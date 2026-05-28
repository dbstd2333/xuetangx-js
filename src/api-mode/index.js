const { createApiClient, checkLogin } = require('./auth');
const { parseCourseUrl } = require('./course');
const { LEAF_TYPE } = require('./config');
const { CONFIG_FILE } = require('./get-cookies');
const { runAutoLearn } = require('./auto-learn');
const fs = require('fs');

function getAuth() {
    const sessionid = process.env.SESSIONID;
    const csrftoken = process.env.CSRFTOKEN;
    if (sessionid && csrftoken) return { sessionid, csrftoken };

    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            if (config.sessionid && config.csrftoken) return config;
        } catch { /* ignore */ }
    }

    console.error('未找到认证信息，请先运行:');
    console.error('  node src/api-mode/interactive.js    (交互式扫码登录)');
    console.error('  node src/api-mode/get-cookies.js    (浏览器获取 cookie)');
    process.exit(1);
}

function parseArgs() {
    const args = process.argv.slice(2);
    let courseUrl = null;
    let skipAudio = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--course-url' && args[i + 1]) {
            courseUrl = args[++i];
        } else if (args[i] === '--skip-audio') {
            skipAudio = true;
        }
    }

    if (!courseUrl) {
        console.error('用法: node src/api-mode/index.js --course-url "https://www.xuetangx.com/learn/..."');
        console.error('选项:');
        console.error('  --course-url   课程页面 URL（必填）');
        console.error('  --skip-audio   跳过音频章节');
        console.error('');
        console.error('或使用交互式模式:');
        console.error('  node src/api-mode/interactive.js');
        process.exit(1);
    }

    return { courseUrl, skipAudio };
}

async function main() {
    const { courseUrl, skipAudio } = parseArgs();
    const { sessionid, csrftoken } = getAuth();
    const client = createApiClient(sessionid, csrftoken);
    const { sign, classroomId } = parseCourseUrl(courseUrl);

    await runAutoLearn(client, sign, classroomId, { skipAudio });
}

main().catch(err => {
    console.error('致命错误:', err);
    process.exit(1);
});
