// guestbook-panel.js (用于在主页内以浮动面板形式显示留言板)

// 假设 API 路径是完整的服务器地址，用于跨域访问。
const BASE_URL = 'https://api.frey.asia';

document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM 元素
    const guestbookBtn = document.getElementById('guestbook-btn');
    const guestbookPanel = document.getElementById('guestbook-panel');
    const submitBtn = document.getElementById('panel-submit-message');
    const nameInput = document.getElementById('panel-guestbook-name');
    const contentInput = document.getElementById('panel-guestbook-content');
    const messagesList = document.getElementById('panel-messages-list');
    const messageLog = document.getElementById('panel-message-log');
    
    // 用于存储定时器ID
    let fetchIntervalId = null; 
    const REFRESH_INTERVAL_MS = 60000; // 1 分钟

    // 2. 面板切换逻辑
    if(guestbookBtn && guestbookPanel) {
        guestbookBtn.addEventListener('click', () => {
            // 确保点击时，其他面板关闭 (与 time/music 按钮行为一致)
            const otherPanels = document.querySelectorAll('#time-panel, #music-player-panel, #net-monitor-panel, #bg-switcher-panel');
            otherPanels.forEach(p => {
                if (p !== guestbookPanel) {
                    p.style.display = 'none';
                }
            });

            if (guestbookPanel.style.display === 'block') {
                guestbookPanel.style.display = 'none';
                // 关闭面板时清除定时器
                if (fetchIntervalId) {
                    clearInterval(fetchIntervalId);
                    fetchIntervalId = null;
                }
            } else {
                guestbookPanel.style.display = 'block';
                // 每次打开面板时刷新留言
                fetchMessages();
                // 打开面板时启动定时器，每 1 分钟刷新一次
                if (!fetchIntervalId) {
                    fetchIntervalId = setInterval(fetchMessages, REFRESH_INTERVAL_MS);
                }
            }
        });
    }

    // 3. 核心功能函数
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const renderMessages = (messages) => {
        messagesList.innerHTML = ''; 
        if (messages.length === 0) {
            messagesList.innerHTML = '<p class="small" style="text-align:center;">暂无留言，快来留下第一条吧！</p>';
            return;
        }

        // 只显示最新的 10 条留言，避免面板内容过多
        const displayMessages = messages.slice(0, 10); 

        displayMessages.forEach(msg => {
            const msgEl = document.createElement('div');
            msgEl.className = 'guestbook-item';
            msgEl.innerHTML = `
                <div style="font-weight: 600; color: var(--accent); font-size: 13px;">${msg.name || '匿名访客'}</div>
                <div style="font-size: 13px; color: var(--text); line-height: 1.4; padding: 4px 0; white-space: pre-wrap; word-break: break-word;">${msg.content}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${formatTime(msg.timestamp)}</div>
            `;
            messagesList.appendChild(msgEl);
        });
    };

    const fetchMessages = async () => {
        // 如果面板未显示，则不执行 fetch（避免在后台运行）
        if (guestbookPanel.style.display !== 'block') {
            return;
        }

        // 每次 fetch 尝试时都显示加载提示
        messagesList.innerHTML = '<p class="small" style="text-align:center;">正在加载留言...</p>';
        
        try {
            const response = await fetch(`${BASE_URL}/api/messages`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                renderMessages(data.data);
            } 
            // ❗ 关键改动：如果失败（非200状态码），我们不做任何操作，让加载提示保留。
            
        } catch (error) {
            console.error('Error fetching messages:', error);
            // ❗ 关键改动：网络错误时，我们不做任何操作，让加载提示保留。
        }
    };

    // 4. 提交留言逻辑
    if(submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim() || '匿名访客';
            const content = contentInput.value.trim();

            if (!content) {
                messageLog.style.color = 'red';
                messageLog.textContent = '留言内容不能为空！';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = '提交中...';
            messageLog.textContent = ''; // 清空之前的日志

            try {
                const response = await fetch(`${BASE_URL}/api/message`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, content })
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    messageLog.style.color = 'var(--accent)';
                    messageLog.textContent = '留言成功！';
                    contentInput.value = ''; // 清空内容
                    // 重新加载留言列表以显示新内容
                    await fetchMessages(); 
                } else {
                    // 提交失败时，仍然显示错误提示（提交失败是用户操作，需要明确反馈）
                    messageLog.style.color = 'red';
                    messageLog.textContent = `留言失败：${result.error || '未知错误'}`;
                }
            } catch (error) {
                console.error('Error submitting message:', error);
                // 提交失败时，仍然显示错误提示
                messageLog.style.color = 'red';
                messageLog.textContent = '网络或服务器错误，提交失败。';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '提交留言';
            }
        });
    }
});
