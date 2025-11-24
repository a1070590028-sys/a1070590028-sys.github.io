// js/modules/vanta-bg.js   ← 直接完整替换成这个文件！

let currentVanta = null;

// 销毁当前效果
const destroy = () => {
    if (currentVanta) {
        currentVanta.destroy();
        currentVanta = null;
    }
};

// 保持铺满视口
const resize = () => {
    if (currentVanta && currentVanta.resize) currentVanta.resize();
};
window.addEventListener('resize', resize);
setTimeout(resize, 150);

// 一天六段真实天空配色（自动模式）
const skyPresets = [
    { h: [0,6],   sky:0x0f172a, cloud:0x1e293b, sun:0x1e40af },   // 深夜
    { h: [6,9],   sky:0xff9e6b, cloud:0xffffff, sun:0xff6b00 },   // 清晨（亮）
    { h: [9,12],  sky:0x87CEEB, cloud:0xffffff, sun:0xff8c00 },   // 上午（亮）
    { h: [12,16], sky:0x60a5fa, cloud:0xf0f9ff, sun:0xffb700 },   // 下午（亮）
    { h: [16,19], sky:0xff6b6b, cloud:0xff8fa3, sun:0xff4500 },   // 傍晚（亮）
    { h: [19,24], sky:0x1e293b, cloud:0x64748b, sun:0x1e40af }    // 夜晚（暗）
];
const getCurrentSky = () => {
    const hour = new Date().getHours();
    return skyPresets.find(p => hour >= p.h[0] && hour < p.h[1]) || skyPresets[0];
};

// 判断当前时间段是否属于“白天”（需要深色文字）
const isBrightTime = () => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 19;   // 6点-19点算白天
};

// 三种模式核心
const modes = {
    night: () => {
        destroy();
        currentVanta = window.VANTA.NET({
            el: document.body,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200,
            scale: 1, scaleMobile: 1,
            color: 0x60a5fa,
            backgroundColor: 0x0f172a,
            points: 12, maxDistance: 22, spacing: 16
        });
        resize();
    },

    day: () => {
        destroy();
        currentVanta = window.VANTA.BIRDS({
            el: document.body,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200,
            scale: 1, scaleMobile: 1,
            backgroundColor: 0x87CEEB,
            color: 0x60a5fa,
            birdSize: 1.5,
            wingSpan: 30,
            speedLimit: 5,
            separation: 60,
            alignment: 30,
            cohesion: 20,
            quantity: 4
        });
        resize();
    },

    auto: () => {
        destroy();
        const sky = getCurrentSky();
        currentVanta = window.VANTA.CLOUDS({
            el: document.body,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200,
            scale: 1, scaleMobile: 1,
            skyColor: sky.sky,
            cloudColor: sky.cloud,
            cloudShadowColor: 0x172033,
            sunColor: sky.sun,
            sunGlareColor: sky.sun,
            sunlightColor: 0xffffff,
            speed: 1.0
        });
        resize();
    }
};

// 切换主函数（负责主题类、文字颜色、保存）
const applyMode = (mode) => {
    // 清除旧主题类
    document.body.classList.remove(
        'theme-night', 'theme-day',
        'theme-auto-bright', 'theme-auto-dark'
    );

    if (mode === 'night') {
        document.body.classList.add('theme-night');
        modes.night();
    } else if (mode === 'day') {
        document.body.classList.add('theme-day');
        modes.day();
    } else if (mode === 'auto') {
        modes.auto();
        document.body.classList.add(
            isBrightTime() ? 'theme-auto-bright' : 'theme-auto-dark'
        );
    }

    // 高亮按钮
    document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`)?.classList.add('active');

    // 保存选择
    localStorage.setItem('frey-bg-mode', mode);
};

// —— 面板交互 ——
document.getElementById('bg-switcher-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('bg-switcher-panel');
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
    // 互斥关闭其他面板
    document.getElementById('net-monitor-panel').style.display = 'none';
    document.getElementById('music-player-panel').style.display = 'none';
});

document.querySelectorAll('.bg-opt').forEach(btn => {
    btn.addEventListener('click', () => applyMode(btn.dataset.mode));
});

// —— 初始化 ——（默认夜间 + 恢复上次选择）
const saved = localStorage.getItem('frey-bg-mode') || 'night';
applyMode(saved);
