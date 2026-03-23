import { logStatus } from './utils.js';

export function findVideoPlayer() {
    var videos = document.getElementsByClassName("xt_video_player");
    return videos.length > 0 ? videos[0] : undefined;
}

function normalizeText(text) {
    return (text || "").replace(/\s+/g, "").trim();
}

function dispatchMouseEvent(target, type) {
    if (!target) return;

    target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window
    }));
}

export function findMarkAsFinishedButton() {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        var text = normalizeText(button.textContent || button.innerText);
        var isVisible = button.getClientRects().length > 0;
        var isDisabled = button.disabled || button.getAttribute('aria-disabled') === 'true';

        if (text.includes("标记看完") && isVisible && !isDisabled) {
            return button;
        }
    }
    return null;
}

export function clickMarkAsFinishedButton() {
    var button = findMarkAsFinishedButton();
    if (!button) {
        return false;
    }

    console.log("找到'标记看完'按钮，点击它");
    logStatus("当前章节：点击'标记看完'按钮");

    try {
        button.scrollIntoView({ block: "center", inline: "center" });
    } catch (error) {
        // 某些页面容器不支持平滑滚动，忽略即可。
    }

    if (typeof button.focus === "function") {
        button.focus();
    }

    dispatchMouseEvent(button, "mousedown");
    dispatchMouseEvent(button, "mouseup");
    button.click();
    return true;
}

export function soundClose() {
    var mutedIcon = document.getElementsByClassName("xt_video_player_common_icon_muted");
    if (mutedIcon.length === 0) {
        var muteButton = document.getElementsByClassName("xt_video_player_common_icon")[0];
        if (muteButton) {
            muteButton.click();
            console.log("视频声音关闭");
        }
    }
}

export function setSpeed(video, rate = 2.0) {
    if (video && video.playbackRate !== rate) {
        video.playbackRate = rate;
        console.log("设置播放速度为 " + rate + " 倍。");
    }
}

export function playVideo(video) {
    if (video && video.paused) {
        video.play().catch(function(error) {
            console.log("尝试播放失败 (可能需要用户交互)：", error.name);
            logStatus("尝试播放视频失败，可能需要手动点一下播放按钮。");
        });
    }
}

export function isVideoValid(video) {
    return isFinite(video.duration) && video.duration >= 1;
}
