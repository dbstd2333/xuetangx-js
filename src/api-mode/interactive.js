const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');

const BASE_URL = 'https://www.xuetangx.com';
const WS_URL = 'wss://www.xuetangx.com/wsapp/';
const CONFIG_DIR = path.join(__dirname, '..', '..', '.xuetangx-auth');
const CONFIG_FILE = path.join(CONFIG_DIR, 'cookies.json');

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadQRImage(url) {
    const qrDir = path.join(CONFIG_DIR, 'qr');
    await fs.promises.mkdir(qrDir, { recursive: true });
    const qrPath = path.join(qrDir, `login-${Date.now()}.png`);

    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(qrPath);
        https.get(url, (resp) => {
            if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
                https.get(resp.headers.location, (resp2) => {
                    resp2.pipe(file);
                    file.on('finish', () => { file.close(); resolve(qrPath); });
                }).on('error', reject);
            } else {
                resp.pipe(file);
                file.on('finish', () => { file.close(); resolve(qrPath); });
            }
        }).on('error', reject);
    });
}

async function wxQRLogin() {
    const WebSocketClass = globalThis.WebSocket;
    if (!WebSocketClass) {
        console.error('当前 Node.js 版本不支持 WebSocket，请升级到 Node 22+');
        process.exit(1);
    }

    return new Promise((resolve, reject) => {
        const ws = new WebSocketClass(WS_URL);
        let resolved = false;
        let expireTimer = null;

        ws.onerror = (event) => {
            const errMsg = event.message || event.error?.message || '连接失败';
            if (!resolved) { resolved = true; reject(new Error(`WebSocket 连接失败: ${errMsg}`)); }
        };

        ws.onclose = () => {
            if (expireTimer) clearInterval(expireTimer);
        };

        ws.onopen = () => {
            ws.send(JSON.stringify({
                op: 'requestlogin',
                role: 'web',
                version: '1.4',
                purpose: 'login',
                xtbz: 'xt',
                'x-client': 'web',
            }));
        };

        ws.onmessage = async (event) => {
            let msg;
            try { msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString()); } catch { return; }

            if (msg.op === 'requestlogin') {
                console.log('\n请用微信扫描以下二维码登录：');
                console.log(`  ${msg.ticket}\n`);

                console.log(`有效期 ${msg.expire_seconds} 秒，超时自动刷新。\n`);

                let countdown = msg.expire_seconds;
                if (expireTimer) clearInterval(expireTimer);
                expireTimer = setInterval(() => {
                    countdown--;
                    process.stdout.write(`\r  等待扫码，剩余 ${countdown} 秒 `);
                    if (countdown <= 0) {
                        clearInterval(expireTimer);
                        console.log('\n二维码已过期，重新获取...');
                        ws.send(JSON.stringify({
                            op: 'requestlogin', role: 'web', version: '1.4',
                            purpose: 'login', xtbz: 'xt', 'x-client': 'web',
                        }));
                    }
                }, 1000);
            }

            if (msg.op === 'loginsuccess') {
                if (expireTimer) clearInterval(expireTimer);
                process.stdout.write('\r                              \r');
                ws.close();
                console.log('扫码成功，正在登录...');

                try {
                    const token = msg.is_new ? msg.s_s : msg.token;
                    const cookies = await loginWxCallback(token);
                    if (!resolved) { resolved = true; resolve(cookies); }
                } catch (err) {
                    if (!resolved) { resolved = true; reject(err); }
                }
            }
        };

        setTimeout(() => {
            if (!resolved) { resolved = true; ws.close(); reject(new Error('登录超时 (5分钟)')); }
        }, 5 * 60 * 1000);
    });
}

function extractCookiesFromResponse(resp) {
    let sessionid, csrftoken;

    // Node 24+ Headers.getSetCookie() 返回数组
    if (typeof resp.headers.getSetCookie === 'function') {
        const cookies = resp.headers.getSetCookie();
        for (const raw of cookies) {
            const m = raw.match(/^(\w+)=([^;]+)/);
            if (m) {
                if (m[1] === 'sessionid') sessionid = m[2];
                if (m[1] === 'csrftoken') csrftoken = m[2];
            }
        }
    } else {
        const raw = resp.headers.get('set-cookie') || '';
        for (const part of raw.split(/,(?=\w+=)/)) {
            const m = part.trim().match(/^(\w+)=([^;]+)/);
            if (m) {
                if (m[1] === 'sessionid') sessionid = m[2];
                if (m[1] === 'csrftoken') csrftoken = m[2];
            }
        }
    }

    return { sessionid, csrftoken };
}

async function loginWxCallback(s_s) {
    const resp = await fetch(`${BASE_URL}/api/v1/u/login/wx/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'app-name': 'xtzx',
            'x-client': 'web',
            'xtbz': 'xt',
        },
        body: JSON.stringify({ s_s }),
    });

    const data = await resp.json();
    console.log('[debug] loginWx response:', JSON.stringify(data).slice(0, 300));
    console.log('[debug] loginWx set-cookie:', resp.headers.getSetCookie?.() || 'no getSetCookie');

    if (!data.success) {
        throw new Error(`微信登录失败: ${data.msg || JSON.stringify(data)}`);
    }

    let { sessionid, csrftoken } = extractCookiesFromResponse(resp);
    console.log('[debug] extracted cookies:', { sessionid: sessionid ? sessionid.slice(0, 8) + '...' : null, csrftoken: csrftoken ? csrftoken.slice(0, 8) + '...' : null });

    // 如果 login/wx 没有直接设置 cookie，尝试通过 check_is_l 触发
    if (!sessionid || !csrftoken) {
        const checkResp = await fetch(`${BASE_URL}/api/v1/u/login/check_is_l/`, {
            headers: { 'x-client': 'web', 'xtbz': 'xt' },
        });
        const cookies2 = extractCookiesFromResponse(checkResp);
        sessionid = sessionid || cookies2.sessionid;
        csrftoken = csrftoken || cookies2.csrftoken;
    }

    if (!sessionid || !csrftoken) {
        throw new Error('登录成功但未获取到 cookie');
    }

    return { sessionid, csrftoken };
}

async function getCourseList(client) {
    const profile = await client.get('/api/v1/u/user/basic_profile/');
    console.log(`\n用户: ${profile.data?.nickname || ''} (ID: ${profile.data?.user_id})\n`);

    // get_user_last 返回单个最近学习的课程
    try {
        const lastRes = await client.get('/api/v1/lms/learn/get_user_last/');
        console.log(`[debug] get_user_last:`, JSON.stringify(lastRes.data).slice(0, 300));

        // 尝试获取完整课程列表
        const listApis = [
            '/api/v1/lms/learn/course_list/',
            '/api/v1/lms/classroom/list/',
            '/api/v1/lms/learn/list/',
        ];

        let allCourses = [];

        // 先从 get_user_last 提取单个课程
        if (lastRes.data?.product_sign) {
            allCourses.push({
                name: lastRes.data.product_name || '未知课程',
                sign: lastRes.data.product_sign,
                classroomId: String(lastRes.data.classroom_id),
            });
        }

        // 尝试获取完整列表
        for (const api of listApis) {
            try {
                const res = await client.get(api);
                console.log(`[debug] ${api}:`, JSON.stringify(res).slice(0, 500));
                const courses = normalizeCourseList(res.data || res);
                if (courses.length > 0) {
                    // 合并去重
                    const seen = new Set(allCourses.map(c => c.classroomId));
                    for (const c of courses) {
                        if (!seen.has(c.classroomId)) {
                            allCourses.push(c);
                            seen.add(c.classroomId);
                        }
                    }
                }
            } catch (e) {
                console.log(`[debug] ${api}: ${e.message}`);
            }
        }

        console.log(`[debug] 共找到 ${allCourses.length} 门课程:`, allCourses.map(c => c.name));
        if (allCourses.length > 0) return allCourses;
    } catch (e) {
        console.log(`[debug] get_user_last error: ${e.message}`);
    }

    throw new Error('无法获取课程列表');
}

function normalizeCourseList(data) {
    let list = data.course_list || data.classroom_list || data;
    if (!Array.isArray(list)) {
        list = Object.values(data).find(v => Array.isArray(v)) || [];
    }
    return list.map(c => ({
        name: c.course_name || c.classroom_name || c.name || c.product_name || '未知课程',
        sign: c.product_sign || c.sign || c.products_sign,
        classroomId: String(c.classroom_id || c.cid || c.id),
    })).filter(c => c.sign && c.classroomId);
}

async function interactiveCourseSelect(courses) {
    if (courses.length === 0) {
        console.error('未找到课程。请确认已报名课程。');
        process.exit(1);
    }

    console.log('你的课程列表：');
    console.log('─'.repeat(60));
    courses.forEach((c, i) => {
        console.log(`  [${i + 1}] ${c.name}`);
        console.log(`      sign=${c.sign}  cid=${c.classroomId}`);
    });
    console.log('─'.repeat(60));

    const ans = await ask(`\n选择课程编号 (1-${courses.length}): `);
    const idx = parseInt(ans, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= courses.length) {
        console.error('无效选择');
        process.exit(1);
    }

    return courses[idx];
}

async function main() {
    console.log('═══════════════════════════════════');
    console.log('  学堂在线 - 终端自动刷课工具');
    console.log('═══════════════════════════════════\n');

    let config;

    if (fs.existsSync(CONFIG_FILE)) {
        try {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            console.log('检测到已保存的登录信息，验证中...');
            const checkResp = await fetch(`${BASE_URL}/api/v1/u/login/check_is_l/`, {
                headers: {
                    'x-client': 'web',
                    'cookie': `sessionid=${config.sessionid}; csrftoken=${config.csrftoken}`,
                },
            });
            const checkData = await checkResp.json();
            if (checkData.data?.is_login) {
                console.log('Cookie 有效，跳过登录。\n');
            } else {
                console.log('Cookie 已过期，需要重新登录。\n');
                config = null;
            }
        } catch {
            config = null;
        }
    }

    if (!config) {
        config = await wxQRLogin();

        await fs.promises.mkdir(CONFIG_DIR, { recursive: true });
        const saved = { ...config, updatedAt: new Date().toISOString() };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(saved, null, 2));
        console.log(`Cookie 已保存: ${CONFIG_FILE}\n`);
    }

    const { createApiClient } = require('./auth');
    const { runAutoLearn } = require('./auto-learn');

    const client = createApiClient(config.sessionid, config.csrftoken);
    const courses = await getCourseList(client);
    const selected = await interactiveCourseSelect(courses);

    console.log(`\n已选择: ${selected.name}`);
    console.log('开始自动学习...\n');

    await runAutoLearn(client, selected.sign, selected.classroomId);
}

main().catch(err => {
    console.error('\n错误:', err.message);
    process.exit(1);
});
