const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.xuetangx.com';
const CONFIG_DIR = path.join(__dirname, '..', '..', '.xuetangx-auth');
const CONFIG_FILE = path.join(CONFIG_DIR, 'cookies.json');

function ensurePuppeteer() {
    try {
        require.resolve('puppeteer');
    } catch {
        console.log('安装 puppeteer...');
        execSync('npm install puppeteer', { cwd: path.join(__dirname, '..', '..'), stdio: 'inherit' });
    }
}

async function getCookies() {
    ensurePuppeteer();
    const puppeteer = require('puppeteer');

    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: CONFIG_DIR,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const page = await browser.newPage();

    await page.goto(`${BASE_URL}/learn`, { waitUntil: 'networkidle2', timeout: 30000 });

    // 等待登录状态
    console.log('等待登录...');
    console.log('如果看到登录页面，请手动完成登录（包括验证码）。');
    console.log('');

    let loggedIn = false;
    while (!loggedIn) {
        try {
            const cookies = await page.cookies();
            const sessionCookie = cookies.find(c => c.name === 'sessionid');
            const csrfCookie = cookies.find(c => c.name === 'csrftoken');
            if (sessionCookie && csrfCookie) {
                // 验证登录有效
                const resp = await page.evaluate(async () => {
                    const r = await fetch('/api/v1/u/login/check_is_l/', {
                        headers: { 'x-client': 'web', 'x-requested-with': 'XMLHttpRequest' },
                    });
                    return r.json();
                });
                if (resp.data?.is_login) {
                    loggedIn = true;
                    console.log('登录成功！');
                    break;
                }
            }
        } catch {
            // 忽略
        }
        await new Promise(r => setTimeout(r, 2000));
    }

    const cookies = await page.cookies();
    const sessionid = cookies.find(c => c.name === 'sessionid')?.value;
    const csrftoken = cookies.find(c => c.name === 'csrftoken')?.value;

    if (!sessionid || !csrftoken) {
        console.error('无法获取 cookie');
        await browser.close();
        process.exit(1);
    }

    // 保存到文件
    const config = { sessionid, csrftoken, updatedAt: new Date().toISOString() };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

    console.log('');
    console.log('Cookie 已保存到: ' + CONFIG_FILE);
    console.log('');
    console.log('环境变量方式:');
    console.log(`  SESSIONID='${sessionid}' CSRFTOKEN='${csrftoken}' node src/api-mode/index.js --course-url "..."`);
    console.log('');

    await browser.close();
    return config;
}

// 直接运行时
if (require.main === module) {
    getCookies().catch(err => {
        console.error('错误:', err.message);
        process.exit(1);
    });
}

module.exports = { getCookies, CONFIG_FILE };
