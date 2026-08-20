(() => {
    const STORAGE_KEY = 'epub-studio-lang';
    const PAGE = (() => {
        const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        if (file === 'about.html') return 'about';
        if (file === 'privacy.html') return 'privacy';
        if (file === 'contact.html') return 'contact';
        return 'index';
    })();
    const PUBLIC_ORIGIN = 'https://epub-studio-mocha.vercel.app';
    const PUBLIC_PATHS = {
        index: '/',
        about: '/about.html',
        privacy: '/privacy.html',
        contact: '/contact.html'
    };

    const TEXT = {
        ko: {
            common: {
                brandSubtitle: '브라우저에서 TXT를 EPUB으로 바꾸는 도구',
                navTool: '변환 도구',
                navFeatures: '기능 소개',
                navAbout: '사이트 소개',
                navPrivacy: '개인정보처리방침',
                navContact: '문의',
                langKo: '한국어',
                langEn: 'English',
                langSwitcherLabel: '언어 전환',
                navLabel: '페이지 섹션',
                copyright: '© 2026 EPUB STUDIO.'
            },
                index: {
                    head: {
                        title: 'EPUB STUDIO | TXT를 EPUB으로 변환하는 브라우저 기반 도구',
                    description: 'EPUB STUDIO는 TXT 파일을 브라우저에서 EPUB으로 바꾸는 도구입니다. 공백 정리, 목차 추출, 표지 적용, 인코딩 자동 감지, ZIP 압축을 브라우저 안에서 처리합니다.',
                    ogTitle: 'EPUB STUDIO | TXT를 EPUB으로 변환하는 브라우저 기반 도구',
                    ogDescription: '브라우저 안에서 TXT 파일을 EPUB으로 바꾸는 도구입니다. 공백 정리, 목차 추출, 표지 적용, 인코딩 자동 감지, ZIP 압축을 쓸 수 있습니다.',
                    twitterTitle: 'EPUB STUDIO | TXT를 EPUB으로 변환하는 브라우저 기반 도구',
                    twitterDescription: '브라우저에서 TXT 파일을 EPUB으로 바꾸고, 공백 정리와 목차 추출을 한 번에 처리합니다.'
                },
                heroKicker: '브라우저에서 바로 쓰는 EPUB 도구',
                heroTitle: 'TXT 파일을 브라우저에서 EPUB으로 바꿉니다',
                heroDesc: '공백 정리, 목차 추출, 표지 적용, 인코딩 자동 감지, ZIP 묶음 출력까지 모두 브라우저에서 처리합니다.',
                optTrim: '공백 정제',
                optToc: '목차 추출',
                optMultiToc: '다중 패턴 허용',
                optMultiTocTitle: "체크하면 '몇 화'와 '070'처럼 형식이 다른 챕터 표기가 섞여 있어도 함께 목차로 잡습니다.",
                optZip: 'ZIP 일괄 압축',
                advancedToggle: '고급 설정',
                regexLabel: '목차 추출 커스텀 정규식',
                testLabel: '파서 시뮬레이터 (엔진 테스트)',
                testButton: '테스트 실행',
                testOutput: '감지할 제목을 넣으면 여기서 바로 확인할 수 있습니다.',
                convertStart: 'EPUB 변환 시작',
                convertStop: '중단',
                statusLabel: '현재 상태',
                statusIdle: '대기 중',
                statusIdleDetail: 'TXT 파일을 추가하면 변환을 시작할 수 있습니다.',
                statusProcessing: '변환 중',
                statusDone: '완료',
                statusStopped: '중단됨',
                statusReady: '준비 완료',
                statusProgress: '{done}/{total} 완료',
                statusSummary: '{done}개 완료 · {error}개 오류',
                statusSummaryWait: '{done}개 완료 · {error}개 오류 · {wait}개 대기',
                previewTitle: '목차 미리보기',
                previewMeta: '파일을 고르면 감지된 제목 후보를 보여줍니다.',
                previewMulti: '다중 패턴',
                previewToggleTitle: '다중 패턴을 바로 바꿔서 미리보기를 다시 계산합니다.',
                previewCopy: '복사',
                previewClose: '닫기',
                previewExclude: '제외',
                previewRestore: '복구',
                previewEmpty: '아직 미리보기 결과가 없습니다. 파일 목록에서 목차 미리보기를 눌러보세요.',
                previewNoResult: '목차 후보가 아직 잡히지 않았습니다. 지금 설정으로는 제목으로 보는 줄이 없습니다.',
                previewScanning: '지금 설정으로 목차 후보를 찾는 중입니다.',
                previewCount: '총 {count}개 감지됨',
                previewExcludedCount: '{count}개 제외됨',
                previewFallbackFound: '다른 형식의 목차 후보 {count}개를 찾았습니다.',
                previewFallbackCount: '다른 형식 {count}개',
                previewFallbackTitle: '다른 형식의 목차 후보',
                previewFallbackSample: '같은 형식 {count}개 · 예: {sample}',
                previewFallbackAdd: '목차에 추가',
                previewFallbackRemove: '후보 선택 해제',
                previewLoading: '분석 중...',
                previewError: '파일을 읽는 동안 문제가 생겼습니다. 인코딩이나 브라우저 권한을 확인해 보세요.',
                copyFail: '선택한 줄을 복사하지 못했습니다.',
                dropEmpty: '텍스트 파일을 드래그하거나 클릭해서 추가하세요',
                tableTitle: '제목',
                tableCover: '표지 설정',
                tableEncoding: '인코딩',
                tableDetect: '감지',
                tableState: '상태',
                tablePreview: '미리보기',
                tableConvertOne: '변환',
                tableConvertOneTitle: '이 파일만 EPUB으로 변환',
                tableSearch: '검색',
                tableClipboard: '클립보드',
                featureKicker: '기능 소개',
                featureTitle: '지금 들어 있는 기능만 추려 적었습니다',
                featureDesc: '지금 구현된 기능만 짧게 적었습니다.',
                featureCards: [
                    ['TXT에서 EPUB으로 변환', '여러 파일을 한꺼번에 처리하거나 목록에서 필요한 파일 하나만 EPUB으로 만들 수 있습니다.'],
                    ['공백 정제', '불필요한 연속 빈 줄은 줄이고, 문단 사이의 여백은 너무 과하게 건드리지 않습니다.'],
                    ['목차 추출', '번호가 순서대로 이어지는 제목을 찾고, 파일명에 1-200 같은 범위가 있으면 패턴 선택에 참고합니다.'],
                    ['목차 미리보기', '자동 감지된 목차를 확인하고 필요 없는 줄은 뺄 수 있습니다. 다중 패턴에서는 자동 감지와 다른 형식도 별도 후보로 확인해 추가할 수 있습니다.'],
                    ['표지 적용', '제목을 검색하거나 클립보드의 이미지 URL과 이미지를 바로 붙일 수 있습니다.'],
                    ['인코딩 자동 감지', 'UTF-8, CP949 같은 흔한 인코딩을 자동으로 읽어들여 깨짐을 줄입니다.'],
                    ['ZIP 일괄 압축', '여러 EPUB 결과물을 한 번에 ZIP으로 묶어 받을 수 있습니다.']
                ],
                storyKicker: '작동 방식',
                storyTitle: '파일은 브라우저 안에서 움직입니다',
                storyDesc: 'TXT를 읽고 목차를 찾고 EPUB을 만드는 기본 흐름은 서버 업로드 없이 현재 브라우저에서 처리합니다.',
                workflowLabel: 'EPUB 변환 과정',
                workflowSteps: [
                    ['파일을 직접 읽습니다', 'UTF-8, CP949, UTF-16 계열을 확인해 원문이 깨지지 않도록 읽습니다.'],
                    ['제목 흐름을 분석합니다', '이어지는 번호와 반복되는 형식을 비교해 목차 후보를 만들고 미리보기에서 바로 다듬습니다.'],
                    ['읽기 좋은 단위로 묶습니다', '긴 본문은 안전한 크기로 나누고 표지와 목차를 포함한 EPUB 파일로 내려받습니다.']
                ],
                privacyKicker: '개인정보처리방침',
                privacyTitle: '파일과 데이터 처리 방식을 안내합니다',
                privacyDesc: '기본 변환은 사용자의 브라우저에서 진행되며 원문 파일을 서버에 저장하지 않습니다.',
                contactKicker: '문의',
                contactTitle: '이상한 제목 패턴을 발견했나요',
                contactDesc: '감지되지 않는 제목 형식이나 변환 중 생긴 문제를 파일 예시와 함께 보내주세요.',
                contactEmail: '이메일로 문의하기',
                footerCopy: '© 2026 EPUB STUDIO. TXT를 EPUB으로 바꾸는 브라우저 도구입니다.',
                fileState: {
                    wait: '대기',
                    ing: '진행',
                    done: '완료',
                    error: '오류'
                },
                statusDetail: {
                    stopped: '중단 요청을 처리하는 중입니다.'
                },
                clipboard: {
                    reading: '클립보드 내용을 확인하는 중...',
                    imageApplied: '클립보드 이미지 적용 완료',
                    downloading: '이미지 다운로드 중...',
                    cached: '원격 이미지 저장 완료',
                    unsupported: '지원하지 않는 이미지 형식입니다. JPG, PNG, GIF 또는 SVG를 사용해 주세요.',
                    invalid: '클립보드에 쓸 만한 이미지나 주소가 없습니다.',
                    fail: '클립보드를 읽지 못했습니다. 브라우저 권한이나 CORS 제한을 확인해 주세요.'
                },
                test: {
                    noInput: '테스트할 텍스트를 입력해 주세요.',
                    analyzing: '분석 중...',
                    noResults: '감지된 제목이 없습니다. 모두 본문으로 봤습니다.',
                    resultCount: '총 {count}개 감지됨:',
                    parserError: '파서 오류: {error}',
                    engineError: '엔진 오류: 정규식 문법이나 스크립트 에러({error})'
                }
            },
            about: {
                head: {
                    title: '사이트 소개 | EPUB STUDIO',
                    description: 'EPUB STUDIO는 TXT 파일을 브라우저에서 EPUB으로 바꾸는 웹 도구입니다. 로컬에서 바로 처리하고, 목차 추출, 공백 정리, 표지 적용, 인코딩 감지도 지원합니다.',
                    ogTitle: '사이트 소개 | EPUB STUDIO',
                    ogDescription: 'EPUB STUDIO는 브라우저에서 TXT 파일을 EPUB으로 바꾸는 웹 도구입니다.',
                    twitterTitle: '사이트 소개 | EPUB STUDIO',
                    twitterDescription: 'EPUB STUDIO는 TXT 파일을 브라우저에서 EPUB으로 바꾸는 웹 도구입니다.'
                },
                kicker: '사이트 소개',
                title: 'EPUB STUDIO는 TXT로 만든 전자책 작업을 돕는 웹 도구입니다',
                intro: '이 사이트는 웹소설이나 일반 텍스트 파일을 EPUB으로 바꾸는 데 필요한 기능을 한 화면에 모아 둔 도구입니다. 변환은 기본적으로 브라우저에서 진행되고, 표지 검색이나 클립보드 접근 같은 동작은 사용자가 직접 눌렀을 때만 실행됩니다.',
                cards: [
                    ['무엇을 제공하나요', 'TXT 파일을 한꺼번에 EPUB으로 바꾸고, 공백 정리, 목차 추출, 표지 적용, 인코딩 감지, ZIP 압축까지 한 번에 처리합니다.'],
                    ['어떤 방식으로 동작하나요', '변환 로직은 Web Worker에서 돌고, 파일 본문은 브라우저가 직접 읽습니다. 기본 흐름은 서버 업로드를 쓰지 않습니다.'],
                    ['왜 별도 페이지가 있나요', '도구 화면과 설명 페이지를 나눠 두면 필요한 정보를 더 빨리 찾을 수 있습니다.']
                ]
            },
            privacy: {
                head: {
                    title: '개인정보처리방침 | EPUB STUDIO',
                    description: 'EPUB STUDIO의 개인정보처리방침입니다. 파일 처리 방식, 외부 요청, 보관, 문의 방법을 안내합니다.',
                    ogTitle: '개인정보처리방침 | EPUB STUDIO',
                    ogDescription: 'EPUB STUDIO의 개인정보처리방침입니다.',
                    twitterTitle: '개인정보처리방침 | EPUB STUDIO',
                    twitterDescription: 'EPUB STUDIO의 개인정보처리방침입니다.'
                },
                kicker: '개인정보처리방침',
                title: '개인정보처리방침',
                intro: 'EPUB STUDIO는 브라우저에서 TXT 파일을 EPUB으로 바꾸는 도구입니다. 기본 변환 과정은 사용자의 기기에서 돌아가고, 파일 본문을 서버로 보내지 않는 것을 원칙으로 합니다.',
                sections: [
                    '이 사이트는 회원가입 없이 사용할 수 있고, 운영자가 따로 계정을 만들거나 프로필 정보를 모으는 구조도 아닙니다. 사용자가 넣는 파일명, 제목, 정규식, 클립보드 이미지, 이미지 URL은 변환에 필요한 범위에서만 브라우저 안에서 씁니다.',
                    'TXT 파일 내용은 브라우저가 직접 읽고, Web Worker에서 변환합니다. 기본 동작은 로컬에서 처리하며, 서버 업로드는 하지 않습니다. 다만 브라우저가 외부 서비스에 요청을 보내는 기능은 있을 수 있습니다.',
                    'JSZip과 jschardet는 cdnjs CDN에서 불러오고, 표지 검색과 클립보드 기능, 그리고 AdSense 광고 스크립트를 불러올 때 브라우저가 외부 요청을 보낼 수 있습니다. 이런 요청은 각 서비스와 브라우저 권한 설정에 따라 달라질 수 있습니다.',
                    '지금 구조에서는 원문 파일을 서버에 저장하지 않고, 브라우저 밖으로 오래 보관하는 방식도 쓰지 않습니다. 브라우저를 닫거나 새로고침하면 로컬 상태는 초기화될 수 있습니다.',
                    '개인정보 처리와 관련해 궁금한 점이 있으면 아래 문의처로 연락해 주세요.'
                ],
                headings: [
                    '1. 수집하는 정보',
                    '2. 파일 처리 방식',
                    '3. 외부 서비스',
                    '4. 보관 및 파기',
                    '5. 문의'
                ],
                bullets: [
                    'JSZip과 jschardet는 cdnjs CDN에서 불러옵니다.',
                    '표지 검색 버튼을 누르면 Google 이미지 검색이 열릴 수 있습니다.',
                    '클립보드 버튼을 누르면 브라우저 권한을 통해 이미지나 텍스트 URL을 읽습니다.'
                ]
            },
            contact: {
                head: {
                    title: '문의 | EPUB STUDIO',
                    description: 'EPUB STUDIO 운영자 문의 페이지입니다. 정책 문의, 서비스 제안, 오류 제보를 보낼 수 있습니다.',
                    ogTitle: '문의 | EPUB STUDIO',
                    ogDescription: 'EPUB STUDIO 운영자 문의 페이지입니다.',
                    twitterTitle: '문의 | EPUB STUDIO',
                    twitterDescription: 'EPUB STUDIO 운영자 문의 페이지입니다.'
                },
                kicker: '문의',
                title: '운영자 연락처',
                intro: '정책 문의, 서비스 제안, 오류 제보는 아래 연락처로 보내 주세요. 운영 방식이 바뀌면 이 부분만 바꾸면 됩니다.',
                cards: [
                    ['운영자 이메일', '이메일로 문의하기'],
                    ['답변 범위', '서비스 오류, 정책 문의, 기능 제안, 제휴 문의를 받습니다.'],
                    ['운영 안내', '이 사이트는 변환 도구와 안내 페이지를 함께 두는 구조로 되어 있습니다.']
                ]
            }
        },
        en: {
            common: {
                brandSubtitle: 'A browser-based TXT to EPUB tool',
                navTool: 'Converter',
                navFeatures: 'Features',
                navAbout: 'About',
                navPrivacy: 'Privacy',
                navContact: 'Contact',
                langKo: 'Korean',
                langEn: 'English',
                langSwitcherLabel: 'Language switcher',
                navLabel: 'Page sections',
                copyright: '© 2026 EPUB STUDIO.'
            },
            index: {
                head: {
                    title: 'EPUB STUDIO | Browser-based TXT to EPUB converter',
                    description: 'EPUB STUDIO batch converts TXT files to EPUB in the browser. It handles whitespace cleanup, table of contents extraction, cover application, automatic encoding detection, and ZIP packaging locally.',
                    ogTitle: 'EPUB STUDIO | Browser-based TXT to EPUB converter',
                    ogDescription: 'Convert TXT files to EPUB right in the browser. Supports whitespace cleanup, table of contents extraction, cover application, automatic encoding detection, and ZIP packaging.',
                    twitterTitle: 'EPUB STUDIO | Browser-based TXT to EPUB converter',
                    twitterDescription: 'Convert TXT files to EPUB in the browser and handle whitespace cleanup and table of contents extraction in one pass.'
                },
                heroKicker: 'A browser-native EPUB converter',
                heroTitle: 'Convert TXT files to EPUB in your local browser',
                heroDesc: 'Whitespace cleanup, table of contents extraction, cover application, automatic encoding detection, and ZIP output all run inside the browser.',
                optTrim: 'Trim whitespace',
                optToc: 'Extract TOC',
                optMultiToc: 'Allow multi-patterns',
                optMultiTocTitle: 'Include different chapter formats, such as numbered episodes and 070-style headings, in the same table of contents.',
                optZip: 'Batch ZIP',
                advancedToggle: 'Advanced settings',
                regexLabel: 'Custom regex for TOC extraction',
                testLabel: 'Parser simulator (engine test)',
                testButton: 'Run test',
                testOutput: 'Enter a title candidate and it will appear here. (Priority engine active)',
                convertStart: 'Start EPUB conversion',
                convertStop: 'Stop',
                statusLabel: 'Current status',
                statusIdle: 'Ready',
                statusIdleDetail: 'Add TXT files to start converting.',
                statusProcessing: 'Processing',
                statusDone: 'Done',
                statusStopped: 'Stopped',
                statusReady: 'Ready',
                statusProgress: '{done}/{total} done',
                statusSummary: '{done} done · {error} errors',
                statusSummaryWait: '{done} done · {error} errors · {wait} waiting',
                previewTitle: 'TOC preview',
                previewMeta: 'Select a file to see detected title candidates.',
                previewMulti: 'Multi-pattern',
                previewToggleTitle: 'Switch multi-pattern mode and recalculate the preview right away.',
                previewCopy: 'Copy',
                previewClose: 'Close',
                previewExclude: 'Exclude',
                previewRestore: 'Restore',
                previewEmpty: 'No preview results yet. Click "TOC preview" in the file list.',
                previewNoResult: 'No TOC candidate was detected with the current settings.',
                previewScanning: 'Searching for TOC candidates with the current settings.',
                previewCount: 'Detected {count} items',
                previewExcludedCount: '{count} excluded',
                previewFallbackFound: 'Found {count} lines in another TOC pattern.',
                previewFallbackCount: 'Alternative pattern: {count}',
                previewFallbackTitle: 'Alternative TOC pattern',
                previewFallbackSample: '{count} matching lines · Example: {sample}',
                previewFallbackAdd: 'Add to TOC',
                previewFallbackRemove: 'Remove candidate',
                previewLoading: 'Analyzing...',
                previewError: 'There was a problem reading the file. Check encoding or browser permissions.',
                copyFail: 'Failed to copy the selected row.',
                dropEmpty: 'Drag TXT files here or click to add them',
                tableTitle: 'Title',
                tableCover: 'Cover',
                tableEncoding: 'Encoding',
                tableDetect: 'Detect',
                tableState: 'Status',
                tablePreview: 'Preview',
                tableConvertOne: 'Convert',
                tableConvertOneTitle: 'Convert only this file to EPUB',
                tableSearch: 'Search',
                tableClipboard: 'Clipboard',
                featureKicker: 'Features',
                featureTitle: 'A quick summary of what is included',
                featureDesc: 'Only the features currently implemented are listed here.',
                featureCards: [
                    ['TXT to EPUB conversion', 'Convert every added file together or create an EPUB from just one selected row.'],
                    ['Whitespace cleanup', 'Reduce meaningless empty lines while keeping the spacing needed for paragraph breaks.'],
                    ['Table of contents extraction', 'Detect sequential numbered headings and use filename ranges such as 1-200 when choosing a title pattern.'],
                    ['TOC preview', 'Review detected chapters and exclude unwanted rows. Multi-pattern mode can also add trailing parenthesized-number formats as candidates.'],
                    ['Cover application', 'Search for a cover image or apply an image URL or clipboard image right away.'],
                    ['Automatic encoding detection', 'Automatically detects common encodings such as UTF-8 and CP949 to reduce read failures.'],
                    ['Batch ZIP packaging', 'Bundle multiple EPUB outputs into a single ZIP file for download.']
                ],
                storyKicker: 'How it works',
                storyTitle: 'Your file stays in the browser workflow',
                storyDesc: 'Reading TXT, finding chapters, and building the EPUB all happen in the current browser without a server upload.',
                workflowLabel: 'EPUB conversion process',
                workflowSteps: [
                    ['Read the file directly', 'Check UTF-8, CP949, and UTF-16 variants so the original text can be read without corruption.'],
                    ['Analyze the title flow', 'Compare sequential numbers and repeated formats, then refine the detected TOC in preview.'],
                    ['Package readable sections', 'Split long text into safe sections and download an EPUB with its cover and table of contents.']
                ],
                privacyKicker: 'Privacy Policy',
                privacyTitle: 'How your files and data are handled',
                privacyDesc: 'Conversion runs in your browser by default, and the original text file is not stored on a server.',
                contactKicker: 'Contact',
                contactTitle: 'Found an unusual title pattern?',
                contactDesc: 'Send an example when a title format is missed or a conversion behaves unexpectedly.',
                contactEmail: 'Send an email',
                footerCopy: '© 2026 EPUB STUDIO. A browser-based TXT to EPUB tool.',
                fileState: {
                    wait: 'Ready',
                    ing: 'Working',
                    done: 'Done',
                    error: 'Error'
                },
                statusDetail: {
                    stopped: 'Applying the stop request.'
                },
                clipboard: {
                    reading: 'Reading clipboard...',
                    imageApplied: 'Clipboard image applied',
                    downloading: 'Downloading image...',
                    cached: 'Image cached from clipboard',
                    unsupported: 'Unsupported image format. Use JPG, PNG, GIF, or SVG.',
                    invalid: 'No valid image or URL was found in the clipboard.',
                    fail: 'Unable to read the clipboard. Check browser permissions or a CORS-limited URL.'
                },
                test: {
                    noInput: 'Please enter text to test.',
                    analyzing: 'Analyzing engine...',
                    noResults: 'No title candidates were detected. (All lines were treated as body text)',
                    resultCount: 'Detected {count} items:',
                    parserError: 'Parser error: {error}',
                    engineError: 'Engine fatal error: regex syntax or script error ({error})'
                }
            },
            about: {
                head: {
                    title: 'About | EPUB STUDIO',
                    description: 'EPUB STUDIO is a web tool for converting TXT files to EPUB in the browser. It supports local processing, TOC extraction, whitespace cleanup, cover application, and encoding detection.',
                    ogTitle: 'About | EPUB STUDIO',
                    ogDescription: 'EPUB STUDIO is a browser-based TXT to EPUB conversion tool.',
                    twitterTitle: 'About | EPUB STUDIO',
                    twitterDescription: 'EPUB STUDIO is a browser-based TXT to EPUB conversion tool.'
                },
                kicker: 'About',
                title: 'EPUB STUDIO helps with TXT-based ebook conversion work',
                intro: 'This site brings the core steps needed to turn web novels or general text files into EPUB into one screen. Conversion runs in the browser by default, and extra actions such as cover search or clipboard access only happen when the user triggers them.',
                cards: [
                    ['What does it provide?', 'Batch TXT conversion, whitespace cleanup, TOC extraction, cover application, encoding detection, and ZIP packaging.'],
                    ['How does it work?', 'The conversion logic runs in a Web Worker, and the file content is read directly by the browser. The default flow does not assume server uploads.'],
                    ['Why have a separate page?', 'Separating the tool screen from the explanation pages makes the site easier to read and maintain.']
                ]
            },
            privacy: {
                head: {
                    title: 'Privacy Policy | EPUB STUDIO',
                    description: 'Privacy policy for EPUB STUDIO. This page explains file handling, external requests, retention, and how to contact us.',
                    ogTitle: 'Privacy Policy | EPUB STUDIO',
                    ogDescription: 'Privacy policy for EPUB STUDIO.',
                    twitterTitle: 'Privacy Policy | EPUB STUDIO',
                    twitterDescription: 'Privacy policy for EPUB STUDIO.'
                },
                kicker: 'Privacy Policy',
                title: 'Privacy Policy',
                intro: 'EPUB STUDIO is a browser-based tool for converting TXT files to EPUB. The default conversion flow runs on your device, and the original file contents are not sent to a server.',
                sections: [
                    'The site does not require sign-up and does not create user accounts or collect profile information. File names, titles, custom regex values, clipboard images, or image URLs are only used inside the browser for conversion features.',
                    'TXT contents are read directly by the browser and converted through a Web Worker. In other words, the default behavior is local processing and does not assume server uploads. Some external requests may still occur when the browser uses third-party services.',
                    'JSZip and jschardet are loaded from the cdnjs CDN. Cover search and clipboard-related features, as well as AdSense scripts, may cause the browser to send external requests. Those requests are subject to the service and browser permission settings.',
                    'The current structure does not store the original file on a server and does not keep long-term storage outside the browser by default. Closing the browser or refreshing the page can reset local state.',
                    'For privacy-related questions, please contact the address below.'
                ],
                headings: [
                    '1. Information collected',
                    '2. File handling',
                    '3. External services',
                    '4. Retention and deletion',
                    '5. Contact'
                ],
                bullets: [
                    'JSZip and jschardet are loaded from the cdnjs CDN.',
                    'The cover search button may open Google Images.',
                    'The clipboard button reads images or image URLs with browser permission.'
                ]
            },
            contact: {
                head: {
                    title: 'Contact | EPUB STUDIO',
                    description: 'Contact page for the EPUB STUDIO operator. You can reach out for policy questions, service suggestions, and bug reports.',
                    ogTitle: 'Contact | EPUB STUDIO',
                    ogDescription: 'Contact page for the EPUB STUDIO operator.',
                    twitterTitle: 'Contact | EPUB STUDIO',
                    twitterDescription: 'Contact page for the EPUB STUDIO operator.'
                },
                kicker: 'Contact',
                title: 'Operator contact',
                intro: 'Send policy questions, service ideas, or bug reports to the contact below. If the operating contact changes later, only this section needs to be updated.',
                cards: [
                    ['Operator email', 'Send an email'],
                    ['Response scope', 'Service issues, policy-related questions, feature suggestions, and partnership inquiries.'],
                    ['Operation note', 'This site provides the guide pages alongside the single-page conversion tool.']
                ]
            }
        }
    };

    const current = {
        lang: 'ko'
    };

    function normalizeLang(input) {
        if (!input) return null;
        const value = String(input).toLowerCase();
        if (value.startsWith('ko')) return 'ko';
        if (value.startsWith('en')) return 'en';
        return null;
    }

    function detectLanguage() {
        const url = new URL(location.href);
        const query = normalizeLang(url.searchParams.get('lang'));
        if (query) return query;

        try {
            const saved = normalizeLang(localStorage.getItem(STORAGE_KEY));
            if (saved) return saved;
        } catch (_) {}

        const preferred = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
        if (preferred.some((lang) => normalizeLang(lang) === 'ko')) return 'ko';

        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz === 'Asia/Seoul') return 'ko';
        } catch (_) {}

        return 'en';
    }

    function getString(key, lang = current.lang, vars = {}) {
        const page = TEXT[lang]?.[PAGE] || {};
        const common = TEXT[lang]?.common || {};
        const resolve = (source, path) => String(path).split('.').reduce((acc, part) => {
            if (!acc || typeof acc !== 'object') return undefined;
            return acc[part];
        }, source);
        const template = resolve(page, key) ?? resolve(common, key) ?? key;
        return String(template).replace(/\{(\w+)\}/g, (_, name) => {
            return vars[name] ?? '';
        });
    }

    function setText(selector, key, vars) {
        const el = document.querySelector(selector);
        if (el) el.textContent = getString(key, current.lang, vars);
    }

    function setNthText(selector, index, key, vars) {
        const el = document.querySelectorAll(selector)[index];
        if (el) el.textContent = getString(key, current.lang, vars);
    }

    function setOrdered(selector, keys) {
        const nodes = document.querySelectorAll(selector);
        keys.forEach((key, index) => {
            if (!nodes[index]) return;
            nodes[index].textContent = getString(key);
        });
    }

    function setLabel(inputId, key) {
        const input = document.getElementById(inputId);
        const label = input?.closest('label');
        if (!label) return;
        const inlineLabel = label.querySelector('span');
        if (inlineLabel && inlineLabel !== input) {
            inlineLabel.textContent = getString(key);
            return;
        }
        const textNode = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
        const nextText = ` ${getString(key)}`;
        if (textNode) {
            textNode.nodeValue = nextText;
            return;
        }
        label.appendChild(document.createTextNode(nextText));
    }

    function setButton(id, key, vars = {}) {
        const el = document.getElementById(id);
        if (!el) return;
        const arrow = el.querySelector('.arrow');
        if (arrow) {
            const textNode = Array.from(el.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
            const nextText = `${getString(key, current.lang, vars)} `;
            if (textNode) {
                textNode.nodeValue = nextText;
            } else {
                el.insertBefore(document.createTextNode(nextText), arrow);
            }
            return;
        }
        el.textContent = getString(key, current.lang, vars);
    }

    function setHeadText() {
        const page = TEXT[current.lang][PAGE] || {};
        const head = page.head || {};
        if (head.title) document.title = head.title;

        const metaMap = [
            ['meta[name="description"]', head.description],
            ['meta[property="og:title"]', head.ogTitle || head.title],
            ['meta[property="og:description"]', head.ogDescription || head.description],
            ['meta[name="twitter:title"]', head.twitterTitle || head.title],
            ['meta[name="twitter:description"]', head.twitterDescription || head.description]
        ];

        metaMap.forEach(([selector, value]) => {
            if (!value) return;
            const el = document.querySelector(selector);
            if (el) el.setAttribute('content', value);
        });

        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) {
            canonical.href = makePublicUrl(current.lang);
        }

        const altKo = document.getElementById('hreflangKo');
        const altEn = document.getElementById('hreflangEn');
        if (altKo) altKo.href = makePublicUrl('ko');
        if (altEn) altEn.href = makePublicUrl('en');
        if (!altKo) {
            const link = document.createElement('link');
            link.id = 'hreflangKo';
            link.rel = 'alternate';
            link.hreflang = 'ko';
            link.href = makePublicUrl('ko');
            document.head.appendChild(link);
        }
        if (!altEn) {
            const link = document.createElement('link');
            link.id = 'hreflangEn';
            link.rel = 'alternate';
            link.hreflang = 'en';
            link.href = makePublicUrl('en');
            document.head.appendChild(link);
        }

        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) ogUrl.setAttribute('content', makePublicUrl(current.lang));

        const schemaTag = document.getElementById('siteJsonLd');
        if (schemaTag) {
            try {
                const schema = JSON.parse(schemaTag.textContent);
                schema.inLanguage = current.lang;
                schema.description = head.description || schema.description;
                schema.url = makePublicUrl(current.lang);
                schemaTag.textContent = JSON.stringify(schema);
            } catch (_) {}
        }
    }

    function makePublicUrl(lang) {
        const url = new URL(PUBLIC_PATHS[PAGE], PUBLIC_ORIGIN);
        if (lang === 'en') url.searchParams.set('lang', 'en');
        return url.href;
    }

    function makeUrl(lang, href = location.href) {
        const next = new URL(href, location.href);
        next.searchParams.set('lang', lang);
        return next.href;
    }

    function rewriteInternalLinks() {
        document.querySelectorAll('a[href]').forEach((anchor) => {
            const raw = anchor.getAttribute('href');
            if (!raw) return;
            if (/^(mailto:|tel:|https?:\/\/|\/\/|javascript:)/i.test(raw)) return;
            if (anchor.dataset.noLang === 'true') return;
            try {
                const next = new URL(raw, location.href);
                if (next.origin !== location.origin) return;
                next.searchParams.set('lang', current.lang);
                anchor.href = next.pathname + next.search + next.hash;
            } catch (_) {}
        });
    }

    function updateSwitcherState() {
        document.querySelectorAll('.lang-switch button').forEach((button) => {
            const label = getString(button.dataset.lang === 'ko' ? 'langKo' : 'langEn');
            button.classList.toggle('active', button.dataset.lang === current.lang);
            button.setAttribute('aria-pressed', String(button.dataset.lang === current.lang));
            button.title = label;
            button.setAttribute('aria-label', label);
        });
        const switcher = document.querySelector('.lang-switch');
        if (switcher) switcher.setAttribute('aria-label', getString('langSwitcherLabel'));
    }

    function applyContactLinks() {
        const address = ['navyvyvy', 'naver.com'].join('@');
        document.querySelectorAll('[data-contact-email]').forEach((anchor) => {
            anchor.href = `mailto:${address}`;
        });
    }

    function injectSwitcher() {
        const nav = document.querySelector('.header-nav');
        if (!nav || nav.querySelector('.lang-switch')) return;

        const wrap = document.createElement('div');
        wrap.className = 'lang-switch';
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', getString('langSwitcherLabel'));

        ['ko', 'en'].forEach((lang) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.lang = lang;
            button.textContent = lang === 'ko' ? '🇰🇷' : '🇺🇸';
            const label = getString(lang === 'ko' ? 'langKo' : 'langEn');
            button.title = label;
            button.setAttribute('aria-label', label);
            button.addEventListener('click', () => setLanguage(lang));
            wrap.appendChild(button);
        });

        nav.appendChild(wrap);
    }

    function applyCommonText() {
        setText('.brand-subtitle', 'brandSubtitle');
        setOrdered('header .header-nav a', ['navTool', 'navFeatures', 'navAbout', 'navPrivacy', 'navContact']);
        const nav = document.querySelector('header .header-nav');
        if (nav) nav.setAttribute('aria-label', getString('navLabel'));
    }

    function applyFooterLinks(keys) {
        setOrdered('.footer-panel .footer-links a', keys);
    }

    function applyIndexText() {
        setText('.tool-section .hero-kicker', 'heroKicker');
        setText('.tool-section .section-title', 'heroTitle');
        setNthText('.tool-section .section-headline > p', 1, 'heroDesc');

        ['optTrim', 'optToc', 'optMultiToc', 'optZip'].forEach((id, index) => {
            setLabel(id, ['optTrim', 'optToc', 'optMultiToc', 'optZip'][index]);
        });
        const multiLabel = document.getElementById('optMultiToc')?.closest('label');
        if (multiLabel) multiLabel.title = getString('optMultiTocTitle');

        setButton('btnToggleAdvanced', 'advancedToggle');
        setText('#regexLabel', 'regexLabel');
        setText('#testLabel', 'testLabel');
        setButton('btnTestParser', 'testButton');
        setText('#testOutput', 'testOutput');
        setButton('convertBtn', 'convertStart');
        setText('.process-label', 'statusLabel');
        setText('#status', 'statusIdle');
        setText('#statusDetail', 'statusIdleDetail');
        setText('#previewFileName', 'previewTitle');
        setText('#previewFileMeta', 'previewMeta');
        setLabel('previewMultiTocToggle', 'previewMulti');
        const previewToggle = document.querySelector('.preview-toggle');
        if (previewToggle) previewToggle.title = getString('previewToggleTitle');
        setButton('previewCopyBtn', 'previewCopy');
        setButton('previewCloseBtn', 'previewClose');
        setText('#previewList .preview-empty', 'previewEmpty');
        setText('#emptyMsg', 'dropEmpty');
        setOrdered('.file-table thead th', ['tableTitle', 'tableCover', 'tableEncoding', 'tableDetect', 'tableState']);

        const cards = document.querySelectorAll('.feature-card');
        const titles = TEXT[current.lang].index.featureCards.map((item) => item[0]);
        const bodies = TEXT[current.lang].index.featureCards.map((item) => item[1]);
        cards.forEach((card, index) => {
            const head = card.querySelector('h3');
            const body = card.querySelector('p');
            if (head) head.textContent = titles[index] || head.textContent;
            if (body) body.textContent = bodies[index] || body.textContent;
        });

        setText('#features .hero-kicker', 'featureKicker');
        setText('#features .section-title', 'featureTitle');
        setNthText('#features .section-headline > p', 1, 'featureDesc');

        setText('#about .hero-kicker', 'storyKicker');
        setText('#about .section-title', 'storyTitle');
        setNthText('#about .story-copy > p', 1, 'storyDesc');
        const workflow = document.querySelector('#about .workflow-track');
        if (workflow) workflow.setAttribute('aria-label', getString('workflowLabel'));
        const workflowSteps = TEXT[current.lang].index.workflowSteps;
        document.querySelectorAll('#about .workflow-step').forEach((step, index) => {
            const heading = step.querySelector('h3');
            const body = step.querySelector('p');
            if (heading) heading.textContent = workflowSteps[index]?.[0] || heading.textContent;
            if (body) body.textContent = workflowSteps[index]?.[1] || body.textContent;
        });

        setText('#privacy .hero-kicker', 'privacyKicker');
        setText('#privacy .section-title', 'privacyTitle');
        setNthText('#privacy .privacy-copy > p', 1, 'privacyDesc');
        const privacyData = TEXT[current.lang].privacy;
        document.querySelectorAll('#privacy .privacy-item').forEach((item, index) => {
            const summary = item.querySelector('h3');
            const body = item.querySelector('p');
            if (summary) summary.textContent = privacyData.headings[index] || summary.textContent;
            if (body) body.textContent = privacyData.sections[index] || body.textContent;
        });

        setText('#contact .hero-kicker', 'contactKicker');
        setText('#contact .section-title', 'contactTitle');
        setText('#contact .contact-action > p', 'contactDesc');
        setText('#contact .contact-email', 'contactEmail');
        setText('.footer-panel > p', 'footerCopy');
        applyFooterLinks(['navTool', 'navFeatures', 'navAbout', 'navPrivacy', 'navContact']);
    }

    function applyAboutText() {
        setText('.section-block .hero-kicker', 'kicker');
        setText('.section-block .section-title', 'title');
        setNthText('.section-block .section-headline > p', 1, 'intro');

        const cards = document.querySelectorAll('.support-card');
        const pageCards = TEXT[current.lang].about.cards;
        cards.forEach((card, index) => {
            const head = card.querySelector('h3');
            const body = card.querySelector('p');
            if (head) head.textContent = pageCards[index]?.[0] || head.textContent;
            if (body) body.textContent = pageCards[index]?.[1] || body.textContent;
        });

        setText('.footer-panel > p', 'copyright', {}, 'common');
        applyFooterLinks(['navTool', 'navFeatures', 'navPrivacy', 'navContact']);
    }

    function applyPrivacyText() {
        const section = document.querySelector('.policy-panel');
        if (!section) return;
        setText('.policy-panel .hero-kicker', 'kicker');
        setText('.policy-panel .section-title', 'title');
        setNthText('.policy-panel .section-headline > p', 1, 'intro');

        const h3s = section.querySelectorAll(':scope > h3');
        const ps = section.querySelectorAll(':scope > h3 + p');
        const lis = section.querySelectorAll('li');
        const page = TEXT[current.lang].privacy;

        h3s.forEach((el, index) => { el.textContent = page.headings[index] || el.textContent; });
        ps.forEach((el, index) => {
            el.textContent = page.sections[index] || el.textContent;
        });
        lis.forEach((el, index) => { el.textContent = page.bullets[index] || el.textContent; });
        applyFooterLinks(['navTool', 'navFeatures', 'navAbout', 'navContact']);
    }

    function applyContactText() {
        setText('.section-block .hero-kicker', 'kicker');
        setText('.section-block .section-title', 'title');
        setNthText('.section-block .section-headline > p', 1, 'intro');

        const cards = document.querySelectorAll('.contact-card');
        const pageCards = TEXT[current.lang].contact.cards;
        cards.forEach((card, index) => {
            const head = card.querySelector('strong');
            const body = card.querySelector('p, a');
            if (head) head.textContent = pageCards[index]?.[0] || head.textContent;
            if (body) body.textContent = pageCards[index]?.[1] || body.textContent;
        });
        applyFooterLinks(['navTool', 'navFeatures', 'navAbout', 'navPrivacy']);
    }

    function applyPageText() {
        if (PAGE === 'index') applyIndexText();
        if (PAGE === 'about') applyAboutText();
        if (PAGE === 'privacy') applyPrivacyText();
        if (PAGE === 'contact') applyContactText();
    }

    function apply() {
        document.documentElement.lang = current.lang;
        applyCommonText();
        applyPageText();
        applyContactLinks();
        setHeadText();
        rewriteInternalLinks();
        injectSwitcher();
        updateSwitcherState();
    }

    function setLanguage(lang, persist = true) {
        const next = normalizeLang(lang) || 'en';
        current.lang = next;
        if (persist) {
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch (_) {}
        }
        const url = new URL(location.href);
        url.searchParams.set('lang', next);
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        apply();
        window.dispatchEvent(new CustomEvent('epub-langchange', { detail: { lang: next } }));
    }

    const api = {
        get lang() {
            return current.lang;
        },
        t: (key, vars = {}) => getString(key, current.lang, vars),
        setLanguage,
        detectLanguage,
        page: PAGE
    };

    window.EPUB_STUDIO_I18N = api;

    document.addEventListener('DOMContentLoaded', () => {
        current.lang = detectLanguage();
        apply();
    });
})();
