// js/modules/card-toggle.js
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.post-card .card-title').forEach(title => {
        const icon = title.querySelector('.toggle-icon');
        const content = title.nextElementSibling;
        if (!content) return;

        // ====== 【关键修复】页面加载时根据图标初始化展开/收起状态 ======
        if (icon.textContent === '▸') {
            // 初始应收起
            content.classList.add('collapsed');
            content.style.maxHeight = '0';
            content.style.padding = '0';
        } else {
            // 初始应展开（比如图片压缩那张是 ▾）
            content.classList.remove('collapsed');
            content.style.maxHeight = content.scrollHeight + 50 + 'px'; // +50 容错
            content.style.padding = '12px 0 0 0';
        }

        // 点击切换（你原有逻辑，完美保留）
        title.addEventListener('click', () => {
            content.classList.toggle('collapsed');
            if (content.classList.contains('collapsed')) {
                icon.textContent = 'Right Arrow';
                content.style.maxHeight = '0';
                content.style.padding = '0';
            } else {
                icon.textContent = 'Down Arrow';
                const fullHeight = content.scrollHeight + 
                    parseInt(getComputedStyle(content).paddingTop) + 
                    parseInt(getComputedStyle(content).paddingBottom) + 20;
                content.style.maxHeight = fullHeight + 'px';
                content.style.padding = '12px 0 0 0';
            }
        });

        // 窗口缩放时重新计算高度（你原有逻辑，保留）
        window.addEventListener('resize', () => {
            if (!content.classList.contains('collapsed')) {
                const fullHeight = content.scrollHeight + 
                    parseInt(getComputedStyle(content).paddingTop) + 
                    parseInt(getComputedStyle(content).paddingBottom) + 20;
                content.style.maxHeight = fullHeight + 'px';
            }
        });
    });
});
