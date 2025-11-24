// js/modules/vanta-bg.js  
// 2025 双模式终极版 + 动态日夜图标 ☀🌙（已修复 const 报错）

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
    // ──────────────────────── 夜间模式 ────────────────────────
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

        // 动态切换为月亮图标
        const icon = document.getElementById('bg-icon');
        if (icon) icon.textContent = 'Moon';

        resize();
    },

    // ──────────────────────── 日间模式 ────────────────────────
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
            backgroundColor: 0xc0d6e4,
            color: 0xff8c6b,
            birdSize: 1.5,
            wingSpan: 30,
            speedLimit: 5,
            separation: 60,
            alignment: 30,
            cohesion: 20,
            quantity: 4
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

        // 动态切换为太阳图标
        const icon = document.getElementById('bg-icon');
        if (icon) icon.textContent = 'Sun';

        resize();
    }
};

const apply = (mode) => {
    document.body.className = '';
    document.body.classList.add(mode === 'day' ? 'theme-day' : 'theme-night');
    modes[mode]();

    // 高亮当前选中的选项
    document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`)?.classList.add('active');

    // 保存用户选择
    localStorage.setItem('frey-bg-mode', mode);
};

// ==================== 交互 ====================

// 点击按钮打开/关闭面板
document.getElementById('bg-switcher-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('bg-switcher-panel');
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';

    // 关闭其他面板
    document.getElementById('net-monitor-panel').style.display = 'none';
    document.getElementById('music-player-panel').style.display = 'none';
});

// 切换背景模式
document.querySelectorAll('.bg-opt').forEach(btn => {
    btn.addEventListener('click', () => {
        apply(btn.dataset.mode);
        // 切换完后自动收起面板（可选）
        document.getElementById('bg-switcher-panel').style.display = 'none';
    });
});

// ==================== 初始化 ====================
const savedMode = localStorage.getItem('frey-bg-mode') || 'night';
apply(savedMode);
