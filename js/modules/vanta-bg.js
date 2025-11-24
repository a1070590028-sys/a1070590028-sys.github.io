// js/modules/vanta-bg.js  
// 2025 双模式终极版：夜间冷蓝深空 ↔ 日间温暖杏橘飞鸟（完全隔离 · 零污染）

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

const modes = {
    // ──────────────────────── 夜间模式（冷蓝深空） ────────────────────────
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
        r.style.setProperty('--text', '#e2e8f0');
        r.style.setProperty('--text-muted', '#94a3b8');
        r.style.setProperty('--border', 'rgba(255,255,255,0.12)');
        r.style.setProperty('--card-bg', 'rgba(255,255,255,0.04)');
        r.style.setProperty('--btn-bg', 'rgba(255,255,255,0.02)');
        r.style.setProperty('--accent', '#60a5fa');
        r.style.setProperty('--accent-light', '#cfe8ff');  // 夜间标题高亮：浅冷蓝
        r.style.setProperty('--log-bg', 'rgba(0,0,0,0.25)');
        r.style.setProperty('--select-arrow', '#60a5fa');
        r.style.setProperty('--range-track', 'rgba(96,165,250,0.25)');
        r.style.setProperty('--range-thumb', '#60a5fa');
        r.style.setProperty('--checkbox-border', '#60a5fa');
        r.style.setProperty('--date-deep', '#60a5fa');

        resize();
    },

    // ──────────────────────── 日间模式（温暖杏橘飞鸟） ────────────────────────
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
        r.style.setProperty('--card-bg', 'rgba(255,248,240,0.78)');
        r.style.setProperty('--btn-bg', 'rgba(255,248,240,0.68)');
        r.style.setProperty('--accent', '#ff6b52');
        r.style.setProperty('--accent-light', '#fed7aa');  // 日间标题高亮：柔和淡杏橘（比其他橙色更浅更奶）
        r.style.setProperty('--log-bg', 'rgba(255,230,210,0.35)');
        r.style.setProperty('--select-arrow', '#ff6b52');
        r.style.setProperty('--range-track', 'rgba(255,107,82,0.25)');
        r.style.setProperty('--range-thumb', '#ff6b52');
        r.style.setProperty('--checkbox-border', '#ff6b52');
        r.style.setProperty('--date-deep', '#b8473a');

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
