// guestbook-panel.js (优化版，增加稳定性和重试机制)

const BASE_URL = 'https://api.frey.asia'; // 始终使用 HTTPS

document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM 元素
    const guestbookBtn = document.getElementById('guestbook-btn');
    const guestbookPanel = document.getElementById('guestbook-panel');
    const submitBtn = document.getElementById('panel-submit-message');
    const nameInput = document.getElementById('panel-guestbook-name');
    const contentInput = document.getElementById('panel-guestbook-content');
    const messagesList = document.getElementById('panel-messages-list');
    const messageLog = document.getElementById('panel-message-log');

    let fetchIntervalId = null;
    const REFRESH_INTERVAL_MS = 60000; // 1 分钟
    const RETRY_DELAY_MS = 2000; // 重试间隔 2 秒
    const MAX_RETRY = 10; // 最大重试次数

    // 2. 面板切换逻辑
    if (guestbookBtn && guestbookPanel) {
        guestbookBtn.addEventListener('click', () => {
            const otherPanels = document.querySelectorAll('#time-panel, #music-player-panel, #net-monitor-panel, #bg-switcher-panel');
            otherPanels.forEach(p => { if (p !== guestbookPanel) p.style.display = 'none'; });

            if (guestbookPanel.style.display === 'block') {
                guestbookPanel.style.display = 'none';
                if (fetchIntervalId) { clearInterval(fetchIntervalId); fetchIntervalId = null; }
            } else {
                guestbookPanel.style.display = 'block';
                fetchMessages();
                if (!fetchIntervalId) { fetchIntervalId = setInterval(fetchMessages, REFRESH_INTERVAL_MS); }
            }
        });
    }

    // 3. 核心功能函数
    const formatTime = isoString => {
        const date = new Date(isoString);
        return date.toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    };

    const renderMessages = messages => {
        messagesList.innerHTML = '';
        if (!messages || messages.length === 0) {
            messagesList.innerHTML = '<p class="small" style="text-align:center;">暂无留言，快来留下第一条吧！</p>';
            return;
        }

        const displayMessages = messages.slice(0, 10); 
        displayMessages.forEach(msg => {
            const msgEl = document.createElement('div');
            msgEl.className = 'guestbook-item';
            msgEl.innerHTML = `
                <div style="font-weight:600;color:var(--accent);font-size:13px;">${msg.name || '匿名访客'}</div>
                <div style="font-size:13px;color:var(--text);line-height:1.4;padding:4px 0;white-space:pre-wrap;word-break:break-word;">${msg.content}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${formatTime(msg.timestamp)}</div>
            `;
            messagesList.appendChild(msgEl);
        });
    };

    const fetchMessages = async (retry = MAX_RETRY) => {
        if (guestbookPanel.style.display !== 'block') return;
        messagesList.innerHTML = '<p class="small" style="text-align:center;">正在加载留言...</p>';

        try {
            const response = await fetch(`${BASE_URL}/api/messages`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.success) renderMessages(data.data);
            else throw new Error(data.error || '未知错误');
        } catch (error) {
            console.error('Error fetching messages:', error);
            if (retry > 0) setTimeout(() => fetchMessages(retry - 1), RETRY_DELAY_MS);
            else messagesList.innerHTML = '<p class="small" style="text-align:center;color:red;">加载留言失败，请检查网络或刷新页面</p>';
        }
    };

    // 4. 提交留言逻辑
    if (submitBtn) {
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
            messageLog.textContent = '';

            const submit = async (retry = MAX_RETRY) => {
                try {
                    const response = await fetch(`${BASE_URL}/api/message`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, content })
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const result = await response.json();
                    if (result.success) {
                        messageLog.style.color = 'var(--accent)';
                        messageLog.textContent = '留言成功！';
                        contentInput.value = '';
                        await fetchMessages();
                    } else throw new Error(result.error || '提交失败');
                } catch (error) {
                    console.error('Error submitting message:', error);
                    if (retry > 0) {
                        messageLog.style.color = 'orange';
                        messageLog.textContent = `提交失败，重试中... (${retry})`;
                        setTimeout(() => submit(retry - 1), RETRY_DELAY_MS);
                    } else {
                        messageLog.style.color = 'red';
                        messageLog.textContent = '网络或服务器错误，提交失败';
                    }
                } finally {
                    if (retry === MAX_RETRY) { submitBtn.disabled = false; submitBtn.textContent = '提交留言'; }
                }
            };

            submit();
        });
    }
});
