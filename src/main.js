import { SCRIPT_METADATA, MAX_REPLAY_PER_CHAPTER, CHECK_INTERVAL_MS, PANEL_INIT_DELAY_MS, PANEL_POPULATE_DELAY_MS, VIDEO_SWITCH_RETRY_MAX, PIE_REFRESH_DELAY_MS, VIDEO_REPLAY_DELAY_MS } from './constants.js';
import { logStatus } from './utils.js';
import { createPanel } from './panel.js';
import { isHomeworkChapter, isChapterFinished, getChapterTitle, getChapterType, getAllChapters } from './chapters.js';
import { findVideoPlayer, clickMarkAsFinishedButton, soundClose, setSpeed, playVideo, isVideoValid } from './video.js';
import { findNextUnfinished, navigateToChapter } from './navigation.js';

let index = 0;
let runIt;
let lists;
let replayCountMap = {};
let isCheckingProgress = false;
let pendingCheckIndex = null;
let isRefreshingPie = false;
let videoSwitchRetryCount = 0;

export function populatePanel() {
    try {
        lists = getAllChapters();

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

            if (isChapterFinished(item)) continue;
            if (isHomeworkChapter(item)) continue;

            unfinishedCount++;

            const titleText = getChapterTitle(item);
            const typeText = getChapterType(item);

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
    lists = getAllChapters();

    if (num >= lists.length) {
        console.log("索引超出范围，尝试结束。");
        logStatus("章节索引超出范围，脚本结束。");
        window.clearInterval(runIt);
        alert("脚本运行结束。");
        return;
    }

    index = num;
    const currentItem = lists[index];

    if (isHomeworkChapter(currentItem) || isChapterFinished(currentItem)) {
        gotoNextUnfinished(index);
        return;
    }

    const titleText = getChapterTitle(currentItem);
    const typeText = getChapterType(currentItem);

    console.log("当前章节编号：" + index + ", 类型：" + typeText + ", 标题：" + titleText);
    logStatus("正在处理章节 #" + index + " - [" + typeText + "] " + titleText);

    currentItem.click();
    start();
}

function start() {
    console.log("播放检查/启动----");
    window.clearInterval(runIt);
    runIt = setInterval(next, CHECK_INTERVAL_MS);
}

function next() {
    const video = findVideoPlayer();

    if (video === undefined) {
        const versionSwitch = document.querySelector('.version-switch');
        if (versionSwitch && videoSwitchRetryCount < VIDEO_SWITCH_RETRY_MAX) {
            videoSwitchRetryCount++;
            console.log("未找到视频播放器，尝试点击旧版切换按钮 (重试次数:" + videoSwitchRetryCount + ")...");
            logStatus("未找到视频播放器，点击旧版切换按钮 (重试次数:" + videoSwitchRetryCount + ")...");
            versionSwitch.click();
            setTimeout(function() {
                const videoRetry = findVideoPlayer();
                if (videoRetry !== undefined) {
                    videoSwitchRetryCount = 0;
                    console.log("切换旧版后成功找到视频播放器。");
                    logStatus("切换到旧版后找到视频，继续播放。");
                    next();
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

    const c = video.currentTime;
    const d = video.duration;

    if (!isVideoValid(video)) {
        console.log("视频时长无效或仍在加载中，等待加载...");
        logStatus("视频时长未正确获取，等待加载中...");
        if (video.paused) {
            playVideo(video);
        }
        return;
    }

    setSpeed(video, 2.0);
    soundClose();

    if (video.paused) {
        console.log("检测到视频暂停，尝试强制播放...");
        logStatus("检测到视频暂停，尝试继续播放当前章节。");
        playVideo(video);

        var staNow = document.getElementsByClassName("play-btn-tip")[0];
        if (staNow && staNow.innerText === "播放") {
            staNow.click();
        }
    }

    const ratio = c / d;
    const percentText = (ratio * 100).toFixed(2) + "%";
    const remain = d - c;

    if (video.ended || remain <= 1.0) {
        if (isRefreshingPie) return;

        isRefreshingPie = true;
        pendingCheckIndex = index;

        console.log("本节视频完整播放结束，进度：" + percentText + "，准备切换章节刷新饼图...");
        logStatus("本节视频完整播放结束（" + percentText + "），切到其他章节刷新饼图，然后再看饼图是否满。");

        switchChapterForPieRefresh();
    } else {
        console.log("视频正在播放中... 进度: " + percentText);
    }
}

function switchChapterForPieRefresh() {
    lists = getAllChapters();

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

    const item = lists[jumpIndex];
    item.click();
    console.log("为刷新饼图，临时切到章节 #" + jumpIndex);
    logStatus("为刷新饼图，暂时切到章节 #" + jumpIndex + "。");

    setTimeout(function() {
        checkProgressAndMaybeGotoNext();
    }, PIE_REFRESH_DELAY_MS);
}

function checkProgressAndMaybeGotoNext() {
    isCheckingProgress = false;
    lists = getAllChapters();

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
        const v = findVideoPlayer();
        if (v) {
            v.currentTime = 0;
            playVideo(v);
        }
        start();
    }, VIDEO_REPLAY_DELAY_MS);
}

function main() {
    console.log("油猴脚本已启动，开始加载操作面板...");
    createPanel();
    logStatus("脚本已载入，正在识别未完成的章节...");
    setTimeout(populatePanel, PANEL_POPULATE_DELAY_MS);
}

export function getMetadata() {
    return SCRIPT_METADATA;
}

setTimeout(main, PANEL_INIT_DELAY_MS);