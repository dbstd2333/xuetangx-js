// ==UserScript==
// @name             学堂在线视频自动学习面板脚本
// @namespace        http://tampermonkey.net/
// @version          1.8.0
// @license          MIT
// @description      为学堂在线(xuetangx.com/learn/)提供一个操作面板，只播放左侧"饼图未满"的章节；对讨论题会自动填入“课程很棒！”并提交；自动 2.0 倍速、静音、循环播放，直到饼图满再跳下一节。
// @author           Yangkunlong + ChatGPT + qinxurui
// @match            *://www.xuetangx.com/learn/*
// @grant            none
// @run-at           document-idle
// ==/UserScript==

var XuetangXAutoLearn = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/main.js
  var main_exports = {};
  __export(main_exports, {
    getMetadata: () => getMetadata,
    populatePanel: () => populatePanel
  });

  // src/constants.js
  var SCRIPT_METADATA = {
    name: "\u5B66\u5802\u5728\u7EBF\u89C6\u9891\u81EA\u52A8\u5B66\u4E60\u9762\u677F\u811A\u672C",
    namespace: "http://tampermonkey.net/",
    version: "1.8.0",
    license: "MIT",
    description: '\u4E3A\u5B66\u5802\u5728\u7EBF(xuetangx.com/learn/)\u63D0\u4F9B\u4E00\u4E2A\u64CD\u4F5C\u9762\u677F\uFF0C\u53EA\u64AD\u653E\u5DE6\u4FA7"\u997C\u56FE\u672A\u6EE1"\u7684\u7AE0\u8282\uFF1B\u5BF9\u8BA8\u8BBA\u9898\u4F1A\u81EA\u52A8\u586B\u5165\u201C\u8BFE\u7A0B\u5F88\u68D2\uFF01\u201D\u5E76\u63D0\u4EA4\uFF1B\u81EA\u52A8 2.0 \u500D\u901F\u3001\u9759\u97F3\u3001\u5FAA\u73AF\u64AD\u653E\uFF0C\u76F4\u5230\u997C\u56FE\u6EE1\u518D\u8DF3\u4E0B\u4E00\u8282\u3002',
    author: "Yangkunlong + ChatGPT",
    match: "*://www.xuetangx.com/learn/*",
    grant: "none",
    runAt: "document-idle"
  };
  var MAX_REPLAY_PER_CHAPTER = 20;
  var CHECK_INTERVAL_MS = 5e3;
  var PANEL_INIT_DELAY_MS = 2e3;
  var PANEL_POPULATE_DELAY_MS = 3e3;
  var PIE_REFRESH_DELAY_MS = 5e3;
  var VIDEO_REPLAY_DELAY_MS = 1e3;

  // src/utils.js
  function logStatus(msg) {
    var box = document.getElementById("gemini-status");
    if (!box)
      return;
    var time = (/* @__PURE__ */ new Date()).toLocaleTimeString();
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
      element.style.top = element.offsetTop - pos2 + "px";
      element.style.left = element.offsetLeft - pos1 + "px";
    }
    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // src/panel.js
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
            \u{1F680} \u5B66\u5802\u5728\u7EBF\u81EA\u52A8\u5B66\u4E60\u9762\u677F
        </div>
        <div style="padding: 10px;">
            <p><strong>\u672A\u5B8C\u6210\u7AE0\u8282\u6570: </strong><span id="video-count">\u52A0\u8F7D\u4E2D...</span></p>
            <div style="margin-bottom: 15px; margin-top: 10px;">
                <label for="start-select" style="display: block; font-weight: bold;">\u9009\u62E9\u8D77\u59CB\u7AE0\u8282\uFF08\u4EC5\u663E\u793A\u997C\u56FE\u672A\u6EE1\uFF09:</label>
                <select id="start-select" style="width: 100%; padding: 7px; margin-top: 5px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"></select>
            </div>
            <button id="start-automation" style="width: 100%; padding: 10px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                \u25B6\uFE0F \u4ECE\u6240\u9009\u7AE0\u8282\u5F00\u59CB\u81EA\u52A8\u5B66\u4E60
            </button>
            <p style="margin-top: 10px; font-size: 12px; color: #666; text-align: center;">
                * \u53EA\u64AD\u653E\u997C\u56FE\u672A\u6EE1\u7684\u7AE0\u8282\uFF1B\u8BA8\u8BBA\u9898\u4F1A\u81EA\u52A8\u586B\u5165\u201C\u8BFE\u7A0B\u5F88\u68D2\uFF01\u201D\u5E76\u63D0\u4EA4\uFF1B\u81EA\u52A8 2.0 \u500D\u901F\u3001\u9759\u97F3\uFF0C\u6BCF 5 \u79D2\u68C0\u67E5\u8FDB\u5EA6\uFF0C\u997C\u56FE\u672A\u6EE1\u4F1A\u81EA\u52A8\u91CD\u64AD\u672C\u8282\u3002
            </p>

            <div id="gemini-status"
                style="margin-top: 8px; font-size: 12px; color: #333;
                       background: #f8f9fa; border-radius: 4px; padding: 6px;
                       max-height: 140px; overflow-y: auto; white-space: pre-line; border: 1px solid #e1e4e8;">
                \u7B49\u5F85\u542F\u52A8...
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

  // src/chapters.js
  function isHomeworkChapter(menuContentItem) {
    if (!menuContentItem)
      return false;
    var itemType = menuContentItem.querySelector(".item-type");
    if (!itemType)
      return false;
    var text = (itemType.innerText || "").trim();
    if (!text)
      return false;
    return /习题|作业|练习|测验|考试|homework|quiz|exercise/i.test(text);
  }
  function isImageTextChapter(menuContentItem) {
    if (!menuContentItem)
      return false;
    var itemType = menuContentItem.querySelector(".item-type");
    if (!itemType)
      return false;
    var text = (itemType.innerText || "").trim();
    return text === "\u56FE\u6587";
  }
  function isDiscussionChapter(menuContentItem) {
    if (!menuContentItem)
      return false;
    const typeText = getChapterType(menuContentItem);
    const titleText = getChapterTitle(menuContentItem);
    return /讨论|discussion/i.test(typeText) || /讨论|discussion/i.test(titleText);
  }
  function isChapterFinished(menuContentItem) {
    if (!menuContentItem)
      return false;
    return menuContentItem.querySelector(".is-finish") !== null;
  }
  function getChapterTitle(item) {
    const itemName = item.querySelector(".item-name");
    return itemName ? itemName.innerText.trim() : "\u65E0\u6807\u9898";
  }
  function getChapterType(item) {
    const itemType = item.querySelector(".item-type");
    return itemType ? itemType.innerText.trim() : "\u672A\u77E5";
  }
  function getAllChapters() {
    return document.querySelectorAll(".menu-content-item");
  }

  // src/video.js
  function findVideoPlayer() {
    var videos = document.getElementsByClassName("xt_video_player");
    return videos.length > 0 ? videos[0] : void 0;
  }
  function normalizeText(text) {
    return (text || "").replace(/\s+/g, "").trim();
  }
  function dispatchMouseEvent(target, type) {
    if (!target)
      return;
    target.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }
  function findMarkAsFinishedButton() {
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      var text = normalizeText(button.textContent || button.innerText);
      var isVisible = button.getClientRects().length > 0;
      var isDisabled = button.disabled || button.getAttribute("aria-disabled") === "true";
      if (text.includes("\u6807\u8BB0\u770B\u5B8C") && isVisible && !isDisabled) {
        return button;
      }
    }
    return null;
  }
  function clickMarkAsFinishedButton() {
    var button = findMarkAsFinishedButton();
    if (!button) {
      return false;
    }
    console.log("\u627E\u5230'\u6807\u8BB0\u770B\u5B8C'\u6309\u94AE\uFF0C\u70B9\u51FB\u5B83");
    logStatus("\u5F53\u524D\u7AE0\u8282\uFF1A\u70B9\u51FB'\u6807\u8BB0\u770B\u5B8C'\u6309\u94AE");
    try {
      button.scrollIntoView({ block: "center", inline: "center" });
    } catch (error) {
    }
    if (typeof button.focus === "function") {
      button.focus();
    }
    dispatchMouseEvent(button, "mousedown");
    dispatchMouseEvent(button, "mouseup");
    button.click();
    return true;
  }
  function soundClose() {
    var mutedIcon = document.getElementsByClassName("xt_video_player_common_icon_muted");
    if (mutedIcon.length === 0) {
      var muteButton = document.getElementsByClassName("xt_video_player_common_icon")[0];
      if (muteButton) {
        muteButton.click();
        console.log("\u89C6\u9891\u58F0\u97F3\u5173\u95ED");
      }
    }
  }
  function setSpeed(video, rate = 2) {
    if (video && video.playbackRate !== rate) {
      video.playbackRate = rate;
      console.log("\u8BBE\u7F6E\u64AD\u653E\u901F\u5EA6\u4E3A " + rate + " \u500D\u3002");
    }
  }
  function playVideo(video) {
    if (video && video.paused) {
      video.play().catch(function(error) {
        console.log("\u5C1D\u8BD5\u64AD\u653E\u5931\u8D25 (\u53EF\u80FD\u9700\u8981\u7528\u6237\u4EA4\u4E92)\uFF1A", error.name);
        logStatus("\u5C1D\u8BD5\u64AD\u653E\u89C6\u9891\u5931\u8D25\uFF0C\u53EF\u80FD\u9700\u8981\u624B\u52A8\u70B9\u4E00\u4E0B\u64AD\u653E\u6309\u94AE\u3002");
      });
    }
  }
  function isVideoValid(video) {
    return isFinite(video.duration) && video.duration >= 1;
  }

  // src/navigation.js
  function findNextUnfinished(startIndex) {
    const lists2 = getAllChapters();
    for (let i = startIndex + 1; i < lists2.length; i++) {
      const item = lists2[i];
      if (isChapterFinished(item))
        continue;
      if (isHomeworkChapter(item))
        continue;
      return i;
    }
    return -1;
  }

  // src/mark-finished.js
  var MARK_AS_FINISHED_RETRY_DELAY_MS = 2e3;
  var MARK_AS_FINISHED_RETRY_MAX = 5;
  var isMarkingAsFinished = false;
  var markAsFinishedRetryCount = 0;
  var markAsFinishedTimer = null;
  var activeChapterIndex = null;
  var activeGotoNextUnfinished = null;
  function resetMarkAsFinishedState() {
    if (markAsFinishedTimer) {
      window.clearTimeout(markAsFinishedTimer);
      markAsFinishedTimer = null;
    }
    isMarkingAsFinished = false;
    markAsFinishedRetryCount = 0;
  }
  function finishMarkAsFinishedFlow() {
    const gotoNextUnfinished2 = activeGotoNextUnfinished;
    const chapterIndex = activeChapterIndex;
    resetMarkAsFinishedState();
    activeChapterIndex = null;
    activeGotoNextUnfinished = null;
    if (typeof gotoNextUnfinished2 === "function") {
      gotoNextUnfinished2(chapterIndex);
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
      console.log("\u627E\u4E0D\u5230\u5F53\u524D\u7AE0\u8282\u8282\u70B9\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      logStatus("\u627E\u4E0D\u5230\u5F53\u524D\u7AE0\u8282\u8282\u70B9\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      finishMarkAsFinishedFlow();
      return;
    }
    if (isChapterFinished(currentItem)) {
      console.log("\u5F53\u524D\u7AE0\u8282\u5DF2\u6807\u8BB0\u5B8C\u6210\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      logStatus("\u5F53\u524D\u7AE0\u8282\u5DF2\u6807\u8BB0\u5B8C\u6210\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      finishMarkAsFinishedFlow();
      return;
    }
    if (markAsFinishedRetryCount >= MARK_AS_FINISHED_RETRY_MAX) {
      console.log("\u5F53\u524D\u7AE0\u8282\u8FDE\u7EED\u5C1D\u8BD5\u6807\u8BB0\u770B\u5B8C\u4ECD\u672A\u6210\u529F\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      logStatus("\u5F53\u524D\u7AE0\u8282\u8FDE\u7EED\u5C1D\u8BD5\u6807\u8BB0\u770B\u5B8C\u4ECD\u672A\u6210\u529F\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      finishMarkAsFinishedFlow();
      return;
    }
    console.log("\u5F53\u524D\u7AE0\u8282\u5C1D\u8BD5\u70B9\u51FB'\u6807\u8BB0\u770B\u5B8C'\u6309\u94AE (\u7B2C" + (markAsFinishedRetryCount + 1) + "\u6B21)\u3002");
    logStatus("\u5F53\u524D\u7AE0\u8282\u5C1D\u8BD5\u70B9\u51FB'\u6807\u8BB0\u770B\u5B8C'\u6309\u94AE\uFF0C\u7B2C" + (markAsFinishedRetryCount + 1) + "\u6B21\u3002");
    clickMarkAsFinishedButton();
    markAsFinishedRetryCount++;
    scheduleNextCheck();
  }
  function confirmMarkAsFinished() {
    const currentItem = getAllChapters()[activeChapterIndex];
    if (currentItem && isChapterFinished(currentItem)) {
      console.log("\u5F53\u524D\u7AE0\u8282\u5DF2\u786E\u8BA4\u6807\u8BB0\u5B8C\u6210\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      logStatus("\u5F53\u524D\u7AE0\u8282\u5DF2\u786E\u8BA4\u6807\u8BB0\u5B8C\u6210\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      finishMarkAsFinishedFlow();
      return;
    }
    if (markAsFinishedRetryCount >= MARK_AS_FINISHED_RETRY_MAX) {
      console.log("\u5F53\u524D\u7AE0\u8282\u70B9\u51FB'\u6807\u8BB0\u770B\u5B8C'\u540E\u4ECD\u672A\u786E\u8BA4\u5B8C\u6210\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      logStatus("\u5F53\u524D\u7AE0\u8282\u70B9\u51FB'\u6807\u8BB0\u770B\u5B8C'\u540E\u4ECD\u672A\u786E\u8BA4\u5B8C\u6210\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      finishMarkAsFinishedFlow();
      return;
    }
    tryClickMarkAsFinishedButton();
  }
  function startMarkAsFinishedFlow(chapterIndex, gotoNextUnfinished2) {
    if (isMarkingAsFinished) {
      return;
    }
    isMarkingAsFinished = true;
    activeChapterIndex = chapterIndex;
    activeGotoNextUnfinished = gotoNextUnfinished2;
    markAsFinishedRetryCount = 0;
    tryClickMarkAsFinishedButton();
  }
  function resetMarkAsFinishedFlow() {
    resetMarkAsFinishedState();
    activeChapterIndex = null;
    activeGotoNextUnfinished = null;
  }

  // src/discussion.js
  var DISCUSSION_ANSWER_TEXT = "\u8BFE\u7A0B\u5F88\u68D2\uFF01";
  var DISCUSSION_RETRY_DELAY_MS = 1500;
  var DISCUSSION_SEND_DELAY_MS = 250;
  var DISCUSSION_COMPLETE_DELAY_MS = 2e3;
  var DISCUSSION_MAX_RETRY = 5;
  var isDiscussionFlowRunning = false;
  var discussionRetryCount = 0;
  var discussionTimer = null;
  var activeDiscussionIndex = null;
  var activeGotoNextUnfinished2 = null;
  function isVisibleElement(element) {
    if (!element)
      return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }
  function setNativeInputValue(element, value) {
    if (!element)
      return;
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor && typeof descriptor.set === "function") {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      return;
    }
    element.textContent = value;
    element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  }
  function dispatchEnterKey(element) {
    if (!element)
      return;
    const eventInit = {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter",
      which: 13,
      keyCode: 13,
      charCode: 13
    };
    element.dispatchEvent(new KeyboardEvent("keydown", eventInit));
    element.dispatchEvent(new KeyboardEvent("keypress", eventInit));
    element.dispatchEvent(new KeyboardEvent("keyup", eventInit));
  }
  function findDiscussionEditor() {
    const selectors = [
      ".prompt-send-box textarea.el-textarea__inner",
      ".topics-new textarea.el-textarea__inner",
      '.prompt-send-box textarea[placeholder*="\u53D1\u8868"]',
      '.topics-new textarea[placeholder*="\u53D1\u8868"]',
      '.prompt-send-box [contenteditable="true"]',
      '.topics-new [contenteditable="true"]'
    ];
    for (let i = 0; i < selectors.length; i++) {
      const nodes = document.querySelectorAll(selectors[i]);
      for (let j = 0; j < nodes.length; j++) {
        const node = nodes[j];
        if (isVisibleElement(node) && !node.closest(".replyBox")) {
          return node;
        }
      }
    }
    const fallbackNodes = document.querySelectorAll('textarea, [contenteditable="true"]');
    for (let i = 0; i < fallbackNodes.length; i++) {
      const node = fallbackNodes[i];
      if (isVisibleElement(node) && !node.closest(".replyBox")) {
        return node;
      }
    }
    return null;
  }
  function findDiscussionSendControl() {
    const selectors = [
      ".prompt-send-box .prompt-send-btn",
      ".topics-new .prompt-send-btn"
    ];
    for (let i = 0; i < selectors.length; i++) {
      const nodes = document.querySelectorAll(selectors[i]);
      for (let j = 0; j < nodes.length; j++) {
        const node = nodes[j];
        if (isVisibleElement(node) && !node.closest(".replyBox")) {
          return node;
        }
      }
    }
    const fallbackNodes = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a');
    for (let i = 0; i < fallbackNodes.length; i++) {
      const node = fallbackNodes[i];
      const text = (node.innerText || node.textContent || node.value || "").trim();
      if (!isVisibleElement(node) || node.closest(".replyBox"))
        continue;
      if (/提交|发表|发布|发送|回复|评论/i.test(text) || /提交|发表|发布|发送|回复|评论/i.test(node.getAttribute("aria-label") || "")) {
        return node;
      }
    }
    return null;
  }
  function isControlDisabled(element) {
    if (!element)
      return true;
    return Boolean(
      element.disabled || element.getAttribute("aria-disabled") === "true" || element.classList && element.classList.contains("disabled")
    );
  }
  function clickDiscussionSendControl(control) {
    if (!control)
      return false;
    try {
      control.scrollIntoView({ block: "center", inline: "center" });
    } catch (error) {
    }
    if (typeof control.focus === "function") {
      control.focus();
    }
    control.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    control.dispatchEvent(new MouseEvent("mouseup", {
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
    const gotoNextUnfinished2 = activeGotoNextUnfinished2;
    const chapterIndex = activeDiscussionIndex;
    resetDiscussionState();
    activeDiscussionIndex = null;
    activeGotoNextUnfinished2 = null;
    if (typeof gotoNextUnfinished2 === "function") {
      gotoNextUnfinished2(chapterIndex);
    }
  }
  function submitDiscussionAnswer() {
    if (!isDiscussionFlowRunning)
      return;
    const currentItem = getAllChapters()[activeDiscussionIndex];
    if (!currentItem) {
      logStatus("\u627E\u4E0D\u5230\u5F53\u524D\u8BA8\u8BBA\u7AE0\u8282\uFF0C\u76F4\u63A5\u8DF3\u5230\u4E0B\u4E00\u8282\u3002");
      finishDiscussionFlow();
      return;
    }
    if (isChapterFinished(currentItem)) {
      logStatus("\u5F53\u524D\u8BA8\u8BBA\u7AE0\u8282\u5DF2\u5B8C\u6210\uFF0C\u8DF3\u5230\u4E0B\u4E00\u8282\u3002");
      finishDiscussionFlow();
      return;
    }
    const editor = findDiscussionEditor();
    if (!editor) {
      if (discussionRetryCount >= DISCUSSION_MAX_RETRY) {
        logStatus("\u672A\u627E\u5230\u8BA8\u8BBA\u9898\u8F93\u5165\u6846\uFF0C\u5DF2\u8DF3\u8FC7\u8FD9\u4E00\u8282\u3002");
        finishDiscussionFlow();
        return;
      }
      discussionRetryCount++;
      logStatus("\u672A\u627E\u5230\u8BA8\u8BBA\u9898\u8F93\u5165\u6846\uFF0C\u7B49\u5F85\u9875\u9762\u52A0\u8F7D\u540E\u91CD\u8BD5\u3002");
      discussionTimer = window.setTimeout(submitDiscussionAnswer, DISCUSSION_RETRY_DELAY_MS);
      return;
    }
    setNativeInputValue(editor, DISCUSSION_ANSWER_TEXT);
    if (typeof editor.focus === "function") {
      editor.focus();
    }
    logStatus("\u5DF2\u586B\u5199\u8BA8\u8BBA\u9898\u7B54\u6848\u201C\u8BFE\u7A0B\u5F88\u68D2\uFF01\u201D\uFF0C\u51C6\u5907\u63D0\u4EA4\u3002");
    discussionTimer = window.setTimeout(function() {
      const sendControl = findDiscussionSendControl();
      if (sendControl && !isControlDisabled(sendControl)) {
        clickDiscussionSendControl(sendControl);
        logStatus("\u5DF2\u70B9\u51FB\u8BA8\u8BBA\u9898\u63D0\u4EA4\u6309\u94AE\u3002");
      } else {
        dispatchEnterKey(editor);
        logStatus("\u5DF2\u901A\u8FC7 Enter \u5C1D\u8BD5\u63D0\u4EA4\u8BA8\u8BBA\u9898\u3002");
      }
      discussionTimer = window.setTimeout(finishDiscussionFlow, DISCUSSION_COMPLETE_DELAY_MS);
    }, DISCUSSION_SEND_DELAY_MS);
  }
  function hasDiscussionComposer() {
    return findDiscussionEditor() !== null;
  }
  function startDiscussionFlow(chapterIndex, gotoNextUnfinished2) {
    if (isDiscussionFlowRunning) {
      return;
    }
    isDiscussionFlowRunning = true;
    activeDiscussionIndex = chapterIndex;
    activeGotoNextUnfinished2 = gotoNextUnfinished2;
    discussionRetryCount = 0;
    submitDiscussionAnswer();
  }
  function resetDiscussionFlow() {
    resetDiscussionState();
    activeDiscussionIndex = null;
    activeGotoNextUnfinished2 = null;
  }

  // src/main.js
  var index = 0;
  var runIt;
  var lists;
  var replayCountMap = {};
  var pendingCheckIndex = null;
  var isRefreshingPie = false;
  function populatePanel() {
    try {
      lists = getAllChapters();
      const videoCountSpan = document.getElementById("video-count");
      const startSelect = document.getElementById("start-select");
      const startButton = document.getElementById("start-automation");
      if (lists.length === 0) {
        videoCountSpan.innerText = "0 (\u672A\u627E\u5230\u7AE0\u8282\uFF0C\u8BF7\u68C0\u67E5\u7C7B\u540D 'menu-content-item')";
        logStatus("\u672A\u627E\u5230\u4EFB\u4F55\u7AE0\u8282\u5143\u7D20\uFF0C\u53EF\u80FD\u9875\u9762\u7ED3\u6784\u6709\u53D8\u5316\u3002");
        startSelect.innerHTML = '<option value="-1">\u672A\u627E\u5230\u89C6\u9891\u5217\u8868</option>';
        startButton.disabled = true;
        return;
      }
      startSelect.innerHTML = "";
      let unfinishedCount = 0;
      for (let i = 0; i < lists.length; i++) {
        const item = lists[i];
        if (isChapterFinished(item))
          continue;
        if (isHomeworkChapter(item))
          continue;
        unfinishedCount++;
        const titleText = getChapterTitle(item);
        const typeText = getChapterType(item);
        const option = document.createElement("option");
        option.value = i;
        option.innerText = `[#${i}] [${typeText}] ${titleText}`;
        startSelect.appendChild(option);
      }
      videoCountSpan.innerText = unfinishedCount;
      logStatus("\u5F53\u524D\u672A\u5B8C\u6210\u7AE0\u8282\u6570\uFF1A" + unfinishedCount + "\u3002");
      if (unfinishedCount === 0) {
        startSelect.innerHTML = '<option value="-1">\u6CA1\u6709\u672A\u5B8C\u6210\u7684\u7AE0\u8282</option>';
        startButton.disabled = true;
        logStatus("\u6240\u6709\u7AE0\u8282\u997C\u56FE\u90FD\u5DF2\u6EE1\uFF0C\u65E0\u9700\u81EA\u52A8\u5B66\u4E60\u3002");
        return;
      } else {
        startButton.disabled = false;
      }
      startButton.onclick = function() {
        const selectedValue = startSelect.value;
        const selectedIndex = parseInt(selectedValue, 10);
        if (!isNaN(selectedIndex) && selectedIndex >= 0) {
          console.log("\u7528\u6237\u9009\u62E9\u4ECE\u7AE0\u8282 #", selectedIndex, " \u5F00\u59CB\u3002");
          logStatus("\u5F00\u59CB\u81EA\u52A8\u5B66\u4E60\uFF0C\u4ECE\u7AE0\u8282 #" + selectedIndex + " \u5F00\u59CB\uFF08\u997C\u56FE\u672A\u6EE1\uFF09\u3002");
          window.clearInterval(runIt);
          index = selectedIndex;
          startNum(selectedIndex);
        } else {
          alert("\u8BF7\u9009\u62E9\u4E00\u4E2A\u6709\u6548\u7684\u8D77\u59CB\u7AE0\u8282\uFF01");
        }
      };
    } catch (e) {
      console.error("\u9762\u677F\u521D\u59CB\u5316\u5931\u8D25:", e);
      logStatus("\u9762\u677F\u521D\u59CB\u5316\u5931\u8D25\uFF1A" + e.message);
    }
  }
  function gotoNextUnfinished(currentIndex) {
    const nextIdx = findNextUnfinished(currentIndex);
    if (nextIdx === -1) {
      console.log("\u6CA1\u6709\u66F4\u591A\u672A\u5B8C\u6210\u7684\u7AE0\u8282\uFF0C\u811A\u672C\u7ED3\u675F\u3002");
      logStatus("\u6CA1\u6709\u66F4\u591A\u672A\u5B8C\u6210\u7684\u7AE0\u8282\uFF0C\u811A\u672C\u7ED3\u675F\u3002");
      window.clearInterval(runIt);
      alert("\u672A\u5B8C\u6210\u7684\u7AE0\u8282\u5DF2\u5168\u90E8\u64AD\u653E\u5B8C\u6BD5\uFF01");
      return;
    }
    resetMarkAsFinishedFlow();
    resetDiscussionFlow();
    startNum(nextIdx);
  }
  function startNum(num) {
    lists = getAllChapters();
    if (num >= lists.length) {
      console.log("\u7D22\u5F15\u8D85\u51FA\u8303\u56F4\uFF0C\u5C1D\u8BD5\u7ED3\u675F\u3002");
      logStatus("\u7AE0\u8282\u7D22\u5F15\u8D85\u51FA\u8303\u56F4\uFF0C\u811A\u672C\u7ED3\u675F\u3002");
      window.clearInterval(runIt);
      alert("\u811A\u672C\u8FD0\u884C\u7ED3\u675F\u3002");
      return;
    }
    index = num;
    resetMarkAsFinishedFlow();
    resetDiscussionFlow();
    const currentItem = lists[index];
    if (isHomeworkChapter(currentItem) || isChapterFinished(currentItem)) {
      gotoNextUnfinished(index);
      return;
    }
    const titleText = getChapterTitle(currentItem);
    const typeText = getChapterType(currentItem);
    console.log("\u5F53\u524D\u7AE0\u8282\u7F16\u53F7\uFF1A" + index + ", \u7C7B\u578B\uFF1A" + typeText + ", \u6807\u9898\uFF1A" + titleText);
    logStatus("\u6B63\u5728\u5904\u7406\u7AE0\u8282 #" + index + " - [" + typeText + "] " + titleText);
    currentItem.click();
    start();
  }
  function start() {
    console.log("\u64AD\u653E\u68C0\u67E5/\u542F\u52A8----");
    window.clearInterval(runIt);
    runIt = setInterval(next, CHECK_INTERVAL_MS);
  }
  function next() {
    const video = findVideoPlayer();
    if (video === void 0) {
      lists = getAllChapters();
      const currentItem = lists[index];
      if (!currentItem) {
        gotoNextUnfinished(index);
        return;
      }
      if (isImageTextChapter(currentItem) || findMarkAsFinishedButton()) {
        startMarkAsFinishedFlow(index, gotoNextUnfinished);
        return;
      }
      if (isDiscussionChapter(currentItem) || hasDiscussionComposer()) {
        console.log("\u5F53\u524D\u7AE0\u8282\u662F\u8BA8\u8BBA\u9898\uFF0C\u51C6\u5907\u81EA\u52A8\u586B\u5199\u5E76\u63D0\u4EA4\u3002");
        logStatus("\u5F53\u524D\u7AE0\u8282\u662F\u8BA8\u8BBA\u9898\uFF0C\u81EA\u52A8\u586B\u5199\u201C\u8BFE\u7A0B\u5F88\u68D2\uFF01\u201D\u5E76\u63D0\u4EA4\u540E\u8FDB\u5165\u4E0B\u4E00\u8282\u3002");
        startDiscussionFlow(index, gotoNextUnfinished);
        return;
      }
      console.log("\u672A\u627E\u5230\u89C6\u9891\u64AD\u653E\u5668\uFF0C\u53EF\u80FD\u662F\u4F5C\u4E1A/\u8BA8\u8BBA/\u56FE\u6587\uFF0C\u8DF3\u8F6C\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      logStatus("\u5F53\u524D\u7AE0\u8282\u4E0D\u662F\u89C6\u9891\uFF08\u53EF\u80FD\u662F\u4F5C\u4E1A/\u8BA8\u8BBA/\u56FE\u6587\uFF09\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      gotoNextUnfinished(index);
      return;
    }
    const c = video.currentTime;
    const d = video.duration;
    if (!isVideoValid(video)) {
      console.log("\u89C6\u9891\u65F6\u957F\u65E0\u6548\u6216\u4ECD\u5728\u52A0\u8F7D\u4E2D\uFF0C\u7B49\u5F85\u52A0\u8F7D...");
      logStatus("\u89C6\u9891\u65F6\u957F\u672A\u6B63\u786E\u83B7\u53D6\uFF0C\u7B49\u5F85\u52A0\u8F7D\u4E2D...");
      if (video.paused) {
        playVideo(video);
      }
      return;
    }
    setSpeed(video, 2);
    soundClose();
    if (video.paused) {
      console.log("\u68C0\u6D4B\u5230\u89C6\u9891\u6682\u505C\uFF0C\u5C1D\u8BD5\u5F3A\u5236\u64AD\u653E...");
      logStatus("\u68C0\u6D4B\u5230\u89C6\u9891\u6682\u505C\uFF0C\u5C1D\u8BD5\u7EE7\u7EED\u64AD\u653E\u5F53\u524D\u7AE0\u8282\u3002");
      playVideo(video);
      var staNow = document.getElementsByClassName("play-btn-tip")[0];
      if (staNow && staNow.innerText === "\u64AD\u653E") {
        staNow.click();
      }
    }
    const ratio = c / d;
    const percentText = (ratio * 100).toFixed(2) + "%";
    const remain = d - c;
    if (video.ended || remain <= 1) {
      if (isRefreshingPie)
        return;
      isRefreshingPie = true;
      pendingCheckIndex = index;
      console.log("\u672C\u8282\u89C6\u9891\u5B8C\u6574\u64AD\u653E\u7ED3\u675F\uFF0C\u8FDB\u5EA6\uFF1A" + percentText + "\uFF0C\u51C6\u5907\u5207\u6362\u7AE0\u8282\u5237\u65B0\u997C\u56FE...");
      logStatus("\u672C\u8282\u89C6\u9891\u5B8C\u6574\u64AD\u653E\u7ED3\u675F\uFF08" + percentText + "\uFF09\uFF0C\u5207\u5230\u5176\u4ED6\u7AE0\u8282\u5237\u65B0\u997C\u56FE\uFF0C\u7136\u540E\u518D\u770B\u997C\u56FE\u662F\u5426\u6EE1\u3002");
      switchChapterForPieRefresh();
    } else {
      console.log("\u89C6\u9891\u6B63\u5728\u64AD\u653E\u4E2D... \u8FDB\u5EA6: " + percentText);
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
      logStatus("\u53EA\u6709\u4E00\u4E2A\u7AE0\u8282\uFF0C\u65E0\u6CD5\u5207\u7AE0\u5237\u65B0\u997C\u56FE\uFF0C\u76F4\u63A5\u68C0\u67E5\u5F53\u524D\u7AE0\u8282\u997C\u56FE\u3002");
      checkProgressAndMaybeGotoNext();
      return;
    }
    const item = lists[jumpIndex];
    item.click();
    console.log("\u4E3A\u5237\u65B0\u997C\u56FE\uFF0C\u4E34\u65F6\u5207\u5230\u7AE0\u8282 #" + jumpIndex);
    logStatus("\u4E3A\u5237\u65B0\u997C\u56FE\uFF0C\u6682\u65F6\u5207\u5230\u7AE0\u8282 #" + jumpIndex + "\u3002");
    setTimeout(function() {
      checkProgressAndMaybeGotoNext();
    }, PIE_REFRESH_DELAY_MS);
  }
  function checkProgressAndMaybeGotoNext() {
    lists = getAllChapters();
    if (pendingCheckIndex == null) {
      isRefreshingPie = false;
      logStatus("\u6CA1\u6709 pendingCheckIndex\uFF0C\u8DF3\u8FC7\u997C\u56FE\u68C0\u67E5\u3002");
      return;
    }
    var idx = pendingCheckIndex;
    var currentItem = lists[idx];
    if (!currentItem) {
      console.log("\u627E\u4E0D\u5230 pending \u7AE0\u8282\u8282\u70B9\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      logStatus("\u627E\u4E0D\u5230 pending \u7AE0\u8282\u8282\u70B9\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      isRefreshingPie = false;
      pendingCheckIndex = null;
      gotoNextUnfinished(idx);
      return;
    }
    if (isChapterFinished(currentItem)) {
      console.log("\u68C0\u6D4B\u5230\u7AE0\u8282 #" + idx + " \u997C\u56FE\u5DF2\u6EE1\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      logStatus("\u7AE0\u8282 #" + idx + " \u997C\u56FE\u5DF2\u6EE1\uFF0C\u5F00\u59CB\u4E0B\u4E00\u8282\u672A\u5B8C\u6210\u89C6\u9891\u3002");
      replayCountMap[idx] = 0;
      isRefreshingPie = false;
      pendingCheckIndex = null;
      gotoNextUnfinished(idx);
      return;
    }
    replayCountMap[idx] = (replayCountMap[idx] || 0) + 1;
    var times = replayCountMap[idx];
    console.log("\u7AE0\u8282 #" + idx + " \u997C\u56FE\u4ECD\u672A\u6EE1\uFF0C\u7B2C " + times + " \u6B21\u91CD\u64AD\u3002");
    logStatus("\u7AE0\u8282 #" + idx + " \u997C\u56FE\u4ECD\u672A\u6EE1\uFF0C\u7B2C " + times + " \u6B21\u91CD\u64AD\u3002");
    if (times >= MAX_REPLAY_PER_CHAPTER) {
      console.log("\u672C\u7AE0\u8282\u91CD\u64AD\u8D85\u8FC7 " + MAX_REPLAY_PER_CHAPTER + " \u6B21\u4ECD\u672A\u6EE1\uFF0C\u8DF3\u5230\u4E0B\u4E00\u4E2A\u672A\u5B8C\u6210\u7AE0\u8282\u3002");
      logStatus("\u7AE0\u8282 #" + idx + " \u770B\u4E86 " + MAX_REPLAY_PER_CHAPTER + " \u6B21\u997C\u56FE\u4ECD\u672A\u6EE1\uFF0C\u53EF\u80FD\u9700\u8981\u4F60\u624B\u52A8\u7B54\u9898/\u64CD\u4F5C\uFF0C\u5DF2\u81EA\u52A8\u8DF3\u8FC7\u8FD9\u4E00\u8282\u3002");
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
    console.log("\u6CB9\u7334\u811A\u672C\u5DF2\u542F\u52A8\uFF0C\u5F00\u59CB\u52A0\u8F7D\u64CD\u4F5C\u9762\u677F...");
    createPanel();
    logStatus("\u811A\u672C\u5DF2\u8F7D\u5165\uFF0C\u6B63\u5728\u8BC6\u522B\u672A\u5B8C\u6210\u7684\u7AE0\u8282...");
    setTimeout(populatePanel, PANEL_POPULATE_DELAY_MS);
  }
  function getMetadata() {
    return SCRIPT_METADATA;
  }
  setTimeout(main, PANEL_INIT_DELAY_MS);
  return __toCommonJS(main_exports);
})();
