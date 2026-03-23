import { makeDraggable } from './utils.js';

export function createPanel() {
    const panelStyle = `
        #gemini-automation-panel {
            position: fixed;
            top: 100px;
            right: 20px;
            width: 320px;
            background-color: #fff;
            border: 1px solid #ccc;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999;
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            border-radius: 8px;
            overflow: hidden;
            font-size: 13px;
        }
        #gemini-panel-header {
            cursor: move;
            background-color: #007bff;
            color: white;
            padding: 10px;
            border-bottom: 1px solid #0056b3;
            font-weight: bold;
            user-select: none;
        }
        #gemini-automation-panel button {
            transition: background-color 0.3s;
        }
        #gemini-automation-panel button:hover {
            background-color: #1e7e34 !important;
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = panelStyle;
    document.head.appendChild(styleSheet);

    const panelHTML = `
        <div id="gemini-panel-header">
            🚀 学堂在线自动学习面板
        </div>
        <div style="padding: 10px;">
            <p><strong>未完成章节数: </strong><span id="video-count">加载中...</span></p>
            <div style="margin-bottom: 15px; margin-top: 10px;">
                <label for="start-select" style="display: block; font-weight: bold;">选择起始章节（仅显示饼图未满）:</label>
                <select id="start-select" style="width: 100%; padding: 7px; margin-top: 5px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"></select>
            </div>
            <button id="start-automation" style="width: 100%; padding: 10px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                ▶️ 从所选章节开始自动学习
            </button>
            <p style="margin-top: 10px; font-size: 12px; color: #666; text-align: center;">
                * 只播放饼图未满的章节；自动 2.0 倍速、静音，每 5 秒检查进度，饼图未满会自动重播本节。
            </p>

            <div id="gemini-status"
                style="margin-top: 8px; font-size: 12px; color: #333;
                       background: #f8f9fa; border-radius: 4px; padding: 6px;
                       max-height: 140px; overflow-y: auto; white-space: pre-line; border: 1px solid #e1e4e8;">
                等待启动...
            </div>
        </div>
    `;

    const panel = document.createElement("div");
    panel.id = "gemini-automation-panel";
    panel.innerHTML = panelHTML;
    document.body.appendChild(panel);

    makeDraggable(panel);

    return panel;
}