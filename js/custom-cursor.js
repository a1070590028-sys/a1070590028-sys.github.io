document.addEventListener("DOMContentLoaded", () => {
    const cursor = document.createElement("div");
    cursor.id = "custom-cursor";
    document.body.appendChild(cursor);

    let mouseX = 0, mouseY = 0;

    // 精准获取鼠标下方真实元素
    function getCursorType(x, y) {
        cursor.style.display = 'none';
        const el = document.elementFromPoint(x, y);
        cursor.style.display = '';

        if (!el) return "default";
        const style = getComputedStyle(el);
        const cursorProp = style.cursor;

        if (cursorProp === "pointer" || 
            el.closest('a, button, input, textarea, select, [role="button"], .btn, [onclick]')) {
            return "pointer";
        }
        if (cursorProp === "text" || el.tagName === "TEXTAREA" || el.isContentEditable) {
            return "text";
        }
        return "default";
    }

    document.addEventListener("mousemove", e => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        const type = getCursorType(mouseX, mouseY);

        // 清空再添加，保证 transform 正确覆盖
        cursor.className = "visible";
        cursor.classList.add("cursor-" + type);

        // 直接定位到鼠标坐标，偏移由 CSS 的 !important transform 精确控制
        cursor.style.left = mouseX + "px";
        cursor.style.top  = mouseY + "px";
    });

    // 鼠标进出页面
    document.addEventListener("mouseenter", () => {
        cursor.classList.add("visible");
        document.body.classList.add("cursor-active");
    });
    document.addEventListener("mouseleave", () => {
        cursor.classList.remove("visible");
        document.body.classList.remove("cursor-active");
    });

    // 初始隐藏
    cursor.style.left = "-100px";
    cursor.style.top = "-100px";
});
