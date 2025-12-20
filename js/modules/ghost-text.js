// js/modules/ghost-text.js

// 零宽字符表：用于将二进制数据映射到不可见字符
const ZW = ['\u200b', '\u200c', '\u200d', '\uFEFF'];
const SEP = '\u200e'; // 分隔符

/**
 * 核心逻辑：将字符串转为 AES 加密后的零宽字符流
 */
async function encryptText(text, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // 生成 Key
    const pwHash = await crypto.subtle.digest('SHA-256', encoder.encode(password));
    const key = await crypto.subtle.importKey(
        'raw', pwHash, { name: 'AES-CBC' }, false, ['encrypt']
    );

    // IV 向量
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv }, key, data
    );

    // 合并 IV + Ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // 转为二进制字符串再转为零宽字符
    let bits = '';
    combined.forEach(byte => {
        bits += byte.toString(2).padStart(8, '0');
    });

    let zwStr = '';
    for (let i = 0; i < bits.length; i += 2) {
        const index = parseInt(bits.substring(i, i + 2), 2);
        zwStr += ZW[index];
    }
    return zwStr;
}

/**
 * 核心逻辑：从零宽字符流中解密
 */
async function decryptText(zwStr, password) {
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
    const key = await crypto.subtle.importKey(
        'raw', pwHash, { name: 'AES-CBC' }, false, ['decrypt']
    );

    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-CBC', iv }, key, data
        );
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        throw new Error('密钥错误或数据损坏');
    }
}

// 初始化 UI 交互
export function initGhostText() {
    // 元素获取
    const encodeBtn = document.getElementById('ghostGenBtn');
    const decodeBtn = document.getElementById('ghostParseBtn');
    const copyBtn = document.getElementById('ghostCopyBtn');
    const downloadBtn = document.getElementById('ghostDownloadBtn');
    const fileInput = document.getElementById('ghostFileInput');
    const dropzone = document.getElementById('ghostReadDropzone');

    // 1. 生成功能
    if (encodeBtn) {
        encodeBtn.onclick = async () => {
            const visible = document.getElementById('ghostVisibleText').value;
            const hidden = document.getElementById('ghostHiddenText').value;
            const key = document.getElementById('ghostEncKey').value;
            const log = document.getElementById('ghostOutputLog');

            if (!hidden || !key) return alert('请输入秘密内容和密钥');

            try {
                const zw = await encryptText(hidden, key);
                log.innerText = visible + SEP + zw;
                log.style.color = 'var(--accent)';
            } catch (err) {
                log.innerText = '生成失败: ' + err.message;
            }
        };
    }

    // 2. 提取功能
    if (decodeBtn) {
        decodeBtn.onclick = async () => {
            const input = document.getElementById('ghostInputPaste').value;
            const key = document.getElementById('ghostDecKey').value;
            const log = document.getElementById('ghostResultLog');

            if (!input || !key) return alert('请输入文本和密钥');

            const idx = input.indexOf(SEP);
            if (idx === -1) {
                log.innerText = '错误：未发现隐藏的幽灵信息';
                return;
            }

            try {
                const secret = await decryptText(input.slice(idx + 1), key);
                log.innerText = '提取成功：' + secret;
                log.style.color = '#10b981'; // 成功绿
            } catch (err) {
                log.innerText = '提取失败：密钥不正确';
                log.style.color = '#ef4444'; // 错误红
            }
        };
    }

    // 3. 复制功能
    if (copyBtn) {
        copyBtn.onclick = () => {
            const content = document.getElementById('ghostOutputLog').innerText;
            if (content.includes('等待')) return;
            navigator.clipboard.writeText(content).then(() => {
                const originalText = copyBtn.innerText;
                copyBtn.innerText = '已复制！';
                setTimeout(() => copyBtn.innerText = originalText, 2000);
            });
        };
    }

    // 4. 下载 TXT
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            const content = document.getElementById('ghostOutputLog').innerText;
            if (content.includes('等待')) return;
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ghost_msg_${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        };
    }

    // 5. 文件拖拽读取
    if (dropzone && fileInput) {
        dropzone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('ghostInputPaste').value = ev.target.result;
                dropzone.querySelector('.dropzone-title').innerText = `已加载: ${file.name}`;
            };
            reader.readAsText(file);
        };
    }
}

// 自动执行初始化
initGhostText();
