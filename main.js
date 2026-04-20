const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Processor = require('./src/modules/processor');
const Epub = require('epub-gen');

let mainWindow;
let isCancelled = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 650,
        height: 850,
        backgroundColor: '#0f172a',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    // 메뉴바 제거 (필요 시)
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, 'src/ui/index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// 파일 추가 처리 (비동기 루프)
ipcMain.on('open-file-dialog', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: '텍스트 파일', extensions: ['txt'] }]
    });

    if (!result.canceled) {
        const fileData = [];
        for (const filePath of result.filePaths) {
            fileData.push({
                filePath: filePath,
                fileName: path.basename(filePath),
                encoding: Processor.detectEncoding(filePath)
            });
            // 10개마다 UI 응답성 확보
            if (fileData.length % 10 === 0) await new Promise(res => setImmediate(res));
        }
        event.reply('selected-files', fileData);
    }
});

// 폴더 추가 처리
ipcMain.on('open-folder-dialog', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'multiSelections']
    });

    if (!result.canceled) {
        let allPaths = [];
        for (const dirPath of result.filePaths) {
            const files = fs.readdirSync(dirPath)
                .filter(f => f.toLowerCase().endsWith('.txt'))
                .map(f => path.join(dirPath, f));
            allPaths.push(...files);
        }

        const uniquePaths = [...new Set(allPaths)];
        const fileData = [];
        for (const filePath of uniquePaths) {
            fileData.push({
                filePath: filePath,
                fileName: path.basename(filePath),
                encoding: Processor.detectEncoding(filePath)
            });
            if (fileData.length % 10 === 0) await new Promise(res => setImmediate(res));
        }
        event.reply('selected-files', fileData);
    }
});

// 저장 경로 선택
ipcMain.on('select-output-folder', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled) {
        event.reply('selected-output-path', result.filePaths[0]);
    }
});

// 중단 신호 수신
ipcMain.on('cancel-conversion', () => {
    isCancelled = true;
});

// 변환 핵심 로직
ipcMain.on('start-conversion', async (event, data) => {
    const { files, removeEmptyLines, outputMode, customPath } = data;
    isCancelled = false;

    for (let i = 0; i < files.length; i++) {
        if (isCancelled) break;

        const file = files[i];
        try {
            event.reply('progress', {
                current: i + 1,
                total: files.length,
                percent: Math.round(((i + 1) / files.length) * 100),
                message: `${file.customTitle} 처리 중...`
            });

            // UI 스레드에 틈을 주어 중단 클릭 감지
            await new Promise(resolve => setTimeout(resolve, 50));

            const rawContent = await Processor.processTextAsync(file.filePath, file.encoding, { removeEmptyLines });

            // 대용량 텍스트 분할 HTML 변환 (프리징 방지)
            const lines = rawContent.split('\n');
            let htmlContent = "";
            for (let j = 0; j < lines.length; j++) {
                if (j % 500 === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                    if (isCancelled) break;
                }
                const line = lines[j].trim();
                if (line.length > 0) {
                    htmlContent += `<p style="text-indent: 1.2em; margin: 0.8em 0; line-height: 1.6;">${line}</p>`;
                }
            }

            if (isCancelled) break;

            const saveDir = (outputMode === 'same') ? path.dirname(file.filePath) : customPath;
            const savePath = path.join(saveDir, `${file.customTitle}.epub`);

            const option = {
                title: file.customTitle,
                author: "EPUB Workshop",
                appendToc: false, // 목차 페이지 생성 안함
                content: [{
                    title: file.customTitle,
                    data: `<html><body>${htmlContent}</body></html>`
                }]
            };

            await new Promise((resolve, reject) => {
                new Epub(option, savePath).promise.then(resolve).catch(reject);
            });

        } catch (err) {
            console.error(`실패: ${file.fileName}`, err);
        }
    }

    event.reply('finished', isCancelled ? '변환이 중단되었습니다.' : '모든 작업이 완료되었습니다!');
});