# 📚 EPUB STUDIO

**EPUB STUDIO**는 웹 브라우저 환경에서 동작하는 **고성능 웹소설 텍스트(TXT) ➔ 전자책(EPUB) 일괄 변환 도구**입니다.
서버 통신 없이 100% 클라이언트 사이드(Client-side)에서 동작하며, 기가바이트급 파일 변환 시에도 끊김 없는 쾌적한 환경을 제공합니다.

## ✨ 주요 기능 (Key Features)

- **스마트 목차 추출 엔진 (Smart TOC Parser)**
  - 대화문이나 본문 내 수치 데이터(예: *7.5퍼센트*, *12x8*)를 제목으로 오인하지 않는 하이브리드 검증 알고리즘이 적용되어 있습니다.
  - 위아래 줄의 여백을 분석하여 진짜 제목(화/회)과 본문을 완벽하게 구분합니다.
- **스마트 공백 정제 (Smart Whitespace Trimming)**
  - 작가가 의도한 '장면 전환용 1줄 여백'과 '문단 들여쓰기'는 보존하면서, 실수로 들어간 무의미한 빈 줄 폭격(엔터 남발)만 지능적으로 압축하여 최적의 가독성을 보장합니다.
- **클립보드 원클릭 표지 생성 (Clipboard Cover Injection)**
  - 도서명 구글 검색 버튼을 제공하며, 복사한 이미지(바이너리 또는 URL)를 [클립보드] 버튼 클릭 한 번으로 EPUB 표지에 즉시 주입합니다.
- **다중 파일 일괄 변환 및 자동 인코딩**
  - 드래그 앤 드롭으로 수십 개의 텍스트 파일을 추가하고, `jschardet`를 통해 인코딩(UTF-8, CP949 등)을 자동 감지합니다.
  - 파일명에 포함된 `+` 기호(URL 인코딩 잔재)를 자동으로 띄어쓰기로 변환합니다.

## 🛠️ 기술 아키텍처 (Architecture)

단일 HTML 파일(Single-file Component)이지만, 모던 프론트엔드 프레임워크의 핵심 철학을 차용하여 설계되었습니다.

- **Transferable Web Worker 비동기 파이프라인**
  - 무거운 파싱과 `JSZip` 압축 연산을 백그라운드로 격리하여 UI 블로킹을 없앴습니다.
  - 대용량 표지 및 파일 데이터를 메인 스레드와 워커 간에 넘길 때 메모리 복사가 일어나지 않도록 `ArrayBuffer` 전송 방식을 채택하여 OOM(Out of Memory)과 멈춤 현상을 원천 차단했습니다.
- **Flux 패턴 기반 상태 관리 (State Management)**
  - `Store` 클래스를 구축하여 앱의 모든 상태를 중앙 집중화하고 `dispatch`를 통한 단방향 데이터 흐름을 구현했습니다.
- **선언적 렌더링 & XSS 방어 (Declarative UI)**
  - `innerHTML`을 배제하고 JSX와 유사한 형태의 커스텀 `el()` DOM 팩토리 함수를 구현하여 크로스 사이트 스크립팅(XSS) 공격을 완벽히 차단했습니다.

## 🚀 사용 방법 (How to Use)

1. `index.html` 파일을 최신 웹 브라우저에서 실행합니다.
2. 텍스트(`.txt`) 파일들을 드래그 앤 드롭하여 목록에 추가합니다.
3. (선택) [검색] 버튼을 눌러 이미지를 찾은 뒤 복사하고, [클립보드] 버튼을 눌러 표지를 등록합니다.
4. 옵션(공백 정제, 목차 추출, ZIP 압축 등)을 확인합니다.
5. **[EPUB 변환 시작]** 버튼을 눌러 작업을 진행합니다.

## ⚙️ Tech Stack
- **Core:** HTML5, CSS3, Vanilla JavaScript (ES6+), Web Workers API, FileReader & Clipboard API
- **Compression:** [JSZip](https://stuk.github.io/jszip/)
- **Encoding Detection:** [jschardet](https://github.com/aadsm/jschardet)