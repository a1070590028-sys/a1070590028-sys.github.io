// js/modules/encryption.js

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

        selector.onchange = (e) => updateCarrierImageSelection(e.target.value);

    } catch (e) {
        selector.innerHTML = '<option disabled>加载失败</option>';
        log('encLog', `列表加载错误: ${e.message}`, true);
    }
}

function initLocalCarrierImageSupport() {
    const dropzone = document.getElementById('localCarrierDropzone');
    const selector = document.getElementById('carrierImage');
    if (!dropzone || !selector) return;

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

        updateCarrierImageSelection(opt.value);
        log('encLog', `已加载载体: ${file.name}`);
    });
}

function updateCarrierImageSelection(val) {
    const preview = document.getElementById('carrierPreview');
    const name = document.getElementById('carrierName');
    const img = document.getElementById('carrierImagePreview');

    if (!val) {
        preview.style.display = 'none';
        return;
    }

    if (val.startsWith(LOCAL_CARRIER_PREFIX) && localCarrierFile) {
        name.textContent = localCarrierFile.name;
        img.src = URL.createObjectURL(localCarrierFile);
        preview.style.display = 'block';
    } else {
        name.textContent = val;
        img.src = `picture/${val}`;
        preview.style.display = 'block';
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
            document.getElementById('decFileDetail').style.display = 'block';
            document.getElementById('decFileName').textContent = file.name;
            document.getElementById('decFileSize').textContent = `${sizeMB} MB`;
            document.getElementById('decLevelDisplay').textContent = '待解析...';
        } else {
            fileToEncrypt = file;
        }

        dropzone.querySelector('.dropzone-title').textContent = `已选: ${file.name}`;
        log(logId, `已加载: ${file.name} (${sizeMB} MB)`);
    };

    dropzone.onclick = () => input.click();
    input.onchange = () => handler(input.files);

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

// ====== 5. 核心业务逻辑 (Web Crypto) ======

async function startEncryption() {
    const logId = 'encLog';
    const carrierVal = document.getElementById('carrierImage').value;
    const level = document.getElementById('encLevel').value;

    document.getElementById('encSaltDisplay').value = '';
    document.getElementById('encFilenameDisplay').value = '';

    if (!fileToEncrypt) return log(logId, '请先选择文件', true);
    if (!carrierVal) return log(logId, '请选择载体', true);

    // ------------------ 新逻辑：读取 UI 输入框 ------------------
    let outName = document.getElementById('encOutputName').value.trim();
    if (!outName) outName = fileToEncrypt.name.split('.')[0];
    const finalOutputName = outName + ".png";

    // Level2 加密密码
    const pwd = document.getElementById('encPasswordInput').value.trim();
    if (level === "level2" && !pwd) {
        log(logId, "请输入加密密码", true);
        document.getElementById('encPasswordInput').focus();
        return;
    }
    // ------------------------------------------------------------

    try {
        log(logId, '正在初始化加密环境...');

        let carrierBlob;
        if (carrierVal.startsWith(LOCAL_CARRIER_PREFIX)) {
            carrierBlob = localCarrierFile;
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

                if (offset >= totalSize) {
                    log(logId, `加密完成 100%`);
                }
            }
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

        document.getElementById('encSaltDisplay').value = saltBase64 || "一级加密无盐";
        document.getElementById('encFilenameDisplay').value = finalOutputName;

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

        detail.textContent = `Level ${meta.level} (${meta.name})`;
        log(logId, `检测到加密数据: ${(meta.hiddenSize / 1024 / 1024).toFixed(2)} MB`);

        let resultSegments = [];

        if (meta.level === 2) {
            const pwd = document.getElementById('decPasswordInput').value.trim();
            if (!pwd) {
                log(logId, '请输入解密密码', true);
                document.getElementById('decPasswordInput').focus();
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

    document.getElementById('startEncrypt').onclick = startEncryption;
    document.getElementById('startDecrypt').onclick = startDecryption;
});
