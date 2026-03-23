import { getAllChapters, isChapterFinished } from './chapters.js';
import { logStatus } from './utils.js';

const DISCUSSION_ANSWER_TEXT = '课程很棒！';
const DISCUSSION_RETRY_DELAY_MS = 1500;
const DISCUSSION_SEND_DELAY_MS = 250;
const DISCUSSION_COMPLETE_DELAY_MS = 2000;
const DISCUSSION_MAX_RETRY = 5;

let isDiscussionFlowRunning = false;
let discussionRetryCount = 0;
let discussionTimer = null;
let activeDiscussionIndex = null;
let activeGotoNextUnfinished = null;

// 只处理当前讨论页顶部的发言框，避免误填到回复区。
function isVisibleElement(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0';
}

// 触发输入事件，让学堂在线的 Vue 绑定能及时感知到内容变化。
function setNativeInputValue(element, value) {
    if (!element) return;

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

        if (descriptor && typeof descriptor.set === 'function') {
            descriptor.set.call(element, value);
        } else {
            element.value = value;
        }

        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        return;
    }

    element.textContent = value;
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}

// 讨论页支持直接按 Enter 发送，作为按钮点击失败时的兜底。
function dispatchEnterKey(element) {
    if (!element) return;

    const eventInit = {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
        which: 13,
        keyCode: 13,
        charCode: 13
    };

    element.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    element.dispatchEvent(new KeyboardEvent('keypress', eventInit));
    element.dispatchEvent(new KeyboardEvent('keyup', eventInit));
}

// 只找“发表你的观点”这一类顶层输入框，不碰评论区回复框。
function findDiscussionEditor() {
    const selectors = [
        '.prompt-send-box textarea.el-textarea__inner',
        '.topics-new textarea.el-textarea__inner',
        '.prompt-send-box textarea[placeholder*="发表"]',
        '.topics-new textarea[placeholder*="发表"]',
        '.prompt-send-box [contenteditable="true"]',
        '.topics-new [contenteditable="true"]'
    ];

    for (let i = 0; i < selectors.length; i++) {
        const nodes = document.querySelectorAll(selectors[i]);
        for (let j = 0; j < nodes.length; j++) {
            const node = nodes[j];
            if (isVisibleElement(node) && !node.closest('.replyBox')) {
                return node;
            }
        }
    }

    const fallbackNodes = document.querySelectorAll('textarea, [contenteditable="true"]');
    for (let i = 0; i < fallbackNodes.length; i++) {
        const node = fallbackNodes[i];
        if (isVisibleElement(node) && !node.closest('.replyBox')) {
            return node;
        }
    }

    return null;
}

// 发送控件在当前页面里通常是 div.prompt-send-btn，而不是原生 button。
function findDiscussionSendControl() {
    const selectors = [
        '.prompt-send-box .prompt-send-btn',
        '.topics-new .prompt-send-btn'
    ];

    for (let i = 0; i < selectors.length; i++) {
        const nodes = document.querySelectorAll(selectors[i]);
        for (let j = 0; j < nodes.length; j++) {
            const node = nodes[j];
            if (isVisibleElement(node) && !node.closest('.replyBox')) {
                return node;
            }
        }
    }

    const fallbackNodes = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a');
    for (let i = 0; i < fallbackNodes.length; i++) {
        const node = fallbackNodes[i];
        const text = (node.innerText || node.textContent || node.value || '').trim();
        if (!isVisibleElement(node) || node.closest('.replyBox')) continue;
        if (/提交|发表|发布|发送|回复|评论/i.test(text) || /提交|发表|发布|发送|回复|评论/i.test(node.getAttribute('aria-label') || '')) {
            return node;
        }
    }

    return null;
}

function isControlDisabled(element) {
    if (!element) return true;
    return Boolean(
        element.disabled ||
        element.getAttribute('aria-disabled') === 'true' ||
        (element.classList && element.classList.contains('disabled'))
    );
}

// 点击发送控件时先派发鼠标事件，和手工操作更接近。
function clickDiscussionSendControl(control) {
    if (!control) return false;

    try {
        control.scrollIntoView({ block: 'center', inline: 'center' });
    } catch (error) {
        // 某些容器不支持滚动，直接忽略即可。
    }

    if (typeof control.focus === 'function') {
        control.focus();
    }

    control.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
    }));
    control.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window
    }));
    control.click();
    return true;
}

function clearDiscussionTimer() {
    if (discussionTimer) {
        window.clearTimeout(discussionTimer);
        discussionTimer = null;
    }
}

function resetDiscussionState() {
    clearDiscussionTimer();
    isDiscussionFlowRunning = false;
    discussionRetryCount = 0;
}

function finishDiscussionFlow() {
    const gotoNextUnfinished = activeGotoNextUnfinished;
    const chapterIndex = activeDiscussionIndex;

    resetDiscussionState();
    activeDiscussionIndex = null;
    activeGotoNextUnfinished = null;

    if (typeof gotoNextUnfinished === 'function') {
        gotoNextUnfinished(chapterIndex);
    }
}

function submitDiscussionAnswer() {
    if (!isDiscussionFlowRunning) return;

    const currentItem = getAllChapters()[activeDiscussionIndex];
    if (!currentItem) {
        logStatus('找不到当前讨论章节，直接跳到下一节。');
        finishDiscussionFlow();
        return;
    }

    if (isChapterFinished(currentItem)) {
        logStatus('当前讨论章节已完成，跳到下一节。');
        finishDiscussionFlow();
        return;
    }

    const editor = findDiscussionEditor();
    if (!editor) {
        if (discussionRetryCount >= DISCUSSION_MAX_RETRY) {
            logStatus('未找到讨论题输入框，已跳过这一节。');
            finishDiscussionFlow();
            return;
        }

        discussionRetryCount++;
        logStatus('未找到讨论题输入框，等待页面加载后重试。');
        discussionTimer = window.setTimeout(submitDiscussionAnswer, DISCUSSION_RETRY_DELAY_MS);
        return;
    }

    setNativeInputValue(editor, DISCUSSION_ANSWER_TEXT);
    if (typeof editor.focus === 'function') {
        editor.focus();
    }

    logStatus('已填写讨论题答案“课程很棒！”，准备提交。');

    discussionTimer = window.setTimeout(function() {
        const sendControl = findDiscussionSendControl();

        if (sendControl && !isControlDisabled(sendControl)) {
            clickDiscussionSendControl(sendControl);
            logStatus('已点击讨论题提交按钮。');
        } else {
            dispatchEnterKey(editor);
            logStatus('已通过 Enter 尝试提交讨论题。');
        }

        discussionTimer = window.setTimeout(finishDiscussionFlow, DISCUSSION_COMPLETE_DELAY_MS);
    }, DISCUSSION_SEND_DELAY_MS);
}

// 公开给主流程，用于判断当前页面是否已经打开了讨论题输入区。
export function hasDiscussionComposer() {
    return findDiscussionEditor() !== null;
}

// 启动讨论题自动填答流程，提交后会继续跳到下一节。
export function startDiscussionFlow(chapterIndex, gotoNextUnfinished) {
    if (isDiscussionFlowRunning) {
        return;
    }

    isDiscussionFlowRunning = true;
    activeDiscussionIndex = chapterIndex;
    activeGotoNextUnfinished = gotoNextUnfinished;
    discussionRetryCount = 0;
    submitDiscussionAnswer();
}

// 给章节切换路径调用，避免讨论题流程的定时器误打到下一页。
export function resetDiscussionFlow() {
    resetDiscussionState();
    activeDiscussionIndex = null;
    activeGotoNextUnfinished = null;
}
