import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const defaultTitleRegex = html.match(/id="regexInput" value="([^"]+)"/)[1];

function loadWorker() {
    const template = html.match(/const workerCode = `([\s\S]*?)`;\s*\n\s*const workerBlob/)[1];
    const source = Function(`return \`${template}\`;`)();
    const messages = [];

    class FakeZip {
        constructor(files = new Map(), prefix = '') {
            this.files = files;
            this.prefix = prefix;
        }
        file(name, content) {
            this.files.set(this.prefix + name, content);
            return this;
        }
        folder(name) {
            return new FakeZip(this.files, this.prefix + name + '/');
        }
        async generateAsync() {
            return { files: this.files };
        }
    }

    const context = vm.createContext({
        console,
        importScripts() {},
        JSZip: FakeZip,
        self: { postMessage(message) { messages.push(message); } }
    });
    vm.runInContext(source, context);
    return { context, messages };
}

test('parser detects sequential Korean chapter titles', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: { text: '제1화 시작\n본문\n제2화 계속', userRegex: '', useMultiToc: false }
    } });
    assert.deepEqual(Array.from(messages[0].payload.resultLines), ['제1화 시작', '제2화 계속']);
});

test('parser treats 수 as a chapter unit without matching prose', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: '제1수 시작\n\n유키의 흑2수가 화점에 내리꽂히자 백이 곧장 수를 두었다.\n\n제2수 계속',
            userRegex: '',
            useMultiToc: false
        }
    } });
    assert.deepEqual(Array.from(messages[0].payload.resultLines), ['제1수 시작', '제2수 계속']);
});

test('Korean chapter numbers at the end of a title continue the same sequence', async () => {
    const content = '44화. 어쩌구\n\n본문\n\n스트라이커 45화';

    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: content,
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });

        assert.deepEqual(Array.from(messages[0].payload.resultLines), ['44화. 어쩌구', '스트라이커 45화']);
    }
});

test('decorated Korean chapter titles keep their leading symbol', async () => {
    const content = [
        '◈ 1화 제국의 수도로 (1)',
        '[그가 99화에 왔다고 말했다.]',
        '401호.',
        '402호.',
        '403호.',
        '◈ 2화 제국의 수도로 (2)'
    ].join('\n\n');

    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: content,
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });

        assert.deepEqual(Array.from(messages[0].payload.resultLines), [
            '◈ 1화 제국의 수도로 (1)',
            '◈ 2화 제국의 수도로 (2)'
        ]);

        const standalone = loadWorker();
        await standalone.context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: '401호.\n\n402호.\n\n403호.',
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });
        assert.deepEqual(Array.from(standalone.messages[0].payload.resultLines), ['401호.', '402호.', '403호.']);

        const lowerUnrelated = loadWorker();
        await lowerUnrelated.context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: '◈ 401화 시작\n\n1호.\n\n2호.\n\n3호.\n\n◈ 402화 계속',
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });
        assert.deepEqual(Array.from(lowerUnrelated.messages[0].payload.resultLines), ['◈ 401화 시작', '◈ 402화 계속']);
    }
});

test('hash-prefixed chapter titles allow fullwidth marks, spaces, and a single item', async () => {
    const cases = [
        ['＃1화', ['＃1화']],
        ['＃ 1화 시작\n본문\n＃ 2화 계속', ['＃ 1화 시작', '＃ 2화 계속']],
        ['#1화 시작\n본문\n#2화 계속', ['#1화 시작', '#2화 계속']]
    ];

    for (const [content, expected] of cases) {
        for (const useMultiToc of [false, true]) {
            const { context, messages } = loadWorker();
            await context.self.onmessage({ data: {
                type: 'TEST_PARSER',
                payload: { text: content, userRegex: '', preserveCustomMatches: false, useMultiToc }
            } });

            assert.deepEqual(Array.from(messages[0].payload.resultLines), expected);
        }
    }
});

test('numbered prose between consecutive titles is not a title candidate', async () => {
    const content = [
        '◈ 31화 진실을 향한 발걸음 (0)',
        '5위계 정도가 사용하면 성문을 무력화시킬 수 있으며.',
        '◈ 32화 진실을 향한 발걸음 (1)',
        '6위계 중급 마법.',
        '◈ 33화 진실을 향한 발걸음 (2)',
        '7위계 고급 마법.',
        '◈ 34화 진실을 향한 발걸음 (3)',
        '8위계 오리지널 마법.',
        '◈ 35화 진실을 향한 발걸음 (4)'
    ].join('\n\n');

    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: content,
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });

        assert.deepEqual(Array.from(messages[0].payload.resultLines), [
            '◈ 31화 진실을 향한 발걸음 (0)',
            '◈ 32화 진실을 향한 발걸음 (1)',
            '◈ 33화 진실을 향한 발걸음 (2)',
            '◈ 34화 진실을 향한 발걸음 (3)',
            '◈ 35화 진실을 향한 발걸음 (4)'
        ]);
    }
});

test('special-title words inside prose do not enter the TOC', async () => {
    const content = [
        '41화',
        '프로필? 호날두던데.',
        '프로필? 호날두던데',
        '공지사항은 다음과 같다.',
        '외전? 아니던데',
        '작가의 말? 사실이 아닌데',
        '42화'
    ].join('\n\n');

    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: content,
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });

        assert.deepEqual(Array.from(messages[0].payload.resultLines), ['41화', '42화']);
    }
});

test('authors notes are excluded while afterwords remain in the TOC', async () => {
    const content = [
        '1화 시작',
        '작가의 말',
        '[작가의 말]',
        '후기',
        '[후기]',
        '2화 계속'
    ].join('\n\n');

    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: content,
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });

        assert.deepEqual(Array.from(messages[0].payload.resultLines), [
            '1화 시작',
            '후기',
            '[후기]',
            '2화 계속'
        ]);
    }
});

test('automatic discovery converts unknown sequential title formats', async () => {
    const { context, messages } = loadWorker();
    const content = 'Story@001 :: Alpha\n\nbody\n\nStory@002 :: Beta\n\nbody\n\nStory@003 :: Gamma';
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: { requestId: 1, fileName: 'sample.txt', text: content, userRegex: '', useMultiToc: false }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.idx), [0, 4, 8]);

    await context.self.onmessage({ data: {
        type: 'CONVERT',
        payload: {
            id: 'pattern-book',
            title: 'Pattern Book',
            content,
            useTrim: true,
            useAutoToc: true,
            useMultiToc: false,
            userRegex: '',
            coverBuffer: null,
            coverType: '',
            language: 'en',
            excludedIndices: []
        }
    } });

    const ncx = messages[1].payload.blob.files.get('OEBPS/toc.ncx');
    assert.equal((ncx.match(/<navPoint /g) || []).length, 3);
});

test('EP dot numbering is detected between body lines', async () => {
    const content = 'EP.1 시작\n본문\nEP.2 계속\n본문\nEP.5 재개';

    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: { text: content, userRegex: '', preserveCustomMatches: false, useMultiToc }
        } });

        assert.deepEqual(Array.from(messages[0].payload.resultLines), [
            'EP.1 시작',
            'EP.2 계속',
            'EP.5 재개'
        ]);
    }
});

test('automatic discovery scans repeated sequential patterns without blank lines', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: 'ARC@1 :: 시작\n본문\nARC@2 :: 계속\n본문\nARC@3 :: 마침',
            userRegex: '',
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), [
        'ARC@1 :: 시작',
        'ARC@2 :: 계속',
        'ARC@3 :: 마침'
    ]);
});

test('blank-separated Korean units are detected automatically', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '본문\n\n1수\n\n내용\n\n2수\n\n끝',
            userRegex: '',
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), ['1수', '2수']);
});

test('수 sequence ignores a prefixed outlier', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '28수\n\n흑 37수\n\n29수',
            userRegex: '',
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), ['28수', '29수']);
});

test('수 sequence skips numeric runs that do not continue the first title', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '3수\n\n7수\n\n8수\n\n9수\n\n4수',
            userRegex: '',
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), ['3수', '4수']);
});

test('수 sequence is not split by optional title prefixes', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '제3수\n\n7수.\n\n8수.\n\n9수.\n\n제4수',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), ['제3수', '제4수']);
});

test('isolated higher numbers do not become automatic titles', async () => {
    for (const suffix of ['270.잘못된 후보', '270. 잘못된 후보']) {
        for (const useMultiToc of [false, true]) {
            const { context, messages } = loadWorker();
            await context.self.onmessage({ data: {
                type: 'TEST_PARSER',
                payload: {
                    text: `101화 앞\n\n102화 다음\n\n${suffix}`,
                    userRegex: defaultTitleRegex,
                    preserveCustomMatches: false,
                    useMultiToc
                }
            } });

            assert.deepEqual(Array.from(messages[0].payload.resultLines), ['101화 앞', '102화 다음']);
        }
    }
});

test('bare numbers continue a confirmed chapter sequence across formats', async () => {
    const cases = [
        { content: '300화\n\n301화\n\n302', expected: ['300화', '301화', '302'] },
        { content: '300화\n\n301화\n\n302\n\n303', expected: ['300화', '301화', '302', '303'] },
        { content: '300화\n\n301화\n\n302\n\n304', expected: ['300화', '301화', '302'] },
        { content: '300화\n301화\n302', expected: ['300화', '301화', '302'] },
        { content: '300화\n본문\n301화\n본문\n302\n본문', expected: ['300화', '301화', '302'] }
    ];

    for (const { content, expected } of cases) {
        for (const useMultiToc of [false, true]) {
            const { context, messages } = loadWorker();
            await context.self.onmessage({ data: {
                type: 'TEST_PARSER',
                payload: {
                    text: content,
                    userRegex: defaultTitleRegex,
                    preserveCustomMatches: false,
                    useMultiToc
                }
            } });

            assert.deepEqual(Array.from(messages[0].payload.resultLines), expected);
        }
    }
});

test('numbered prose is not bridged into a confirmed chapter sequence', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: '1화 시작\n\n2화 계속\n\n3. 일반문장',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), ['1화 시작', '2화 계속']);
});

test('filename chapter ranges guide single-pattern selection', async () => {
    const { context, messages } = loadWorker();
    const korean = Array.from({ length: 5 }, (_, index) => `제${index + 1}화 제목`).join('\n\n');
    const english = Array.from({ length: 6 }, (_, index) => `Chapter ${index + 1} Noise`).join('\n\n');

    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: `프롤로그\n\n${korean}\n\n${english}\n\n외전 99\n\n에필로그`,
            fileName: '작품 1-5.txt',
            userRegex: '',
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), [
        '프롤로그',
        ...Array.from({ length: 5 }, (_, index) => `제${index + 1}화 제목`),
        '외전 99',
        '에필로그'
    ]);
});

test('automatic title groups prefer the expected next number', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: 'Chapter 3 Start\n\nChapter 7 Wrong\n\nChapter 8 Wrong\n\nChapter 4 Continue',
            userRegex: '',
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), ['Chapter 3 Start', 'Chapter 4 Continue']);
});

test('same title pattern keeps later titles after a number gap', async () => {
    const cases = [
        ['11. 시작\n\n12. 계속\n\n15. 재개\n\n16. 다음', ['11. 시작', '12. 계속', '15. 재개', '16. 다음']],
        ['제11화 시작\n\n제12화 계속\n\n제15화 재개\n\n제16화 다음', ['제11화 시작', '제12화 계속', '제15화 재개', '제16화 다음']],
        ['3. 시작\n\n4. 계속\n\n7. 재개', ['3. 시작', '4. 계속', '7. 재개']],
        ['3.시작\n본문\n4.계속\n본문\n7.재개', ['3.시작', '4.계속', '7.재개']],
        ['제3화 시작\n\n제4화 계속\n\n제7화 재개', ['제3화 시작', '제4화 계속', '제7화 재개']]
    ];

    for (const [content, expected] of cases) {
        for (const useMultiToc of [false, true]) {
            const { context, messages } = loadWorker();
            await context.self.onmessage({ data: {
                type: 'TEST_PARSER',
                payload: {
                    text: content,
                    userRegex: defaultTitleRegex,
                    preserveCustomMatches: false,
                    useMultiToc
                }
            } });

            assert.deepEqual(Array.from(messages[0].payload.resultLines), expected);
        }
    }
});

test('an unusable first number does not block a later title sequence', async () => {
    const cases = [
        ['999. 잡음\n\n11. 시작\n\n12. 계속', ['11. 시작', '12. 계속']],
        ['999화 안내\n\n11화 시작\n\n12화 계속', ['11화 시작', '12화 계속']]
    ];

    for (const [content, expected] of cases) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: content,
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc: false
            }
        } });
        assert.deepEqual(Array.from(messages[0].payload.resultLines), expected);
    }
});

test('numbered special titles prefer the expected next number', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '외전 3\n\n외전 7\n\n외전 4',
            userRegex: '',
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), ['외전 3', '외전 4']);
});

test('custom regex remains an explicit override of automatic sequencing', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: '1. one\n\n3. three',
            userRegex: '^\\d+\\.\\s+.*$',
            preserveCustomMatches: true,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), ['1. one', '3. three']);
});

test('explicit custom regex does not mix in automatic patterns', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: 'Marker Alpha\n\nMarker Beta\n\nArc 1 Start\n\nArc 2 Continue',
            userRegex: '^Marker ',
            preserveCustomMatches: true,
            useMultiToc: true
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), ['Marker Alpha', 'Marker Beta']);
});

test('default regex matches still use automatic sequencing', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: 'Item 3\n\nItem 7\n\nItem 4',
            userRegex: '^Item \\d+$',
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), ['Item 3', 'Item 4']);
});

test('single-pattern ties use the group seen first in the file', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: '11.시작\n\n12.계속\n\n67화 시작\n\n68화 계속',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), ['11.시작', '12.계속']);
});

test('legacy numbered titles stay detected after an earlier number sequence', async () => {
    const content = '003. 시작\n\n004. 계속\n\n085.여름의 문턱(3)\n\n086. 여름의 문턱(4)';

    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: content,
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });

        assert.deepEqual(Array.from(messages[0].payload.resultLines), [
            '003. 시작',
            '004. 계속',
            '085.여름의 문턱(3)',
            '086. 여름의 문턱(4)'
        ]);
    }
});

test('numbered title sequences survive sentence-like title endings', async () => {
    const content = '11. 시작\n\n12. 계속\n\n13. 진실이다.\n\n14. 다음이다.\n\nXXX 67화\n\nXXX 68화';

    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: content,
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });

        const expected = ['11. 시작', '12. 계속', '13. 진실이다.', '14. 다음이다.'];
        if (useMultiToc) expected.push('XXX 67화', 'XXX 68화');
        assert.deepEqual(Array.from(messages[0].payload.resultLines), expected);
    }
});

test('an established numeric sequence continues through another title group', async () => {
    const content = '11. 시작\n\n12. 계속\n\nXXX 66화\n\n13. 진실\n\n14. 다음\n\nXXX 67화';
    const { context, messages } = loadWorker();

    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: content,
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), [
        '11. 시작',
        '12. 계속',
        'XXX 66화',
        '13. 진실',
        '14. 다음',
        'XXX 67화'
    ]);
});

test('multi-pattern mode keeps interleaved sequential groups distinct', async () => {
    const cases = [
        {
            content: '1화 시작\n\nChapter 1 Start\n\n2화 계속\n\nChapter 2 Continue',
            expected: ['1화 시작', 'Chapter 1 Start', '2화 계속', 'Chapter 2 Continue']
        },
        {
            content: 'Arc 1 Start\n\nSide 1 Start\n\nArc 2 Continue\n\nSide 2 Continue',
            expected: ['Arc 1 Start', 'Side 1 Start', 'Arc 2 Continue', 'Side 2 Continue']
        },
        {
            content: '11화 시작\n\nXXX 67화\n\n12화 계속\n\nXXX 68화',
            expected: ['11화 시작', 'XXX 67화', '12화 계속', 'XXX 68화']
        },
        {
            content: '1화 시작\n\n2화 계속\n\n001. 시작\n\n002. 계속',
            expected: ['1화 시작', '2화 계속', '001. 시작', '002. 계속']
        },
        {
            content: '001. 시작\n\n002. 계속\n\nArc 1 Start\n\nArc 2 Continue',
            expected: ['001. 시작', '002. 계속']
        }
    ];

    for (const { content, expected } of cases) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: content,
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc: true
            }
        } });

        assert.deepEqual(Array.from(messages[0].payload.resultLines), expected);
    }
});

test('multi-pattern mode keeps equal chapter numbers from different title groups', async () => {
    const content = '1화 시작\n\n2화 계속\n\n1수 시작\n\n2수 계속';
    const expected = [
        '1화 시작',
        '2화 계속',
        '1수 시작',
        '2수 계속'
    ];
    const { context, messages } = loadWorker();

    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: { text: content, userRegex: '', useMultiToc: true }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), expected);
});

test('single-pattern mode merges different formats when chapter numbers continue', async () => {
    const continuous = '1. 시작\n본문\n2. 계속\n본문\n＃3화 전환\n본문\n＃4화 계속';
    const separate = '1. 시작\n본문\n2. 계속\n본문\n＃10화 전환\n본문\n＃11화 계속';

    for (const [content, expected] of [
        [continuous, ['1. 시작', '2. 계속', '＃3화 전환', '＃4화 계속']],
        [
            '＃109화 영웅의 길\n본문\n＃110화 전령\n본문\n111화 외계인 (1)',
            ['＃109화 영웅의 길', '＃110화 전령', '111화 외계인 (1)']
        ],
        [
            '＃109화 영웅의 길\n1. 일반 문장\n＃110화 전령\n2. 일반 문장\n111화 외계인 (1)',
            ['＃109화 영웅의 길', '＃110화 전령', '111화 외계인 (1)']
        ],
        [separate, ['1. 시작', '2. 계속']]
    ]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: content,
                userRegex: '',
                preserveCustomMatches: false,
                useMultiToc: false
            }
        } });

        assert.deepEqual(Array.from(messages[0].payload.resultLines), expected);
    }
});

test('automatic sequencing chooses the increasing numeric column', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: 'Season 1 Episode 1\n\nSeason 1 Episode 2\n\nSeason 1 Episode 3',
            userRegex: '',
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), [
        'Season 1 Episode 1',
        'Season 1 Episode 2',
        'Season 1 Episode 3'
    ]);
});

test('automatic discovery handles punctuation before the repeated word', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: '1-회차 시작\n\n2-회차 계속',
            userRegex: '',
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), ['1-회차 시작', '2-회차 계속']);
});

test('automatic discovery rejects short prose and longer prefixed runs', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: '28수\n\n흑 37수\n\n흑 38수\n\n흑 39수\n\n29수\n\n1수. 백은 둔다.\n\n2수. 흑은 둔다.',
            userRegex: '',
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), ['28수', '29수']);
});

test('automatic discovery rejects non-sequential and non-title lines', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: 'Story@001 :: Alpha\n\nStory@003 :: Gamma\n\n유키의 흑2수가 화점에 내리꽂히자 백이 곧장 수를 두었다.\n\n유키의 흑3수가 화점에 내리꽂히자 백이 곧장 수를 두었다.',
            userRegex: '',
            useMultiToc: false
        }
    } });

    assert.equal(messages[0].payload.resultItems.length, 0);
});

test('parenthesized number suffixes are offered as a selectable multi-pattern fallback', async () => {
    const content = '내집 마련의 꿈(1)\n본문\n내집 마련의 꿈(2)';

    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'PREVIEW_PARSER',
            payload: {
                requestId: 1,
                fileName: 'sample.txt',
                text: content,
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });

        assert.deepEqual(Array.from(messages[0].payload.resultItems), []);
        assert.deepEqual(
            Array.from(messages[0].payload.fallbackItems || [], (item) => item.text),
            useMultiToc ? ['내집 마련의 꿈(1)', '내집 마련의 꿈(2)'] : []
        );
    }

    const singleton = loadWorker();
    await singleton.context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '내집 마련의 꿈(2)',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true
        }
    } });
    assert.deepEqual(Array.from(singleton.messages[0].payload.fallbackItems, (item) => item.text), ['내집 마련의 꿈(2)']);

    const prose = loadWorker();
    await prose.context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '오늘은 집으로 돌아가야 한다.(2)',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true
        }
    } });
    assert.deepEqual(Array.from(prose.messages[0].payload.fallbackItems || []), []);
});

test('parenthesized fallback remains selectable alongside regular titles', async () => {
    const { context, messages } = loadWorker();
    const content = '제1화 시작\n본문\n내집 마련의 꿈(2)\n본문\n제2화 계속';
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: content,
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), ['제1화 시작', '제2화 계속']);
    assert.deepEqual(Array.from(messages[0].payload.fallbackItems, (item) => item.text), ['내집 마련의 꿈(2)']);

    await context.self.onmessage({ data: {
        type: 'CONVERT',
        payload: {
            id: 'mixed-book',
            title: 'Mixed Book',
            fileName: 'sample.txt',
            content,
            useTrim: true,
            useAutoToc: true,
            useMultiToc: true,
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            coverBuffer: null,
            coverType: '',
            language: 'ko',
            selectedFallbackIndices: [2],
            excludedIndices: []
        }
    } });

    const ncx = messages[1].payload.blob.files.get('OEBPS/toc.ncx');
    assert.equal((ncx.match(/<navPoint /g) || []).length, 3);
    assert.match(ncx, /내집 마련의 꿈\(2\)/);
});

test('parenthesized candidate count includes matching lines already detected as titles', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '제1화 시작(1)\n본문\n100억을 벌었다(2)\n본문\n제2화 계속(2)',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.fallbackItems, (item) => item.text), [
        '제1화 시작(1)',
        '100억을 벌었다(2)',
        '제2화 계속(2)'
    ]);
});

test('selected parenthesized fallback titles are applied to validation and conversion', async () => {
    const content = '내집 마련의 꿈(1)\n본문\n내집 마련의 꿈(2)';
    const { context, messages } = loadWorker();

    await context.self.onmessage({ data: {
        type: 'VALIDATE',
        payload: {
            id: 'fallback-book',
            fileName: 'sample.txt',
            text: content,
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true,
            selectedFallbackIndices: [],
            excludedIndices: []
        }
    } });
    assert.equal(messages[0].payload.isValid, 'no');

    await context.self.onmessage({ data: {
        type: 'VALIDATE',
        payload: {
            id: 'fallback-book',
            fileName: 'sample.txt',
            text: content,
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true,
            selectedFallbackIndices: [0, 2],
            excludedIndices: []
        }
    } });
    assert.equal(messages[1].payload.isValid, 'ok');

    await context.self.onmessage({ data: {
        type: 'CONVERT',
        payload: {
            id: 'fallback-book',
            title: 'Fallback Book',
            fileName: 'sample.txt',
            content,
            useTrim: true,
            useAutoToc: true,
            useMultiToc: true,
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            coverBuffer: null,
            coverType: '',
            language: 'ko',
            selectedFallbackIndices: [0, 2],
            excludedIndices: []
        }
    } });

    const ncx = messages[2].payload.blob.files.get('OEBPS/toc.ncx');
    assert.equal((ncx.match(/<navPoint /g) || []).length, 2);
    assert.match(ncx, /내집 마련의 꿈\(1\)/);
    assert.match(ncx, /내집 마련의 꿈\(2\)/);
});

test('automatic patterns do not join known titles from repetition alone', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: '1화 시작\n\n2화 계속\n\n401호.\n\n402호.\n\n403호.',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultLines), ['1화 시작', '2화 계속']);
});

test('file-table clicks do not reopen the picker during a row rerender', () => {
    const handlerBody = html.match(/dom\.dropZone\.onclick = \(e\) => \{([^}]*)\};/)[1];
    const tableWrapper = {};
    let pickerClicks = 0;
    const dom = {
        tableWrapper,
        fileInput: { click() { pickerClicks++; } }
    };
    const handler = Function('dom', `return (e) => {${handlerBody}}`)(dom);

    handler({
        target: { closest() { return null; } },
        composedPath() { return [{}, tableWrapper, {}]; }
    });
    assert.equal(pickerClicks, 0);

    handler({
        target: { closest() { return null; } },
        composedPath() { return [{}, {}]; }
    });
    assert.equal(pickerClicks, 1);
});

test('EPUB metadata stays consistent and long chapters are split', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'CONVERT',
        payload: {
            id: 'book',
            title: 'Sample',
            content: Array.from({ length: 901 }, (_, index) => `Line ${index}`).join('\n'),
            useTrim: true,
            useAutoToc: false,
            useMultiToc: false,
            userRegex: '',
            coverBuffer: null,
            coverType: '',
            language: 'en',
            excludedIndices: []
        }
    } });

    const files = messages[0].payload.blob.files;
    const opf = files.get('OEBPS/content.opf');
    const ncx = files.get('OEBPS/toc.ncx');
    const id = opf.match(/<dc:identifier id="uid">([^<]+)<\/dc:identifier>/)[1];
    assert.match(opf, /<dc:language>en<\/dc:language>/);
    assert.match(ncx, new RegExp(`name="dtb:uid" content="${id}"`));
    assert.equal([...files.keys()].filter(name => /OEBPS\/ch_\d+\.xhtml$/.test(name)).length, 3);
});

test('duplicate and unsafe output titles get safe unique filenames', () => {
    const helper = html.match(/function getEpubFilename[\s\S]*?(?=\n\s*const SUPPORTED_COVER_TYPES)/)[0];
    const context = vm.createContext({});
    vm.runInContext(helper, context);
    const used = new Set();
    assert.equal(context.getEpubFilename('a/b', used), 'a_b.epub');
    assert.equal(context.getEpubFilename('a/b', used), 'a_b (2).epub');
});

test('public pages expose stable crawl metadata and sitemap entries', () => {
    const origin = 'https://epub-studio-mocha.vercel.app';
    const pages = new Map([
        ['index.html', `${origin}/`],
        ['about.html', `${origin}/about.html`],
        ['privacy.html', `${origin}/privacy.html`],
        ['contact.html', `${origin}/contact.html`]
    ]);

    for (const [file, url] of pages) {
        const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
        assert.ok(source.includes(`<link rel="canonical"${file === 'index.html' ? ' id="canonicalLink"' : ''} href="${url}">`));
        assert.ok(source.includes(`<meta property="og:url" content="${url}">`));
        assert.ok(source.includes(`hreflang="en" href="${url}${url.includes('?') ? '&' : '?'}lang=en">`));
    }

    const robots = readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
    assert.match(robots, /Sitemap: https:\/\/epub-studio-mocha\.vercel\.app\/sitemap\.xml/);

    const sitemap = readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
    for (const url of pages.values()) assert.ok(sitemap.includes(`<loc>${url}</loc>`));

    const i18n = readFileSync(new URL('../i18n.js', import.meta.url), 'utf8');
    assert.match(i18n, /canonical\.href = makePublicUrl\(current\.lang\)/);
});
