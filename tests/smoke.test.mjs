import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const defaultTitleRegex = html.match(/id="regexInput" value="([^"]+)"/)[1];

function loadWorker(reportProgress = false) {
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
        async generateAsync(options, onUpdate) {
            if (reportProgress) [10, 60, 100].forEach(percent => onUpdate({ percent }));
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

function loadEncodingDetector() {
    const source = html.match(/const detectFileEncoding = ([\s\S]*?);\s*\n\s*async function readFileText/)[1];
    return Function(`return (${source});`)();
}

function loadFileReader() {
    const source = html.match(/async function readFileText[\s\S]*?\n    }\s*\n\s*function updatePreviewCopyButtonState/)[0]
        .replace(/\s*function updatePreviewCopyButtonState[\s\S]*$/, '');
    return Function(`${source}; return readFileText;`)();
}

function loadStore() {
    const source = html.match(/class Store \{[\s\S]*?(?=\n    const store =)/)[0];
    return vm.runInNewContext(`${source}; Store;`);
}

test('changing one file multi-pattern setting preserves other files and resets only its output status', () => {
    const Store = loadStore();
    const first = { id: 'a', useMultiToc: false, state: 'done', isValid: 'ok', customTitle: 'first' };
    const second = { id: 'b', useMultiToc: false, state: 'done', isValid: 'ok' };
    const store = new Store({ files: [first, second] });
    store.dispatch({ type: 'UPDATE_FILE_MULTI_TOC', payload: { id: 'a', useMultiToc: true } });
    assert.equal(store.state.files[0].useMultiToc, true);
    assert.equal(store.state.files[0].state, 'wait');
    assert.equal(store.state.files[0].isValid, 'none');
    assert.equal(store.state.statusKey, 'statusReady');
    assert.equal(store.state.files[0].customTitle, 'first');
    assert.equal(store.state.files[1], second);
    assert.equal(first.useMultiToc, false);
});

test('file multi-pattern controls refresh only that file without changing the default', () => {
    const Store = loadStore();
    const store = new Store({ files: [{ id: 'a', useMultiToc: false }, { id: 'b', useMultiToc: true }], isProcessing: false });
    const validated = [];
    const previewed = [];
    const dom = { optToc: { checked: true }, optMultiToc: { checked: false }, previewDialog: { open: true } };
    const source = html.match(/function setFileMultiToc[\s\S]*?(?=\n    function handlePreviewOptionChange)/)[0];
    const context = vm.createContext({ store, dom, currentPreviewFileId: 'a',
        validateFileById: id => validated.push(id), previewFileById: id => previewed.push(id) });
    vm.runInContext(source, context);
    context.setFileMultiToc('a', true);
    assert.deepEqual(validated, ['a']);
    assert.deepEqual(previewed, ['a']);
    assert.equal(dom.optMultiToc.checked, false);
    context.setFileMultiToc('a', true);
    context.setFileMultiToc('missing', false);
    assert.deepEqual(validated, ['a']);
    context.setFileMultiToc('b', false);
    assert.deepEqual(validated, ['a', 'b']);
    assert.deepEqual(previewed, ['a']);
    store.state.isProcessing = true;
    context.setFileMultiToc('a', false);
    store.state.isProcessing = false;
    dom.optToc.checked = false;
    context.setFileMultiToc('a', false);
    assert.equal(store.state.files[0].useMultiToc, true);
    assert.deepEqual(validated, ['a', 'b']);
});

test('validation uses each file setting and discards outdated reads and worker responses', async () => {
    const Store = loadStore();
    const store = new Store({ files: [{ id: 'a', useMultiToc: false, file: {} }, { id: 'b', useMultiToc: true, file: {} }] });
    const messages = [];
    const requestIds = new Map();
    const context = vm.createContext({ store, validationRequestIds: requestIds, workerFailed: false,
        dom: { optMultiToc: { checked: false }, regexInput: { value: '', defaultValue: '' } },
        readFileText: async () => '1화 시작\n\n2화 계속',
        parserWorker: { postMessage: message => messages.push(message) },
        getSelectedFallbackLines: () => new Set(), getExcludedPreviewLines: () => new Set() });
    vm.runInContext(html.match(/async function validateFileById[\s\S]*?(?=\n    async function validateFiles)/)[0], context);
    await context.validateFileById('a');
    await context.validateFileById('b');
    assert.deepEqual(messages.map(message => message.payload.useMultiToc), [false, true]);
    let finishOldRead;
    context.readFileText = () => new Promise(resolve => { finishOldRead = resolve; });
    const outdated = context.validateFileById('a');
    context.readFileText = async () => 'new';
    store.dispatch({ type: 'UPDATE_FILE_MULTI_TOC', payload: { id: 'a', useMultiToc: true } });
    await context.validateFileById('a');
    finishOldRead('old');
    await outdated;
    assert.equal(messages.length, 3);
    assert.equal(messages[2].payload.useMultiToc, true);
    assert.equal(messages[2].payload.requestId, 3);
    const responseBody = html.match(/else if \(type === 'VALIDATE_RESULT'\) \{([\s\S]*?)\n        }/)[1];
    const respond = Function('payload', 'validationRequestIds', 'store', responseBody);
    respond({ id: 'a', requestId: 1, isValid: 'no' }, requestIds, store);
    assert.equal(store.state.files[0].isValid, 'none');
    respond({ id: 'a', requestId: 3, isValid: 'ok' }, requestIds, store);
    assert.equal(store.state.files[0].isValid, 'ok');
    requestIds.delete('a');
    respond({ id: 'a', requestId: 3, isValid: 'no' }, requestIds, store);
    assert.equal(store.state.files[0].isValid, 'ok');
});

test('adding files analyzes only new TXT files and preserves existing analysis and settings', async () => {
    const Store = loadStore();
    const existing = { id: 'old', customTitle: 'edited title', useMultiToc: false, state: 'done', isValid: 'ok' };
    const store = new Store({ files: [existing] });
    const validated = [];
    let additions = 0;
    store.subscribe(() => additions++);
    const dom = { optMultiToc: { checked: true } };
    const source = html.match(/async function handleFiles[\s\S]*?(?=\n    async function validateFileById)/)[0];
    const context = vm.createContext({ store, dom, detectFileEncoding: () => 'UTF-8',
        validateFileById: async id => validated.push(id) });
    vm.runInContext(source, context);
    const file = name => ({ name, slice() { return { arrayBuffer: async () => {
        dom.optMultiToc.checked = false;
        return new ArrayBuffer(0);
    } }; } });
    await context.handleFiles([file('first.txt'), file('second.TXT'), file('ignored.pdf')]);
    assert.equal(store.state.files.length, 3);
    assert.equal(store.state.files[0], existing);
    assert.deepEqual(validated, Array.from(store.state.files.slice(1), item => item.id));
    assert.equal(validated.includes('old'), false);
    assert.equal(store.state.files[1].useMultiToc, true);
    assert.equal(store.state.files[2].useMultiToc, true);
    await context.handleFiles([file('ignored.pdf')]);
    await context.handleFiles([]);
    assert.equal(additions, 1);
    assert.equal(validated.length, 2);
});

test('preview toggle buttons invert only their current file setting without checkbox state', () => {
    const store = { state: { files: [{ id: 'a', useMultiToc: false }, { id: 'b', useMultiToc: true }] } };
    const calls = [];
    const body = html.match(/dom\.previewMultiTocToggle\.addEventListener\('click', \(\) => \{([\s\S]*?)\n    }\);/)[1];
    const context = vm.createContext({ store, currentPreviewFileId: 'a', setFileMultiToc(id, value) {
        calls.push([id, value]);
        store.state.files.find(file => file.id === id).useMultiToc = value;
    } });
    vm.runInContext(`function clickToggle() {${body}}`, context);
    context.clickToggle();
    context.clickToggle();
    assert.deepEqual(calls, [['a', true], ['a', false]]);
    assert.equal(store.state.files[1].useMultiToc, true);
    context.currentPreviewFileId = 'missing';
    context.clickToggle();
    assert.equal(calls.length, 2);
});

test('worker validation echoes the request identity for rapid file setting changes', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: { type: 'VALIDATE', payload: {
        id: 'a', requestId: 42, text: '1화 시작\n\n2화 계속', userRegex: '', useMultiToc: false
    } } });
    assert.equal(messages[0].payload.id, 'a');
    assert.equal(messages[0].payload.requestId, 42);
    assert.equal(messages[0].payload.isValid, 'ok');
});

test('preview worker returns a language-neutral total line count', async () => {
    for (const text of ['One line', '1화 시작\n\n본문\n\n2화 계속']) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: {
            fileName: 'sample.txt', requestId: 7, text, userRegex: '', useMultiToc: false
        } } });
        assert.equal(messages[0].type, 'PREVIEW_RESULT');
        assert.equal(messages[0].payload.lineCount, text.split('\n').length);
        assert.equal(messages[0].payload.fileName, 'sample.txt');
        assert.equal('meta' in messages[0].payload, false);
    }
});

test('preview metadata translates line counts and uses the English singular for one line', () => {
    const i18n = readFileSync(new URL('../i18n.js', import.meta.url), 'utf8');
    const single = [...i18n.matchAll(/previewLine: '([^']+)'/g)].map(match => match[1]);
    const plural = [...i18n.matchAll(/previewLines: '([^']+)'/g)].map(match => match[1]);
    let language = 0;
    const context = vm.createContext({ window: { EPUB_STUDIO_I18N: {
        t: (key, { count }) => (key === 'previewLine' ? single : plural)[language].replace('{count}', count)
    } } });
    vm.runInContext(html.match(/function formatPreviewFileMeta[\s\S]*?(?=\n    function openPreviewDialog)/)[0], context);
    assert.equal(context.formatPreviewFileMeta('sample.txt', 1), 'sample.txt · 1줄');
    assert.equal(context.formatPreviewFileMeta('sample.txt', 5), 'sample.txt · 5줄');
    language = 1;
    assert.equal(context.formatPreviewFileMeta('sample.txt', 1), 'sample.txt · 1 line');
    assert.equal(context.formatPreviewFileMeta('sample.txt', 5), 'sample.txt · 5 lines');
    assert.equal(context.formatPreviewFileMeta('', 0), '0 lines');
});

test('preview mode label shows the current file setting even while results are loading', () => {
    const attributes = new Map();
    const toggle = { setAttribute: (name, value) => attributes.set(name, value), textContent: '' };
    const store = { state: { files: [{ id: 'a', useMultiToc: false }, { id: 'b', useMultiToc: true }] } };
    const context = vm.createContext({ store, currentPreviewFileId: 'a', currentPreviewItems: [], currentPreviewFallbackItems: [],
        window: { EPUB_STUDIO_I18N: { t: key => key } },
        dom: { previewDialog: { open: true, dataset: {} }, previewFileName: {}, previewFileMeta: {},
            previewMultiTocToggle: toggle, previewSummary: {}, previewCandidate: {}, previewRepairCandidates: {}, previewList: {}, previewCopyBtn: {} } });
    vm.runInContext(html.match(/function openPreviewDialog[\s\S]*?(?=\n    async function copyPreviewLine)/)[0], context);
    for (const [id, label, pressed] of [['a', 'tocModeSingle', 'false'], ['b', 'tocModeMultiple', 'true'], ['missing', 'tocModeSingle', 'false']]) {
        context.currentPreviewFileId = id;
        context.openPreviewDialog('file', '', [], [], 'loading');
        assert.equal(toggle.textContent, label);
        assert.equal(attributes.get('aria-pressed'), pressed);
    }
});

test('file removal is blocked during conversion and works after it finishes', () => {
    const Store = loadStore();
    const file = { id: 'a' };
    const store = new Store({ files: [file], isProcessing: true });
    const processingState = store.state;
    store.dispatch({ type: 'REMOVE_FILE', payload: 'a' });
    assert.equal(store.state, processingState);
    store.dispatch({ type: 'FINISH_PROCESSING' });
    store.dispatch({ type: 'REMOVE_FILE', payload: 'a' });
    assert.equal(store.state.files.length, 0);
    assert.match(html, /removeBtn\.disabled = store\.state\.isProcessing/);
});

test('new files reset completed status without overwriting an active conversion', () => {
    const Store = loadStore();
    const completed = { id: 'a', state: 'done' };
    const store = new Store({ files: [completed], statusKey: 'statusDone', progress: 100 });
    store.dispatch({ type: 'ADD_FILES', payload: [{ id: 'b', state: 'wait' }] });
    assert.equal(store.state.statusKey, 'statusReady');
    assert.equal(store.state.progress, 0);
    assert.equal(store.state.files[0], completed);
    store.dispatch({ type: 'START_PROCESSING', payload: { totalCount: 2 } });
    store.dispatch({ type: 'SET_PROGRESS', payload: 50 });
    store.dispatch({ type: 'ADD_FILES', payload: [{ id: 'c', state: 'wait' }] });
    assert.equal(store.state.statusKey, 'statusProcessing');
    assert.equal(store.state.progress, 50);
});

test('a failed file read does not strand later files or overwrite newer validation', async () => {
    const Store = loadStore();
    const store = new Store({ files: [{ id: 'a', file: {} }, { id: 'b', file: {} }] });
    const messages = [];
    const context = vm.createContext({ store, validationRequestIds: new Map(), workerFailed: false,
        dom: { regexInput: { value: '', defaultValue: '' } },
        readFileText: async file => { if (file === store.state.files[0].file) throw new Error('read failed'); return 'text'; },
        parserWorker: { postMessage: message => messages.push(message) },
        getSelectedFallbackLines: () => new Set(), getExcludedPreviewLines: () => new Set() });
    vm.runInContext(html.match(/async function validateFileById[\s\S]*?(?=\n    async function convertFiles)/)[0], context);
    await context.validateFiles();
    assert.equal(store.state.files[0].isValid, 'error');
    assert.deepEqual(messages.map(message => message.payload.id), ['b']);
    let failOldRead;
    context.readFileText = () => new Promise((resolve, reject) => { failOldRead = reject; });
    const old = context.validateFileById('a');
    context.readFileText = async () => 'new';
    await context.validateFileById('a');
    store.dispatch({ type: 'UPDATE_FILE_VALIDITY', payload: { id: 'a', isValid: 'ok' } });
    failOldRead(new Error('outdated failure'));
    await old;
    assert.equal(store.state.files[0].isValid, 'ok');
    context.parserWorker.postMessage = () => { throw new Error('worker unavailable'); };
    await context.validateFileById('b');
    assert.equal(store.state.files[1].isValid, 'error');
});

test('failure to read an encoding sample preserves the row and allows later files to load', async () => {
    const Store = loadStore();
    const store = new Store({ files: [] });
    const validated = [];
    const context = vm.createContext({ store, dom: { optMultiToc: { checked: false } },
        detectFileEncoding: () => 'CP949', validateFileById: async id => validated.push(id) });
    vm.runInContext(html.match(/async function handleFiles[\s\S]*?(?=\n    async function validateFileById)/)[0], context);
    const file = (name, fails) => ({ name, slice: () => ({ arrayBuffer: async () => {
        if (fails) throw new Error('sample unreadable');
        return new ArrayBuffer(0);
    } }) });
    await context.handleFiles([file('bad.txt', true), file('good.txt', false)]);
    assert.equal(store.state.files.length, 2);
    assert.equal(store.state.files[0].isValid, 'error');
    assert.equal(store.state.files[1].encoding, 'CP949');
    assert.deepEqual(validated, [store.state.files[1].id]);
});

test('worker validation failures include the request identity and operation', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: { type: 'VALIDATE', payload: {
        id: 'a', requestId: 42, get text() { throw new Error('invalid text'); }
    } } });
    assert.equal(messages[0].type, 'ERROR');
    assert.equal(messages[0].payload.operation, 'VALIDATE');
    assert.equal(messages[0].payload.requestId, 42);
    assert.equal(messages[0].payload.id, 'a');
});

test('worker sends actual compression progress before the EPUB result', async () => {
    const { context, messages } = loadWorker(true);
    await context.self.onmessage({ data: { type: 'CONVERT', payload: {
        id: 'book', title: 'Book', content: '본문', useAutoToc: false, useTrim: false, userRegex: ''
    } } });
    assert.deepEqual(messages.filter(message => message.type === 'CONVERT_PROGRESS').map(message => message.payload.percent), [10, 60, 100]);
    assert.equal(messages.at(-1).type, 'CONVERT_RESULT');
    assert.equal(messages.at(-1).payload.id, 'book');
});

test('conversion progress covers individual files and final batch ZIP compression', async () => {
    for (const zip of [false, true]) {
        const Store = loadStore();
        const store = new Store({ files: [{ id: 'a', state: 'wait', file: {}, customTitle: 'a' },
            { id: 'b', state: 'wait', file: {}, customTitle: 'b' }] });
        const progress = [];
        const downloads = [];
        const resolvers = new Map();
        store.subscribe((state, action) => { if (action.type === 'SET_PROGRESS') progress.push(state.progress); });
        const context = vm.createContext({ store, conversionResolvers: resolvers, workerFailed: false,
            dom: { optZip: { checked: zip }, optTrim: {}, optToc: {}, regexInput: {} },
            window: { EPUB_STUDIO_I18N: { lang: 'ko' } }, readFileText: async () => 'text',
            JSZip: class { file() {} async generateAsync(options, onUpdate) { onUpdate({ percent: 50 }); onUpdate({ percent: 100 }); return {}; } },
            parserWorker: { postMessage: ({ payload }) => {
                const pending = resolvers.get(payload.id);
                pending.onProgress(50);
                pending.resolve({});
                resolvers.delete(payload.id);
            } },
            getFileStats: files => ({ done: files.filter(file => file.state === 'done').length, error: 0 }),
            getEpubFilename: title => title + '.epub', triggerDownload: (blob, name) => downloads.push(name),
            getSelectedFallbackLines: () => new Set(), getExcludedPreviewLines: () => new Set() });
        vm.runInContext(html.match(/function requestConversion[\s\S]*?(?=\n    dom\.convertBtn\.onclick)/)[0], context);
        await context.convertFiles();
        assert.deepEqual(progress, zip ? [22.5, 45, 67.5, 90, 95, 100] : [25, 50, 75, 100]);
        assert.deepEqual(downloads, zip ? ['EPUB_COLLECTION.zip'] : ['a.epub', 'b.epub']);
        assert.equal(store.state.isProcessing, false);
        assert.equal(store.state.statusKey, 'statusDone');
    }
});

test('non-adjacent selections form ordered groups and ungrouping restores original files', () => {
    const Store = loadStore();
    const files = [{ id: 'a', state: 'done', customTitle: 'First' }, { id: 'b' }, { id: 'c', useMultiToc: true }, { id: 'd' }];
    const store = new Store({ files, groups: [], selectedIds: [] });
    const select = id => store.dispatch({ type: 'SELECT_FILE', payload: { id, checked: true } });
    select('c');
    store.dispatch({ type: 'GROUP_FILES' });
    assert.equal(store.state.groups.length, 0);
    select('a');
    store.dispatch({ type: 'GROUP_FILES' });
    const [group, second, fourth] = store.getQueueItems();
    assert.equal(group.customTitle, 'First');
    assert.deepEqual(Array.from(group.sources), [files[0], files[2]]);
    assert.equal(second, files[1]);
    assert.equal(fourth, files[3]);
    assert.equal(store.state.files, files);
    assert.equal(store.state.selectedIds.length, 0);
    select('a');
    select('missing');
    assert.equal(store.state.selectedIds.length, 0);
    select('d');
    select('b');
    store.dispatch({ type: 'GROUP_FILES' });
    assert.deepEqual(Array.from(store.getQueueItems(), item => item.id), ['group-a', 'group-b']);
    const state = store.state;
    store.state.isProcessing = true;
    store.dispatch({ type: 'UNGROUP_FILES', payload: group.id });
    store.dispatch({ type: 'GROUP_FILES' });
    select('d');
    assert.equal(store.state, state);
    store.state.isProcessing = false;
    store.dispatch({ type: 'UNGROUP_FILES', payload: group.id });
    store.dispatch({ type: 'UNGROUP_FILES', payload: 'group-b' });
    assert.equal(store.getQueueItems(), files);
    select('a');
    store.dispatch({ type: 'REMOVE_FILE', payload: 'a' });
    assert.equal(store.state.selectedIds.length, 0);
});

test('merged EPUB matches separately parsed TOCs, preserving file-local selections and repeated numbering', async () => {
    const regular = ['제1화 시작', '제2화 계속', '제3화 마지막'];
    const content = [...regular, '다른 제목(1)', '다른 제목(2)'].join('\n본문\n');
    const base = { content, useAutoToc: true, useTrim: true, userRegex: defaultTitleRegex,
        preserveCustomMatches: false, fileName: 'sample.txt' };
    const sources = [
        { ...base, title: 'first', useMultiToc: false, selectedFallbackIndices: [6, 8], excludedIndices: [6] },
        { ...base, title: 'second', useMultiToc: true, selectedFallbackIndices: [], excludedIndices: [2] }
    ];
    const expected = [];
    for (const source of sources) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: { type: 'CONVERT', payload: { ...source, title: 'Book', id: 'single' } } });
        const ncx = messages.at(-1).payload.blob.files.get('OEBPS/toc.ncx');
        expected.push(...Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), match => match[1]));
    }
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: { type: 'CONVERT', payload: { id: 'merge', title: 'Combined & book', sources,
        language: 'en', coverType: 'image/png', coverBuffer: new Uint8Array([1, 2, 3]).buffer } } });
    const files = messages.at(-1).payload.blob.files;
    const ncx = files.get('OEBPS/toc.ncx');
    const titles = Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), match => match[1]);
    assert.deepEqual(titles, expected);
    assert.equal(titles.filter(title => title === regular[0]).length, 2);
    assert.equal(titles.filter(title => title === regular[1]).length, 1);
    assert.equal(titles.filter(title => title === '다른 제목(2)').length, 1);
    assert.match(files.get('OEBPS/content.opf'), /<dc:title>Combined &amp; book<\/dc:title>/);
    assert.match(files.get('OEBPS/content.opf'), /<dc:language>en<\/dc:language>/);
    assert.ok(files.has('OEBPS/images/cover.png'));
    const ids = Array.from(files.get('OEBPS/content.opf').matchAll(/<item id="([^"]+)"/g), match => match[1]);
    assert.equal(ids.length, new Set(ids).size);
});

test('merging files without a TOC preserves source order and splits long chapters', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: { type: 'CONVERT', payload: { id: 'merge', title: 'Book', sources: [
        { title: 'First', content: Array.from({ length: 1000 }, (_, i) => 'first ' + i).join('\n'), useAutoToc: false },
        { title: 'Second', content: 'second body', useAutoToc: false }
    ] } } });
    const files = messages.at(-1).payload.blob.files;
    assert.match(files.get('OEBPS/ch_0.xhtml'), /first 0<\/p>/);
    assert.match(files.get('OEBPS/ch_2.xhtml'), /first 999<\/p>/);
    assert.match(files.get('OEBPS/ch_3.xhtml'), /second body/);
    const ncx = files.get('OEBPS/toc.ncx');
    assert.match(ncx, /First[\s\S]*Second/);
    assert.equal((ncx.match(/<navPoint /g) || []).length, 2);
});

function loadMergeConversion({ readFailure = false, workerFailure = false, stopDuring = '', mixed = false, zip = false, zipFailure = false } = {}) {
    const Store = loadStore();
    const firstCover = { type: 'image/png', arrayBuffer: async () => new Uint8Array([1]).buffer };
    const files = [
        { id: 'a', state: 'done', file: { name: 'a.txt' }, customTitle: 'First', encoding: 'CP949', useMultiToc: false, coverBlob: firstCover },
        { id: 'b', state: 'wait', file: { name: 'b.txt' }, customTitle: 'Second', encoding: 'UTF-16LE', useMultiToc: true,
            coverBlob: { arrayBuffer: () => { throw new Error('Only the first cover should be read'); } } }
    ];
    if (mixed) files.splice(1, 0, { id: 'c', state: 'wait', file: { name: 'c.txt' }, customTitle: 'Standalone' });
    const store = new Store({ files, groups: [], selectedIds: ['b', 'a'] });
    store.dispatch({ type: 'GROUP_FILES' });
    const reads = [], downloads = [], payloads = [], progress = [], resolvers = new Map();
    const zipEntries = [];
    store.subscribe((state, action) => { if (action.type === 'SET_PROGRESS') progress.push(state.progress); });
    const context = vm.createContext({ store, conversionResolvers: resolvers, workerFailed: false,
        dom: { optZip: { checked: zip }, optTrim: { checked: true }, optToc: { checked: true }, regexInput: { value: 'custom', defaultValue: '' } },
        JSZip: class {
            file(name) { zipEntries.push(name); }
            async generateAsync(_, onUpdate) {
                if (zipFailure) throw new Error('ZIP failed');
                if (stopDuring === 'zip') store.dispatch({ type: 'STOP_PROCESSING' });
                onUpdate({ percent: 100 });
                return {};
            }
        },
        window: { EPUB_STUDIO_I18N: { lang: 'ko' } },
        readFileText: async (file, encoding) => {
            reads.push([file.name, encoding]);
            if (readFailure && file.name === 'b.txt') throw new Error('Cannot read');
            if (stopDuring === 'read') store.dispatch({ type: 'STOP_PROCESSING' });
            return file.name + ' body';
        },
        parserWorker: { postMessage: ({ payload }) => {
            payloads.push(payload);
            if (workerFailure) throw new Error('Worker failed');
            const pending = resolvers.get(payload.id);
            pending.onProgress(50);
            if (stopDuring === 'worker') store.dispatch({ type: 'STOP_PROCESSING' });
            pending.resolve({});
            resolvers.delete(payload.id);
        } },
        getFileStats: files => ({ done: files.filter(file => file.state === 'done').length, error: files.filter(file => file.state === 'error').length }),
        getEpubFilename: title => title + '.epub', triggerDownload: (blob, name) => downloads.push(name),
        getSelectedFallbackLines: id => new Set(id === 'a' ? [6, 8] : []), getExcludedPreviewLines: id => new Set(id === 'a' ? [2] : [4]) });
    vm.runInContext(html.match(/function requestConversion[\s\S]*?(?=\n    dom\.convertBtn\.onclick)/)[0], context);
    return { context, store, reads, downloads, payloads, resolvers, progress, zipEntries };
}

test('merge includes completed files and preserves each encoding, settings, selections and first cover', async () => {
    const run = loadMergeConversion();
    await run.context.convertFiles();
    assert.deepEqual(run.reads, [['a.txt', 'CP949'], ['b.txt', 'UTF-16LE']]);
    assert.deepEqual(run.downloads, ['First.epub']);
    const payload = run.payloads[0];
    assert.equal(payload.coverType, 'image/png');
    assert.equal(payload.title, 'First');
    assert.deepEqual(Array.from(payload.sources, source => source.useMultiToc), [false, true]);
    assert.deepEqual(Array.from(payload.sources[0].selectedFallbackIndices), [6, 8]);
    assert.deepEqual(Array.from(payload.sources[1].excludedIndices), [4]);
    assert.equal(payload.sources.every(source => source.useAutoToc && source.useTrim && source.preserveCustomMatches), true);
    assert.deepEqual(Array.from(run.store.state.files, file => file.state), ['done', 'wait']);
    assert.equal(run.store.state.groups[0].state, 'done');
    assert.equal(run.store.state.isProcessing, false);
    assert.equal(run.resolvers.size, 0);
    assert.deepEqual(run.progress.map(value => Math.round(value)), [10, 20, 60, 100]);
});

test('merge never downloads partial output after read failures, worker failures or stop requests', async () => {
    for (const options of [{ readFailure: true }, { workerFailure: true }, { stopDuring: 'read' }, { stopDuring: 'worker' }]) {
        const run = loadMergeConversion(options);
        await run.context.convertFiles();
        assert.deepEqual(run.downloads, []);
        assert.equal(run.store.state.isProcessing, false);
        assert.equal(run.resolvers.size, 0);
        assert.equal(run.store.state.files.some(file => file.state === 'ing'), false);
        assert.equal(run.store.state.groups[0].state, options.stopDuring ? 'wait' : 'error');
        assert.equal(run.store.state.statusKey, options.stopDuring ? 'statusStopped' : 'statusError');
        if (options.readFailure) {
            assert.equal(run.payloads.length, 0);
            assert.deepEqual(Array.from(run.store.state.files, file => file.state), ['done', 'wait']);
        }
    }
});

test('mixed queues output one EPUB per group or standalone item, with optional ZIP packaging', async () => {
    for (const zip of [false, true]) {
        const run = loadMergeConversion({ mixed: true, zip });
        await run.context.convertFiles();
        assert.deepEqual(Array.from(run.payloads[0].sources, source => source.fileName), ['a.txt', 'b.txt']);
        assert.equal(run.payloads[1].fileName, 'c.txt');
        assert.deepEqual(run.downloads, zip ? ['EPUB_COLLECTION.zip'] : ['First.epub', 'Standalone.epub']);
        assert.deepEqual(run.zipEntries, zip ? ['First.epub', 'Standalone.epub'] : []);
    }
    const single = loadMergeConversion({ mixed: true, zip: true });
    await single.context.convertFiles(['group-a']);
    assert.deepEqual(single.downloads, ['First.epub']);
    assert.deepEqual(single.zipEntries, []);

    const bundleOnly = loadMergeConversion({ zip: true });
    await bundleOnly.context.convertFiles();
    assert.deepEqual(bundleOnly.downloads, ['EPUB_COLLECTION.zip']);
    assert.deepEqual(bundleOnly.zipEntries, ['First.epub']);
});

test('failed groups do not block standalone conversions and interrupted ZIPs never mark items done', async () => {
    const failure = loadMergeConversion({ mixed: true, zip: true, readFailure: true });
    await failure.context.convertFiles();
    assert.deepEqual(failure.zipEntries, ['Standalone.epub']);
    assert.equal(failure.store.state.groups[0].state, 'error');
    assert.equal(failure.store.state.statusKey, 'statusError');
    for (const options of [{ stopDuring: 'zip' }, { zipFailure: true }]) {
        const run = loadMergeConversion({ mixed: true, zip: true, ...options });
        await run.context.convertFiles();
        assert.deepEqual(run.downloads, []);
        assert.equal(run.store.state.isProcessing, false);
        assert.equal(run.store.state.statusKey, options.zipFailure ? 'statusError' : 'statusStopped');
        assert.deepEqual(Array.from(run.store.getQueueItems(), item => item.state), options.zipFailure ? ['error', 'error'] : ['wait', 'wait']);
    }
});

test('button localization preserves the advanced settings icon and updates plain buttons', () => {
    const i18n = readFileSync(new URL('../i18n.js', import.meta.url), 'utf8');
    const source = i18n.match(/function setButton\([\s\S]*?\n    }/)[0];
    const label = { textContent: '' };
    const trigger = { querySelector: () => label, textContent: 'original icon and label' };
    const plain = { querySelector: () => null, textContent: '' };
    const context = vm.createContext({
        document: { getElementById: id => ({ trigger, plain })[id] },
        current: { lang: 'ko' },
        getString: (key, lang) => `${lang}:${key}`
    });
    vm.runInContext(source, context);
    context.setButton('trigger', 'advancedToggle');
    context.setButton('plain', 'testButton');
    context.setButton('missing', 'testButton');
    assert.equal(label.textContent, 'ko:advancedToggle');
    assert.equal(trigger.textContent, 'original icon and label');
    assert.equal(plain.textContent, 'ko:testButton');
});

test('encoding detection prefers valid UTF-8 and recognizes short CP949 Korean text', () => {
    const detectEncoding = loadEncodingDetector();
    const utf8 = new TextEncoder().encode('옥션 하우스').buffer;
    const cp949 = new Uint8Array([0xBF, 0xC1, 0xBC, 0xC7, 0x20, 0xC7, 0xCF, 0xBF, 0xEC, 0xBD, 0xBA]).buffer;
    const misleadingDetector = () => ({ encoding: 'windows-1252', confidence: 0.95 });

    assert.equal(detectEncoding(utf8, misleadingDetector), 'UTF-8');
    assert.equal(detectEncoding(cp949, misleadingDetector), 'CP949');
});

test('file reading recovers when UTF-8 and CP949 sampling picks the wrong encoding', async () => {
    const readFileText = loadFileReader();
    const bytes = new Uint8Array([0xBF, 0xC1, 0xBC, 0xC7, 0x20, 0xC7, 0xCF, 0xBF, 0xEC, 0xBD, 0xBA]);
    const asFile = (content) => ({
        slice(start = 0, end = bytes.length) {
            const chunk = content.slice(start, end);
            return { arrayBuffer: async () => chunk.buffer };
        },
        arrayBuffer: async () => content.buffer
    });

    assert.equal(await readFileText(asFile(bytes), 'UTF-8'), '옥션 하우스');

    const utf8 = new TextEncoder().encode('#1. 오늘은 우리가 함께 걷는다');
    assert.equal(await readFileText(asFile(utf8), 'CP949'), '#1. 오늘은 우리가 함께 걷는다');
});

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

test('wrapped hash-prefixed repeated chapters keep sequential parenthesized parts', async () => {
    const content = '105장 이전 이야기\n\n본문\n\n# 106장 하북성으로 (1) #\n\n본문\n\n# 106장 하북성으로 (2) #\n\n본문\n\n107장 다음 이야기';

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

        assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), [
            '105장 이전 이야기',
            '# 106장 하북성으로 (1) #',
            '# 106장 하북성으로 (2) #',
            '107장 다음 이야기'
        ]);
    }
});

test('matching chapter and part sequences recover out-of-order titles without reordering the text', async () => {
    const titles = ['267화. 정파', '268화. 정파(2)', '269화. 정파(3)', '270화. 정파(4)'];
    const earlierTitles = ['264화. 이전 제목', '265화. 이전 제목(2)', '266화. 이전 제목(3)'];
    const outOfOrder = [...earlierTitles, titles[0], titles[3], titles[2], titles[1], '271화. 정파(5)'];
    const cases = [
        { lines: titles, expected: titles },
        { lines: outOfOrder, expected: outOfOrder },
        {
            lines: [...earlierTitles, titles[0], '700화. 정파(3)', '701화. 정파(4)', titles[3], titles[2], titles[1], '271화. 정파(5)'],
            expected: outOfOrder
        }
    ];

    for (const { lines, expected } of cases) {
        for (const useMultiToc of [false, true]) {
            const { context, messages } = loadWorker();
            const text = lines.join('\n\n\n');
            const options = { fileName: 'sample.txt', userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc };
            await context.self.onmessage({ data: {
                type: 'PREVIEW_PARSER',
                payload: { ...options, text }
            } });

            assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), expected);
            assert.deepEqual(Array.from(messages[0].payload.fallbackItems), []);

            await context.self.onmessage({ data: {
                type: 'CONVERT',
                payload: { ...options, id: 'chapter-parts', title: 'Chapter Parts', content: text, useAutoToc: true, useTrim: true, language: 'ko' }
            } });
            const ncx = messages[1].payload.blob.files.get('OEBPS/toc.ncx');
            assert.deepEqual(Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), (match) => match[1]), expected);
        }
    }
});

test('part numbers alone do not override the expected chapter sequence', async () => {
    const regularTitles = ['264화. 이전 제목', '265화. 이전 제목(2)', '266화. 다음 제목'];
    const unrelatedRuns = [
        ['267화. 정파(1)', '700화. 정파(2)', '900화. 정파(3)'],
        ['267화. 정파(4)'],
        ['700화. 정파(1)', '701화. 정파(2)', '702화. 정파(3)']
    ];
    for (const run of unrelatedRuns) {
        for (const useMultiToc of [false, true]) {
            const { context, messages } = loadWorker();
            await context.self.onmessage({ data: {
                type: 'PREVIEW_PARSER',
                payload: {
                    text: [regularTitles[0], regularTitles[1], ...run, regularTitles[2]].join('\n\n'),
                    userRegex: defaultTitleRegex,
                    preserveCustomMatches: false,
                    useMultiToc
                }
            } });
            assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), regularTitles);
            assert.deepEqual(Array.from(messages[0].payload.fallbackItems), []);
        }
    }
});

test('angle-bracketed episode numbers allow a title after the closing bracket', async () => {
    for (const useMultiToc of [false, true]) {
        for (const [open, close] of [['〈', '〉'], ['<', '>']]) {
            const titles = [open + ' 1화 ' + close + ' 이사', open + '2화' + close + ' 면접과 첫 요리'];
            const content = [
                titles[0], '본문에서 〈 10화 〉 내용을 언급했다.',
                '〈 2화 > 잘못 닫힌 괄호', '< 2화 〉 잘못 닫힌 괄호',
                open + ' 2화 ' + close + ' 에서는 이전 일을 설명한다.',
                titles[1], open + ' 2화 ' + close + ' 끝', '뒤 본문'
            ].join('\n');
            const { context, messages } = loadWorker();
            const options = { userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc, repairLineBreaks: false };
            await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, text: content } } });
            const preview = messages.at(-1).payload;
            assert.deepEqual(Array.from(preview.resultItems, item => item.text), titles);
            assert.equal(preview.fallbackItems.length, 0);
            await context.self.onmessage({ data: { type: 'CONVERT', payload: {
                ...options, id: 'book', title: 'Book', content, useAutoToc: true
            } } });
            const ncx = messages.at(-1).payload.blob.files.get('OEBPS/toc.ncx');
            assert.deepEqual(Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g),
                match => match[1].replaceAll('&lt;', '<').replaceAll('&gt;', '>')), titles);
        }
    }
});

test('angle-wrapped titles allow a trailing bracketed chapter marker', async () => {
    const longGap = Array.from({ length: 200 }, (_, index) => ['', '   ', '\t', '&#x20;'][index % 4]).join('\r\n');
    const content = '< 집 - [서장] >\n본문\n< 위층 복도 - [1] >\n본문\n< 독방 - [3] >&#x20;\r\n' + longGap + '\r\n< 지하 창고 - [8] >';

    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: { text: content, userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc }
        } });

        assert.deepEqual(Array.from(messages[0].payload.resultLines), [
            '< 집 - [서장] >',
            '< 위층 복도 - [1] >',
            '< 독방 - [3] >&#x20;',
            '< 지하 창고 - [8] >'
        ]);
    }

    const singleton = loadWorker();
    await singleton.context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: { text: '< 소환전(召喚殿) - [1] >\n본문의 [1] 표시는 제목이 아니다.', userRegex: defaultTitleRegex, useMultiToc: false }
    } });
    assert.deepEqual(Array.from(singleton.messages[0].payload.resultLines), ['< 소환전(召喚殿) - [1] >']);

    const afterEndMarker = loadWorker();
    await afterEndMarker.context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: { text: longGap + '\r\n< 독방 - [2] > 끝\r\nⓒ 검미성\r\n< 독방 - [3] >&#x20;\r\n' + longGap, userRegex: defaultTitleRegex, useMultiToc: false }
    } });
    assert.deepEqual(Array.from(afterEndMarker.messages[0].payload.resultLines), ['< 독방 - [3] >&#x20;']);

    for (const useMultiToc of [false, true]) {
        const mixedPatterns = loadWorker();
        await mixedPatterns.context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: {
                text: '1화 시작\n\n2화 계속\n\n3화 다음\n\n< 소환전(召喚殿) - [1] >\n\n< 독방 - [1] > 끝\nⓒ 검미성\n< 독방 - [1] >\n\n< 성밖 - [1] >',
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });
        assert.deepEqual(Array.from(mixedPatterns.messages[0].payload.resultLines), [
            '1화 시작',
            '2화 계속',
            '3화 다음',
            ...(useMultiToc ? ['< 소환전(召喚殿) - [1] >', '< 독방 - [1] >', '< 성밖 - [1] >'] : [])
        ]);
    }

    const revisedTitles = loadWorker();
    await revisedTitles.context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: '< 아스가르드 - [1] 수정본 >\n본문\n< 미드가르드 - [종장] 수정본 >',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });
    assert.deepEqual(Array.from(revisedTitles.messages[0].payload.resultLines), [
        '< 아스가르드 - [1] 수정본 >',
        '< 미드가르드 - [종장] 수정본 >'
    ]);

    const alternateWrappers = loadWorker();
    await alternateWrappers.context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: '.. # 대학 - [서장] #\n본문\n＃ 강의실 - [1] ＃\n본문\n【 운동장 - [종장] 】',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });
    assert.deepEqual(Array.from(alternateWrappers.messages[0].payload.resultLines), [
        '.. # 대학 - [서장] #',
        '＃ 강의실 - [1] ＃',
        '【 운동장 - [종장] 】'
    ]);

    const numberedWrappers = loadWorker();
    await numberedWrappers.context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: '< 006. 들린다 > 끝\nⓒ 나일함\n=====\n\n< 007. 안 부르는 게 아니라, 못 부르는 것 >\n\n< 016. 오디션의 결과 > 끝\nⓒ 나일함\n=====\n\n< 017. 내가 그렇게 만들 생각이다 >',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });
    assert.deepEqual(Array.from(numberedWrappers.messages[0].payload.resultLines), [
        '< 007. 안 부르는 게 아니라, 못 부르는 것 >',
        '< 017. 내가 그렇게 만들 생각이다 >'
    ]);
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

test('decorated Korean chapter titles allow a closing symbol after the chapter unit', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '본문\n\n◈12화◈ 무엇을 상상하든 그 이상\n\n내용\n\n◈13화◈ 다음 이야기\n\n본문',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), [
        '◈12화◈ 무엇을 상상하든 그 이상',
        '◈13화◈ 다음 이야기'
    ]);
});

test('box-drawing separators before Korean chapter numbers are treated as title decoration', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '본문\n\n──────────────────────────────────── 1화 첩자의 끝은 죽음이다.\n\n내용\n\n──────────────────────────────────── 2화 다음 이야기.\n\n본문',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), [
        '──────────────────────────────────── 1화 첩자의 끝은 죽음이다.',
        '──────────────────────────────────── 2화 다음 이야기.'
    ]);
});

test('chapter-like lines ending with an end marker stay out of the TOC', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: "'< 80화 반시(半屍) (1) > 끝' 어쩌구 저쩌구 끝\n\n본문\n\n'< 80화 반시(半屍) (2) > 끝' 어쩌구 저쩌구 끝",
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems), []);
    assert.deepEqual(Array.from(messages[0].payload.fallbackItems), []);

    const direct = loadWorker();
    await direct.context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: {
            text: '1화 시작\n\n2화 잘못된 끝\n\n2화 정상 제목\n\n3화 계속',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });
    assert.deepEqual(Array.from(direct.messages[0].payload.resultLines), [
        '1화 시작',
        '2화 정상 제목',
        '3화 계속'
    ]);
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
        '◈ 35화 진실을 향한 발걸음 (4)',
        '곧바로 3화. 그래, 4화. 5화 때 6.8프로라는 대박을 했을 때도 놀라긴 했지만, 이 정도는 아니었는데······.'
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

test('chapter references in consecutive prose sentences stay out of the TOC', async () => {
    const sentence = '곧바로 3화. 그래, 4화. 5화 때 6.8프로라는 대박을 했을 때도 놀라긴 했지만, 이 정도는 아니었는데······.';
    const splitSentence = '곧바로 3화.\n\n그래, 4화.\n\n5화 때 6.8프로라는 대박을 했을 때도 놀라긴 했지만, 이 정도는 아니었는데······.';

    for (const text of [sentence, splitSentence]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: { text, userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc: false }
        } });
        assert.deepEqual(Array.from(messages[0].payload.resultLines), []);
    }
});

test('timecodes stay out of the TOC', async () => {
    const content = '1화 시작\n\n[00:00:01]\n\n[00:00:02] 대사\n\n00:00:03,500 --> 00:00:05,000\n\n2화 계속';
    const timecodesOnly = '[00:00:01]\n\n[00:00:02]\n\n[00:00:03]';

    for (const useMultiToc of [false, true]) {
        const mixed = loadWorker();
        await mixed.context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: { text: content, userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc }
        } });
        assert.deepEqual(Array.from(mixed.messages[0].payload.resultLines), ['1화 시작', '2화 계속']);

        const standalone = loadWorker();
        await standalone.context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: { text: timecodesOnly, userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc }
        } });
        assert.deepEqual(Array.from(standalone.messages[0].payload.resultLines), []);
    }
});

test('spaced clocks and calendar date ranges are never title candidates', async () => {
    const noiseGroups = [
        ['[13 : 59]', '[14 : 59]', '[15 : 59]'],
        ['[13:59]', '[14:59]', '[15:59]'],
        ['[13 : 59 : 01]', '[14 : 59 : 02]', '[15 : 59 : 03]'],
        ['[2015. 4. 21. ~ 2034. 1. 28]', '[2016. 4. 21. ~ 2035. 1. 28]'],
        ['[2015.4.21~2034.1.28]', '[2016.4.21~2035.1.28]', '[2017.4.21~2036.1.28]'],
        ['2015-04-21 ~ 2034-01-28', '2016-04-21 ~ 2035-01-28']
    ];
    for (const noise of noiseGroups) {
        for (const useMultiToc of [false, true]) {
            const options = { userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc };
            const standalone = loadWorker();
            await standalone.context.self.onmessage({ data: {
                type: 'PREVIEW_PARSER', payload: { ...options, text: noise.join('\n\n') }
            } });
            assert.deepEqual(Array.from(standalone.messages[0].payload.resultItems), [], noise.join('\n'));
            assert.deepEqual(Array.from(standalone.messages[0].payload.fallbackItems), []);

            const text = ['169화', ...noise, '170화'].join('\n\n');
            const { context, messages } = loadWorker();
            await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, text } } });
            assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), ['169화', '170화']);
            assert.deepEqual(Array.from(messages[0].payload.fallbackItems), []);
            await context.self.onmessage({ data: {
                type: 'CONVERT', payload: { ...options, content: text, title: 'Clocks and Dates', useAutoToc: true, useTrim: true }
            } });
            const files = messages[1].payload.blob.files;
            assert.deepEqual(Array.from(files.get('OEBPS/toc.ncx').matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), (match) => match[1]), ['169화', '170화']);
            const body = Array.from(files.entries()).filter(([name]) => name.endsWith('.xhtml')).map(([, value]) => value).join('\n');
            for (const line of noise) assert.ok(body.includes(line));
        }
    }

    for (const titles of [['[13]', '[14]'], ['2015. 여름', '2016. 겨울']]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER', payload: { text: titles.join('\n\n'), userRegex: defaultTitleRegex, useMultiToc: false }
        } });
        assert.deepEqual(Array.from(messages[0].payload.resultLines), titles);
    }
});

test('numbered lists between consecutive chapter titles stay out of the TOC', async () => {
    const content = [
        '대영제국에서 작가로 살아남기 361화',
        '',
        '1. 독일이 러시아에 전쟁을 선포한다.',
        '',
        '2. 우리 군이 알자스─로렌으로 돌격한다.',
        '',
        '3. 실지를 탈환한다.',
        '',
        '4. ??',
        '',
        '5. PROFIT!!',
        '',
        '대영제국에서 작가로 살아남기 362화'
    ].join('\n');

    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'TEST_PARSER',
            payload: { text: content, userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc }
        } });
        assert.deepEqual(Array.from(messages[0].payload.resultLines), [
            '대영제국에서 작가로 살아남기 361화',
            '대영제국에서 작가로 살아남기 362화'
        ]);
    }
});

test('wiki-style family profile rows stay out of the TOC', async () => {
    const content = [
        '배우자 | 로웨나 진─로스차일드(1904)',
        '',
        '자녀 | 딸 : 애나 밀러(1905)[한국_이름1 진예나]',
        '',
        '장남 : 프레드 리처드 진─로스차일드(1921)[한국_이름2 진이찰]',
        '',
        '차남 : 아서 조지 진─로스차일드(1921)[한국_이름3 진아슬]'
    ].join('\n');

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
        assert.deepEqual(Array.from(messages[0].payload.fallbackItems || []), []);
    }
});

test('a parenthesized year inside prose stays out of the TOC', async () => {
    const content = '아, 그…… <민중을 이끄는 자유의 여신(1830)> 말인가.';

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
        assert.deepEqual(Array.from(messages[0].payload.fallbackItems || []), []);
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

test('hash-prefixed special chapter titles are detected without admitting author notes', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '# 종장 (1)\n\n본문\n\n＃ 서장 (2)\n\n# 작가의 말',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), [
        '# 종장 (1)',
        '＃ 서장 (2)'
    ]);
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

test('title counts take priority over filename chapter ranges', async () => {
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
        ...Array.from({ length: 6 }, (_, index) => `Chapter ${index + 1} Noise`),
        '외전 99',
        '에필로그'
    ]);
});

test('single-pattern selection counts all valid groups before choosing the largest', async () => {
    const korean = ['제1화 시작', '제2화 계속'];
    const english = ['Chapter 11 Start', 'Chapter 12 Continue', 'Chapter 13 Finish'];
    const numbered = ['101. 시작', '102. 계속', '103. 전환', '104. 마무리'];
    const wrapped = ['< 첫 방 - [1] >', '< 두 번째 방 - [1] >', '< 세 번째 방 - [1] >'];
    const alternative = ['첫 이야기(1)', '두 번째 이야기(1)', '세 번째 이야기(1)'];
    const special = ['프롤로그', '외전', '에필로그'];
    const cases = [
        { groups: [korean, english], expected: english },
        { groups: [english, korean], expected: english },
        { groups: [korean, english, numbered], expected: numbered },
        { groups: [wrapped, numbered], expected: numbered },
        { groups: [korean, wrapped], expected: wrapped },
        { groups: [korean, alternative], expected: alternative },
        { groups: [korean, english, [...alternative, '네 번째 이야기(1)']], expected: [...alternative, '네 번째 이야기(1)'] },
        { groups: [special, korean, alternative], expected: [...special, ...alternative] },
        { groups: [wrapped, wrapped, numbered], expected: numbered },
        { groups: [alternative.slice(0, 2), korean], expected: alternative.slice(0, 2) },
        { groups: [korean, alternative.slice(0, 2)], expected: korean, expectedMulti: korean },
        { groups: [['#1 첫 장'], alternative.slice(0, 2)], expected: alternative.slice(0, 2) },
        { groups: [[korean[0], '제99화 무관', '제100화 무관', korean[1]], english], expected: english, expectedMulti: [...korean, ...english] }
    ];

    for (const { groups, expected, expectedMulti = [...new Set(groups.flat())] } of cases) {
        const text = groups.flat().join('\n본문\n\n');
        for (const useMultiToc of [false, true]) {
            const selected = useMultiToc ? expectedMulti : expected;
            const options = { fileName: 'sample.txt', userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc };
            const { context, messages } = loadWorker();
            await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, text } } });
            assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), selected, text);

            await context.self.onmessage({ data: {
                type: 'VALIDATE',
                payload: { ...options, text, excludedIndices: Array.from(messages[0].payload.resultItems, (item) => item.idx) }
            } });
            assert.equal(messages[1].payload.isValid, 'no');

            await context.self.onmessage({ data: {
                type: 'CONVERT',
                payload: { ...options, id: 'largest-pattern', title: 'Largest Pattern', content: text, useAutoToc: true, useTrim: true, language: 'ko' }
            } });
            const ncx = messages[2].payload.blob.files.get('OEBPS/toc.ncx');
            const titles = Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), (match) => match[1]);
            assert.deepEqual(titles.filter((title) => title !== '시작'), selected.map((title) => title.replaceAll('<', '&lt;').replaceAll('>', '&gt;')), text);
        }
    }
});

test('filename ranges still break ties between equally sized title groups', async () => {
    const { context, messages } = loadWorker();
    const english = ['Chapter 11 Start', 'Chapter 12 Continue', 'Chapter 13 Finish'];
    const korean = ['제1화 시작', '제2화 계속', '제3화 마무리'];
    await context.self.onmessage({ data: {
        type: 'TEST_PARSER',
        payload: { text: [...english, ...korean].join('\n\n'), fileName: 'sample 1-3.txt', userRegex: '', useMultiToc: false }
    } });
    assert.deepEqual(Array.from(messages[0].payload.resultLines), korean);
});

test('alternative counts exclude duplicate titles, rejected numeric lists, and special chapters', async () => {
    const regular = ['제1화 시작', '제2화 계속', '제3화 다음'];
    const specials = ['외전 (1)', '외전 (2)', '외전 (3)', '외전 (4)'];
    const cases = [
        {
            lines: [...regular, ...Array(4).fill('옥션 하우스(1)')],
            expected: regular,
            fallback: []
        },
        {
            lines: ['361화 시작', '1. 첫 단계(1)', '2. 두 단계(1)', '3. 세 단계(1)', '362화 계속'],
            expected: ['361화 시작', '362화 계속'],
            fallback: []
        },
        { lines: [...regular, ...Array(4).fill('오늘은 집으로 돌아가야 한다.(2)')], expected: regular, fallback: [] },
        { lines: ['3 Story(1)\nbody', '3 Story(1)\n', '4 Continue(2)'], expected: ['3 Story(1)', '4 Continue(2)'], fallback: [] },
        { lines: [...regular, ...specials], expected: [...regular, ...specials], fallback: [] }
    ];
    for (const { lines, expected, fallback } of cases) {
        for (const useMultiToc of [false, true]) {
            const { context, messages } = loadWorker();
            const options = { userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc };
            const text = lines.join('\n본문\n\n');
            await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, text } } });
            assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), expected, text);
            assert.deepEqual(Array.from(messages[0].payload.fallbackItems, (item) => item.text), fallback, text);
            await context.self.onmessage({ data: {
                type: 'CONVERT',
                payload: { ...options, id: 'filtered-patterns', title: 'Filtered Patterns', content: text, useAutoToc: true, useTrim: true }
            } });
            const ncx = messages[1].payload.blob.files.get('OEBPS/toc.ncx');
            assert.deepEqual(Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), (match) => match[1]).filter((title) => title !== '시작'), expected, text);
        }
    }
});

test('a larger alternative pattern does not override explicit custom matches', async () => {
    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'PREVIEW_PARSER',
            payload: {
                text: 'Marker Alpha\n\nMarker Beta\n\n첫 이야기(1)\n\n두 번째 이야기(1)\n\n세 번째 이야기(1)',
                userRegex: '^Marker ',
                preserveCustomMatches: true,
                useMultiToc
            }
        } });
        assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), ['Marker Alpha', 'Marker Beta']);
        assert.equal(messages[0].payload.fallbackItems.length, 3);
    }
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

test('line-break repair separates joined body text without moving source indexes', async () => {
    const stem = '내 딸은 천재화백';
    const titles = [stem + ' 112화', stem + ' 113화'];
    const sentence = '우리들은 다시금 벽화를 향해 걸어가기 시작했다.';
    const body = Array(4).fill(sentence).join(' ') + '  ';
    const joined = titles[1] + body;
    const references = [
        titles[1] + '에서는 등장인물들이 어떤 일을 하는지 알아볼 수 있었다.',
        titles[1] + '짧은 부제',
        stem + ' 120화' + sentence,
        '다른 제목 113화' + sentence
    ];
    const lines = [titles[0], '본문입니다.', ...references, joined, '끝 문단입니다.'];
    const content = lines.join('\n');
    const joinedIndex = lines.indexOf(joined);
    assert.ok(joined.length > 90);
    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        const options = { userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc };
        for (const repairLineBreaks of [false, true]) {
            await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: {
                ...options, text: content, repairLineBreaks
            } } });
            const preview = messages.at(-1).payload;
            assert.equal(preview.lineCount, lines.length);
            assert.deepEqual(Array.from(preview.resultItems, item => [item.idx, item.text]),
                repairLineBreaks ? [[0, titles[0]], [joinedIndex, titles[1]]] : []);
        }

        for (const [repairLineBreaks, excludedIndices, useAutoToc, expectedTitles] of [
            [true, [], true, titles],
            [true, [joinedIndex], true, [titles[0]]],
            [false, [], true, ['시작']],
            [true, [], false, ['시작']]
        ]) {
            await context.self.onmessage({ data: { type: 'CONVERT', payload: {
                ...options, id: 'book', title: 'Book', content, useAutoToc, useTrim: false, repairLineBreaks, excludedIndices
            } } });
            const files = messages.at(-1).payload.blob.files;
            const ncx = files.get('OEBPS/toc.ncx');
            assert.deepEqual(Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), match => match[1]), expectedTitles);
            const repaired = repairLineBreaks && useAutoToc && !excludedIndices.length;
            const page = files.get(repaired ? 'OEBPS/ch_1.xhtml' : 'OEBPS/ch_0.xhtml');
            assert.ok(page.includes('<p>' + (repaired ? body : joined) + '</p>'));
            if (repaired) assert.equal(page.includes(joined), false);
            const allPages = [...files].filter(([name]) => /ch_\d+\.xhtml$/.test(name)).map(([, value]) => value).join('');
            for (const reference of references) assert.ok(allPages.includes('<p>' + reference + '</p>'));
        }
    }
});

test('line-break repair uses adjacent episode numbers on either side to recover short sentences', async () => {
    const stem = '내 딸은 천재화백';
    const title = episode => stem + ' ' + episode + '화';
    const sentence = '주무관님의 차는 귀여운 소형차였다.';
    const shortSentence = '그는 떠났다.';
    assert.equal(sentence.length, 19);
    const { context, messages } = loadWorker();
    for (const useMultiToc of [false, true]) {
        const options = { useMultiToc, repairLineBreaks: true, userRegex: defaultTitleRegex };
        for (const [before, after, body, expected] of [
            [115, null, sentence, true],
            [null, 117, sentence, true],
            [115, 117, shortSentence, true],
            [115, null, shortSentence, false],
            [null, 117, shortSentence, false],
            [114, 118, sentence, false],
            [115, 117, '늦은 여름.', false],
            [115, 117, '에서는 ' + sentence, false]
        ]) {
            const lines = ['앞 문단', ...(before ? [title(before), '이전 본문'] : []), title(116) + body,
                '다음 문단', ...(after ? [title(after), '나머지 본문'] : [])];
            const index = lines.indexOf(title(116) + body);
            await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, text: lines.join('\n') } } });
            const items = messages.at(-1).payload.resultItems;
            assert.equal(items.some(item => item.idx === index && item.text === title(116)), expected);
            if (!expected) continue;
            await context.self.onmessage({ data: { type: 'CONVERT', payload: {
                ...options, id: 'book', title: 'Book', content: lines.join('\n'), useAutoToc: true
            } } });
            const files = messages.at(-1).payload.blob.files;
            const ncx = files.get('OEBPS/toc.ncx');
            assert.ok(ncx.includes('<text>' + title(116) + '</text>'));
            assert.ok([...files].some(([name, value]) => /ch_\d+\.xhtml$/.test(name) && value.includes('<p>' + body + '</p>')));
        }
        const repair = vm.runInContext('resolveTocSelection', context);
        const unanchored = [title(115) + sentence, title(116) + sentence, title(117) + sentence];
        assert.equal(repair(unanchored, options).repairs.size, 0);
        const anchored = repair([...unanchored, title(118)], options);
        assert.deepEqual([...anchored.repairs.keys()], [0, 1, 2]);
    }
});

test('two-sided episode evidence repairs short repeated sounds but keeps other short tails as candidates', async () => {
    const { context, messages } = loadWorker();
    const title = number => '내 딸은 천재화백 ' + number + '화';
    for (const useMultiToc of [false, true]) {
        const options = { userRegex: defaultTitleRegex, repairLineBreaks: true, useMultiToc };
        for (const [body, next, expected] of [['슥슥.', 131, 'auto'], ['사각사각.', 131, 'auto'],
            ['슥슥.', null, 'candidate'], ['재회.', 131, 'candidate'], ['에서는 그대로 읽었다.', 131, 'none']]) {
            const text = [title(129), '앞 본문', title(130) + body, '뒤 본문',
                ...(next ? [title(next), '다음 본문'] : [])].join('\n');
            await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, text } } });
            const { resultItems, repairCandidates, fallbackItems } = messages.at(-1).payload;
            assert.equal(resultItems.some(item => item.idx === 2 && item.text === title(130)), expected === 'auto');
            assert.equal(fallbackItems.some(item => item.idx === 2), false);
            assert.deepEqual(Array.from(repairCandidates, item => [item.idx, item.title, item.body]),
                expected === 'candidate' ? [[2, title(130), body]] : []);
        }
    }
});

test('line-break repair recovers successive joined episodes after one intact title', async () => {
    const title = n => '내 딸은 천재화백 ' + n + '화';
    const sound = '슥슥.';
    const sentence = '방송국에 도착하자 처음 김찬미 PD님을 만나러 왔을 때가 떠올랐다.';
    const joined = [title(130) + sound, title(131) + sentence];
    const lines = [title(129), '앞 본문', ...joined, '마지막 문단'];
    const { context, messages } = loadWorker();
    for (const useMultiToc of [false, true]) {
        const options = { userRegex: defaultTitleRegex, repairLineBreaks: true, useMultiToc };
        await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, text: lines.join('\n') } } });
        assert.deepEqual(Array.from(messages.at(-1).payload.resultItems, item => [item.idx, item.text]),
            [[0, title(129)], [2, title(130)], [3, title(131)]]);
        await context.self.onmessage({ data: { type: 'CONVERT', payload: {
            ...options, id: 'book', title: 'Book', content: lines.join('\n'), useAutoToc: true
        } } });
        const files = messages.at(-1).payload.blob.files;
        assert.ok(files.get('OEBPS/ch_1.xhtml').includes('<p>' + sound + '</p>'));
        assert.ok(files.get('OEBPS/ch_2.xhtml').includes('<p>' + sentence + '</p>'));
        const resolve = vm.runInContext('resolveTocSelection', context);
        assert.equal(resolve(joined, options).repairs.size, 0);
        const ambiguous = resolve([...lines.slice(0, 3), title(131) + '재회.'], options);
        assert.equal(ambiguous.repairs.size, 0);
    }
});

test('recurring titles relax body checks only after 100 distinct intact episodes of that title', () => {
    const { context } = loadWorker();
    const resolve = vm.runInContext('resolveTocSelection', context);
    const title = n => '산책의 기록 ' + n + '화';
    const makeLines = count => Array.from({ length: count }, (_, index) => [title(index + 1), '본문']).flat();
    const options = { userRegex: defaultTitleRegex, repairLineBreaks: true };
    const ninetyNine = makeLines(99);
    const duplicate = [...ninetyNine, title(99), '다시 본문', title(100) + '슥'];
    const duplicateResult = resolve(duplicate, options);
    assert.equal(duplicateResult.repairs.size, 0);
    assert.equal(duplicateResult.repairCandidates.at(-1).title, title(100));
    const lines = [...makeLines(100), title(101) + '슥', title(102) + '에서는 본문을 읽는다.',
        title(103) + '소리', '다른 제목 101화소리'];
    const result = resolve(lines, options);
    assert.deepEqual(Array.from(result.repairs, ([idx, item]) => [idx, item.title, item.body]), [[200, title(101), '슥']]);
    assert.ok(result.validIndices.has(200));
    assert.equal(resolve(lines, { ...options, repairLineBreaks: false }).repairs.size, 0);
});

test('an explicitly selected line-break candidate becomes a chapter only while repair is enabled and not excluded', async () => {
    const { context, messages } = loadWorker();
    const title = '내 딸은 천재화백 130화';
    const tail = '재회.';
    const joined = title + tail;
    const lines = ['내 딸은 천재화백 129화', '앞 본문', joined, '뒤 본문',
        'Chapter 1 First', 'Body.', 'Chapter 2 Next', 'Body.', 'Chapter 3 Last', 'Body.'];
    const content = lines.join('\n');
    const options = { id: 'book', title: 'Book', content, userRegex: defaultTitleRegex, useAutoToc: true, useMultiToc: false };
    const chosen = { ...options, repairLineBreaks: true, selectedRepairIndices: [2] };
    await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...chosen, text: content } } });
    const preview = messages.at(-1).payload;
    assert.equal(preview.lineCount, lines.length);
    assert.equal(preview.resultItems.some(item => item.idx === 2 && item.text === title), true);
    assert.equal(preview.repairCandidates.length, 0);
    for (const [overrides, accepted] of [[{}, true], [{ excludedIndices: [2] }, false],
        [{ repairLineBreaks: false }, false], [{ selectedRepairIndices: [] }, false]]) {
        await context.self.onmessage({ data: { type: 'CONVERT', payload: { ...chosen, ...overrides } } });
        const files = messages.at(-1).payload.blob.files;
        assert.equal(files.get('OEBPS/toc.ncx').includes('<text>' + title + '</text>'), accepted);
        const pages = [...files].filter(([name]) => /ch_\d+\.xhtml$/.test(name)).map(([, page]) => page).join('');
        assert.ok(pages.includes('<p>' + (accepted ? tail : joined) + '</p>'));
        if (accepted) assert.equal(pages.includes(joined), false);
    }
});

test('line-break repair resets only the selected file and its containing bundle', () => {
    const Store = loadStore();
    const other = { id: 'b', state: 'done', repairLineBreaks: false };
    const store = new Store({ files: [{ id: 'a', state: 'done', isValid: 'no', useMultiToc: true }, other],
        groups: [{ id: 'group-a', fileIds: ['a', 'b'], state: 'done' }] });
    const scanned = [], previewed = [];
    const body = html.match(/dom\.previewRepairToggle\.addEventListener\('click', \(\) => \{([\s\S]*?)\n    \}\);/)[1];
    const toggle = vm.runInNewContext('() => {' + body + '}', {
        store, currentPreviewFileId: 'a', dom: { optToc: { checked: true } },
        validateFileById: id => scanned.push(id), previewFileById: id => previewed.push(id)
    });
    toggle();
    assert.equal(store.state.files[0].repairLineBreaks, true);
    assert.equal(store.state.files[0].useMultiToc, true);
    assert.equal(store.state.files[0].state, 'wait');
    assert.equal(store.state.files[1], other);
    assert.equal(store.state.groups[0].state, 'wait');
    toggle();
    assert.equal(store.state.files[0].repairLineBreaks, false);
    assert.deepEqual(scanned, ['a', 'a']);
    assert.deepEqual(previewed, ['a', 'a']);
});

test('repeated suffix titles accept consecutive episodes without blank lines or with a question mark', async () => {
    const title = '내 딸은 천재화백';
    for (const useMultiToc of [false, true]) {
        for (const ending of ['', '?', '？']) {
            const titles = [title + ' 001화' + ending, title + ' 002화' + ending];
            const content = [titles[0], '본문입니다.', '다른 이야기 002화?', '본문입니다.', titles[1], '본문입니다.'].join('\n');
            const { context, messages } = loadWorker();
            const options = { userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc };
            await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, text: content } } });
            assert.deepEqual(Array.from(messages.at(-1).payload.resultItems, item => item.text), titles);
            await context.self.onmessage({ data: { type: 'CONVERT', payload: {
                ...options, id: 'book', title: 'Book', content, useAutoToc: true, useTrim: true
            } } });
            const ncx = messages.at(-1).payload.blob.files.get('OEBPS/toc.ncx');
            assert.deepEqual(Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), match => match[1]), titles);
        }
    }
});

test('suffix questions need a matching title and a consecutive episode', async () => {
    const { context, messages } = loadWorker();
    for (const useMultiToc of [false, true]) {
        for (const text of ['지금 001화?', '지금 001화?\n다음 002화?', '지금 001화?\n지금 003화?', '지금 002화?\n지금 001화?']) {
            await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: {
                text, userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc
            } } });
            assert.equal(messages.at(-1).payload.resultItems.length, 0);
        }
    }
});

test('diamond-prefixed numbered titles start at zero without treating decimals as headings', async () => {
    const titles = ['◈ 0. 프롤로그', '◈ 1. 귀농자는 쉬고 싶다'];
    const content = [titles[0], '◈ 0.5 ratio', '◈ 1.5 ratio', titles[1], '본문입니다.'].join('\n');
    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        const options = { userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc };
        for (const [text, expected] of [[titles.join('\n'), titles], [content, titles], [titles[1], []]]) {
            await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, text } } });
            assert.deepEqual(Array.from(messages.at(-1).payload.resultItems, item => item.text), expected);
        }
        await context.self.onmessage({ data: { type: 'CONVERT', payload: {
            ...options, id: 'book', title: 'Book', content, useAutoToc: true, useTrim: true
        } } });
        const ncx = messages.at(-1).payload.blob.files.get('OEBPS/toc.ncx');
        assert.deepEqual(Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), match => match[1]), titles);
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

test('parenthesized number suffixes are offered as a selectable fallback', async () => {
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
        assert.deepEqual(Array.from(messages[0].payload.fallbackItems || [], (item) => item.text), [
            '내집 마련의 꿈(1)',
            '내집 마련의 꿈(2)'
        ]);
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
    assert.deepEqual(Array.from(singleton.messages[0].payload.fallbackItems), []);

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

test('different titles sharing a parenthesized suffix are offered together', async () => {
    const titles = ['콘티가 움직이더라 (1)', '비료를 거름삼아 (1)'];
    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        await context.self.onmessage({ data: {
            type: 'PREVIEW_PARSER',
            payload: {
                requestId: 1,
                fileName: 'sample.txt',
                text: titles.join('\n본문\n'),
                userRegex: defaultTitleRegex,
                preserveCustomMatches: false,
                useMultiToc
            }
        } });

        assert.deepEqual(Array.from(messages[0].payload.fallbackItems, (item) => item.text), titles);
    }
});

test('isolated alternative titles and parenthesized prose stay out of the TOC', async () => {
    const prose = '임당검사는 정상(135)인데 정상범위 끝에 좀 아슬아슬하다... 단 거 줄여야지ㅜㅜ';
    const alternatives = ['첫 이야기(1)', '두 번째 이야기(1)'];
    const cases = [
        { middle: [prose], expectedFallback: [] },
        { middle: [prose, prose], expectedFallback: [] },
        { middle: ['내집 마련의 꿈(2)'], expectedFallback: [] },
        { middle: [alternatives[0], prose], expectedFallback: [] },
        { middle: [alternatives[0], "'다른 이야기(1)'"], expectedFallback: [] },
        { middle: ['< 같은 이야기(1) >', '같은 이야기(2)'], expectedFallback: ['< 같은 이야기(1) >', '같은 이야기(2)'] },
        { middle: [...alternatives, prose], expectedFallback: alternatives }
    ];
    for (const { middle, expectedFallback } of cases) {
        const lines = ['169화', ...middle, '170화'];
        const text = lines.join('\n\n');
        for (const useMultiToc of [false, true]) {
            const { context, messages } = loadWorker();
            const options = { userRegex: defaultTitleRegex, preserveCustomMatches: false, useMultiToc };
            await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, text } } });
            assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), ['169화', '170화'], text);
            assert.deepEqual(Array.from(messages[0].payload.fallbackItems, (item) => item.text), expectedFallback, text);
            await context.self.onmessage({ data: {
                type: 'VALIDATE',
                payload: { ...options, text, excludedIndices: [0, (lines.length - 1) * 2], selectedFallbackIndices: middle.map((_, index) => (index + 1) * 2) }
            } });
            assert.equal(messages[1].payload.isValid, expectedFallback.length ? 'ok' : 'no');
            await context.self.onmessage({ data: {
                type: 'CONVERT',
                payload: { ...options, content: text, title: 'Isolated Candidates', useAutoToc: true, useTrim: true }
            } });
            const files = messages[2].payload.blob.files;
            assert.deepEqual(Array.from(files.get('OEBPS/toc.ncx').matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), (match) => match[1]), ['169화', '170화']);
            const body = Array.from(files.entries()).filter(([name]) => name.endsWith('.xhtml')).map(([, content]) => content).join('\n');
            for (const line of middle) {
                const escaped = line.replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character]));
                assert.ok(body.includes(escaped), 'Non-title content must stay in the book');
            }
        }
    }
});

test('a clearly dominant alternative TOC pattern becomes the main pattern', async () => {
    const regularTitles = ['제1화 시작', '제2화 계속'];
    const alternativeTitles = Array.from({ length: 5 }, (_, index) => `서로 다른 제목 ${index + 1}(1)`);
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: [...regularTitles, ...alternativeTitles].join('\n본문\n'),
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), alternativeTitles);
});

test('parenthesized fallback allows a leading quote decoration', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: "' 옥션 하우스(1)\n본문\n' 옥션 하우스(2)",
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.fallbackItems, (item) => item.text), [
        "' 옥션 하우스(1)",
        "' 옥션 하우스(2)"
    ]);
});

test('parenthesized fallback allows a quoted angle-bracket title', async () => {
    const { context, messages } = loadWorker();
    const titles = [5, 6].map((number) => `'< 이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(${number}) >'`);
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: titles.join('\n본문\n'),
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.fallbackItems, (item) => item.text), titles);
});

test('parenthesized fallback allows a fully quoted sentence title', async () => {
    const { context, messages } = loadWorker();
    const titles = [1, 2].map((number) => `' 이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(${number}) '`);
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: titles.join('\n본문\n'),
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.fallbackItems, (item) => item.text), titles);
});

test('parenthesized fallback allows a trailing episode note', async () => {
    const { context, messages } = loadWorker();
    const titles = [
        "' 이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(1)  '",
        "' 이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(3)(무료 마지막화입니다!) '"
    ];
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: titles.join('\n본문\n'),
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.fallbackItems, (item) => item.text), titles);
});

test('parenthesized titles already inferred by the main parser stay out of fallback', async () => {
    const { context, messages } = loadWorker();
    const titles = [
        '이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(1)',
        '이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(2) 리하르트 슈트라우스.',
        '이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(3)(무료 마지막화입니다!)'
    ];
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: titles.join('\n본문\n'),
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), titles);
    assert.deepEqual(Array.from(messages[0].payload.fallbackItems), []);
});

test('a detected wrapped title promotes earlier matching parenthesized titles', async () => {
    const { context, messages } = loadWorker();
    const titles = [
        '이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(1)',
        '이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(2) 리하르트 슈트라우스.',
        '이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(3)(무료 마지막화입니다!)',
        '< [유료화 시작]이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(4) >'
    ];
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: titles.join('\n본문\n'),
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: false
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.resultItems, (item) => item.text), titles);
});

test('selected candidates stay separate from automatic preview titles and appear once in EPUB', async () => {
    const regular = ['제1화 시작', '제2화 계속', '제3화 마지막'];
    const extra = ['내집 마련의 꿈(1)', '내집 마련의 꿈(2)'];
    const content = [...regular, ...extra].join('\n본문\n');
    for (const useMultiToc of [false, true]) {
        const { context, messages } = loadWorker();
        const options = { fileName: 'overlap.txt', userRegex: defaultTitleRegex, preserveCustomMatches: false,
            useMultiToc, selectedFallbackIndices: [6, 8] };
        await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, requestId: 1, text: content } } });
        const preview = messages[0].payload;
        assert.deepEqual(Array.from(preview.resultItems, item => item.text), regular);
        assert.deepEqual(Array.from(preview.fallbackItems, item => item.text), extra);
        const detected = new Set(Array.from(preview.resultItems, item => item.idx));
        assert.equal(preview.fallbackItems.some(item => detected.has(item.idx)), false);
        await context.self.onmessage({ data: { type: 'VALIDATE', payload: { ...options, id: 'book', text: content,
            excludedIndices: [0, 2, 4, 6, 8] } } });
        assert.equal(messages[1].payload.isValid, 'no');
        await context.self.onmessage({ data: { type: 'CONVERT', payload: { ...options, id: 'book', title: 'Book',
            content, useAutoToc: true, useTrim: true, language: 'ko', excludedIndices: [6] } } });
        const ncx = messages[2].payload.blob.files.get('OEBPS/toc.ncx');
        const titles = Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), match => match[1]);
        assert.deepEqual(titles, [...regular, extra[1]]);
    }
});

test('preview selection separates available candidates from added rows and preserves exclusions', () => {
    const context = vm.createContext({
        currentPreviewFileId: 'a',
        currentPreviewItems: [{ idx: 0, text: '제1화 시작' }, { idx: 4, text: '제2화 계속' }],
        currentPreviewFallbackItems: [{ idx: 0, text: '제1화 시작' }, { idx: 2, text: '추가 제목(1)' },
            { idx: 6, text: '다른 제목(1)' }, { idx: 6, text: '다른 제목(1)' }],
        getSelectedFallbackLines: () => new Set([2]), getExcludedPreviewLines: () => new Set([2])
    });
    vm.runInContext(html.match(/function getPreviewSelection[\s\S]*?(?=\n    function renderPreviewDialog)/)[0], context);
    const selection = context.getPreviewSelection();
    assert.deepEqual(Array.from(selection.items, item => item.idx), [0, 2, 4]);
    assert.deepEqual(Array.from(selection.activeItems, item => item.idx), [0, 4]);
    assert.deepEqual(Array.from(selection.addedItems, item => item.idx), [2]);
    assert.deepEqual(Array.from(selection.candidates, item => item.idx), [6]);
});

test('candidate selections accumulate per file and can be cleared without changing other files', () => {
    const selectedFallbackLinesByFile = new Map([['b', new Set([20])]]);
    const context = vm.createContext({ selectedFallbackLinesByFile });
    vm.runInContext(html.match(/function getSelectedFallbackLines[\s\S]*?(?=\n    function changePreviewFallbackSelection)/)[0], context);
    context.setFallbackSelection('a', [{ idx: 2 }], true);
    context.setFallbackSelection('a', [{ idx: 6 }, { idx: 2 }], true);
    assert.deepEqual(Array.from(context.getSelectedFallbackLines('a')), [2, 6]);
    context.setFallbackSelection('a', [], false);
    assert.equal(context.getSelectedFallbackLines('a').size, 0);
    assert.deepEqual(Array.from(context.getSelectedFallbackLines('b')), [20]);
});

test('pattern switching does not offer manually selected titles again after automatic promotion', async () => {
    const regular = Array.from({ length: 5 }, (_, index) => `제${index + 1}화 제목`);
    const extra = [
        '이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(1)',
        '이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(2) 리하르트 슈트라우스.',
        '이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(3)(무료 마지막화입니다!)',
        '< [유료화 시작]이 프로그램은 보고 계신 스폰서의 제공으로 보내드립니다(4) >'
    ];
    const content = [...regular, ...extra].join('\n본문\n');
    const selectedFallbackIndices = [10, 12, 14, 16];
    const { context, messages } = loadWorker();
    for (const useMultiToc of [false, true, false]) {
        const options = { fileName: 'sample.txt', userRegex: defaultTitleRegex, preserveCustomMatches: false,
            selectedFallbackIndices, useMultiToc };
        await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, requestId: 1, text: content } } });
        const preview = messages.at(-1).payload;
        const automaticIds = new Set(Array.from(preview.resultItems, item => item.idx));
        assert.equal(preview.fallbackItems.some(item => automaticIds.has(item.idx)), false);
        assert.equal(new Set(Array.from(preview.resultItems, item => item.text)).size, preview.resultItems.length);
        await context.self.onmessage({ data: { type: 'CONVERT', payload: { ...options, id: 'book', title: 'Book',
            content, useAutoToc: true, useTrim: true, language: 'ko' } } });
        const ncx = messages.at(-1).payload.blob.files.get('OEBPS/toc.ncx');
        const titles = Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), match => match[1]);
        assert.equal(titles.length, 9);
        assert.equal(new Set(titles).size, 9);
    }
});

test('parenthesized fallback remains selectable alongside regular titles', async () => {
    const { context, messages } = loadWorker();
    const content = '제1화 시작\n본문\n내집 마련의 꿈(1)\n본문\n내집 마련의 꿈(2)\n본문\n제2화 계속';
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
    assert.deepEqual(Array.from(messages[0].payload.fallbackItems, (item) => item.text), ['내집 마련의 꿈(1)', '내집 마련의 꿈(2)']);

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
    assert.match(ncx, /내집 마련의 꿈\(1\)/);
});

test('parenthesized candidates exclude titles already detected by the main parser', async () => {
    const { context, messages } = loadWorker();
    await context.self.onmessage({ data: {
        type: 'PREVIEW_PARSER',
        payload: {
            requestId: 1,
            fileName: 'sample.txt',
            text: '제1화 시작(1)\n본문\n100억을 벌었다(2)\n본문\n100억을 벌었다(3)\n본문\n제2화 계속(2)',
            userRegex: defaultTitleRegex,
            preserveCustomMatches: false,
            useMultiToc: true
        }
    } });

    assert.deepEqual(Array.from(messages[0].payload.fallbackItems, (item) => item.text), [
        '100억을 벌었다(2)', '100억을 벌었다(3)'
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
        composedPath() { return [{ tagName: 'BUTTON' }, { tagName: 'TR' }, tableWrapper, {}]; }
    });
    assert.equal(pickerClicks, 0);

    handler({ composedPath() { return [{ tagName: 'path' }, { tagName: 'svg' }, { tagName: 'BUTTON' }, {}]; } });
    assert.equal(pickerClicks, 0);

    handler({
        target: { closest() { return null; } },
        composedPath() { return [{ tagName: 'DIV' }, tableWrapper, {}]; }
    });
    assert.equal(pickerClicks, 1);

    handler({ composedPath() { return [{ tagName: 'INPUT' }, { tagName: 'TR' }, tableWrapper]; } });
    assert.equal(pickerClicks, 1);
    handler({ composedPath() { return [{ tagName: 'DIV' }, {}]; } });
    assert.equal(pickerClicks, 2);
});

test('file-area keyboard shortcuts do not interfere with row inputs', () => {
    const body = html.match(/dom\.dropZone\.onkeydown = \(e\) => \{([\s\S]*?)\n    \};/)[1];
    let opened = 0;
    let prevented = 0;
    const dom = { dropZone: {}, fileInput: { click() { opened++; } } };
    const handler = Function('dom', `return (e) => {${body}}`)(dom);
    for (const key of ['Enter', ' ']) {
        handler({ target: dom.dropZone, key, preventDefault() { prevented++; } });
    }
    handler({ target: {}, key: 'Enter', preventDefault() { prevented++; } });
    handler({ target: dom.dropZone, key: 'Escape', preventDefault() { prevented++; } });
    assert.equal(opened, 2);
    assert.equal(prevented, 2);
});

test('file rows show pending title detection as analyzing', () => {
    const renderList = html.match(/function renderList[\s\S]*?(?=\n\s*async function readClipboardImage)/)[0];
    const validateFile = html.match(/async function validateFileById[\s\S]*?(?=\n\s*async function validateFiles)/)[0];

    assert.match(renderList, /isDetecting \? 'previewLoading' : analysisFailed \? 'previewAnalysisFailed' : 'tablePreview'/);
    assert.match(renderList, /detectBtn\.disabled = !canPreview \|\| isDetecting/);
    assert.match(validateFile, /UPDATE_FILE_VALIDITY[\s\S]*isValid: 'none'/);
});

test('file status uses the shared compact button and resets only completed or failed files when idle', () => {
    const Store = loadStore();
    const source = html.match(/const statusBtn = el\('button',[\s\S]*?statusBtn\.disabled = [^;]+;/)[0];
    for (const state of ['wait', 'ing', 'done', 'error']) {
        for (const isProcessing of [false, true]) {
            const item = { id: 'a', state };
            const store = new Store({ files: [item], isProcessing });
            const isClickable = ['done', 'error'].includes(state);
            const context = vm.createContext({ item, store, isClickable, group: false,
                window: { EPUB_STUDIO_I18N: { t: key => key } },
                el: (tag, attributes, label) => ({ tag, ...attributes, label }) });
            vm.runInContext(`${source}\nglobalThis.button = statusBtn;`, context);
            const button = context.button;
            assert.equal(button.tag, 'button');
            assert.equal(button.type, 'button');
            assert.match(button.className, /ui-button ui-button--compact/);
            assert.equal(button.label, 'fileState.' + state);
            assert.equal(button.disabled, isProcessing || !isClickable);
            button.onClick();
            assert.equal(store.state.files[0].state, !isProcessing && isClickable ? 'wait' : state);
        }
    }
});

test('EPUB keeps adjacent detected headings without adding an empty intro', async () => {
    for (const [titles, tail] of [
        [['Chapter 1 First', 'Chapter 2 Next'], ''],
        [['산책의 기록 129화', '산책의 기록 130화'], '우리는 다시 조용한 숲길을 따라서 천천히 걷기 시작했다.']
    ]) {
        const { context, messages } = loadWorker();
        const content = [titles[0], titles[1] + tail, '본문입니다.'].join('\n');
        const options = { id: 'book', title: 'Book', content, userRegex: defaultTitleRegex, useAutoToc: true, repairLineBreaks: !!tail };
        await context.self.onmessage({ data: { type: 'PREVIEW_PARSER', payload: { ...options, text: content } } });
        assert.deepEqual(Array.from(messages.at(-1).payload.resultItems, item => item.text), titles);
        await context.self.onmessage({ data: { type: 'CONVERT', payload: options } });
        const files = messages.at(-1).payload.blob.files;
        const ncx = files.get('OEBPS/toc.ncx');
        assert.deepEqual(Array.from(ncx.matchAll(/<navLabel><text>(.*?)<\/text><\/navLabel>/g), match => match[1]), titles);
        assert.match(files.get('OEBPS/ch_0.xhtml'), /<h2>[^<]+<\/h2>/);
        if (tail) assert.ok(files.get('OEBPS/ch_1.xhtml').includes('<p>' + tail + '</p>'));
    }
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

test('navigation highlights the most visible section below the header and clears the previous link', () => {
    const positions = [{ top: 0, bottom: 700 }, { top: 700, bottom: 1600 }, { top: 1600, bottom: 2500 }];
    const sections = ['tool', 'features', 'about'].map((id, index) => ({ id, getBoundingClientRect: () => positions[index] }));
    const navLinks = sections.map(section => ({ hash: '#' + section.id, attributes: new Map(),
        setAttribute(name, value) { this.attributes.set(name, value); },
        removeAttribute(name) { this.attributes.delete(name); } }));
    const context = vm.createContext({ sections, navLinks, activeSectionFrame: 1, innerHeight: 900,
        header: { getBoundingClientRect: () => ({ bottom: 100 }) } });
    vm.runInContext(html.match(/function updateActiveSection\(\) \{[\s\S]*?(?=\n        function scheduleActiveSectionUpdate)/)[0], context);
    const active = () => navLinks.filter(link => link.attributes.get('aria-current') === 'location').map(link => link.hash);
    context.updateActiveSection();
    assert.deepEqual(active(), ['#tool']);
    positions[0] = { top: -500, bottom: 200 };
    positions[1] = { top: 200, bottom: 1100 };
    positions[2] = { top: 1100, bottom: 2000 };
    context.updateActiveSection();
    assert.deepEqual(active(), ['#features']);
    positions[1] = { top: -800, bottom: 100 };
    positions[2] = { top: 100, bottom: 2000 };
    context.innerHeight = 640;
    context.updateActiveSection();
    assert.deepEqual(active(), ['#about']);
    assert.equal(context.activeSectionFrame, 0);
});

test('public pages load the shared button component stylesheet', () => {
    const css = readFileSync(new URL('../ui-buttons.css', import.meta.url), 'utf8');
    for (const selector of ['.ui-button {', '.ui-button--compact {', '.ui-button--action {', '.ui-button--large {', '.ui-button--icon {']) {
        assert.ok(css.includes(selector), selector);
    }
    for (const file of ['index.html', 'about.html', 'privacy.html', 'contact.html']) {
        const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
        assert.match(source, /<link rel="stylesheet" href="\.\/ui-buttons\.css\?v=[^"]+">/);
    }
});

test('the simulator run action belongs to the input header and uses the shared action size', () => {
    const inputField = html.match(/<div class="regex-test-field">([\s\S]*?)<\/textarea>/)[1];
    assert.match(inputField, /class="regex-field-head"/);
    assert.match(inputField, /<label id="testInputLabel" for="testInput">/);
    assert.match(inputField, /id="btnTestParser" class="ui-button ui-button--action ui-button--primary"/);
    assert.ok(inputField.indexOf('id="btnTestParser"') < inputField.indexOf('id="testInput"'));
    assert.equal([...html.matchAll(/id="btnTestParser"/g)].length, 1);
    assert.doesNotMatch(html, /class="regex-test-row"/);
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
