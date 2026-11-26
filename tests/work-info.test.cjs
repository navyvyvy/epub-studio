const assert = require('node:assert/strict');
const test = require('node:test');
const handler = require('../api/work-info.js');
const { sources, selectWork } = handler;

const fixtures = {
    sosul: '<div class="product"><div class="product-author"><a>Author</a></div><h3><a href="/series/1/">Sample <small>완결</small></a></h3><div class="product-reviews">3.75 (1,234)</div></div>',
    ridi: '<li class="card"><div><section><a href="/books/12"><div role="img" aria-label="Sample"></div></a></section><div><a href="/books/12"><span><strong>Sam</strong>ple</span></a><a href="/author/1"><span>Author</span></a><svg aria-label="구매자 평균 별점"></svg>4.1<span>(<!-- -->8<!-- -->)</span></div></div></li>',
    munpia: JSON.stringify({ code: 'M000_00000', result: { total: 1,
        searchNovelTabDtos: [{ title: 'Sample', author: 'Author', novelId: 23, viewCount: 9999 }] } })
};

const headers = { 'content-type': 'application/json' };
const response = () => ({ statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; } });
const reply = (id, body = fixtures[id]) => new Response(body, {
    headers: { 'Content-Type': sources[id].contentType || 'text/html' }
});
const sourceId = url => Object.keys(sources).find(id => new URL(sources[id].url).hostname === url.hostname);

test('public search rows yield original scores and counts, not popularity as a score', () => {
    assert.deepEqual(sources.sosul.parse(fixtures.sosul), [
        { title: 'Sample', author: 'Author', url: 'https://ssn.so/series/1/', score: 3.75, max: 5, votes: 1234 }
    ]);
    assert.deepEqual(sources.ridi.parse(fixtures.ridi), [
        { title: 'Sample', author: 'Author', url: 'https://ridibooks.com/books/12', score: 4.1, max: 5, votes: 8 }
    ]);
    assert.deepEqual(sources.munpia.parse(fixtures.munpia), [
        { title: 'Sample', author: 'Author', url: 'https://www.munpia.com/novel/detail/23' }
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

test('ebook titles are a fallback, never a substitute for exact or ambiguous results', () => {
    const exact = { title: 'Sample', author: 'Author', url: 'https://ridibooks.com/books/12' };
    const ebook = { ...exact, title: '[e북] Sample', url: 'https://ridibooks.com/books/99' };
    assert.equal(selectWork([ebook], 'Sample'), ebook);
    assert.equal(selectWork([ebook, exact], 'Sample'), exact);
    assert.equal(selectWork([ebook, { ...ebook, author: 'Other', url: 'https://ridibooks.com/books/100' }], 'Sample'), null);
    assert.equal(selectWork([ebook, exact, { ...exact, author: 'Other', url: 'https://ridibooks.com/books/101' }], 'Sample'), null);
    assert.equal(selectWork([{ ...ebook, title: '[다른 작품] Sample' }], 'Sample'), null);
    assert.equal(selectWork([{ ...ebook, title: '[e북] Sample next' }], 'Sample'), null);
    assert.equal(selectWork([{ ...ebook, author: '' }], 'Sample'), null);
});

test('lookup sends only the title to fixed search hosts and returns partial matches on failure', async t => {
    const calls = [];
    t.mock.method(Date, 'now', () => 1_000_000_000_000);
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push([url.href, options.redirect]);
        if (url.hostname === 'www.munpia.com') throw new Error('network timeout');
        const body = url.hostname === 'ssn.so' ? fixtures.sosul : fixtures.ridi;
        return new Response(body, { headers: { 'Content-Type': 'text/html' } });
    });
    const invalid = response();
    await handler({ method: 'POST', headers, body: { title: 'x'.repeat(121) } }, invalid);
    assert.equal(invalid.statusCode, 400);
    assert.equal(calls.length, 0);
    const result = response();
    await handler({ method: 'POST', headers, body: { title: 'Sample', content: 'private' } }, result);
    assert.deepEqual(result.body.matches.map(item => item.id), ['sosul', 'ridi']);
    assert.deepEqual(result.body.statuses, { sosul: 'found', ridi: 'found', munpia: 'error' });
    assert.deepEqual(calls.map(([url]) => new URL(url).hostname).sort(), ['ridibooks.com', 'ssn.so', 'www.munpia.com']);
    assert.ok(calls.every(([url, redirect]) => url.includes('=Sample') && !url.includes('private') && redirect === 'error'));
});

test('verified empty searches are distinct from failed and unrecognized responses', async t => {
    let now = 2_000_000_000_000;
    t.mock.method(Date, 'now', () => now);
    const empty = {
        sosul: '<h4>검색결과가 없습니다.</h4>',
        ridi: '<span>‘Sample’에 대한 검색결과가 없습니다.</span>',
        munpia: JSON.stringify({ code: 'M000_00000', result: { total: 0, searchNovelTabDtos: [] } })
    };
    let fetchResponse;
    t.mock.method(globalThis, 'fetch', (url, options) => fetchResponse(sourceId(url), options));
    for (const [expected, makeResponse] of [
        ['empty', id => reply(id, empty[id])],
        ['error', id => reply(id, '<html>Unknown search layout or challenge</html>')],
        ['error', id => reply(id, '')],
        ['error', () => new Response('Access denied', { status: 403 })],
        ['error', () => new Response('not a search response', { headers: { 'Content-Type': 'text/plain' } })]
    ]) {
        now += 11000;
        fetchResponse = makeResponse;
        const res = response();
        await handler({ method: 'POST', headers, body: { title: 'Sample' } }, res);
        assert.deepEqual(res.body.matches, []);
        assert.deepEqual(res.body.statuses, { sosul: expected, ridi: expected, munpia: expected });
    }
});

test('matching titles with multiple works require confirmation instead of claiming no results', async t => {
    t.mock.method(Date, 'now', () => 3_000_000_000_000);
    const ambiguous = {
        sosul: fixtures.sosul + fixtures.sosul.replace('/series/1/', '/series/2/').replace('Author', 'Other'),
        ridi: fixtures.ridi + fixtures.ridi.replaceAll('/books/12', '/books/99').replace('Author', 'Other'),
        munpia: JSON.stringify({ code: 'M000_00000', result: { total: 2, searchNovelTabDtos: [
            { title: 'Sample', author: 'Author', novelId: 23 }, { title: 'Sample', author: 'Other', novelId: 24 }
        ] } })
    };
    t.mock.method(globalThis, 'fetch', async url => reply(sourceId(url), ambiguous[sourceId(url)]));
    const res = response();
    await handler({ method: 'POST', headers, body: { title: 'Sample' } }, res);
    assert.deepEqual(res.body.matches, []);
    assert.deepEqual(res.body.statuses, { sosul: 'ambiguous', ridi: 'ambiguous', munpia: 'ambiguous' });
});

test('Sosulnet crawl delay is reported without hiding other site results', async t => {
    t.mock.method(Date, 'now', () => 4_000_000_000_000);
    const calls = [];
    t.mock.method(globalThis, 'fetch', async url => {
        calls.push(sourceId(url));
        return reply(sourceId(url));
    });
    const first = response();
    await handler({ method: 'POST', headers, body: { title: 'Sample' } }, first);
    assert.deepEqual(first.body.statuses, { sosul: 'found', ridi: 'found', munpia: 'found' });
    const next = response();
    await handler({ method: 'POST', headers, body: { title: 'Sample' } }, next);
    assert.deepEqual(next.body.statuses, { sosul: 'deferred', ridi: 'found', munpia: 'found' });
    assert.deepEqual(next.body.matches.map(item => item.id), ['ridi', 'munpia']);
    assert.equal(calls.filter(id => id === 'sosul').length, 1);
});

test('Munpia rejects unsuccessful, malformed, and empty-but-incomplete search payloads', () => {
    for (const body of [
        '{}',
        JSON.stringify({ code: 'ERROR', result: { total: 0, searchNovelTabDtos: [] } }),
        JSON.stringify({ code: 'M000_00000', result: { total: 1, searchNovelTabDtos: [] } }),
        JSON.stringify({ code: 'M000_00000', result: { total: 1, searchNovelTabDtos: [{ title: 'Sample', author: 'Author', novelId: '../wrong' }] } })
    ]) {
        assert.throws(() => sources.munpia.parse(body));
    }
});

test('ebook fallback results have the same found and ambiguous states as exact titles', async t => {
    let now = 5_000_000_000_000;
    let multiple = false;
    t.mock.method(Date, 'now', () => now);
    const edition = fixtures.ridi.replaceAll('/books/12', '/books/99')
        .replace('<strong>Sam</strong>ple', '[e북] Sample');
    t.mock.method(globalThis, 'fetch', async url => {
        const id = sourceId(url);
        if (id === 'ridi') return reply(id, edition + (multiple
            ? edition.replaceAll('/books/99', '/books/100').replace('Author', 'Other') : ''));
        if (id === 'sosul') return reply(id, '<h4>검색결과가 없습니다.</h4>');
        return reply(id, JSON.stringify({ code: 'M000_00000', result: { total: 0, searchNovelTabDtos: [] } }));
    });
    const found = response();
    await handler({ method: 'POST', headers, body: { title: 'Sample' } }, found);
    assert.equal(found.body.statuses.ridi, 'found');
    assert.equal(found.body.matches[0].url, 'https://ridibooks.com/books/99');
    now += 11000;
    multiple = true;
    const ambiguous = response();
    await handler({ method: 'POST', headers, body: { title: 'Sample' } }, ambiguous);
    assert.equal(ambiguous.body.statuses.ridi, 'ambiguous');
    assert.deepEqual(ambiguous.body.matches, []);
});
