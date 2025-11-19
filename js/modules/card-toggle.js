// js/modules/card-toggle.js
document.querySelectorAll('.post-card .card-title').forEach(title => {
    const icon = title.querySelector('.toggle-icon');
    const content = title.nextElementSibling;
    if (!content) return;

    // 关键：先强制渲染一次，拿到真实 scrollHeight
    content.style.display = 'block';
    content.style.visibility = 'hidden';
    const fullHeight = content.scrollHeight + 40;
    content.style.display = '';
    content.style.visibility = '';

    // 初始展开状态（和你的其他卡片一致）
    content.style.maxHeight = fullHeight + 'px';

    // 统一的高度更新函数
    const updateHeight = () => {
        if (content.classList.contains('collapsed')) return;
        content.style.maxHeight = 'none'; // 让浏览器能正确计算
        const padding = parseInt(getComputedStyle(content).paddingTop) +
                        parseInt(getComputedStyle(content).paddingBottom);
        content.style.maxHeight = (content.scrollHeight + padding + 20) + 'px';
    };

    title.addEventListener('click', () => {
        content.classList.toggle('collapsed');

        if (content.classList.contains('collapsed')) {
            icon.textContent = '▸';   // 收起
            content.style.maxHeight = '0';
            content.style.padding = '0';
        } else {
            icon.textContent = '▾';    // 展开
            updateHeight();
            content.style.padding = '12px 0 0 0';
        }
    });

    // 窗口大小变化时更新
    window.addEventListener('resize', updateHeight);

    // PDF 工具 tab 切换时自动更新高度
    const tabButtons = document.querySelectorAll('.pdf-tools-tabs button');
    if (tabButtons.length > 0) {
        tabButtons.forEach(btn => btn.addEventListener('click', () => setTimeout(updateHeight, 50)));
    }

    // 保险：监听内容变化（比如动态添加缩略图）
    new MutationObserver(() => {
        if (!content.classList.contains('collapsed')) setTimeout(updateHeight, 100);
    }).observe(content, { childList: true, subtree: true });
});
