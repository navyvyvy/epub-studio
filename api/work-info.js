const sources = {
    sosul: {
        url: 'https://ssn.so/series/',
        param: 'keyword',
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
        url: 'https://mm.munpia.com/?action=search&menu=detailSearchV2&searchKey=all',
        param: 'keyword',
        parse(html) {
            return html.split(/(?=<li\b[^>]*view_novel\(\d+)/i).filter(card => /^<li\b/i.test(card)).flatMap(card => {
                const id = card.match(/view_novel\((\d+)/i)?.[1];
                const title = field(card, 'title');
                if (!id || !title) return [];
                const author = plain(field(card, 'author').split(/<span\b/i)[0]);
                const stats = plain(field(card, 'n_info'));
                return [{ title: plain(title.replace(/<span\b[\s\S]*?<\/span>/gi, '')), author,
                    url: 'https://www.munpia.com/novel/detail/' + id,
                    favorites: count(stats.match(/\uc120\ud638\uc791\uc218?\s*([\d,]+)/)?.[1]),
                    likes: count(stats.match(/\ucd94\ucc9c\uc218?\s*([\d,]+)/)?.[1]) }];
            });
        }
    }
};

function field(html, name) {
    return html.match(new RegExp('<p class="' + name + '"[^>]*>([\\s\\S]*?)<\\/p>', 'i'))?.[1] || '';
}

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
    return title.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]+/gu, '');
}

function selectWork(results, title) {
    const key = titleKey(title);
    if (!key) return null;
    const matches = [...new Map(results.filter(result => result.author && titleKey(result.title) === key)
        .map(result => [result.url, result])).values()];
    return matches.length === 1 ? matches[0] : null;
}

async function loadSearch(url) {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(4500),
        headers: { 'User-Agent': 'EPUBStudio-WorkLookup/1.0 (+https://epub-studio-mocha.vercel.app/)' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let html = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) return html + decoder.decode();
        bytes += value.byteLength;
        if (bytes > 4_000_000) {
            await reader.cancel();
            return '';
        }
        html += decoder.decode(value, { stream: true });
    }
}

let nextSosulLookup = 0;
let lookupInProgress = false;

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method' });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type'] || '')) {
        return res.status(415).json({ error: 'content-type' });
    }
    if (typeof req.body?.title !== 'string' || req.body.title.length > 120 || !req.body.title.trim()) {
        return res.status(400).json({ error: 'title' });
    }
    if (lookupInProgress) return res.status(429).json({ error: 'busy' });
    lookupInProgress = true;
    try {
        const title = req.body.title.trim();
        const results = await Promise.all(Object.entries(sources).map(async ([id, source]) => {
            // shortcut: honor the Sosulnet crawl delay per instance; coordinate centrally if scaled out.
            if (id === 'sosul') {
                if (Date.now() < nextSosulLookup) return null;
                nextSosulLookup = Date.now() + 10000;
            }
            try {
                const url = new URL(source.url);
                url.searchParams.set(source.param, title);
                const work = selectWork(source.parse(await loadSearch(url)), title);
                return work && { id, ...work };
            } catch {
                return null;
            }
        }));
        return res.json({ matches: results.filter(Boolean) });
    } finally {
        lookupInProgress = false;
    }
};

module.exports.sources = sources;
module.exports.selectWork = selectWork;
