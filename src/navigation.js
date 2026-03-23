import { logStatus } from './utils.js';
import { getAllChapters, isChapterFinished, isHomeworkChapter, getChapterTitle, getChapterType } from './chapters.js';

export function findNextUnfinished(startIndex) {
    const lists = getAllChapters();
    for (let i = startIndex + 1; i < lists.length; i++) {
        const item = lists[i];
        if (isChapterFinished(item)) continue;
        if (isHomeworkChapter(item)) continue;
        return i;
    }
    return -1;
}

export function navigateToChapter(index, onComplete) {
    const lists = getAllChapters();

    if (index >= lists.length) {
        console.log("索引超出范围，尝试结束。");
        logStatus("章节索引超出范围，脚本结束。");
        return false;
    }

    const currentItem = lists[index];

    if (isHomeworkChapter(currentItem)) {
        logStatus("章节 #" + index + " 是作业/习题，自动跳过。");
        return false;
    }

    if (isChapterFinished(currentItem)) {
        logStatus("章节 #" + index + " 饼图已经满了，自动跳到下一个未完成章节。");
        return false;
    }

    const titleText = getChapterTitle(currentItem);
    const typeText = getChapterType(currentItem);

    console.log("当前章节编号：" + index + ", 类型：" + typeText + ", 标题：" + titleText);
    logStatus("正在处理章节 #" + index + " - [" + typeText + "] " + titleText);

    currentItem.click();
    return true;
}