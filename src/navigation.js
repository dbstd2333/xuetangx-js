import { getAllChapters, isVideoChapter, shouldSkipChapter } from './chapters.js';

// 从当前位置后面找到下一个可自动学习的章节，跳过已完成、作业和音频章节。
export function findNextUnfinished(startIndex) {
    const lists = getAllChapters();
    for (let i = startIndex + 1; i < lists.length; i++) {
        const item = lists[i];
        if (shouldSkipChapter(item)) continue;
        return i;
    }
    return -1;
}

// 为刷新饼图寻找一个临时可点击视频章节，优先选择最近的非跳过视频章节。
export function findRefreshJumpChapter(currentIndex) {
    const lists = getAllChapters();
    for (let offset = 1; offset < lists.length; offset++) {
        const forwardIndex = currentIndex + offset;
        if (forwardIndex < lists.length && isVideoChapter(lists[forwardIndex]) && !shouldSkipChapter(lists[forwardIndex])) {
            return forwardIndex;
        }

        const backwardIndex = currentIndex - offset;
        if (backwardIndex >= 0 && isVideoChapter(lists[backwardIndex]) && !shouldSkipChapter(lists[backwardIndex])) {
            return backwardIndex;
        }
    }
    return -1;
}
