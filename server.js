const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

function isImage(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.jpg', '.jpeg', '.png'].includes(ext);
}

// OS native folder selector endpoint
app.get('/api/select-folder', (req, res) => {
    try {
        // Use System Events to make the dialog appear faster and force it to the foreground
        const script = `
            tell application "System Events"
                activate
                set folderPath to POSIX path of (choose folder with prompt "请选择包含活动照片的文件夹")
            end tell
            return folderPath
        `;
        const stdout = execSync(`osascript -e '${script}'`, { encoding: 'utf-8' });
        const folderPath = stdout.trim();
        res.json({ success: true, path: folderPath });
    } catch (error) {
        // execSync throws if exit code is non-zero (e.g. user clicks Cancel)
        res.json({ success: false, reason: '用户取消了选择' });
    }
});

app.get('/api/process', (req, res) => {
    const targetPath = req.query.path;
    const blurThreshold = req.query.blur || 200;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!targetPath || !fs.existsSync(targetPath)) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: '提供的路径不存在或为空' })}\n\n`);
        return res.end();
    }

    try {
        const stats = fs.statSync(targetPath);
        if (!stats.isDirectory()) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: '目标路径不是一个文件夹' })}\n\n`);
            return res.end();
        }
    } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: '无法读取目标路径属性' })}\n\n`);
        return res.end();
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
        res.write(`data: ${JSON.stringify({ type: 'error', message: '创建分类文件夹失败，请检查读写权限' })}\n\n`);
        return res.end();
    }

    let files = [];
    try {
        // Only get files, not directories, and only images
        const allItems = fs.readdirSync(targetPath);
        for (const item of allItems) {
            const itemPath = path.join(targetPath, item);
            if (fs.statSync(itemPath).isFile() && isImage(item)) {
                files.push(item);
            }
        }
    } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: '读取图片列表失败。' })}\n\n`);
        return res.end();
    }

    const total = files.length;
    res.write(`data: ${JSON.stringify({ type: 'start', total })}\n\n`);

    if (total === 0) {
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        return res.end();
    }

    // Process sequentially
    setTimeout(() => {
        let current = 0;
        for (const file of files) {
            current++;
            const filePath = path.join(targetPath, file);

            let result;
            try {
                // Ignore stdout from child process that is not json by executing script and capturing stdout
                // If python script prints warnings, we should parse the last line
                const stdout = execSync(`./venv311/bin/python3 analyzer.py "${filePath}" ${blurThreshold}`, { encoding: 'utf-8', cwd: __dirname });

                // Extract JSON part safely
                const lines = stdout.trim().split('\n');
                const jsonStr = lines[lines.length - 1]; // We expect the last line to be the json

                result = JSON.parse(jsonStr);
            } catch (error) {
                console.error(`处理文件失败: ${filePath}`, error);
                result = { keep: false, reason: "处理图片时分析器崩溃或抛出异常" };
            }

            const keep = result.keep === true;

            if (keep) {
                const destPath = path.join(goodDir, file);
                try {
                    fs.copyFileSync(filePath, destPath);
                } catch (err) {
                    console.error(`复制文件失败: ${file}`, err);
                    result.reason += ' (复制文件时出现文件系统错误)';
                }
            }

            const msg = {
                type: 'progress',
                current,
                fileName: file,
                keep: keep,
                reason: result.reason || ''
            };

            res.write(`data: ${JSON.stringify(msg)}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    }, 0);
});

app.listen(PORT, () => {
    console.log(`Server started. Web interface available at http://localhost:${PORT}`);
});
