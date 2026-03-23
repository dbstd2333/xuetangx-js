export const SCRIPT_METADATA = {
    name: '学堂在线视频自动学习面板脚本',
    namespace: 'http://tampermonkey.net/',
    version: '1.8.0',
    license: 'MIT',
    description: '为学堂在线(xuetangx.com/learn/)提供一个操作面板，只播放左侧"饼图未满"的章节，并自动跳过标题中包含 [音频] 的章节；对讨论题会自动填入“课程很棒！”并提交；自动 2.0 倍速、静音、循环播放，直到饼图满再跳下一节。',
    author: 'Yangkunlong + ChatGPT',
    match: '*://www.xuetangx.com/learn/*',
    grant: 'none',
    runAt: 'document-idle'
};

export const MAX_REPLAY_PER_CHAPTER = 20;
export const CHECK_INTERVAL_MS = 5000;
export const PANEL_INIT_DELAY_MS = 2000;
export const PANEL_POPULATE_DELAY_MS = 3000;
export const PIE_REFRESH_DELAY_MS = 5000;
export const VIDEO_REPLAY_DELAY_MS = 1000;
