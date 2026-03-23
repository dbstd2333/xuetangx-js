import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = __dirname;
const SRC_DIR = join(ROOT_DIR, 'src');
const DIST_DIR = join(ROOT_DIR, 'dist');
const OUTPUT_FILE = join(DIST_DIR, 'xuetangx-autolearn.user.js');

const SCRIPT_METADATA = {
    name: '学堂在线视频自动学习面板脚本',
    namespace: 'http://tampermonkey.net/',
    version: '1.8.0',
    license: 'MIT',
    description: '为学堂在线(xuetangx.com/learn/)提供一个操作面板，只播放左侧"饼图未满"的章节，并自动跳过标题中包含 [音频] 的章节；对讨论题会自动填入“课程很棒！”并提交；自动 2.0 倍速、静音、循环播放，直到饼图满再跳下一节。',
    author: 'Yangkunlong + ChatGPT + qinxurui',
    match: '*://www.xuetangx.com/learn/*',
    grant: 'none',
    runAt: 'document-idle'
};

function buildMetadataHeader(meta) {
    const lines = ['// ==UserScript=='];
    for (const [key, value] of Object.entries(meta)) {
        const tmKey = key.replace(/([A-Z])/g, (m) => '-' + m.toLowerCase());
        lines.push(`// @${tmKey.padEnd(16)} ${value}`);
    }
    lines.push('// ==/UserScript==\n');
    return lines.join('\n');
}

async function build({ watch = false } = {}) {
    if (!existsSync(DIST_DIR)) {
        mkdirSync(DIST_DIR, { recursive: true });
    }

    const metadataHeader = buildMetadataHeader(SCRIPT_METADATA);

    const buildOptions = {
        entryPoints: [join(SRC_DIR, 'main.js')],
        bundle: true,
        format: 'iife',
        globalName: 'XuetangXAutoLearn',
        outfile: OUTPUT_FILE,
        banner: {
            js: metadataHeader
        },
        minify: false,
        sourcemap: false,
        logLevel: 'info'
    };

    if (watch) {
        const ctx = await esbuild.context(buildOptions);
        await ctx.watch();
        console.log('👀 监听模式已启动，按 Ctrl+C 停止');
    } else {
        await esbuild.build(buildOptions);
        console.log('✅ 构建完成:', OUTPUT_FILE);
    }
}

const args = process.argv.slice(2);
if (args.includes('--watch')) {
    build({ watch: true });
} else {
    build();
}
