// js/modules/vanta-bg.js
// 支持 NET / BIRDS / CLOUDS 三种效果 + 自动时间天空

let currentVanta = null;

// 销毁当前效果（切换时必须调用）
const destroyCurrent = () => {
    if (currentVanta) {
        currentVanta.destroy();
        currentVanta = null;
    }
};

// 统一 resize 处理（你原来的逻辑，任何情况都能铺满）
const safeResize = () => {
    if (currentVanta && typeof currentVanta.resize === 'function') {
        currentVanta.resize();
    }
};
window.addEventListener('resize', safeResize);

// 页面加载后强制一次 resize（解决首次未铺满问题）
setTimeout(safeResize, 100);

// 一天六段真实天空配色（自动模式用）
const skyPresets = [
    { h: [0,6],   name:"深夜", sky:0x0f172a, cloud:0x1e293b, sun:0x1e40af },
    { h: [6,9],   name:"清晨", sky:0xff9e6b, cloud:0xffffff, sun:0xff6b00 },
    { h: [9,12],  name:"上午", sky:0x87CEEB, cloud:0xffffff, sun:0xff8c00 },
    { h: [12,16], name:"下午", sky:0x60a5fa, cloud:0xf0f9ff, sun:0xffb700 },
    { h: [16,19], name:"傍晚", sky:0xff6b6b, cloud:0xff8fa3, sun:0xff4500 },
    { h: [19,24], name:"夜晚", sky:0x1e293b, cloud:0x64748b, sun:0x1e40af }
];

const getCurrentSky = () => {
    const hour = new Date().getHours();
    return skyPresets.find(p => hour >= p.h[0] && hour < p.h[1]) || skyPresets[0];
};

// 三种模式实现
const modes = {
    night: () => {
        destroyCurrent();
        currentVanta = VANTA.NET({
            el: document.body,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200,
            minWidth: 200,
            scale: 1.0,
            scaleMobile: 1.0,
            color: 0x60a5fa,
            backgroundColor: 0x0f172a,
            points: 12,
            maxDistance: 22,
            spacing: 16
        });
        safeResize();
    },

    day: () => {
        destroyCurrent();
        currentVanta = VANTA.BIRDS({
            el: document.body,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200,
            minWidth: 200,
            scale: 1.0,
            scaleMobile: 1.0,
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
        safeResize();
    },

    auto: () => {
        destroyCurrent();
        const preset = getCurrentSky();
        currentVanta = VANTA.CLOUDS({
            el: document.body,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200,
            minWidth: 200,
            scale: 1.0,
            scaleMobile: 1.0,
            skyColor: preset.sky,
            cloudColor: preset.cloud,
            cloudShadowColor: 0x172033,
            sunColor: preset.sun,
            sunGlareColor: preset.sun,
            sunlightColor: 0xffffff,
            speed: 1.0
        });
        safeResize();

        // 自动模式下，每小时刷新一次天空颜色
        const now = new Date();
        const msTillNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000;
        setTimeout(() => {
            modes.auto(); // 跨小时时重新生成
            setInterval(modes.auto, 3600000);
        }, msTillNextHour);
    }
};

// 切换函数
const switchMode = (mode) => {
    modes[mode]();
    document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[data-mode="${mode}"]`);
    if (btn) btn.classList.add('active');

    // 保存选择
    localStorage.setItem('frey-bg-mode', mode);
};

// —— 按钮交互（和网络面板完全一致）——
document.getElementById('bg-switcher-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('bg-switcher-panel');
    const visible = panel.style.display === 'block';
    panel.style.display = visible ? 'none' : 'block';

    // 互斥：点开背景面板时自动关闭网络和音乐面板
    document.getElementById('net-monitor-panel').style.display = 'none';
    document.getElementById('music-player-panel').style.display = 'none';
});

document.querySelectorAll('.bg-opt').forEach(btn => {
    btn.addEventListener('click', () => {
        switchMode(btn.dataset.mode);
    });
});

// —— 初始化：恢复上次选择，默认夜间 ——
const savedMode = localStorage.getItem('frey-bg-mode') || 'night';
switchMode(savedMode);
