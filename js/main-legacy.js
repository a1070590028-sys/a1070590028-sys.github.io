// js/main-legacy.js   ← 专为非 module 浏览器准备的“传统”入口

// 手动按顺序加载所有模块（因为没有 import）
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

// 按依赖顺序加载（vanta 要等 three，压缩要等库）
loadScript('js/modules/time.js').then(() =>
loadScript('js/modules/vanta-bg.js').then(() =>
loadScript('js/modules/card-toggle.js').then(() =>
loadScript('js/modules/image-compress.js').then(() =>
loadScript('js/modules/net-monitor.js')
))))).catch(err => console.error('模块加载失败', err));