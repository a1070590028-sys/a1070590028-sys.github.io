document.addEventListener("DOMContentLoaded", () => {
    const cursor = document.createElement("div");
    cursor.id = "custom-cursor";
    document.body.appendChild(cursor);

    let mouseX = 0, mouseY = 0;

    // 根据鼠标下元素决定光标类型
    function getCursorType(x, y) {
        const el = document.elementFromPoint(x, y);
        if (!el) return "default";

        const style = getComputedStyle(el);

        if (
            style.cursor === "pointer" ||
            el.closest('a, button, input[type="button"], input[type="submit"], [role="button"], .btn')
        ) {
            return "pointer";
        }

        if (style.cursor === "text" || el.tagName === "TEXTAREA" || el.isContentEditable) {
            return "text";
        }

        return "default";
    }

    // 监听鼠标移动
    document.addEventListener("mousemove", (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        const type = getCursorType(mouseX, mouseY);

        cursor.className = "visible cursor-" + type;

        // 位置跟随
        cursor.style.left = mouseX + "px";
        cursor.style.top = mouseY + "px";
    });

    // 鼠标进入页面时显示自定义光标
    document.addEventListener("mouseenter", () => {
        cursor.classList.add("visible");
        document.body.classList.add("cursor-active");
    });

    // 鼠标离开页面时隐藏自定义光标
    document.addEventListener("mouseleave", () => {
        cursor.classList.remove("visible");
        document.body.classList.remove("cursor-active");
    });

    // 初始位置放到屏幕外
    cursor.style.left = "-100px";
    cursor.style.top = "-100px";
});
