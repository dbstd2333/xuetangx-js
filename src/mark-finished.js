import { getAllChapters, isChapterFinished } from './chapters.js';
import { clickMarkAsFinishedButton } from './video.js';
import { logStatus } from './utils.js';

const MARK_AS_FINISHED_RETRY_DELAY_MS = 2000;
const MARK_AS_FINISHED_RETRY_MAX = 5;

let isMarkingAsFinished = false;
let markAsFinishedRetryCount = 0;
let markAsFinishedTimer = null;
let activeChapterIndex = null;
let activeGotoNextUnfinished = null;

function resetMarkAsFinishedState() {
    if (markAsFinishedTimer) {
        window.clearTimeout(markAsFinishedTimer);
        markAsFinishedTimer = null;
    }

    isMarkingAsFinished = false;
    markAsFinishedRetryCount = 0;
}

function finishMarkAsFinishedFlow() {
    const gotoNextUnfinished = activeGotoNextUnfinished;
    const chapterIndex = activeChapterIndex;

    resetMarkAsFinishedState();
    activeChapterIndex = null;
    activeGotoNextUnfinished = null;

    if (typeof gotoNextUnfinished === 'function') {
        gotoNextUnfinished(chapterIndex);
    }
}

function scheduleNextCheck() {
    markAsFinishedTimer = setTimeout(function() {
        confirmMarkAsFinished();
    }, MARK_AS_FINISHED_RETRY_DELAY_MS);
}

function tryClickMarkAsFinishedButton() {
    const currentItem = getAllChapters()[activeChapterIndex];

    if (!currentItem) {
        console.log("找不到当前章节节点，跳到下一个未完成章节。");
        logStatus("找不到当前章节节点，跳到下一个未完成章节。");
        finishMarkAsFinishedFlow();
        return;
    }

    if (isChapterFinished(currentItem)) {
        console.log("当前章节已标记完成，跳到下一个未完成章节。");
        logStatus("当前章节已标记完成，跳到下一个未完成章节。");
        finishMarkAsFinishedFlow();
        return;
    }

    if (markAsFinishedRetryCount >= MARK_AS_FINISHED_RETRY_MAX) {
        console.log("当前章节连续尝试标记看完仍未成功，跳到下一个未完成章节。");
        logStatus("当前章节连续尝试标记看完仍未成功，跳到下一个未完成章节。");
        finishMarkAsFinishedFlow();
        return;
    }

    console.log("当前章节尝试点击'标记看完'按钮 (第" + (markAsFinishedRetryCount + 1) + "次)。");
    logStatus("当前章节尝试点击'标记看完'按钮，第" + (markAsFinishedRetryCount + 1) + "次。");

    clickMarkAsFinishedButton();
    markAsFinishedRetryCount++;
    scheduleNextCheck();
}

function confirmMarkAsFinished() {
    const currentItem = getAllChapters()[activeChapterIndex];

    if (currentItem && isChapterFinished(currentItem)) {
        console.log("当前章节已确认标记完成，跳到下一个未完成章节。");
        logStatus("当前章节已确认标记完成，跳到下一个未完成章节。");
        finishMarkAsFinishedFlow();
        return;
    }

    if (markAsFinishedRetryCount >= MARK_AS_FINISHED_RETRY_MAX) {
        console.log("当前章节点击'标记看完'后仍未确认完成，跳到下一个未完成章节。");
        logStatus("当前章节点击'标记看完'后仍未确认完成，跳到下一个未完成章节。");
        finishMarkAsFinishedFlow();
        return;
    }

    tryClickMarkAsFinishedButton();
}

export function startMarkAsFinishedFlow(chapterIndex, gotoNextUnfinished) {
    if (isMarkingAsFinished) {
        return;
    }

    isMarkingAsFinished = true;
    activeChapterIndex = chapterIndex;
    activeGotoNextUnfinished = gotoNextUnfinished;
    markAsFinishedRetryCount = 0;
    tryClickMarkAsFinishedButton();
}

export function resetMarkAsFinishedFlow() {
    resetMarkAsFinishedState();
    activeChapterIndex = null;
    activeGotoNextUnfinished = null;
}
