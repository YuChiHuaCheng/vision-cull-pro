const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

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
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
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

    const goodDir = path.join(targetPath, `Selected_Good_${timestamp}`);

    try {
        if (!fs.existsSync(goodDir)) fs.mkdirSync(goodDir, { recursive: true });
    } catch (err) {
        event.sender.send('process:update', { type: 'error', message: '创建分类文件夹失败，请检查读写权限' });
        return;
    }

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

            if (keep) {
                const destPath = path.join(goodDir, file);
                try {
                    fs.copyFileSync(filePath, destPath);
                } catch (err) {
                    console.error(`复制文件失败: ${file}`, err);
                    reason += ' (复制文件出错)';
                }
            }

            // Advance the current pointer
            current++;

            event.sender.send('process:update', {
                type: 'progress',
                current,
                fileName: file,
                keep: keep,
                reason: reason
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
