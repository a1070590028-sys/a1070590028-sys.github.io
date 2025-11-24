// js/modules/vanta-bg.js  ← 2025 终极双模式版（夜间不变 + 暖杏日间）

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
    // ==================== 夜间模式（100% 原样不变） ====================
    night: () => {
        destroy();
        currentVanta = window.VANTA.NET({
            el: vantaEl,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200,
            minWidth: 200,
            scale: 1,
            scaleMobile: 1,
            color: 0x60a5fa,
            backgroundColor: 0x0f172a,
            points: 12,
            maxDistance: 22,
            spacing: 16
        });

        // 夜间经典冷蓝深空配色（原汁原味）
        document.documentElement.style.setProperty('--text', '#e2e8f0');
        document.documentElement.style.setProperty('--text-muted', '#94a3b8');
        document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.12)');
        document.documentElement.style.setProperty('--card-bg', 'rgba(255,255,255,0.04)');
        document.documentElement.style.setProperty('--btn-bg', 'rgba(255,255,255,0.02)');
        document.documentElement.style.setProperty('--accent', '#60a5fa');
        document.documentElement.style.setProperty('--log-bg', 'rgba(0,0,0,0.25)');

        resize();
    },

    // ==================== 日间模式（温暖杏橘系 · 超治愈） ====================
    day: () => {
        destroy();
        currentVanta = window.VANTA.BIRDS({
            el: vantaEl,
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200,
            minWidth: 200,
            scale: 1,
            scaleMobile: 1,
            backgroundColor: 0xc0d6e4,     // 柔和天空蓝
            color: 0xff8c6b,               // 重点！飞鸟变成温暖珊瑚橙
            birdSize: 1.5,
            wingSpan: 30,
            speedLimit: 5,
            separation: 60,
            alignment: 30,
            cohesion: 20,
            quantity: 4
        });

        // 暖杏奶油色系（看久了只想说“太舒服了”）
        document.documentElement.style.setProperty('--text', '#2c1e1a');        // 深暖棕黑（主文字）
        document.documentElement.style.setProperty('--text-muted', '#73554a');  // 红棕灰（辅助文字）
        document.documentElement.style.setProperty('--border', 'rgba(0,0,0,0.11)');
        document.documentElement.style.setProperty('--card-bg', 'rgba(255,248,240,0.78)');  // 杏仁奶油透明磨砂
        document.documentElement.style.setProperty('--btn-bg', 'rgba(255,248,240,0.68)');
        document.documentElement.style.setProperty('--accent', '#ff6b52');       // 珊瑚橙主色调（和飞鸟同色系）
        document.documentElement.style.setProperty('--log-bg', 'rgba(255,230,210,0.35)'); // 超淡橙粉日志区

        resize();
    }
};

const apply = (mode) => {
    // 清除旧主题类
    document.body.classList.remove('theme-night', 'theme-day', 'theme-auto-bright', 'theme-auto-dark');

    if (mode === 'night') {
        document.body.classList.add('theme-night');
        modes.night();
    } else if (mode === 'day') {
        document.body.classList.add('theme-day');
        modes.day();
    }

    // 更新按钮高亮
    document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`)?.classList.add('active');

    localStorage.setItem('frey-bg-mode', mode);
};

// ==================== 交互 ====================
document.getElementById('bg-switcher-btn')?.addEventListener('click', () => {
    const p = document.getElementById('bg-switcher-panel');
    p.style.display = (p.style.display === 'block') ? 'none' : 'block';
    document.getElementById('net-monitor-panel').style.display = 'none';
    document.getElementById('music-player-panel').style.display = 'none';
});

document.querySelectorAll('.bg-opt').forEach(b => {
    b.addEventListener('click', () => apply(b.dataset.mode));
});

// ==================== 启动 ====================
const saved = localStorage.getItem('frey-bg-mode') || 'night';
apply(saved);
