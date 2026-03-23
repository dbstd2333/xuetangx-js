import { getAllChapters, isChapterFinished, isHomeworkChapter } from './chapters.js';

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
