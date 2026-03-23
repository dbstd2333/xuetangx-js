export function isHomeworkChapter(menuContentItem) {
    if (!menuContentItem) return false;

    var itemType = menuContentItem.querySelector(".item-type");
    if (!itemType) return false;

    var text = (itemType.innerText || "").trim();
    if (!text) return false;

    return /习题|作业|练习|测验|考试|homework|quiz|exercise/i.test(text);
}

export function isVideoChapter(menuContentItem) {
    if (!menuContentItem) return false;

    var itemType = menuContentItem.querySelector(".item-type");
    if (!itemType) return false;

    var text = (itemType.innerText || "").trim();
    return text === "视频";
}

export function isImageTextChapter(menuContentItem) {
    if (!menuContentItem) return false;

    var itemType = menuContentItem.querySelector(".item-type");
    if (!itemType) return false;

    var text = (itemType.innerText || "").trim();
    return text === "图文";
}

// 讨论题会进入独立的发帖页面，不能按普通视频章节处理。
export function isDiscussionChapter(menuContentItem) {
    if (!menuContentItem) return false;

    const typeText = getChapterType(menuContentItem);
    const titleText = getChapterTitle(menuContentItem);

    return /讨论|discussion/i.test(typeText) || /讨论|discussion/i.test(titleText);
}

export function isChapterFinished(menuContentItem) {
    if (!menuContentItem) return false;
    return menuContentItem.querySelector(".is-finish") !== null;
}

export function getChapterTitle(item) {
    const itemName = item.querySelector(".item-name");
    return itemName ? itemName.innerText.trim() : "无标题";
}

export function getChapterType(item) {
    const itemType = item.querySelector(".item-type");
    return itemType ? itemType.innerText.trim() : "未知";
}

export function getAllChapters() {
    return document.querySelectorAll(".menu-content-item");
}
