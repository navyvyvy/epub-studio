const sources = {
    sosul: {
        url: 'https://ssn.so/series/',
        param: 'keyword',
        empty: /<h4[^>]*>\s*검색결과가 없습니다\.\s*<\/h4>/,
        parse(html) {
            return html.split(/<div class="product">/i).slice(1).flatMap(card => {
                const title = card.match(/<h3[^>]*>\s*<a href="(\/series\/\d+\/)"[^>]*>([\s\S]*?)<\/a>/i);
                if (!title) return [];
                const author = card.match(/class="product-author"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i);
                const score = card.match(/class="product-reviews"[^>]*>\s*(\d(?:\.\d+)?)\s*\(([\d,]+)\)/i);
                return [{ title: plain(title[2].replace(/<small\b[\s\S]*?<\/small>/gi, '')), author: plain(author?.[1]),
                    url: new URL(title[1], this.url).href, ...rating(score, 5) }];
            });
        }
    },
    ridi: {
        url: 'https://ridibooks.com/search',
        param: 'q',
        empty: /검색결과가 없습니다\.\s*<\/span>/,
        parse(html) {
            return html.split(/(?=<li\b[^>]*>\s*<div\b[^>]*>\s*<section\b[^>]*>\s*<a href="\/books\/\d+)/i)
                .filter(card => /^<li\b/i.test(card)).flatMap(card => {
                card = card.split(/<\/div>\s*<\/div>\s*<\/li>/i, 1)[0];
                const book = card.match(/href="(\/books\/\d+)(?:\?[^"]*)?"/i);
                const title = card.match(/<a href="\/books\/\d+(?:\?[^"]*)?"[^>]*>\s*<span>([\s\S]*?)<\/span>\s*<\/a>/i);
                if (!book || !title) return [];
                const author = card.match(/href="\/author\/\d+[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i);
                const score = card.match(/aria-label="\uad6c\ub9e4\uc790 \ud3c9\uade0 \ubcc4\uc810"[^>]*>[\s\S]*?<\/svg>\s*(\d(?:\.\d+)?)\s*<span[^>]*>([\s\S]*?)<\/span>/i);
                return [{ title: plain(title[1]), author: plain(author?.[1]), url: new URL(book[1], this.url).href, ...rating(score, 5) }];
            });
        }
    },
    munpia: {
        url: 'https://www.munpia.com/api/v1/main/search?tab=NOVEL&sort=SIMILARITY&novelType=ALL&finishedOnly=false&adultMode=false&page=0&size=10',
        param: 'query',
        contentType: 'application/json',
        parse(body) {
            const { code, result } = JSON.parse(body);
            if (code !== 'M000_00000' || !Array.isArray(result?.searchNovelTabDtos)
                || (!result.searchNovelTabDtos.length && result.total !== 0)) {
                throw new Error('Invalid Munpia search response');
            }
            return result.searchNovelTabDtos.map(({ title, author, novelId }) => {
                if (typeof title !== 'string' || typeof author !== 'string'
                    || !Number.isSafeInteger(novelId) || novelId <= 0) {
                    throw new Error('Invalid Munpia search entry');
                }
                return { title: plain(title), author: plain(author),
                    url: 'https://www.munpia.com/novel/detail/' + novelId };
            });
        }
    }
};

function plain(html = '') {
    const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
    return html.replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
        if (code[0] !== '#') return entities[code] ?? entity;
        const value = /^#x/i.test(code) ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return value <= 0x10ffff ? String.fromCodePoint(value) : entity;
    }).replace(/\s+/g, ' ').trim();
}

function count(text) {
    const cleaned = plain(text);
    return /^\(?[\d,]+\)?$/.test(cleaned) ? Number(cleaned.replace(/\D/g, '')) : undefined;
}

function rating(match, max) {
    const score = Number(match?.[1]);
    const votes = count(match?.[2]);
    return score > 0 && score <= max && votes > 0 ? { score, max, votes } : {};
}

function titleKey(title) {
    return title.normalize('NFKC').toLowerCase().replace(/\p{P}+/gu, '').replace(/\s+/gu, ' ').trim();
}

function editionTitleKey(title) {
    return titleKey(title.normalize('NFKC').replace(/^\s*\[e북\]\s*/iu, ''));
}

function matchingWorks(results, title) {
    const key = titleKey(title);
    if (!key) return [];
    const exact = results.filter(result => titleKey(result.title) === key);
    const editions = results.filter(result => editionTitleKey(result.title) === key);
    const compact = key.replace(/\s/g, '');
    const matches = exact.length ? exact : editions.length ? editions : results.filter(result =>
        editionTitleKey(result.title).replace(/\s/g, '') === compact);
    return [...new Map(matches.map(result => [result.url, result])).values()];
}

function selectWork(results, title) {
    const matches = matchingWorks(results, title);
    if (matches.length !== 1 || !matches[0].author) return null;
    const key = titleKey(title);
    return titleKey(matches[0].title) === key || editionTitleKey(matches[0].title) === key ? matches[0] : null;
}

async function loadSearch(url, contentType = 'text/html') {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(4500),
        headers: { 'User-Agent': 'EPUBStudio-WorkLookup/1.0 (+https://epub-studio-mocha.vercel.app/)' } });
    if (!response.ok || !response.headers.get('content-type')?.includes(contentType)) {
        throw new Error('Search unavailable');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let html = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            const body = html + decoder.decode();
            if (!body.trim()) throw new Error('Empty search response');
            return body;
        }
        bytes += value.byteLength;
        if (bytes > 4_000_000) {
            await reader.cancel();
            throw new Error('Search response too large');
        }
        html += decoder.decode(value, { stream: true });
    }
}

let nextSosulLookup = 0;
const lookupCache = new Map();
const pendingLookups = new Map();

async function lookupSource(id, title) {
    const now = Date.now();
    for (const [key, entry] of lookupCache) {
        if (entry.expires <= now) lookupCache.delete(key);
    }
    const key = JSON.stringify([id, title]);
    const cached = lookupCache.get(key);
    if (cached) return cached.result;
    if (pendingLookups.has(key)) return pendingLookups.get(key);
    if (pendingLookups.size >= 9) return { id, status: 'deferred' };
    // shortcut: crawl delays and cached results apply per instance; coordinate centrally if scaled out.
    if (id === 'sosul') {
        if (now < nextSosulLookup) return { id, status: 'deferred' };
        nextSosulLookup = now + 10000;
    }
    const source = sources[id];
    const pending = (async () => {
        try {
            const url = new URL(source.url);
            url.searchParams.set(source.param, title);
            const body = await loadSearch(url, source.contentType);
            const rows = source.parse(body);
            if (!rows.length && source.empty && !source.empty.test(body)) {
                throw new Error('Unrecognized search page');
            }
            const work = selectWork(rows, title);
            if (work) return { id, status: 'found', ...work };
            return { id, status: matchingWorks(rows, title).length ? 'ambiguous' : 'empty' };
        } catch {
            return { id, status: 'error' };
        }
    })();
    pendingLookups.set(key, pending);
    try {
        const result = await pending;
        if (['found', 'empty', 'ambiguous'].includes(result.status)) {
            if (lookupCache.size >= 100) lookupCache.delete(lookupCache.keys().next().value);
            lookupCache.set(key, { result, expires: Date.now() + 60000 });
        }
        return result;
    } finally {
        pendingLookups.delete(key);
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    const githubOrigin = req.headers?.origin === 'https://navyvyvy.github.io';
    if (githubOrigin) res.setHeader('Access-Control-Allow-Origin', 'https://navyvyvy.github.io');
    if (req.method === 'OPTIONS') {
        if (!githubOrigin) return res.status(403).json({ error: 'origin' });
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '600');
        return res.status(204).end();
    }
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).json({ error: 'method' });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type'] || '')) {
        return res.status(415).json({ error: 'content-type' });
    }
    if (typeof req.body?.title !== 'string' || req.body.title.length > 120 || !req.body.title.trim()) {
        return res.status(400).json({ error: 'title' });
    }
    if (req.body.source !== undefined
        && (typeof req.body.source !== 'string' || !Object.hasOwn(sources, req.body.source))) {
        return res.status(400).json({ error: 'source' });
    }
    const title = req.body.title.trim();
    const ids = req.body.source === undefined ? Object.keys(sources) : [req.body.source];
    const results = await Promise.all(ids.map(id => lookupSource(id, title)));
    return res.json({
        matches: results.filter(result => result.status === 'found').map(({ status, ...work }) => work),
        statuses: Object.fromEntries(results.map(({ id, status }) => [id, status]))
    });
};

module.exports.sources = sources;
module.exports.selectWork = selectWork;
