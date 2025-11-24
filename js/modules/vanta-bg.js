// js/modules/vanta-bg.js  
// 2025 双模式终极版 + 动态日夜图标 ☀🌙

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

const vantaEl = document.getElementById('vanta-bg');
const bgIcon = document.getElementById('bg-icon'); // 新增：图标元素

const modes = {
    // ──────────────────────── 夜间模式 ────────────────────────
    night: () => {
        destroy();
        currentVanta = window.VANTA.NET({
            el: vantaEl,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
            color: 0x60a5fa, backgroundColor: 0x0f172a,
            points: 12, maxDistance: 22, spacing: 16
        });

        const r = document.documentElement;
        r.style.setProperty('--text', '#f1f5f9');
        r.style.setProperty('--text-muted', '#cbd5e1');
        r.style.setProperty('--border', 'rgba(255,255,255,0.14)');
        r.style.setProperty('--card-bg', 'rgba(255,255,255,0.055)');
        r.style.setProperty('--btn-bg', 'rgba(255,255,255,0.04)');
        r.style.setProperty('--accent', '#60a5fa');
        r.style.setProperty('--accent-light', '#cfe8ff');
        r.style.setProperty('--select-bg', 'rgba(15,23,42,0.7)');
        r.style.setProperty('--select-color', '#ffffff');
        r.style.setProperty('--log-bg', 'rgba(0,0,0,0.32)');
        r.style.setProperty('--select-arrow', '#60a5fa');
        r.style.setProperty('--range-track', 'rgba(96,165,250,0.3)');
        r.style.setProperty('--range-thumb', '#60a5fa');
        r.style.setProperty('--checkbox-border', '#60a5fa');
        r.style.setProperty('--date-deep', '#60a5fa');

        if (bgIcon) bgIcon.textContent = '🌙'; // 夜间显示月亮

        resize();
    },

    // ──────────────────────── 日间模式 ────────────────────────
    day: () => {
        destroy();
        currentVanta = window.VANTA.BIRDS({
            el: vantaEl,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
            backgroundColor: 0xc0d6e4,
            color: 0xff8c6b,
            birdSize: 1.5, wingSpan: 30, speedLimit: 5,
            separation: 60, alignment: 30, cohesion: 20, quantity: 4
        });

        const r = document.documentElement;
        r.style.setProperty('--text', '#2c1e1a');
        r.style.setProperty('--text-muted', '#73554a');
        r.style.setProperty('--border', 'rgba(0,0,0,0.11)');
        r.style.setProperty('--card-bg', 'rgba(255,248,240,0.82)');
        r.style.setProperty('--btn-bg', 'rgba(255,248,240,0.72)');
        r.style.setProperty('--accent', '#ff6b52');
        r.style.setProperty('--accent-light', '#ffb599');
        r.style.setProperty('--select-bg', 'rgba(255,248,240,0.9)');
        r.style.setProperty('--select-color', '#2c1e1a');
        r.style.setProperty('--log-bg', 'rgba(255,230,210,0.4)');
        r.style.setProperty('--select-arrow', '#ff6b52');
        r.style.setProperty('--range-track', 'rgba(255,107,82,0.28)');
        r.style.setProperty('--range-thumb', '#ff6b52');
        r.style.setProperty('--checkbox-border', '#ff6b52');
        r.style.setProperty('--date-deep', '#b8473a');

        if (bgIcon) bgIcon.textContent = '☀'; // 日间显示太阳

        resize();
    }
};

const apply = (mode) => {
    document.body.className = '';
    document.body.classList.add(mode === 'day' ? 'theme-day' : 'theme-night');
    modes[mode]();

    document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`)?.classList.add('active');
    localStorage.setItem('frey-bg-mode', mode);
};

// 按钮点击展开/收起面板
document.getElementById('bg-switcher-btn')?.addEventListener('click', () => {
    const p = document.getElementById('bg-switcher-panel');
    p.style.display = (p.style.display === 'block') ? 'none' : 'block';
    document.getElementById('net-monitor-panel').style.display = 'none';
    document.getElementById('music-player-panel').style.display = 'none';
});

// 切换模式
document.querySelectorAll('.bg-opt').forEach(b => 
    b.addEventListener('click', () => apply(b.dataset.mode))
);

// 初始化
const saved = localStorage.getItem('frey-bg-mode') || 'night';
apply(saved);
