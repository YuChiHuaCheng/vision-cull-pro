const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Register the local scheme as privileged (allows loading media safely)
protocol.registerSchemesAsPrivileged([
    { scheme: 'local', privileges: { bypassCSP: true, supportFetchAPI: true, secure: true } }
]);


function isImage(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.jpg', '.jpeg', '.png'].includes(ext);
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        titleBarStyle: 'hiddenInset', // looks good on macOS
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // Security best practices
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('public/index.html');
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    // Handle the custom local:// protocol
    protocol.handle('local', (request) => {
        // Strip out 'local://' from the requested URL
        let filePath = request.url.slice('local://'.length);

        // Handle Windows path oddities from URLs (e.g., local:///C:/...)
        if (process.platform === 'win32' && filePath.startsWith('/')) {
            filePath = filePath.slice(1);
        }

        filePath = decodeURI(filePath);
        return net.fetch('file://' + filePath);
    });

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handler: Select Folder
ipcMain.handle('dialog:openDirectory', async () => {
    // macOS file picker can hang when resolving iCloud/Network directories.
    // Removing defaultPath lets macOS use the last opened path cache which is instant.
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory', 'dontAddToRecent'],
        title: '请选择包含活动照片的文件夹',
        buttonLabel: '选择此文件夹'
    });

    if (canceled) {
        return { success: false, reason: '用户取消了选择' };
    } else {
        return { success: true, path: filePaths[0] };
    }
});

// IPC Handler: Start Processing
ipcMain.on('process:start', (event, targetPath, blurThreshold) => {
    if (!targetPath || !fs.existsSync(targetPath)) {
        event.sender.send('process:update', { type: 'error', message: '提供的路径不存在或为空' });
        return;
    }

    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
        event.sender.send('process:update', { type: 'error', message: '目标路径不是一个文件夹' });
        return;
    }

    const now = new Date();
    const timestamp = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') + '_' +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0');

    let files = [];
    try {
        const allItems = fs.readdirSync(targetPath);
        for (const item of allItems) {
            const itemPath = path.join(targetPath, item);
            if (fs.statSync(itemPath).isFile() && isImage(item)) {
                files.push(item);
            }
        }
    } catch (err) {
        event.sender.send('process:update', { type: 'error', message: '读取图片列表失败。' });
        return;
    }

    const total = files.length;
    event.sender.send('process:update', { type: 'start', total });

    if (total === 0) {
        event.sender.send('process:update', { type: 'done' });
        return;
    }

    // Determine the path to the python analyzer executable
    let analyzerExecutable;
    if (app.isPackaged) {
        // Look for the binary in resources/bin when packaged
        analyzerExecutable = path.join(process.resourcesPath, 'bin', 'analyzer');
    } else {
        // Use python source during development
        analyzerExecutable = path.join(__dirname, 'venv311', 'bin', 'python3');
    }

    // Spawn the persistent analyzer daemon exactly ONCE
    let processArgs;
    if (app.isPackaged) {
        processArgs = [];
    } else {
        processArgs = ['analyzer.py'];
    }

    const child = spawn(analyzerExecutable, processArgs);

    let current = 0;
    let stdoutBuffer = "";

    function processNext() {
        if (current >= total) {
            // Tell the python daemon to shutdown cleanly
            try {
                child.stdin.write("exit\n");
            } catch (e) {
                // Ignore if it's already dead
            }
            event.sender.send('process:update', { type: 'done' });
            return;
        }

        const file = files[current];
        const filePath = path.join(targetPath, file);

        // Send the payload to the Python standard input
        const payload = JSON.stringify({ file: filePath, threshold: blurThreshold });
        child.stdin.write(payload + "\n");
    }

    child.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();

        // Python might print "READY\n" or actual JSON results "\n"
        const lines = stdoutBuffer.split('\n');

        // Keep the last incomplete line in the buffer
        stdoutBuffer = lines.pop();

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed === "READY") {
                // Engine is booted and loaded into memory, start processing
                processNext();
                continue;
            }

            // Must be JSON result for the current file
            const file = files[current];
            const filePath = path.join(targetPath, file);
            let keep = false;
            let reason = "";

            try {
                const result = JSON.parse(trimmed);
                keep = result.keep === true;
                reason = result.reason || "";
            } catch (err) {
                console.error("Failed to parse JSON from Python:", trimmed);
                keep = false;
                reason = "分析器输出异常或解析失败";
            }

            // Advance the current pointer
            current++;

            event.sender.send('process:update', {
                type: 'progress',
                current,
                fileName: file,
                keep: keep,
                reason: reason,
                originalPath: filePath
            });


            // Trigger the next one
            processNext();
        }
    });

    child.stderr.on('data', (data) => {
        console.error("ANALYZER ERROR:", data.toString());
    });

    child.on('error', (err) => {
        console.error('Failed to start analyzer process:', err);
        event.sender.send('process:update', {
            type: 'error',
            message: "无法启动分析引擎"
        });
    });

    child.on('close', (code) => {
        // Only error if we didn't finish processing
        if (current < total) {
            event.sender.send('process:update', {
                type: 'error',
                message: `分析引擎异常退出 (代码 ${code})`
            });
        }
    });
});

// --- V1.2 Action IPC Handlers ---

// 1. Copy Files
ipcMain.handle('action:copyFiles', async (event, sourcePath, fileNames) => {
    try {
        const now = new Date();
        const timestamp = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') + '_' +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0');

        const goodDir = path.join(sourcePath, `01_Selected_Good_${timestamp}`);
        if (!fs.existsSync(goodDir)) {
            fs.mkdirSync(goodDir, { recursive: true });
        }

        for (const file of fileNames) {
            // Security: prevent path traversal via crafted filenames
            const safeName = path.basename(file);
            const src = path.join(sourcePath, safeName);
            const dst = path.join(goodDir, safeName);
            // Double-check dst is still inside goodDir
            if (!dst.startsWith(goodDir + path.sep)) continue;
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, dst);
            }
        }
        return { success: true };
    } catch (error) {
        console.error("Error copying files:", error);
        return { success: false, error: error.message };
    }
});

// 2. Check XMP Conflict
ipcMain.handle('action:checkXmpConflict', async (event, sourcePath, fileNames) => {
    try {
        for (const file of fileNames) {
            // e.g. "IMG_1234.jpg" -> "IMG_1234.xmp"
            const baseName = path.parse(file).name;
            const xmpPath = path.join(sourcePath, `${baseName}.xmp`);
            if (fs.existsSync(xmpPath)) {
                return { conflict: true };
            }
        }
        return { conflict: false };
    } catch (error) {
        console.error("Error checking xmp conflict:", error);
        return { conflict: false }; // Fail silently and assume no conflict on error
    }
});

// 3. Create XMP
ipcMain.handle('action:createXmp', async (event, sourcePath, results, overwrite) => {
    try {
        for (const res of results) {
            // Security: strip any directory components from filename
            const safeName = path.basename(res.fileName);
            const baseName = path.parse(safeName).name;
            const xmpPath = path.join(sourcePath, `${baseName}.xmp`);

            // Double-check xmpPath stays inside sourcePath
            if (!xmpPath.startsWith(sourcePath + path.sep)) continue;

            if (!overwrite && fs.existsSync(xmpPath)) {
                continue;
            }

            const rating = res.keep ? 5 : 1;
            const colorLabel = res.keep ? 'Green' : 'Red';

            const xmpContent = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0-c000 1.000000, 0000/00/00-00:00:00        ">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <xmp:Rating>${rating}</xmp:Rating>
   <xmp:Label>${colorLabel}</xmp:Label>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

            fs.writeFileSync(xmpPath, xmpContent, 'utf8');
        }
        return { success: true };
    } catch (error) {
        console.error("Error creating XMP:", error);
        return { success: false, error: error.message };
    }
});

// 4. Analytics Track
ipcMain.on('analytics:track', (event, payload) => {
    try {
        const appDataPath = app.getPath('userData');
        const logPath = path.join(appDataPath, 'analytics.log');
        // Bug fix: was '\\n' (literal backslash-n), entries were concatenated
        const logEntry = JSON.stringify(payload) + '\n';
        fs.appendFileSync(logPath, logEntry, 'utf8');
    } catch (err) {
        console.error("Analytics writing error:", err);
    }
});
