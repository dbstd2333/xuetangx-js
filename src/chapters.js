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