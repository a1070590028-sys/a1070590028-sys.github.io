// js/modules/ghost-text.js

const ZW = ['\u200b', '\u200c', '\u200d', '\uFEFF'];
const SEP = '\u200e'; 

async function encrypt(text, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const pwHash = await crypto.subtle.digest('SHA-256', encoder.encode(password));
    const key = await crypto.subtle.importKey('raw', pwHash, { name: 'AES-CBC' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    let bits = '';
    combined.forEach(byte => { bits += byte.toString(2).padStart(8, '0'); });
    let zwStr = '';
    for (let i = 0; i < bits.length; i += 2) {
        zwStr += ZW[parseInt(bits.substring(i, i + 2), 2)];
    }
    return zwStr;
}

async function decrypt(zwStr, password) {
    let bits = '';
    for (const char of zwStr) {
        const index = ZW.indexOf(char);
        if (index >= 0) bits += index.toString(2).padStart(2, '0');
    }
    const bytes = new Uint8Array(bits.length / 8);
    for (let i = 0; i < bits.length; i += 8) {
        bytes[i / 8] = parseInt(bits.substring(i, i + 8), 2);
    }
    const iv = bytes.slice(0, 16);
    const data = bytes.slice(16);
    const encoder = new TextEncoder();
    const pwHash = await crypto.subtle.digest('SHA-256', encoder.encode(password));
    const key = await crypto.subtle.importKey('raw', pwHash, { name: 'AES-CBC' }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, data);
    return new TextDecoder().decode(decrypted);
}

function initGhostText() {
    const log = document.getElementById('ghostLog');
    const updateLog = (msg, isError = false) => {
        log.innerText = msg;
        log.style.color = isError ? '#ef4444' : 'var(--accent)';
    };

    // Tab 切换逻辑
    document.querySelectorAll('[data-ghost-tab]').forEach(b => b.onclick = () => {
        document.querySelectorAll('[data-ghost-tab]').forEach(x => x.classList.remove('active'));
        document.getElementById('ghost-encode-panel').style.display = 'none';
        document.getElementById('ghost-decode-panel').style.display = 'none';
        b.classList.add('active');
        document.getElementById('ghost-' + b.dataset.ghostTab + '-panel').style.display = 'grid';
        updateLog(`已切换至${b.innerText}模式`);
    });

    // 生成
    document.getElementById('ghostGenBtn').onclick = async () => {
        const visible = document.getElementById('ghostVisibleText').value;
        const hidden = document.getElementById('ghostHiddenText').value;
        const key = document.getElementById('ghostEncKey').value;
        if (!hidden || !key) return updateLog('错误：秘密内容和密钥不能为空', true);

        updateLog('正在进行 AES 加密并注入幽灵字符...');
        try {
            const zw = await encrypt(hidden, key);
            const result = visible + SEP + zw;
            document.getElementById('ghostInputPaste').value = result; // 自动填充到解密框方便测试
            updateLog('生成成功！隐写字符已附着在可见文字后。');
            // 将结果暂存到一个自定义属性，方便复制和下载
            log.dataset.lastResult = result;
        } catch (e) { updateLog('生成失败：' + e.message, true); }
    };

    // 提取
    document.getElementById('ghostParseBtn').onclick = async () => {
        const input = document.getElementById('ghostInputPaste').value;
        const key = document.getElementById('ghostDecKey').value;
        const idx = input.indexOf(SEP);
        if (idx === -1) return updateLog('解析失败：未发现隐藏的幽灵文本', true);

        updateLog('密钥验证中...');
        try {
            const res = await decrypt(input.slice(idx + 1), key);
            updateLog('提取成功：' + res);
            log.style.color = '#10b981';
        } catch (e) { updateLog('解析失败：密钥错误或数据损坏', true); }
    };

    // 复制
    document.getElementById('ghostCopyBtn').onclick = () => {
        const content = log.dataset.lastResult;
        if (!content) return updateLog('请先生成幽灵文本', true);
        navigator.clipboard.writeText(content).then(() => {
            updateLog('已成功复制到剪贴板（含不可见字符）');
        });
    };

    // 下载 TXT
    document.getElementById('ghostDownloadBtn').onclick = () => {
        const content = log.dataset.lastResult;
        if (!content) return updateLog('请先生成幽灵文本', true);
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ghost_msg_${Date.now()}.txt`;
        a.click();
        updateLog('文件已准备好下载');
    };

    // 文件读取
    const fileInput = document.getElementById('ghostFileInput');
    const dropzone = document.getElementById('ghostReadDropzone');
    dropzone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('ghostInputPaste').value = ev.target.result;
            updateLog(`已加载文件: ${file.name}，点击“立即提取”进行解密`);
        };
        reader.readAsText(file);
    };
}

// 适配主程序加载
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGhostText);
} else {
    initGhostText();
}
