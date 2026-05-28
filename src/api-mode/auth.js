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

        // 每次请求后休息 2s，避免触发 429 限速
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status} ${path}: ${text.slice(0, 200)}`);
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

module.exports = { parseCookies, createApiClient, checkLogin };
