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

    // Tab 切换
    document.querySelectorAll('[data-ghost-tab]').forEach(b => b.onclick = () => {
        document.querySelectorAll('[data-ghost-tab]').forEach(x => x.classList.remove('active'));
        document.getElementById('ghost-encode-panel').style.display = 'none';
        document.getElementById('ghost-decode-panel').style.display = 'none';
        b.classList.add('active');
        const target = document.getElementById('ghost-' + b.dataset.ghostTab + '-panel');
        target.style.display = b.dataset.ghostTab === 'encode' ? 'grid' : 'grid';
        log.innerText = `已切换到 ${b.innerText} 模式`;
    });

    // 生成并自动复制
    document.getElementById('ghostGenBtn').onclick = async () => {
        const visible = document.getElementById('ghostVisibleText').value;
        const hidden = document.getElementById('ghostHiddenText').value;
        const key = document.getElementById('ghostEncKey').value;
        if (!hidden || !key) {
            log.innerText = '错误：请填写秘密内容和密钥';
            return;
        }

        try {
            const zw = await encrypt(hidden, key);
            const result = visible + SEP + zw;
            await navigator.clipboard.writeText(result);
            log.innerText = '生成成功！内容已自动复制到剪贴板。';
            log.dataset.lastResult = result;
        } catch (e) { log.innerText = '加密失败'; }
    };

    // 提取
    document.getElementById('ghostParseBtn').onclick = async () => {
        const input = document.getElementById('ghostInputPaste').value;
        const key = document.getElementById('ghostDecKey').value;
        const idx = input.indexOf(SEP);
        if (idx === -1) {
            log.innerText = '解析失败：未发现隐藏信息';
            return;
        }
        try {
            const res = await decrypt(input.slice(idx + 1), key);
            log.innerText = '提取结果：' + res;
        } catch (e) { log.innerText = '提取失败：密钥错误'; }
    };

    // 下载
    document.getElementById('ghostDownloadBtn').onclick = () => {
        const content = log.dataset.lastResult;
        if (!content) { log.innerText = '请先生成内容'; return; }
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ghost_text.txt';
        a.click();
    };
}

// 初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGhostText);
} else {
    initGhostText();
}
