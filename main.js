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

    // Process sequentially (could be optimized or parallelized later)
    let current = 0;

    function processNext() {
        if (current >= total) {
            event.sender.send('process:update', { type: 'done' });
            return;
        }

        const file = files[current];
        current++;
        const filePath = path.join(targetPath, file);

        let processArgs;
        if (app.isPackaged) {
            processArgs = [filePath, blurThreshold.toString()];
        } else {
            processArgs = ['analyzer.py', filePath, blurThreshold.toString()];
        }

        const child = spawn(analyzerExecutable, processArgs);

        let stdoutData = '';
        let stderrData = '';

        child.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        child.on('close', (code) => {
            let result;
            try {
                // Parse the last line as JSON
                const lines = stdoutData.trim().split('\n');
                const jsonStr = lines[lines.length - 1];
                result = JSON.parse(jsonStr);
            } catch (error) {
                console.error(`处理文件失败: ${filePath}`);
                console.error('STDOUT:', stdoutData);
                console.error('STDERR:', stderrData);
                result = { keep: false, reason: "分析器输出无法解析或崩溃" };
            }

            const keep = result.keep === true;

            if (keep) {
                const destPath = path.join(goodDir, file);
                try {
                    fs.copyFileSync(filePath, destPath);
                } catch (err) {
                    console.error(`复制文件失败: ${file}`, err);
                    result.reason += ' (复制文件时出现写入错误)';
                }
            }

            event.sender.send('process:update', {
                type: 'progress',
                current,
                fileName: file,
                keep: keep,
                reason: result.reason || ''
            });

            // Process next file after current completes
            processNext();
        });

        child.on('error', (err) => {
            console.error('Failed to start analyzer process:', err);
            event.sender.send('process:update', {
                type: 'progress',
                current,
                fileName: file,
                keep: false,
                reason: "无法启动分析引擎"
            });
            processNext();
        });
    }

    // Start processing queue
    processNext();
});
