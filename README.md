# 📚 EPUB STUDIO

**EPUB STUDIO**는 웹 브라우저 환경에서 동작하는 **고성능 웹소설 텍스트(TXT) ➔ 전자책(EPUB) 변환 도구**입니다.
서버 통신 없이 100% 클라이언트 사이드(Client-side)에서 동작하며, 대용량 파일 변환 시에도 끊김 없는 쾌적한 UX를 제공합니다.

## ✨ 주요 기능 (Key Features)

- **스마트 목차 추출 엔진 (Smart TOC Parser)**
  - 대화문이나 본문 내 수치 데이터(예: *7.5퍼센트*, *12 곱하기 8*)를 제목으로 오인하지 않는 하이브리드 검증 알고리즘이 적용되어 있습니다.
  - `1화. 제목`, `제2회`, `Chapter 1`, `#001` 등 대중적인 웹소설 연재 포맷을 자동 감지합니다.
  - 사용자가 직접 커스텀 정규식을 입력하여 추출 규칙을 오버라이드할 수 있습니다.
- **다중 파일 일괄 변환 및 자동 인코딩**
  - 드래그 앤 드롭으로 수십 개의 텍스트 파일을 한 번에 추가할 수 있습니다.
  - `jschardet`를 통해 텍스트 파일의 인코딩(UTF-8, EUC-KR, CP949 등)을 자동 감지하여 한글 깨짐을 방지합니다.
- **ZIP 일괄 다운로드**
  - 변환된 여러 개의 EPUB 파일을 하나의 `.zip` 파일로 묶어서 다운로드할 수 있습니다.

## 🛠️ 기술 아키텍처 (Architecture)

단일 HTML 파일(Single-file Component)의 형태를 띠고 있으나, 내부는 모던 프론트엔드 프레임워크의 핵심 철학을 차용하여 설계되었습니다.

- **Web Worker 기반 비동기 파이프라인 (Non-blocking)**
  - 무거운 텍스트 정규식 매칭과 `JSZip` 바이너리 압축 연산을 Inline Blob Worker로 격리했습니다. 기가바이트급 변환 시에도 메인 UI 스레드가 얼어붙지(Freezing) 않습니다.
- **Flux 패턴 기반 상태 관리 (State Management)**
  - `Store` 클래스를 구축하여 어플리케이션의 모든 상태를 중앙 집중화했습니다. `dispatch`를 통한 단방향 데이터 흐름으로 복잡한 비동기 작업 중에도 상태의 일관성을 유지합니다.
- **선언적 렌더링 & XSS 방어 (Declarative UI)**
  - `innerHTML`을 완전히 배제하고, JSX와 유사한 형태의 커스텀 `el()` DOM 생성 유틸리티를 구현하여 크로스 사이트 스크립팅(XSS) 공격을 원천 차단했습니다.

## 🚀 사용 방법 (How to Use)

1. `index.html` 파일을 최신 웹 브라우저(Chrome, Safari, Edge 등)에서 엽니다.
2. 변환할 텍스트(`.txt`) 파일들을 점선 영역으로 드래그하거나 클릭하여 추가합니다.
3. 목록에서 제목(EPUB의 메타데이터 및 파일명으로 사용됨)을 자유롭게 수정합니다.
4. 상단의 옵션(공백 정제, 목차 자동 추출, ZIP 압축 등)을 확인합니다.
5. **[EPUB 변환 시작]** 버튼을 눌러 작업을 진행합니다.

## ⚙️ Tech Stack
- **UI & Logic:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Compression:** [JSZip](https://stuk.github.io/jszip/)
- **Encoding Detection:** [jschardet](https://github.com/aadsm/jschardet)