const assert = require('node:assert/strict');
const test = require('node:test');
const handler = require('../api/work-info.js');
const { sources, selectWork } = handler;

const fixtures = {
    sosul: '<div class="product"><div class="product-author"><a>Author</a></div><h3><a href="/series/1/">Sample <small>완결</small></a></h3><div class="product-reviews">3.75 (1,234)</div></div>',
    ridi: '<li class="card"><div><section><a href="/books/12"><div role="img" aria-label="Sample"></div></a></section><div><a href="/books/12"><span><strong>Sam</strong>ple</span></a><a href="/author/1"><span>Author</span></a><svg aria-label="구매자 평균 별점"></svg>4.1<span>(<!-- -->8<!-- -->)</span></div></div></li>',
    munpia: '<li onclick="$M.detailSearch.old.view_novel(23, \'\');"><p class="title"><span>complete</span>Sample</p><p class="author">Author &nbsp;<span></span>20화</p><p class="n_info">조회수 9,999 &nbsp; 선호작수 20 &nbsp; 추천수 900</p></li>'
};

test('public search rows yield original scores and counts, not popularity as a score', () => {
    assert.deepEqual(sources.sosul.parse(fixtures.sosul), [
        { title: 'Sample', author: 'Author', url: 'https://ssn.so/series/1/', score: 3.75, max: 5, votes: 1234 }
    ]);
    assert.deepEqual(sources.ridi.parse(fixtures.ridi), [
        { title: 'Sample', author: 'Author', url: 'https://ridibooks.com/books/12', score: 4.1, max: 5, votes: 8 }
    ]);
    assert.deepEqual(sources.munpia.parse(fixtures.munpia), [
        { title: 'Sample', author: 'Author', url: 'https://www.munpia.com/novel/detail/23', favorites: 20, likes: 900 }
    ]);
    const edition = fixtures.ridi.replaceAll('/books/12', '/books/99').replace('<strong>Sam</strong>ple', '[e북] Sample');
    assert.equal(selectWork(sources.ridi.parse(edition + fixtures.ridi), 'Sample').url, 'https://ridibooks.com/books/12');
    assert.equal(sources.sosul.parse(fixtures.sosul.replace('3.75 (1,234)', '0.0 (0)'))[0].score, undefined);
});

test('similar titles and different matches with identical titles are not guessed', () => {
    const first = sources.sosul.parse(fixtures.sosul)[0];
    assert.equal(selectWork([first], 'sample next'), null);
    assert.equal(selectWork([first, { ...first, url: 'https://ssn.so/series/2/', author: 'Other' }], 'Sample'), null);
    assert.equal(selectWork([{ ...first, author: '' }], 'Sample'), null);
    assert.equal(selectWork([first], 'ＳＡＭＰＬＥ'), first);
});

test('lookup sends only the title to fixed search hosts and returns partial matches on failure', async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push([url.href, options.redirect]);
        if (url.hostname === 'mm.munpia.com') throw new Error('network timeout');
        const body = url.hostname === 'ssn.so' ? fixtures.sosul : fixtures.ridi;
        return new Response(body, { headers: { 'Content-Type': 'text/html' } });
    });
    const response = () => ({ statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });
    const headers = { 'content-type': 'application/json' };
    const invalid = response();
    await handler({ method: 'POST', headers, body: { title: 'x'.repeat(121) } }, invalid);
    assert.equal(invalid.statusCode, 400);
    assert.equal(calls.length, 0);
    const result = response();
    await handler({ method: 'POST', headers, body: { title: 'Sample', content: 'private' } }, result);
    assert.deepEqual(result.body.matches.map(item => item.id), ['sosul', 'ridi']);
    assert.deepEqual(calls.map(([url]) => new URL(url).hostname).sort(), ['mm.munpia.com', 'ridibooks.com', 'ssn.so']);
    assert.ok(calls.every(([url, redirect]) => url.includes('=Sample') && !url.includes('private') && redirect === 'error'));
});
