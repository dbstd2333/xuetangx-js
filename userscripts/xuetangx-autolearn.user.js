// ==UserScript==
// @name         学堂在线视频自动学习面板脚本
// @namespace    http://tampermonkey.net/
// @version      1.7.0
// @license      MIT
// @description  为学堂在线(xuetangx.com/learn/)提供一个操作面板，只播放左侧"饼图未满"的章节；自动 2.0 倍速、静音、循环播放，直到饼图满再跳下一节。
// @author       Yangkunlong + ChatGPT
// @match        *://www.xuetangx.com/learn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    var index = 0;
    var runIt;
    var lists;
    var dragElement;
    var replayCountMap = {};
    var isCheckingProgress = false;
    var pendingCheckIndex = null;
    var isRefreshingPie = false;
    var videoSwitchRetryCount = 0;

    function createPanel() {
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

        dragElement = panel;
        makeDraggable(panel);

        return panel;
    }

    function isHomeworkChapter(menuContentItem) {
        if (!menuContentItem) return false;

        var itemType = menuContentItem.querySelector(".item-type");
        if (!itemType) return false;

        var text = (itemType.innerText || "").trim();
        if (!text) return false;

        return /习题|作业|练习|测验|考试|homework|quiz|exercise/i.test(text);
    }

    function isVideoChapter(menuContentItem) {
        if (!menuContentItem) return false;

        var itemType = menuContentItem.querySelector(".item-type");
        if (!itemType) return false;

        var text = (itemType.innerText || "").trim();
        return text === "视频";
    }

    function isChapterFinished(menuContentItem) {
        if (!menuContentItem) return false;
        return menuContentItem.querySelector(".is-finish") !== null;
    }

    function clickMarkAsFinishedButton() {
        var buttons = document.querySelectorAll('button[class*="buttonhoverblank"]');
        for (var i = 0; i < buttons.length; i++) {
            if (buttons[i].innerText && buttons[i].innerText.includes("看完")) {
                console.log("找到'标记看完'按钮，点击它");
                logStatus("图文课程：点击'标记看完'按钮");
                buttons[i].click();
                return true;
            }
        }
        return false;
    }

    function logStatus(msg) {
        var box = document.getElementById("gemini-status");
        if (!box) return;

        var time = new Date().toLocaleTimeString();
        var line = "[" + time + "] " + msg;

        if (box.textContent && box.textContent.trim() !== "") {
            box.textContent += "\n" + line;
        } else {
            box.textContent = line;
        }

        box.scrollTop = box.scrollHeight;
    }

    function makeDraggable(element) {
        var header = document.getElementById("gemini-panel-header");
        var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        if (header) {
            header.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    function populatePanel() {
        try {
            lists = document.querySelectorAll(".menu-content-item");

            const videoCountSpan = document.getElementById("video-count");
            const startSelect = document.getElementById("start-select");
            const startButton = document.getElementById("start-automation");

            if (lists.length === 0) {
                videoCountSpan.innerText = "0 (未找到章节，请检查类名 'menu-content-item')";
                logStatus("未找到任何章节元素，可能页面结构有变化。");
                startSelect.innerHTML = '<option value="-1">未找到视频列表</option>';
                startButton.disabled = true;
                return;
            }

            startSelect.innerHTML = '';
            let unfinishedCount = 0;

            for (let i = 0; i < lists.length; i++) {
                const item = lists[i];

                if (isChapterFinished(item)) {
                    continue;
                }

                if (isHomeworkChapter(item)) {
                    continue;
                }

                unfinishedCount++;

                let titleText = "无法获取标题";
                const itemName = item.querySelector(".item-name");
                if (itemName) {
                    titleText = itemName.innerText.trim();
                }

                const itemType = item.querySelector(".item-type");
                const typeText = itemType ? itemType.innerText.trim() : "未知";

                const option = document.createElement("option");
                option.value = i;
                option.innerText = `[#${i}] [${typeText}] ${titleText}`;
                startSelect.appendChild(option);
            }

            videoCountSpan.innerText = unfinishedCount;
            logStatus("当前未完成章节数：" + unfinishedCount + "。");

            if (unfinishedCount === 0) {
                startSelect.innerHTML = '<option value="-1">没有未完成的章节</option>';
                startButton.disabled = true;
                logStatus("所有章节饼图都已满，无需自动学习。");
                return;
            } else {
                startButton.disabled = false;
            }

            startButton.onclick = function() {
                const selectedValue = startSelect.value;
                const selectedIndex = parseInt(selectedValue, 10);
                if (!isNaN(selectedIndex) && selectedIndex >= 0) {
                    console.log("用户选择从章节 #", selectedIndex, " 开始。");
                    logStatus("开始自动学习，从章节 #" + selectedIndex + " 开始（饼图未满）。");
                    window.clearInterval(runIt);
                    index = selectedIndex;
                    startNum(selectedIndex);
                } else {
                    alert("请选择一个有效的起始章节！");
                }
            };

        } catch (e) {
            console.error("面板初始化失败:", e);
            logStatus("面板初始化失败：" + e.message);
        }
    }

    function findNextUnfinished(startIndex) {
        lists = document.querySelectorAll(".menu-content-item");
        for (let i = startIndex + 1; i < lists.length; i++) {
            const item = lists[i];
            if (isChapterFinished(item)) {
                continue;
            }
            if (isHomeworkChapter(item)) {
                continue;
            }
            return i;
        }
        return -1;
    }

    function gotoNextUnfinished(currentIndex) {
        const nextIdx = findNextUnfinished(currentIndex);
        if (nextIdx === -1) {
            console.log("没有更多未完成的章节，脚本结束。");
            logStatus("没有更多未完成的章节，脚本结束。");
            window.clearInterval(runIt);
            alert("未完成的章节已全部播放完毕！");
            return;
        }
        startNum(nextIdx);
    }

    function startNum(num) {
        lists = document.querySelectorAll(".menu-content-item");

        if (num >= lists.length) {
            console.log("索引超出范围，尝试结束。");
            logStatus("章节索引超出范围，脚本结束。");
            window.clearInterval(runIt);
            alert("脚本运行结束。");
            return;
        }

        index = num;
        var currentItem = lists[index];

        if (isHomeworkChapter(currentItem)) {
            logStatus("章节 #" + index + " 是作业/习题，自动跳过。");
            gotoNextUnfinished(index);
            return;
        }

        if (isChapterFinished(currentItem)) {
            logStatus("章节 #" + index + " 饼图已经满了，自动跳到下一个未完成章节。");
            gotoNextUnfinished(index);
            return;
        }

        var itemName = currentItem.querySelector(".item-name");
        var titleText = itemName ? itemName.innerText.trim() : "无标题";
        var itemType = currentItem.querySelector(".item-type");
        var typeText = itemType ? itemType.innerText.trim() : "未知";

        console.log("当前章节编号：" + index + ", 类型：" + typeText + ", 标题：" + titleText);
        logStatus("正在处理章节 #" + index + " - [" + typeText + "] " + titleText);

        currentItem.click();

        start();
    }

    function start() {
        console.log("播放检查/启动----");
        window.clearInterval(runIt);
        runIt = setInterval(next, 5000);
    }

    function next() {
        var videos = document.getElementsByClassName("xt_video_player");
        var video = videos.length > 0 ? videos[0] : undefined;

        if (video === undefined) {
            var versionSwitch = document.querySelector('.version-switch');
            if (versionSwitch && videoSwitchRetryCount < 3) {
                videoSwitchRetryCount++;
                console.log("未找到视频播放器，尝试点击旧版切换按钮 (重试次数:" + videoSwitchRetryCount + ")...");
                logStatus("未找到视频播放器，点击旧版切换按钮 (重试次数:" + videoSwitchRetryCount + ")...");
                versionSwitch.click();
                setTimeout(function() {
                    var videosRetry = document.getElementsByClassName("xt_video_player");
                    var videoRetry = videosRetry.length > 0 ? videosRetry[0] : undefined;
                    if (videoRetry !== undefined) {
                        videoSwitchRetryCount = 0;
                        console.log("切换旧版后成功找到视频播放器。");
                        logStatus("切换到旧版后找到视频，继续播放。");
                        next();
                        return;
                    }
                }, 1500);
                return;
            }
            videoSwitchRetryCount = 0;

            if (clickMarkAsFinishedButton()) {
                setTimeout(function() {
                    checkProgressAndMaybeGotoNext();
                }, 2000);
                return;
            }

            console.log("未找到视频播放器，可能是作业/讨论/图文，跳转下一个未完成章节。");
            logStatus("当前章节不是视频（可能是作业/讨论/图文），跳到下一个未完成章节。");
            gotoNextUnfinished(index);
            return;
        }

        var c = video.currentTime;
        var d = video.duration;

        if (!isFinite(d) || d < 1) {
            console.log("视频时长无效或仍在加载中，等待加载...");
            logStatus("视频时长未正确获取，等待加载中...");
            if (video.paused) {
                video.play().catch(function(error) {
                    console.log("尝试播放失败 (可能需要用户交互)：", error.name);
                    logStatus("尝试播放视频失败，可能需要手动点一下播放按钮。");
                });
            }
            return;
        }

        speed(video);
        soundClose();

        if (video.paused) {
            console.log("检测到视频暂停，尝试强制播放...");
            logStatus("检测到视频暂停，尝试继续播放当前章节。");

            video.play().catch(function(error) {
                console.log("视频强制播放失败，可能需要用户交互。错误类型:", error.name);
                logStatus("强制播放失败，可能需要你手动点一下播放按钮。");
            });

            var staNow = document.getElementsByClassName("play-btn-tip")[0];
            if (staNow && staNow.innerText === "播放") {
                staNow.click();
            }
        }

        var ratio = c / d;
        var percentText = (ratio * 100).toFixed(2) + "%";
        var remain = d - c;

        if (video.ended || remain <= 1.0) {
            if (isRefreshingPie) return;

            isRefreshingPie = true;
            pendingCheckIndex = index;

            console.log("本节视频完整播放结束，进度：" + percentText + "，准备切换章节刷新饼图...");
            logStatus("本节视频完整播放结束（" + percentText + "），切到其他章节刷新饼图，然后再看饼图是否满。");

            switchChapterForPieRefresh();
            return;
        }

        console.log("视频正在播放中... 进度: " + percentText);
    }

    function switchChapterForPieRefresh() {
        lists = document.querySelectorAll(".menu-content-item");

        var jumpIndex = -1;
        if (lists.length > 1) {
            if (index + 1 < lists.length) {
                jumpIndex = index + 1;
            } else if (index - 1 >= 0) {
                jumpIndex = index - 1;
            }
        }

        if (jumpIndex === -1) {
            logStatus("只有一个章节，无法切章刷新饼图，直接检查当前章节饼图。");
            checkProgressAndMaybeGotoNext();
            return;
        }

        var item = lists[jumpIndex];
        item.click();
        console.log("为刷新饼图，临时切到章节 #" + jumpIndex);
        logStatus("为刷新饼图，暂时切到章节 #" + jumpIndex + "。");

        setTimeout(function() {
            checkProgressAndMaybeGotoNext();
        }, 5000);
    }

    var MAX_REPLAY_PER_CHAPTER = 20;

    function checkProgressAndMaybeGotoNext() {
        isCheckingProgress = false;
        lists = document.querySelectorAll(".menu-content-item");

        if (pendingCheckIndex == null) {
            isRefreshingPie = false;
            logStatus("没有 pendingCheckIndex，跳过饼图检查。");
            return;
        }

        var idx = pendingCheckIndex;
        var currentItem = lists[idx];

        if (!currentItem) {
            console.log("找不到 pending 章节节点，跳到下一个未完成章节。");
            logStatus("找不到 pending 章节节点，跳到下一个未完成章节。");
            isRefreshingPie = false;
            pendingCheckIndex = null;
            gotoNextUnfinished(idx);
            return;
        }

        if (isChapterFinished(currentItem)) {
            console.log("检测到章节 #" + idx + " 饼图已满，跳到下一个未完成章节。");
            logStatus("章节 #" + idx + " 饼图已满，开始下一节未完成视频。");
            replayCountMap[idx] = 0;
            isRefreshingPie = false;
            pendingCheckIndex = null;
            gotoNextUnfinished(idx);
            return;
        }

        replayCountMap[idx] = (replayCountMap[idx] || 0) + 1;
        var times = replayCountMap[idx];

        console.log("章节 #" + idx + " 饼图仍未满，第 " + times + " 次重播。");
        logStatus("章节 #" + idx + " 饼图仍未满，第 " + times + " 次重播。");

        if (times >= MAX_REPLAY_PER_CHAPTER) {
            console.log("本章节重播超过 " + MAX_REPLAY_PER_CHAPTER + " 次仍未满，跳到下一个未完成章节。");
            logStatus("章节 #" + idx + " 看了 " + MAX_REPLAY_PER_CHAPTER +
                      " 次饼图仍未满，可能需要你手动答题/操作，已自动跳过这一节。");
            isRefreshingPie = false;
            pendingCheckIndex = null;
            gotoNextUnfinished(idx);
            return;
        }

        index = idx;
        pendingCheckIndex = null;
        isRefreshingPie = false;

        currentItem.click();

        setTimeout(function() {
            var videos = document.getElementsByClassName("xt_video_player");
            var v = videos.length > 0 ? videos[0] : null;
            if (v) {
                v.currentTime = 0;
                v.play().catch(function(err) {
                    console.log("重播当前视频失败：", err.name);
                    logStatus("重播当前视频失败，可能需要你手动点一下播放。");
                });
            }
            start();
        }, 1000);
    }

    function soundClose() {
        var mutedIcon = document.getElementsByClassName("xt_video_player_common_icon_muted");
        if (mutedIcon.length === 0) {
            var muteButton = document.getElementsByClassName("xt_video_player_common_icon")[0];
            if (muteButton) {
                muteButton.click();
                console.log("视频声音关闭");
            }
        }
    }

    function speed(video) {
        if (video && video.playbackRate !== 2.0) {
            video.playbackRate = 2.0;
            console.log("设置播放速度为 2.0 倍。");
        }
    }

    function main() {
        console.log("油猴脚本已启动，开始加载操作面板...");
        createPanel();
        logStatus("脚本已载入，正在识别未完成的章节...");
        setTimeout(populatePanel, 3000);
    }

    setTimeout(main, 2000);
})();
