const fs = require('fs').promises;
const fsSync = require('fs');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');

class Processor {
    // 인코딩 감지: 파일의 앞부분 16KB만 읽어 프리징 방지 및 속도 확보
    static detectEncoding(filePath) {
        try {
            const fd = fsSync.openSync(filePath, 'r');
            const buffer = Buffer.alloc(16384);
            fsSync.readSync(fd, buffer, 0, 16384, 0);
            fsSync.closeSync(fd);
            const result = jschardet.detect(buffer);
            // 신뢰도가 낮으면 기본 UTF-8 사용
            return (result && result.confidence > 0.8) ? result.encoding : 'UTF-8';
        } catch (e) {
            return 'UTF-8';
        }
    }

    // 대용량 텍스트 처리를 위한 비동기 정제 로직
    static async processTextAsync(filePath, encoding, options) {
        const buffer = await fs.readFile(filePath);
        let content = iconv.decode(buffer, encoding);

        // 정규식 연산 전 이벤트 루프에 제어권을 넘겨 UI 프리징 방지
        await new Promise(resolve => setImmediate(resolve));

        // 줄바꿈 기호 표준화
        content = content.replace(/\r\n/g, '\n');

        if (options.removeEmptyLines) {
            content = content
                .replace(/[ \t]+$/gm, '')      // 줄 끝의 의미 없는 공백 제거
                .replace(/^\s*[\r\n]/gm, '')   // 내용 없이 엔터만 있는 줄 제거
                .replace(/\n{2,}/g, '\n');     // 연속된 엔터를 하나로 합침
        }

        return content.trim();
    }
}

module.exports = Processor;