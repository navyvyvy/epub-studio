import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

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
