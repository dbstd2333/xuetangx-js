const { BASE_URL, DEFAULT_HEADERS } = require('./config');

function parseCookies(cookieStr) {
    const map = {};
    for (const part of cookieStr.split(';')) {
        const [k, ...rest] = part.split('=');
        if (k && rest.length) {
            map[k.trim()] = rest.join('=').trim();
        }
    }
    return map;
}

function parseRetryAfter(text) {
    const m = (text || '').match(/Expected available in\s+(\d+(?:\.\d+)?)\s*seconds?/i);
    if (!m) return null;
    const sec = parseFloat(m[1]);
    return Number.isFinite(sec) && sec >= 0 ? sec : null;
}

async function withRetry(fn, opts = {}) {
    const { maxRetries = 3, baseDelay = 5, onRetry, label = '' } = opts;
    let lastErr;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            if (attempt >= maxRetries) break;
            const waitSec = e && e.retryAfter != null
                ? Math.ceil(e.retryAfter + 2)
                : baseDelay * attempt;
            if (onRetry) onRetry(attempt, e, waitSec);
            await new Promise(r => setTimeout(r, waitSec * 1000));
        }
    }
    throw lastErr;
}

function createApiClient(sessionid, csrftoken) {
    const cookie = `sessionid=${sessionid}; csrftoken=${csrftoken}`;
    const headers = {
        ...DEFAULT_HEADERS,
        'x-csrftoken': csrftoken,
        'cookie': cookie,
    };

    async function request(method, path, body) {
        const url = path.startsWith('http') ? path : BASE_URL + path;
        const opts = {
            method,
            headers: { ...headers },
        };
        if (body !== undefined) {
            opts.body = JSON.stringify(body);
        }
        const resp = await fetch(url, opts);
        const text = await resp.text();

        if (!resp.ok) {
            const err = new Error(`HTTP ${resp.status} ${path}: ${text.slice(0, 200)}`);
            if (resp.status === 429) {
                const retryAfter = parseRetryAfter(text);
                if (retryAfter != null) err.retryAfter = retryAfter;
            }
            throw err;
        }
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    return {
        get: (path) => request('GET', path),
        post: (path, body) => request('POST', path, body),
        getHeaders: () => ({ ...headers }),
    };
}

async function checkLogin(client) {
    const res = await client.get('/api/v1/u/login/check_is_l/');
    if (!res.data?.is_login) {
        throw new Error('未登录，请检查 sessionid 和 csrftoken');
    }
    const profile = await client.get('/api/v1/u/user/basic_profile/');
    return {
        userId: profile.data.user_id,
        schoolNumber: profile.data.school_number,
    };
}

module.exports = { parseCookies, parseRetryAfter, withRetry, createApiClient, checkLogin };
