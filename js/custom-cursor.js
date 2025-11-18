document.addEventListener("DOMContentLoaded", () => {
    const cursor = document.createElement("div");
    cursor.id = "custom-cursor";
    cursor.classList.add("cursor-default");
    document.body.appendChild(cursor);

    let mouseX = 0, mouseY = 0;
    let isInside = false;

    // 默认偏移变量
    cursor.style.setProperty('--tx', '-4px');
    cursor.style.setProperty('--ty', '-4px');

    document.addEventListener("mouseenter", (e) => {
        isInside = true;
        cursor.classList.add("visible");
        document.body.classList.add("cursor-active");
        mouseX = e.clientX;
        mouseY = e.clientY;
        updatePosition();
    });

    document.addEventListener("mouseleave", () => {
        isInside = false;
        cursor.classList.remove("visible");
        document.body.classList.remove("cursor-active");
    });

    document.addEventListener("mousemove", (e) => {
        if (!isInside) return;
        mouseX = e.clientX;
        mouseY = e.clientY;

        const target = e.target;
        const computed = getComputedStyle(target).cursor;

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

    // 保持 60fps 流畅跟随
    const render = () => {
        if (isInside) updatePosition();
        requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    // 【已彻底删除 hover 放大和点击缩小相关代码】
});
