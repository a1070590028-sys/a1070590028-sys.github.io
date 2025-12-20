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
    const resultDisplay = document.getElementById('ghostResultText');

    // Tab 切换
    document.querySelectorAll('[data-ghost-tab]').forEach(b => b.onclick = () => {
        document.querySelectorAll('[data-ghost-tab]').forEach(x => x.classList.remove('active'));
        document.getElementById('ghost-encode-panel').style.display = 'none';
        document.getElementById('ghost-decode-panel').style.display = 'none';
        b.classList.add('active');
        document.getElementById('ghost-' + b.dataset.ghostTab + '-panel').style.display = 'grid';
        log.innerText = `模式：${b.innerText}`;
    });

    // 生成
    document.getElementById('ghostGenBtn').onclick = async () => {
        const visible = document.getElementById('ghostVisibleText').value;
        const hidden = document.getElementById('ghostHiddenText').value;
        const key = document.getElementById('ghostEncKey').value;
        
        if (!hidden) return log.innerText = '错误：请填写要隐藏的内容';
        if (!key) return log.innerText = '错误：请设置加密密码';

        try {
            const zw = await encrypt(hidden, key);
            const result = visible + SEP + zw;
            await navigator.clipboard.writeText(result);
            log.innerText = '生成成功！包含隐写信息的文本已复制。';
            log.dataset.lastResult = result;
        } catch (e) { log.innerText = '加密失败'; }
    };

    // 提取 (逻辑仿照兽语)
    document.getElementById('ghostParseBtn').onclick = async () => {
        const input = document.getElementById('ghostInputPaste').value;
        const key = document.getElementById('ghostDecKey').value;
        const idx = input.indexOf(SEP);

        resultDisplay.value = ''; // 清空上次结果
        if (!key) return log.innerText = '错误：请输入提取密码';
        if (idx === -1) return log.innerText = '解析失败：文本中不含隐写信息';

        try {
            const res = await decrypt(input.slice(idx + 1), key);
            resultDisplay.value = res; // 填入结果框
            log.innerText = '提取完成。';
        } catch (e) { 
            log.innerText = '提取失败：密码不正确'; 
        }
    };

    // 下载
    document.getElementById('ghostDownloadBtn').onclick = () => {
        const content = log.dataset.lastResult;
        if (!content) return log.innerText = '请先生成隐写文本';
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ghost_msg.txt';
        a.click();
    };

    // 文件上传
    const fileInput = document.getElementById('ghostFileInput');
    const dropzone = document.getElementById('ghostReadDropzone');
    if (dropzone) {
        dropzone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('ghostInputPaste').value = ev.target.result;
                log.innerText = `加载成功: ${file.name}`;
            };
            reader.readAsText(file);
        };
    }
}

initGhostText();
