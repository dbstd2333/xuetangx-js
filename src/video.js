import { logStatus } from './utils.js';

export function findVideoPlayer() {
    var videos = document.getElementsByClassName("xt_video_player");
    return videos.length > 0 ? videos[0] : undefined;
}

export function clickMarkAsFinishedButton() {
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