// js/main.js
import './modules/guestbook-panel.js';
import './modules/time.js';
import './modules/vanta-bg.js';
import './modules/card-toggle.js';
import './modules/image-compress.js';
import './modules/net-monitor.js';
import './modules/pdf-convert.js';
import './modules/music-player.js';
import './modules/dog-speak.js';
import './modules/encryption.js';

// ==== 左侧导航栏：点击后显示对应卡片 ====
const sidebarButtons = document.querySelectorAll('.sidebar-item');
const cards = document.querySelectorAll('.post-card');

// 默认只显示第一个卡片
cards.forEach(c => c.style.display = 'none');
document.getElementById('card-compress').style.display = 'block';
sidebarButtons[0].classList.add('active');

sidebarButtons.forEach(btn => {
    btn.addEventListener('click', () => {

        // 去掉所有 active
        sidebarButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 隐藏所有卡片
        cards.forEach(c => c.style.display = 'none');

        // 显示对应卡片
        const target = btn.dataset.target;
        document.getElementById(target).style.display = 'block';

        // 自动滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});


