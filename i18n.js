(() => {
    const STORAGE_KEY = 'epub-studio-lang';
    const SUPPORTED = new Set(['ko', 'en']);
    const PAGE = (() => {
        const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        if (file === 'about.html') return 'about';
        if (file === 'privacy.html') return 'privacy';
        if (file === 'contact.html') return 'contact';
        return 'index';
    })();

    const TEXT = {
        ko: {
            common: {
                brandSubtitle: 'TXT를 EPUB으로 바꾸는 브라우저 기반 전자책 도구',
                navTool: '변환 도구',
                navFeatures: '기능 소개',
                navAbout: '사이트 소개',
                navPrivacy: '개인정보처리방침',
                navContact: '문의',
                langKo: '한국어',
                langEn: 'English',
                langSwitcherLabel: '언어 전환',
                copyright: '© 2026 EPUB STUDIO.'
            },
            index: {
                head: {
                    title: 'EPUB STUDIO | TXT를 EPUB으로 변환하는 브라우저 기반 도구',
                    description: 'EPUB STUDIO는 TXT 파일을 브라우저에서 EPUB으로 일괄 변환하는 도구입니다. 공백 정제, 목차 추출, 표지 적용, 인코딩 자동 감지, ZIP 압축을 로컬에서 처리합니다.',
                    ogTitle: 'EPUB STUDIO | TXT를 EPUB으로 변환하는 브라우저 기반 도구',
                    ogDescription: '브라우저 안에서 TXT 파일을 EPUB으로 변환합니다. 공백 정제, 목차 추출, 표지 적용, 인코딩 자동 감지, ZIP 압축을 지원합니다.',
                    twitterTitle: 'EPUB STUDIO | TXT를 EPUB으로 변환하는 브라우저 기반 도구',
                    twitterDescription: '브라우저에서 TXT 파일을 EPUB으로 변환하고, 공백 정제와 목차 추출을 한 번에 처리합니다.'
                },
                heroKicker: '브라우저에서 바로 쓰는 EPUB 변환기',
                heroTitle: 'TXT 파일을 로컬 브라우저에서 EPUB으로 변환합니다',
                heroDesc: '공백 정제, 목차 추출, 표지 적용, 인코딩 자동 감지, ZIP 묶음 출력은 모두 브라우저 안에서 처리됩니다.',
                toolKicker: '브라우저에서 바로 쓰는 EPUB 변환기',
                toolTitle: 'TXT 파일을 로컬 브라우저에서 EPUB으로 변환합니다',
                toolDesc: '공백 정제, 목차 추출, 표지 적용, 인코딩 자동 감지, ZIP 묶음 출력은 모두 브라우저 안에서 처리됩니다.',
                optTrim: '공백 정제',
                optToc: '목차 추출',
                optMultiToc: '다중 패턴 허용',
                optZip: 'ZIP 일괄 압축',
                advancedToggle: '고급 설정',
                regexLabel: '목차 추출 커스텀 정규식',
                testLabel: '파서 시뮬레이터 (엔진 테스트)',
                testButton: '테스트 실행',
                testOutput: '감지할 제목을 입력하면 이곳에 표시됩니다. (순위 결정전 최적화 엔진 가동)',
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
                previewMeta: '파일을 선택하면 감지된 제목 후보를 보여줍니다.',
                previewMulti: '다중 패턴',
                previewToggleTitle: '다중 패턴을 바로 바꿔서 미리보기를 다시 계산합니다.',
                previewCopy: '복사',
                previewClose: '닫기',
                previewEmpty: '아직 미리보기 결과가 없습니다. 파일 목록에서 "목차 미리보기"를 누르세요.',
                previewNoResult: '목차 후보가 감지되지 않았습니다. 현재 설정으로는 제목으로 판정되는 항목이 없습니다.',
                previewScanning: '현재 설정으로 목차 후보를 찾는 중입니다.',
                previewCount: '총 {count}개 감지됨',
                previewLoading: '분석 중...',
                previewError: '파일을 읽는 도중 문제가 발생했습니다. 인코딩이나 브라우저 권한을 확인해 주세요.',
                copyFail: '선택한 행을 복사하지 못했습니다.',
                dropEmpty: '텍스트 파일을 드래그하거나 클릭하여 추가하세요',
                tableTitle: '제목',
                tableCover: '표지 설정',
                tableEncoding: '인코딩',
                tableDetect: '감지',
                tableState: '상태',
                tablePreview: '미리보기',
                tableSearch: '검색',
                tableClipboard: '클립보드',
                featureKicker: '기능 소개',
                featureTitle: '제공 기능만 간단히 정리했습니다',
                featureDesc: '현재 구현된 기능만 간단히 정리했습니다.',
                featureCards: [
                    ['TXT에서 EPUB으로 변환', '여러 텍스트 파일을 한 번에 넣고 EPUB 파일로 변환합니다. 파일 단위로 상태를 확인할 수 있어 작업 흐름이 단순합니다.'],
                    ['공백 정제', '무의미한 연속 빈 줄은 줄이고, 문단 전환에 필요한 최소 여백은 유지합니다.'],
                    ['목차 추출', '제목, 장, 챕터, Episode 같은 패턴을 감지해 목차로 묶습니다. 다중 패턴과 커스텀 정규식도 지원합니다.'],
                    ['목차 미리보기', '파일별 목차 후보를 바로 확인하고, 필요하면 각 행을 클릭해 복사할 수 있습니다. 감지 상태도 함께 보여줍니다.'],
                    ['표지 적용', '제목을 검색하거나 클립보드의 이미지 URL과 이미지를 바로 적용할 수 있습니다.'],
                    ['인코딩 자동 감지', 'UTF-8, CP949 같은 흔한 인코딩을 자동으로 추정해 읽기 실패를 줄입니다.'],
                    ['ZIP 일괄 압축', '여러 EPUB 결과물을 한 번에 ZIP 파일로 묶어 내려받을 수 있습니다.']
                ],
                footerCopy: '© 2026 EPUB STUDIO. TXT 파일을 EPUB으로 변환하는 브라우저 기반 도구입니다.',
                fileState: {
                    wait: '대기',
                    ing: '진행',
                    done: '완료',
                    error: '오류'
                },
                statusDetail: {
                    idle: 'TXT 파일을 추가하면 변환을 시작할 수 있습니다.',
                    processing: '변환 중...',
                    stopped: '중단 요청을 반영하는 중입니다.'
                },
                clipboard: {
                    reading: '클립보드 분석 중...',
                    imageApplied: '클립보드 이미지 적용 완료',
                    downloading: '이미지 다운로드 중...',
                    cached: '숨겨진 이미지 캐싱 완료',
                    invalid: '클립보드에 유효한 이미지 또는 주소가 없습니다.',
                    fail: '클립보드를 읽을 수 없습니다. 브라우저 권한을 확인하시거나 CORS 정책이 제한된 주소입니다.'
                },
                test: {
                    noInput: '테스트할 텍스트를 입력해주세요.',
                    analyzing: '엔진 분석 중...',
                    noResults: '감지된 제목이 없습니다. (모두 본문으로 판정됨)',
                    resultCount: '총 {count}개 감지됨:',
                    parserError: '파서 오류: {error}',
                    engineError: '엔진 치명적 오류: 정규식 문법 또는 스크립트 에러 ({error})'
                }
            },
            about: {
                head: {
                    title: '사이트 소개 | EPUB STUDIO',
                    description: 'EPUB STUDIO는 TXT 파일을 브라우저에서 EPUB으로 변환하는 웹 도구입니다. 로컬 처리, 목차 추출, 공백 정제, 표지 적용, 인코딩 감지를 지원합니다.',
                    ogTitle: '사이트 소개 | EPUB STUDIO',
                    ogDescription: 'EPUB STUDIO는 브라우저에서 TXT 파일을 EPUB으로 변환하는 웹 도구입니다.',
                    twitterTitle: '사이트 소개 | EPUB STUDIO',
                    twitterDescription: 'EPUB STUDIO는 TXT 파일을 브라우저에서 EPUB으로 변환하는 웹 도구입니다.'
                },
                kicker: '사이트 소개',
                title: 'EPUB STUDIO는 TXT 기반 전자책 변환 작업을 돕는 웹 도구입니다',
                intro: '이 사이트는 웹소설이나 일반 텍스트 파일을 EPUB으로 바꾸는 데 필요한 기본 작업을 한 화면에 모아둔 도구입니다. 변환은 기본적으로 브라우저에서 진행되며, 사용자가 직접 기능을 눌렀을 때만 표지 검색이나 클립보드 접근 같은 추가 동작이 발생합니다.',
                cards: [
                    ['무엇을 제공하나요', 'TXT 파일의 일괄 변환, 공백 정제, 목차 추출, 표지 적용, 인코딩 감지, ZIP 압축을 제공합니다.'],
                    ['어떤 방식으로 동작하나요', '변환 로직은 Web Worker를 통해 동작하고, 파일 본문은 브라우저가 직접 읽습니다. 기본 흐름은 서버 업로드를 전제로 하지 않습니다.'],
                    ['왜 별도 페이지가 있나요', '도구 화면과 설명 문서를 분리해 두면 읽기 쉽고 관리도 편합니다.']
                ]
            },
            privacy: {
                head: {
                    title: '개인정보처리방침 | EPUB STUDIO',
                    description: 'EPUB STUDIO의 개인정보처리방침입니다. 파일 처리 방식, 외부 요청, 보관 및 문의 방법을 안내합니다.',
                    ogTitle: '개인정보처리방침 | EPUB STUDIO',
                    ogDescription: 'EPUB STUDIO의 개인정보처리방침입니다.',
                    twitterTitle: '개인정보처리방침 | EPUB STUDIO',
                    twitterDescription: 'EPUB STUDIO의 개인정보처리방침입니다.'
                },
                kicker: '개인정보처리방침',
                title: '개인정보처리방침',
                intro: 'EPUB STUDIO는 브라우저에서 TXT 파일을 EPUB으로 변환하는 도구입니다. 기본 변환 과정은 사용자의 기기에서 실행되며, 업로드한 파일의 본문을 서버에 전송하지 않는 것을 원칙으로 합니다.',
                sections: [
                    '이 사이트는 별도의 회원가입 없이 사용할 수 있으며, 운영자가 사용자 계정을 만들거나 프로필 정보를 수집하는 구조가 아닙니다. 사용자가 입력하는 파일명, 제목, 정규식, 클립보드 이미지 또는 이미지 URL은 변환 기능을 위해 브라우저에서만 사용됩니다.',
                    'TXT 파일 내용은 브라우저가 직접 읽고, Web Worker를 통해 변환합니다. 즉, 기본 동작은 로컬 처리이며 서버 업로드를 전제로 하지 않습니다. 다만 브라우저가 외부 서비스로 요청을 보내는 기능은 예외적으로 발생할 수 있습니다.',
                    'JSZip과 jschardet는 cdnjs CDN에서 불러오며, 표지 검색과 클립보드 관련 기능, 그리고 AdSense 광고 스크립트를 사용할 때 브라우저가 외부 요청을 보낼 수 있습니다. 이러한 요청은 해당 서비스나 브라우저 권한 설정의 영향을 받을 수 있습니다.',
                    '현재 구조상 사용자의 원문 파일을 서버에 저장하지 않으며, 브라우저를 벗어난 장기 보관을 기본으로 하지 않습니다. 사용자가 브라우저를 닫거나 새로고침하면 로컬 상태는 초기화될 수 있습니다.',
                    '개인정보 처리에 대한 문의는 아래 문의처로 연락해 주세요.'
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
                    description: 'EPUB STUDIO 운영자 문의 페이지입니다. 정책 문의, 서비스 제안, 오류 제보를 받을 수 있습니다.',
                    ogTitle: '문의 | EPUB STUDIO',
                    ogDescription: 'EPUB STUDIO 운영자 문의 페이지입니다.',
                    twitterTitle: '문의 | EPUB STUDIO',
                    twitterDescription: 'EPUB STUDIO 운영자 문의 페이지입니다.'
                },
                kicker: '문의',
                title: '운영자 연락처',
                intro: '정책 문의, 서비스 제안, 오류 제보는 아래 연락처로 받습니다. 실제 운영에 맞게 연락처가 바뀌면 이 부분만 교체하면 됩니다.',
                cards: [
                    ['운영자 이메일', 'navyvyvy@naver.com'],
                    ['응답 범위', '서비스 오류, 정책 관련 문의, 기능 제안, 제휴 문의를 받습니다.'],
                    ['운영 안내', '이 사이트는 단일 페이지 기반 도구에서 분리된 안내 페이지를 함께 제공하도록 구성되어 있습니다.']
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
                toolKicker: 'A browser-native EPUB converter',
                toolTitle: 'Convert TXT files to EPUB in your local browser',
                toolDesc: 'Whitespace cleanup, table of contents extraction, cover application, automatic encoding detection, and ZIP output all run inside the browser.',
                optTrim: 'Trim whitespace',
                optToc: 'Extract TOC',
                optMultiToc: 'Allow multi-patterns',
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
                previewEmpty: 'No preview results yet. Click "TOC preview" in the file list.',
                previewNoResult: 'No TOC candidate was detected with the current settings.',
                previewScanning: 'Searching for TOC candidates with the current settings.',
                previewCount: 'Detected {count} items',
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
                tableSearch: 'Search',
                tableClipboard: 'Clipboard',
                featureKicker: 'Features',
                featureTitle: 'A quick summary of what is included',
                featureDesc: 'Only the features currently implemented are listed here.',
                featureCards: [
                    ['TXT to EPUB conversion', 'Drop multiple text files at once and convert them to EPUB. File-level status makes the flow easy to follow.'],
                    ['Whitespace cleanup', 'Reduce meaningless empty lines while keeping the spacing needed for paragraph breaks.'],
                    ['Table of contents extraction', 'Detect title, chapter, and episode-style patterns and group them into a TOC. Multi-pattern mode and custom regex are supported.'],
                    ['TOC preview', 'Review TOC candidates per file, click a row to copy it, and see whether each item is detected or not.'],
                    ['Cover application', 'Search for a cover image or apply an image URL or clipboard image right away.'],
                    ['Automatic encoding detection', 'Automatically detects common encodings such as UTF-8 and CP949 to reduce read failures.'],
                    ['Batch ZIP packaging', 'Bundle multiple EPUB outputs into a single ZIP file for download.']
                ],
                footerCopy: '© 2026 EPUB STUDIO. A browser-based TXT to EPUB tool.',
                fileState: {
                    wait: 'Ready',
                    ing: 'Working',
                    done: 'Done',
                    error: 'Error'
                },
                statusDetail: {
                    idle: 'Add TXT files to start converting.',
                    processing: 'Processing...',
                    stopped: 'Applying the stop request.'
                },
                clipboard: {
                    reading: 'Reading clipboard...',
                    imageApplied: 'Clipboard image applied',
                    downloading: 'Downloading image...',
                    cached: 'Image cached from clipboard',
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
                    ['Operator email', 'navyvyvy@naver.com'],
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
        if (SUPPORTED.has(value)) return value;
        return null;
    }

    function detectPage() {
        return PAGE;
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
        const page = TEXT[lang]?.[detectPage()] || {};
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
        const page = TEXT[current.lang][detectPage()] || {};
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
            const base = new URL(location.href);
            base.searchParams.delete('lang');
            base.hash = '';
            canonical.href = base.href;
        }

        const altKo = document.getElementById('hreflangKo');
        const altEn = document.getElementById('hreflangEn');
        if (altKo) altKo.href = makeUrl('ko');
        if (altEn) altEn.href = makeUrl('en');
        if (!altKo) {
            const link = document.createElement('link');
            link.id = 'hreflangKo';
            link.rel = 'alternate';
            link.hreflang = 'ko';
            link.href = makeUrl('ko');
            document.head.appendChild(link);
        }
        if (!altEn) {
            const link = document.createElement('link');
            link.id = 'hreflangEn';
            link.rel = 'alternate';
            link.hreflang = 'en';
            link.href = makeUrl('en');
            document.head.appendChild(link);
        }

        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) ogUrl.setAttribute('content', makeUrl(current.lang));
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
            button.classList.toggle('active', button.dataset.lang === current.lang);
            button.setAttribute('aria-pressed', String(button.dataset.lang === current.lang));
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
        t: getString,
        setLanguage,
        detectLanguage,
        page: detectPage()
    };

    window.EPUB_STUDIO_I18N = api;

    document.addEventListener('DOMContentLoaded', () => {
        current.lang = detectLanguage();
        apply();
    });
})();
