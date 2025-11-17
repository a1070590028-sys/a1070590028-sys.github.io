document.addEventListener("DOMContentLoaded", () => {
    const cursor = document.createElement("div");
    cursor.id = "custom-cursor";
    cursor.classList.add("cursor-default");   // 默认箭头
    document.body.appendChild(cursor);

    let mouseX = 0, mouseY = 0;
    let isInside = false;

    // 自定义变量用于 active/pressed 时保持偏移不变
    cursor.style.setProperty('--tx', '-4px');
    cursor.style.setProperty('--ty', '-4px');

    // 鼠标进入页面
    document.addEventListener("mouseenter", (e) => {
        isInside = true;
        cursor.classList.add("visible");
        document.body.classList.add("cursor-active");
        mouseX = e.clientX;
        mouseY = e.clientY;
        updatePosition();
    });

    // 鼠标离开页面
    document.addEventListener("mouseleave", () => {
        isInside = false;
        cursor.classList.remove("visible");
        document.body.classList.remove("cursor-active");
        cursor.classList.remove("active", "pressed");
    });

    // 实时检测当前元素应该显示什么光标
    document.addEventListener("mousemove", (e) => {
        if (!isInside) return;
        mouseX = e.clientX;
        mouseY = e.clientY;

        const target = e.target;
        const computed = getComputedStyle(target).cursor;

        // 移除所有形态类，只保留一个
        cursor.classList.remove("cursor-default", "cursor-pointer", "cursor-text");

        if (computed === "pointer") {
            cursor.classList.add("cursor-pointer");
            cursor.style.setProperty('--tx', '-10px');
            cursor.style.setProperty('--ty', '-4px');
        } else if (computed === "text") {
            cursor.classList.add("cursor-text");
            cursor.style.setProperty('--tx', '-50%');
            cursor.style.setProperty('--ty', '-50%');
        } else {
            cursor.classList.add("cursor-default");
            cursor.style.setProperty('--tx', '-4px');
            cursor.style.setProperty('--ty', '-4px');
        }

        updatePosition();
    });

    function updatePosition() {
        cursor.style.left = `${mouseX}px`;
        cursor.style.top  = `${mouseY}px`;
    }

    const render = () => {
        if (isInside) updatePosition();
        requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    // hover 放大（可点击元素）
    const clickable = "a, button, input, select, textarea, label, [onclick], [role='button'], .btn, .card-title, .toggle-icon";
    const addListeners = () => {
        document.querySelectorAll(clickable).forEach(el => {
            if (!el.dataset.cursorListener) {
                el.dataset.cursorListener = "true";
                el.addEventListener("mouseenter", () => cursor.classList.add("active"));
                el.addEventListener("mouseleave", () => cursor.classList.remove("active"));
            }
        });
    };
    addListeners();
    new MutationObserver(addListeners).observe(document.body, { childList: true, subtree: true });

    // 点击缩小
    document.addEventListener("mousedown", () => cursor.classList.add("pressed"));
    document.addEventListener("mouseup", () => cursor.classList.remove("pressed"));
});