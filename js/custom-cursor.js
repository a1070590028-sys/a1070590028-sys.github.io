document.addEventListener("DOMContentLoaded", () => {
    const cursor = document.createElement("div");
    cursor.id = "custom-cursor";
    document.body.appendChild(cursor);

    let mouseX = 0;
    let mouseY = 0;

    // 使用 document.elementFromPoint 来真正获取「鼠标下方的可交互元素」
    function getCursorType(x, y) {
        // 临时隐藏自定义光标，防止自己挡住检测
        cursor.style.display = 'none';
        const underneath = document.elementFromPoint(x, y);
        cursor.style.display = '';
        
        if (!underneath) return "default";
        const style = getComputedStyle(underneath);
        const cursorType = style.cursor;

        // 更宽松的判断，兼容更多情况
        if (cursorType === "pointer" || 
            underneath.tagName === "A" || 
            underneath.tagName === "BUTTON" || 
            underneath.onclick || 
            underneath.style.cursor === "pointer" ||
            underneath.closest('a, button, [onclick], [role="button"], .btn')) {
            return "pointer";
        }
        if (cursorType === "text" || underneath.tagName === "TEXTAREA" || underneath.isContentEditable) {
            return "text";
        }
        return "default";
    }

    document.addEventListener("mousemove", e => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        const type = getCursorType(mouseX, mouseY);

        cursor.className = "visible"; // 先清空再加
        cursor.classList.add("cursor-" + type);

        // 直接用 transform 居中定位，不再依赖 CSS 变量（更稳定）
        cursor.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
    });

    document.addEventListener("mouseenter", () => {
        cursor.classList.add("visible");
        document.body.classList.add("cursor-active");
    });

    document.addEventListener("mouseleave", () => {
        cursor.classList.remove("visible");
        document.body.classList.remove("cursor-active");
    });

    // 初始隐藏在左上角
    cursor.style.transform = "translate(-100px, -100px)";
});
