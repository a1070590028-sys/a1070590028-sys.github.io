document.addEventListener("DOMContentLoaded", () => {
    const cursor = document.createElement("div");
    cursor.id = "custom-cursor";
    document.body.appendChild(cursor);

    let mouseX = 0;
    let mouseY = 0;

    // 默认偏移
    cursor.style.setProperty('--tx', '-4px');
    cursor.style.setProperty('--ty', '-4px');

    // 鼠标进入页面
    document.addEventListener("mouseenter", () => {
        cursor.classList.add("visible");
        document.body.classList.add("cursor-active");
    });

    // 鼠标离开页面
    document.addEventListener("mouseleave", () => {
        cursor.classList.remove("visible");
        document.body.classList.remove("cursor-active");
    });

    // 核心：跟随 + 切换形态
    document.addEventListener("mousemove", e => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        const target = e.target;
        const cur = getComputedStyle(target).cursor;

        // 先移除所有形态类
        cursor.className = "";   // 清空所有 class，只保留 id

        if (cur === "pointer") {
            cursor.classList.add("cursor-pointer");
            cursor.style.setProperty('--tx', '-10px');
            cursor.style.setProperty('--ty', '-4px');
        } else if (cur === "text") {
            cursor.classList.add("cursor-text");
            cursor.style.setProperty('--tx', '-50%');
            cursor.style.setProperty('--ty', '-50%');
        } else {
            cursor.classList.add("cursor-default");
            cursor.style.setProperty('--tx', '-4px');
            cursor.style.setProperty('--ty', '-4px');
        }

        cursor.classList.add("visible"); // 确保可见
        cursor.style.left = mouseX + "px";
        cursor.style.top  = mouseY + "px";
    });

    // 60fps 平滑跟随（即使在低帧率设备上也丝滑）
    const loop = () => {
        cursor.style.transform = `translate(calc(${mouseX}px + var(--tx)), calc(${mouseY}px + var(--ty)))`;
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
});
