// js/modules/encryption.js (patched)

// ====== 1. 常量与配置 ======
const MAGIC_MARKER = 'FSDATA::';
const MAX_METADATA_SEARCH_SIZE = 50 * 1024; 
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB 分块

// 状态变量
let fileToEncrypt = null;
let fileToDecrypt = null;
let localCarrierFile = null; 
const LOCAL_CARRIER_PREFIX = 'LOCAL::';

// ====== 2. 辅助工具函数 ======
function log(elementId, message, isError = false) {
    const logElement = document.getElementById(elementId);
    if (logElement) {
        const color = isError ? 'var(--danger)' : 'var(--text-muted)';
        const prefix = isError ? '❌ ' : '';
        logElement.innerHTML = `<span style="color:${color};">${prefix}${message}</span>`;
    } else {
        // 退化：如果日志元素不存在，输出到控制台，方便调试
        if (isError) console.error(`[${elementId}] ${message}`); else console.log(`[${elementId}] ${message}`);
    }
}

function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1000);
}

function intToBytes(num) {
    const arr = new Uint8Array(4);
    new DataView(arr.buffer).setUint32(0, num, false);
    return arr;
}
function bytesToInt(arr) {
    return new DataView(arr.buffer).getUint32(0, false);
}

// ====== 3. Web Crypto API 核心 ======
async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

// ====== 4. 初始化与 UI 逻辑 ======
async function initCarrierImageSelector() {
    const selector = document.getElementById('carrierImage');
    if (!selector) return;

    selector.innerHTML = '<option value="" disabled selected>正在加载列表...</option>';

    try {
        const response = await fetch('picture/picture-list.json');
        if (!response.ok) throw new Error("无法加载图片列表");
        const list = await response.json();

        selector.innerHTML = '<option value="" disabled selected>请选择一张图片作为载体...</option>';

        list.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            selector.appendChild(opt);
        });

        selector.onchange = (e) => {
            try { updateCarrierImageSelection(e.target.value); } catch (err) { console.error(err); }
        };

    } catch (e) {
        selector.innerHTML = '<option disabled>加载失败</option>';
        log('encLog', `列表加载错误: ${e.message}`, true);
    }
}

function initLocalCarrierImageSupport() {
    const dropzone = document.getElementById('localCarrierDropzone');
    const selector = document.getElementById('carrierImage');
    const input = document.getElementById('localCarrierInput');
    if (!dropzone || !selector || !input) return;

    dropzone.onclick = () => input.click();

    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            e.target.value = '';
            return log('encLog', '请选择图片文件', true);
        }
        
        localCarrierFile = file;

        const old = selector.querySelector(`option[value^="${LOCAL_CARRIER_PREFIX}"]`);
        if (old) old.remove();

        const opt = document.createElement("option");
        opt.value = LOCAL_CARRIER_PREFIX + file.name;
        opt.textContent = `(本地) ${file.name}`;
        selector.appendChild(opt);
        selector.value = opt.value;

        // update safely
        try { updateCarrierImageSelection(opt.value); } catch (err) { console.warn(err); }
        log('encLog', `已加载载体: ${file.name}`);
        e.target.value = '';
    };

    ['dragover', 'dragleave'].forEach(evt => dropzone.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        dropzone.style.borderColor = evt === 'dragover' ? 'var(--accent)' : 'rgba(96,165,250,0.5)';
    }));

    dropzone.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        dropzone.style.borderColor = 'rgba(96,165,250,0.5)';
        if (!e.dataTransfer.files.length) return;

        const file = e.dataTransfer.files[0];
        if (!file.type.startsWith('image/')) return log('encLog', '请拖入图片', true);

        localCarrierFile = file;

        const old = selector.querySelector(`option[value^="${LOCAL_CARRIER_PREFIX}"]`);
        if (old) old.remove();

        const opt = document.createElement('option');
        opt.value = LOCAL_CARRIER_PREFIX + file.name;
        opt.textContent = `(本地) ${file.name}`;
        selector.appendChild(opt);
        selector.value = opt.value;

        try { updateCarrierImageSelection(opt.value); } catch (err) { console.warn(err); }
        log('encLog', `已加载载体: ${file.name}`);
    });
}

function updateCarrierImageSelection(val) {
    // --- 安全检查：预览元素可能不存在，先取并判断 ---
    const preview = document.getElementById('carrierPreview');
    const nameEl = document.getElementById('carrierName');
    const img = document.getElementById('carrierImagePreview');

    if (!val) {
        if (preview) preview.style.display = 'none';
        return;
    }

    if (val.startsWith(LOCAL_CARRIER_PREFIX) && localCarrierFile) {
        if (nameEl) nameEl.textContent = localCarrierFile.name;
        if (img) img.src = URL.createObjectURL(localCarrierFile);
        if (preview) preview.style.display = 'block';
    } else {
        if (nameEl) nameEl.textContent = val;
        if (img) img.src = `picture/${val}`;
        if (preview) preview.style.display = 'block';
        localCarrierFile = null;
    }
}

function initFileSelection(inputId, dropzoneId, logId, isDecrypt) {
    const input = document.getElementById(inputId);
    const dropzone = document.getElementById(dropzoneId);
    if(!input) return;

    const handler = (files) => {
        const file = files[0];
        if (!file) return;

        const sizeMB = (file.size / 1024 / 1024).toFixed(2);

        if (isDecrypt) {
            fileToDecrypt = file;
            const detailEl = document.getElementById('decFileDetail');
            if (detailEl) detailEl.style.display = 'block';
            const nameEl = document.getElementById('decFileName');
            if (nameEl) nameEl.textContent = file.name;
            const sizeEl = document.getElementById('decFileSize');
            if (sizeEl) sizeEl.textContent = `${sizeMB} MB`;
            const levelEl = document.getElementById('decLevelDisplay');
            if (levelEl) levelEl.textContent = '待解析...';
        } else {
            fileToEncrypt = file;
        }

        if (dropzone && dropzone.querySelector) dropzone.querySelector('.dropzone-title').textContent = `已选: ${file.name}`;
        log(logId, `已加载: ${file.name} (${sizeMB} MB)`);
    };

    dropzone && (dropzone.onclick = () => input.click());
    input.onchange = () => handler(input.files);

    if (dropzone) {
        dropzone.addEventListener('dragover', e => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--accent)';
        });
        dropzone.addEventListener('dragleave', e => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border)';
        });
        dropzone.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border)';
            handler(e.dataTransfer.files);
        });
    }
}

// ====== 5. 核心业务逻辑 (Web Crypto) ======
async function startEncryption() {
    const logId = 'encLog';

    // 清理/初始化显示（仅对存在的元素操作）
    const saltEl = document.getElementById('encSaltDisplay');
    if (saltEl) saltEl.value = '';

    // 注意：原代码尝试清空 encFilenameDisplay —— 这个元素在 HTML 中不存在，改用 encFilename（输入框）
    // 读取 carrier 选择（安全读取）
    const carrierSelect = document.getElementById('carrierImage');
    const carrierVal = carrierSelect ? carrierSelect.value : '';
    const levelEl = document.getElementById('encLevel');
    const level = levelEl ? levelEl.value : 'level2';

    // 检查文件和载体（早期检查）
    // 但先安全读取输出文件名输入框
    const outNameInput = document.getElementById('encFilename'); // 使用 HTML 中实际存在的 id
    let outName = '';
    if (outNameInput) outName = outNameInput.value.trim();

    if (!fileToEncrypt) {
        log(logId, '请先选择文件', true);
        return;
    }
    if (!carrierVal) {
        log(logId, '请选择载体', true);
        return;
    }

    if (!outName) outName = fileToEncrypt.name.split('.')[0];
    const finalOutputName = outName + ".png";

    const pwdInput = document.getElementById('encPasswordInput');
    const pwd = pwdInput ? pwdInput.value.trim() : '';

    if (level === "level2" && !pwd) {
        log(logId, "请输入加密密码", true);
        if (pwdInput) pwdInput.focus();
        return;
    }

    try {
        log(logId, '正在初始化加密环境...');

        let carrierBlob;
        if (carrierVal.startsWith(LOCAL_CARRIER_PREFIX)) {
            carrierBlob = localCarrierFile;
            if (!carrierBlob) throw new Error('本地载体未找到');
        } else {
            const res = await fetch(`picture/${carrierVal}`);
            if (!res.ok) throw new Error('无法下载载体图');
            carrierBlob = await res.blob();
        }

        const segments = [carrierBlob];
        let hiddenTotalSize = 0;
        let saltBase64 = null;

        if (level === 'level2') {
            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            saltBase64 = btoa(String.fromCharCode(...salt));

            const key = await deriveKey(pwd, salt);

            segments.push(salt);
            hiddenTotalSize += 16;

            const totalSize = fileToEncrypt.size;
            let offset = 0;

            log(logId, '开始加密 (AES-GCM)...');

            while (offset < totalSize) {
                const chunkBlob = fileToEncrypt.slice(offset, offset + CHUNK_SIZE);
                const chunkBuffer = await chunkBlob.arrayBuffer();

                const iv = window.crypto.getRandomValues(new Uint8Array(12));

                const encryptedBuffer = await window.crypto.subtle.encrypt(
                    { name: "AES-GCM", iv: iv },
                    key,
                    chunkBuffer
                );

                const lenBytes = intToBytes(encryptedBuffer.byteLength);

                segments.push(lenBytes);
                segments.push(iv);
                segments.push(encryptedBuffer);

                hiddenTotalSize += (4 + 12 + encryptedBuffer.byteLength);

                offset += CHUNK_SIZE;

                // 进度提示（粗略）
                const pct = Math.min(100, Math.round((offset / totalSize) * 100));
                log(logId, `加密进度：${pct}%`);
            }

            log(logId, `加密完成 100%`);
        } else {
            segments.push(fileToEncrypt);
            hiddenTotalSize = fileToEncrypt.size;
        }

        const meta = {
            magic: MAGIC_MARKER.slice(0, -2),
            level: level === 'level2' ? 2 : 1,
            name: fileToEncrypt.name,
            hiddenSize: hiddenTotalSize,
            salt: saltBase64
        };

        const metaStr = JSON.stringify(meta) + MAGIC_MARKER;
        segments.push(new TextEncoder().encode(metaStr));

        log(logId, '正在生成最终文件...');
        const finalBlob = new Blob(segments, { type: 'image/png' });

        downloadFile(finalBlob, finalOutputName);
        log(logId, `✅ 成功生成: ${finalOutputName}`);

        if (saltEl) saltEl.value = saltBase64 || "一级加密无盐";

        // 如果你想在页面上显示输出文件名，请确保页面存在 id="encFilenameDisplay" 的元素，
        // 或者我们可以把输出名写回 encFilename（输入框）:
        if (outNameInput) outNameInput.value = outName; // 保持输入框同步

    } catch (e) {
        console.error(e);
        log(logId, `失败: ${e.message}`, true);
    }
}

async function startDecryption() {
    const logId = 'decLog';
    const detail = document.getElementById('decLevelDisplay');

    if (!fileToDecrypt) return log(logId, '请先选择文件', true);

    log(logId, '分析文件结构...');
    try {
        const size = fileToDecrypt.size;

        const tailSize = Math.min(size, MAX_METADATA_SEARCH_SIZE);
        const tailBlob = fileToDecrypt.slice(size - tailSize, size);
        const tailBuf = await tailBlob.arrayBuffer();
        const tailBytes = new Uint8Array(tailBuf);
        const markerBytes = new TextEncoder().encode(MAGIC_MARKER);

        let markerPos = -1;
        for (let i = tailBytes.length - markerBytes.length; i >= 0; i--) {
            let match = true;
            for (let j = 0; j < markerBytes.length; j++) {
                if (tailBytes[i + j] !== markerBytes[j]) { match = false; break; }
            }
            if (match) { markerPos = i; break; }
        }

        if (markerPos === -1) throw new Error("未找到标记: 这不是本站加密的文件");

        const decoder = new TextDecoder();
        const metaAreaStr = decoder.decode(tailBytes.subarray(0, markerPos));
        const jsonStart = metaAreaStr.lastIndexOf('{');
        if (jsonStart === -1) throw new Error("元数据头丢失");

        const jsonStr = metaAreaStr.substring(jsonStart);

        let meta;
        try { meta = JSON.parse(jsonStr); }
        catch { throw new Error("元数据已损坏"); }

        const metaLen = new TextEncoder().encode(jsonStr).byteLength;
        const absMarker = size - tailSize + markerPos;
        const absMetaStart = absMarker - metaLen;
        const absHiddenEnd = absMetaStart;
        const absHiddenStart = absHiddenEnd - meta.hiddenSize;

        if (absHiddenStart < 0) throw new Error("文件结构损坏");

        detail && (detail.textContent = `Level ${meta.level} (${meta.name})`);
        log(logId, `检测到加密数据: ${(meta.hiddenSize / 1024 / 1024).toFixed(2)} MB`);

        let resultSegments = [];

        if (meta.level === 2) {
            const pwd = (document.getElementById('decPasswordInput') || {}).value || '';
            if (!pwd) {
                log(logId, '请输入解密密码', true);
                document.getElementById('decPasswordInput') && document.getElementById('decPasswordInput').focus();
                return;
            }

            const saltBlob = fileToDecrypt.slice(absHiddenStart, absHiddenStart + 16);
            const salt = new Uint8Array(await saltBlob.arrayBuffer());

            const key = await deriveKey(pwd, salt);

            let offset = absHiddenStart + 16;
            const dataEnd = absHiddenEnd;

            log(logId, '开始解密...');

            while (offset < dataEnd) {
                const lenBlob = fileToDecrypt.slice(offset, offset + 4);
                const lenVal = bytesToInt(new Uint8Array(await lenBlob.arrayBuffer()));
                offset += 4;

                const ivBlob = fileToDecrypt.slice(offset, offset + 12);
                const iv = new Uint8Array(await ivBlob.arrayBuffer());
                offset += 12;

                const cipherBlob = fileToDecrypt.slice(offset, offset + lenVal);
                const cipherBuf = await cipherBlob.arrayBuffer();
                offset += lenVal;

                try {
                    const decryptedBuf = await window.crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: iv },
                        key,
                        cipherBuf
                    );
                    resultSegments.push(decryptedBuf);
                } catch {
                    return log(logId, '密码错误或数据损坏', true);
                }
            }
        } else {
            resultSegments.push(fileToDecrypt.slice(absHiddenStart, absHiddenEnd));
        }

        log(logId, '正在组装文件...');
        const finalBlob = new Blob(resultSegments);
        downloadFile(finalBlob, meta.name);
        log(logId, `✅ 成功恢复: ${meta.name}`);

    } catch (e) {
        log(logId, `错误: ${e.message}`, true);
        console.error(e);
    }
}

// ====== 6. 启动 ======
document.addEventListener('DOMContentLoaded', () => {
    initCarrierImageSelector();
    initLocalCarrierImageSupport();
    initFileSelection('encInput', 'dropzoneEnc', 'encLog', false);
    initFileSelection('decInput', 'dropzoneDec', 'decLog', true);

    const startEncryptBtn = document.getElementById('startEncrypt');
    const startDecryptBtn = document.getElementById('startDecrypt');
    if (startEncryptBtn) startEncryptBtn.onclick = startEncryption;
    if (startDecryptBtn) startDecryptBtn.onclick = startDecryption;
});
