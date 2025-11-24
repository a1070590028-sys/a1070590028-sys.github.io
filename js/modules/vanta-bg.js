// js/modules/vanta-bg.js
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
const isBright = () => new Date().getHours() >= 6 && new Date().getHours() < 19;

const vantaEl = document.getElementById('vanta-bg');

const modes = {
    night: () => {
        destroy();
        currentVanta = window.VANTA.NET({
            el: vantaEl,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
            color: 0x60a5fa, backgroundColor: 0x0f172a,
            points: 12, maxDistance: 22, spacing: 16
        });
        resize();
    },
    day: () => {
        destroy();
        currentVanta = window.VANTA.BIRDS({
            el: vantaEl,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
            backgroundColor: 0x87CEEB, color: 0x60a5fa,
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
            skyColor: s.sky, cloudColor: s.cloud,
            cloudShadowColor: 0x172033, sunColor: s.sun,
            sunGlareColor: s.sun, sunlightColor: 0xffffff, speed: 1.0
        });
        resize();
    }
};

const apply = (mode) => {
    document.body.classList.remove('theme-night','theme-day','theme-auto-bright','theme-auto-dark');

    if (mode === 'night') {
        document.body.classList.add('theme-night');
        modes.night();
    } else if (mode === 'day') {
        document.body.classList.add('theme-day');
        modes.day();
    } else if (mode === 'auto') {
        const bright = isBright();
        document.body.classList.add(bright ? 'theme-auto-bright' : 'theme-auto-dark');
        modes.auto();

        // 自动模式夜间也用 NET 网格（更酷）
        if (!bright) {
            setTimeout(() => {
                destroy();
                currentVanta = window.VANTA.NET({
                    el: vantaEl,
                    mouseControls: true, touchControls: true,
                    minHeight: 200, minWidth: 200,
                    color: 0x7dd3fc,
                    backgroundColor: 0x0f172a,
                    points: 10, maxDistance: 20, spacing: 15
                });
                resize();
            }, 400);
        }
    }

    document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`)?.classList.add('active');
    localStorage.setItem('frey-bg-mode', mode);
};

// 交互
document.getElementById('bg-switcher-btn')?.addEventListener('click', () => {
    const p = document.getElementById('bg-switcher-panel');
    p.style.display = (p.style.display === 'block') ? 'none' : 'block';
    document.getElementById('net-monitor-panel').style.display = 'none';
    document.getElementById('music-player-panel').style.display = 'none';
});
document.querySelectorAll('.bg-opt').forEach(b => b.addEventListener('click', () => apply(b.dataset.mode)));

// 启动
const saved = localStorage.getItem('frey-bg-mode') || 'night';
apply(saved);
