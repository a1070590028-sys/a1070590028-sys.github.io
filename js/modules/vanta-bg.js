// js/modules/vanta-bg.js  ← 2025 终极日间完美对应版

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
    night: () => {
        destroy();
        currentVanta = window.VANTA.NET({
            el: vantaEl,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
            color: 0x60a5fa,
            backgroundColor: 0x0f172a,
            points: 12, maxDistance: 22, spacing: 16
        });
        // 夜间主题变量（保持原样）
        document.documentElement.style.setProperty('--text', '#e2e8f0');
        document.documentElement.style.setProperty('--text-muted', '#94a3b8');
        document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.12)');
        document.documentElement.style.setProperty('--card-bg', 'rgba(255,255,255,0.04)');
        document.documentElement.style.setProperty('--btn-bg', 'rgba(255,255,255,0.02)');
        document.documentElement.style.setProperty('--accent', '#60a5fa');
        document.documentElement.style.setProperty('--log-bg', 'rgba(0,0,0,0.25)');
        resize();
    },

    day: () => {
        destroy();
        currentVanta = window.VANTA.BIRDS({
            el: vantaEl,
            mouseControls: true, touchControls: true, gyroControls: false,
            minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
            backgroundColor: 0xc0d6e4,     // 柔和天空蓝
            color: 0x2563eb,
            birdSize: 1.5, wingSpan: 30, speedLimit: 5,
            separation: 60, alignment: 30, cohesion: 20, quantity: 4
        });
        // 日间主题变量 —— 与夜间完全对称的美感
        document.documentElement.style.setProperty('--text', '#1e293b');        // 深蓝灰主文字
        document.documentElement.style.setProperty('--text-muted', '#475569');  // 柔和灰
        document.documentElement.style.setProperty('--border', 'rgba(0,0,0,0.12)');
        document.documentElement.style.setProperty('--card-bg', 'rgba(255,255,255,0.65)');
        document.documentElement.style.setProperty('--btn-bg', 'rgba(255,255,255,0.55)');
        document.documentElement.style.setProperty('--accent', '#2563eb');      // 更深的蓝色主色
        document.documentElement.style.setProperty('--log-bg', 'rgba(0,0,0,0.06)');
        resize();
    }
};

const apply = (mode) => {
    // 移除所有主题类
    document.body.classList.remove('theme-night','theme-day','theme-auto-bright','theme-auto-dark');

    if (mode === 'night') {
        document.body.classList.add('theme-night');
        modes.night();
    } else if (mode === 'day') {
        document.body.classList.add('theme-day');
        modes.day();
    }

    // 更新按钮激活状态
    document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`)?.classList.add('active');
    
    localStorage.setItem('frey-bg-mode', mode);
};

// === 交互 ===
document.getElementById('bg-switcher-btn')?.addEventListener('click', () => {
    const p = document.getElementById('bg-switcher-panel');
    p.style.display = (p.style.display === 'block') ? 'none' : 'block';
    document.getElementById('net-monitor-panel').style.display = 'none';
    document.getElementById('music-player-panel').style.display = 'none';
});

document.querySelectorAll('.bg-opt').forEach(b => {
    b.addEventListener('click', () => apply(b.dataset.mode));
});

// === 启动 ===
const saved = localStorage.getItem('frey-bg-mode') || 'night';
apply(saved);
