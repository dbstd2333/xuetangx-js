export function logStatus(msg) {
    var box = document.getElementById("gemini-status");
    if (!box) return;

    var time = new Date().toLocaleTimeString();
    var line = "[" + time + "] " + msg;

    if (box.textContent && box.textContent.trim() !== "") {
        box.textContent += "\n" + line;
    } else {
        box.textContent = line;
    }

    box.scrollTop = box.scrollHeight;
}

export function makeDraggable(element) {
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
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}