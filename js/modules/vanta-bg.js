// js/modules/vanta-bg.js
// 让 Vanta 背景始终铺满整个视口 + 内容区域
const vantaEffect = VANTA.NET({
    el: "body",
    mouseControls: true,
    touchControls: true,
    gyroControls: false,
    minHeight: 200,
    minWidth: 200,
    scale: 1.0,
    scaleMobile: 1.0,
    color: 0x60a5fa,
    backgroundColor: 0x0f172a
});

// 关键：页面高度变化时自动 resize（展开卡片、手机键盘弹出等场景都生效）
window.addEventListener('resize', () => {
    if (vantaEffect && vantaEffect.resize) vantaEffect.resize();
});

// 可选：首次加载也强制一次 resize，确保一开始就铺满
setTimeout(() => vantaEffect?.resize?.(), 100);
