# 📚 EPUB STUDIO

브라우저 내에서 텍스트(.txt) 파일을 전자책 표준 포맷인 .epub으로 변환해주는 배치 변환 도구입니다.

## ✨ 주요 기능
* **일괄 변환**: 여러 개의 텍스트 파일을 한 번에 처리.
* **자동 인코딩 감지**: `jschardet`를 이용해 한글 깨짐 방지.
* **압축 다운로드**: 변환 완료 후 ZIP 파일로 일괄 저장.
* **중복 방지**: 동일 파일 추가 차단 및 완료 항목 제거 기능.
* **클라이언트 사이드**: 서버에 데이터를 전송하지 않아 개인정보 유출 걱정 없음.

## 🛠 사용 기술
* HTML5 / CSS3 (Modern Dark UI)
* JavaScript (Vanilla JS)
* [JSZip](https://stuk.github.io/jszip/) - 파일 압축 및 EPUB 생성
* [jschardet](https://github.com/aadsm/jschardet) - 문자 인코딩 감지