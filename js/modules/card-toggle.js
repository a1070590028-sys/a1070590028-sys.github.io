document.querySelectorAll('.post-card .card-title').forEach(title => {
    const icon = title.querySelector('.toggle-icon');
    const content = title.nextElementSibling;
    if (!content) return;

    content.style.maxHeight = content.scrollHeight + 'px';

    title.addEventListener('click', () => {
        content.classList.toggle('collapsed');
        if (content.classList.contains('collapsed')) {
            icon.textContent = '▸';
            content.style.maxHeight = '0';
            content.style.padding = '0';
        } else {
            icon.textContent = '▾';
            const computedStyle = getComputedStyle(content);
            const paddingTop = parseInt(computedStyle.paddingTop);
            const paddingBottom = parseInt(computedStyle.paddingBottom);
            content.style.maxHeight = (content.scrollHeight + paddingTop + paddingBottom + 20) + 'px';
            content.style.padding = '12px 0 0 0';
        }
    });

    window.addEventListener('resize', () => {
        if (!content.classList.contains('collapsed')) {
            const computedStyle = getComputedStyle(content);
            const paddingTop = parseInt(computedStyle.paddingTop);
            const paddingBottom = parseInt(computedStyle.paddingBottom);
            content.style.maxHeight = (content.scrollHeight + paddingTop + paddingBottom + 20) + 'px';
        }
    });
});
