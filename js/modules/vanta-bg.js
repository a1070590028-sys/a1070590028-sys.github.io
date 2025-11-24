// js/modules/vanta-bg.js  ——  2025 终极完美版（完整文件，直接覆盖即可）

let currentVanta = null;

const destroy = () => {
    if (currentVanta) {
        currentVanta.destroy();
        currentVanta = null;
    }
};

const resize = () => {
    if (currentVanta && currentVanta.resize) currentVanta.resize();
};
window.addEventListener('resize', resize);
setTimeout(resize, 150);

// 自动模式天空配色（保留你原来的美感）
const skyPresets = [
    { h:[0,6],   sky:0x0f172a, cloud:0x1e293b, sun:0x1e40af },
    { h:[6,9],   sky:0xff9e6b, cloud:0xffffff, sun:0xff6b00 },
    { h:[9,12],  sky:0x87CEEB, cloud:0xffffff, sun:0xff8c00 },
    { h:[12,16], sky:0x60a5fa, cloud:0xf0f9ff, sun:0xffb700 },
    { h:[16,19], sky:0xff6b6b, cloud:0xff8fa3, sun:0xff4500 },
    { h:[19,24], sky:0x1e293b, cloud:0x64748b, sun:0x1e40af }
];
const getSky = () => {
    const h = new Date().getHours();
    return skyPresets.find(p => h >= p.h[0] && h < p.h[1]) || skyPresets[0];
};

const vantaEl = document.getElementById('vanta-bg');

const modes = {
    night: () => {
        destroy();
        currentVanta = window.VANTA.NET({
            el: vantaEl,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
            color: 0x7aa2f7,
            backgroundColor: 0x0f172a,
            points: 11, maxDistance: 22, spacing: 16
        });
        resize();
    },
    day: () => {
        destroy();
        currentVanta = window.VANTA.BIRDS({
            el: vantaEl,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
            backgroundColor: 0x87CEEB,
            color: 0x60a5fa,
            birdSize: 1.5, wingSpan: 30, speedLimit: 5,
            separation: 60, alignment: 30, cohesion: 20, quantity: 4
        });
        resize();
    },
    auto: () => {
        destroy();
        const s = getSky();
        currentVanta = window.VANTA.CLOUDS({
            el: vantaEl,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
            skyColor: s.sky,
            cloudColor: s.cloud,
            cloudShadowColor: 0x172033,
            sunColor: s.sun,
            sunGlareColor: s.sun,
            sunlightColor: 0xffffff,
            speed: 1.0
        });
        resize();
    }
};

const apply = (mode) => {
    // 先清除所有可能的主题类
    document.body.classList.remove(
        'theme-night',
        'theme-day',
        'theme-auto-bright',
        'theme-auto-twilight',
        'theme-auto-dark'
    );

    if (mode === 'night') {
        document.body.classList.add('theme-night');
        modes.night();

    } else if (mode === 'day') {
        document.body.classList.add('theme-day');
        modes.day();

    } else if (mode === 'auto') {
        const h = new Date().getHours();

        // 5-8点 & 17-20点 → 黄昏/黎明专属配色
        if ((h >= 5 && h < 8) || (h >= 17 && h < 20)) {
            document.body.classList.add('theme-auto-twilight');
        }
        // 白天（6-19点）
        else if (h >= 6 && h < 19) {
            document.body.classList.add('theme-auto-bright');
        }
        // 深夜（0-6点）
        else {
            document.body.classList.add('theme-auto-dark');
        }

        modes.auto();

        // 深夜（0-6点）强制使用更帅的 NET 网格（比云更协调）
        if (h >= 0 && h < 6) {
            setTimeout(() => {
                destroy();
                currentVanta = window.VANTA.NET({
                    el: vantaEl,
                    mouseControls: true, touchControls: true,
                    minHeight: 200, minWidth: 200,
                    color: 0x89b4fa,
                    backgroundColor: 0x0f172a,
                    points: 9,
                    maxDistance: 21,
                    spacing: 15
                });
                resize();
            }, 400);
        }
    }

    // 更新按钮高亮
    document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`)?.classList.add('active');

    // 保存用户选择
    localStorage.setItem('frey-bg-mode', mode);
};

// ============ 交互 ============
document.getElementById('bg-switcher-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('bg-switcher-panel');
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
    document.getElementById('net-monitor-panel').style.display = 'none';
    document.getElementById('music-player-panel').style.display = 'none';
});

document.querySelectorAll('.bg-opt').forEach(btn => {
    btn.addEventListener('click', () => apply(btn.dataset.mode));
});

// ============ 启动 ============
const savedMode = localStorage.getItem('frey-bg-mode') || 'night';
apply(savedMode);
