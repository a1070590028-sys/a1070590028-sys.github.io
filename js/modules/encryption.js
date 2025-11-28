// js/modules/encryption.js

// ====== 1. 常量与辅助函数 ======

const MAGIC_MARKER = 'FSDATA::'; 
const MAX_METADATA_SEARCH_SIZE = 50 * 1024; // 50KB
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB 分块

let fileToEncrypt = null;
let fileToDecrypt = null;
let localCarrierFile = null; 
const LOCAL_CARRIER_PREFIX = 'LOCAL::'; 

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
    }, 100);
}

function wordArrayToUint8Array(wordArray) {
    const len = wordArray.sigBytes;
    const words = wordArray.words;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return u8;
}

function intToBytes(num) {
    const arr = new Uint8Array(4);
    arr[0] = (num >>> 24) & 0xff;
    arr[1] = (num >>> 16) & 0xff;
    arr[2] = (num >>> 8) & 0xff;
    arr[3] = num & 0xff;
    return arr;
}

function bytesToInt(arr) {
    let num = 0;
    num = (arr[0] << 24) | (arr[1] << 16) | (arr[2] << 8) | arr[3];
    return num >>> 0; 
}

// ====== 2. 初始化逻辑 (UI 相关) ======

async function initCarrierImageSelector() {
    const selector = document.getElementById('carrierImage');
    if (!selector) return;

    selector.innerHTML = '<option value="" disabled selected>正在加载图片列表...</option>';
    try {
        const response = await fetch('picture/picture-list.json');
        if (!response.ok) throw new Error(`状态码 ${response.status}`);
        const rawContent = await response.text();
        
        let imageList;
        try {
            imageList = JSON.parse(rawContent);
            if (!Array.isArray(imageList)) throw new Error("非数组格式");
        } catch (e) {
            throw new Error("JSON 解析失败");
        }
        
        selector.innerHTML = '<option value="" disabled selected>请选择一张图片作为载体...</option>';
        imageList.forEach(fileName => {
            const option = document.createElement('option');
            option.value = fileName;
            option.textContent = fileName;
            selector.appendChild(option);
        });
        selector.onchange = (e) => updateCarrierImageSelection(e.target.value);
    } catch (error) {
        selector.innerHTML = `<option value="" disabled selected>加载失败</option>`;
        log('encLog', `列表加载错误: ${error.message}`, true);
    }
}

function initLocalCarrierImageSupport() {
    const dropzone = document.getElementById('localCarrierDropzone');
    const selector = document.getElementById('carrierImage');
    const logElementId = 'encLog';
    if (!dropzone || !selector) return;

    ['dragover', 'dragleave'].forEach(evt => dropzone.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        dropzone.style.borderColor = evt === 'dragover' ? 'var(--accent)' : 'rgba(96,165,250,0.5)';
    }));

    dropzone.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        dropzone.style.borderColor = 'rgba(96,165,250,0.5)';
        if (e.dataTransfer.files.length === 0) return;
        
        const file = e.dataTransfer.files[0];
        if (!file.type.startsWith('image/')) return log(logElementId, '请拖入图片文件', true);

        localCarrierFile = file;
        const oldOpt = selector.querySelector(`option[value^="${LOCAL_CARRIER_PREFIX}"]`);
        if (oldOpt) oldOpt.remove();

        const opt = document.createElement('option');
        opt.value = LOCAL_CARRIER_PREFIX + file.name;
        opt.textContent = `(本地) ${file.name}`;
        selector.appendChild(opt);
        selector.value = opt.value;
        updateCarrierImageSelection(opt.value);
        log(logElementId, `已加载本地载体: ${file.name}`);
    });
}

function updateCarrierImageSelection(val) {
    const previewDiv = document.getElementById('carrierPreview');
    const nameSpan = document.getElementById('carrierName');
    const imgElement = document.getElementById('carrierImagePreview');

    if (!val) {
        previewDiv.style.display = 'none';
        return;
    }
    
    if (val.startsWith(LOCAL_CARRIER_PREFIX) && localCarrierFile) {
        nameSpan.textContent = val.replace(LOCAL_CARRIER_PREFIX, '');
        imgElement.src = URL.createObjectURL(localCarrierFile);
        previewDiv.style.display = 'block';
    } else {
        nameSpan.textContent = val;
        imgElement.src = `picture/${val}`;
        previewDiv.style.display = 'block';
        localCarrierFile = null; 
    }
}

function initFileSelection(inputId, dropzoneId, logId, isDecrypt = false) {
    const input = document.getElementById(inputId);
    const dropzone = document.getElementById(dropzoneId);
    
    if (!input || !dropzone) return;

    const handleFile = (files) => {
        const file = files[0];
        if (!file) return;
        
        if (isDecrypt) {
            fileToDecrypt = file;
            document.getElementById('decFileDetail').style.display = 'block';
            document.getElementById('decFileName').textContent = file.name;
            document.getElementById('decFileSize').textContent = (file.size/1024/1024/1024).toFixed(3) + ' GB';
            document.getElementById('decLevelDisplay').textContent = '待识别...';
        } else {
            fileToEncrypt = file;
        }

        const sizeStr = (file.size / 1024 / 1024).toFixed(2) + ' MB';
        dropzone.querySelector('.dropzone-title').textContent = `已选择: ${file.name}`;
        log(logId, `已加载: ${file.name} (${sizeStr})`);
    };

    dropzone.onclick = () => input.click();
    input.onchange = () => handleFile(input.files);
    
    ['dragover', 'dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        if (evt === 'dragover') dropzone.style.borderColor = 'var(--accent)';
        else if (evt === 'dragleave' || evt === 'drop') dropzone.style.borderColor = 'var(--border)';
    }));

    dropzone.addEventListener('drop', e => handleFile(e.dataTransfer.files));
}

// ====== 3. 核心加密逻辑 (独立数据包模式) ======

async function startEncryption() {
    const logId = 'encLog';
    const carrierVal = document.getElementById('carrierImage').value;
    const encLevel = document.getElementById('encLevel').value;
    
    if (!fileToEncrypt) return log(logId, '请先选择待加密文件', true);
    if (!carrierVal) return log(logId, '请选择载体图片', true);

    try {
        log(logId, '正在准备加密...');

        let carrierBuf;
        if (carrierVal.startsWith(LOCAL_CARRIER_PREFIX)) {
            carrierBuf = await localCarrierFile.arrayBuffer();
        } else {
            const resp = await fetch(`picture/${carrierVal}`);
            if (!resp.ok) throw new Error('无法加载远程图片');
            carrierBuf = await resp.arrayBuffer();
        }

        let resultSegments = [carrierBuf];
        let hiddenSize = 0;

        if (encLevel === 'level2') {
            const pwd = prompt("设置加密密码:");
            if (!pwd) return log(logId, '操作取消', true);
            if (typeof CryptoJS === 'undefined') return log(logId, 'CryptoJS 未加载', true);
            
            log(logId, '正在进行 AES-256 数据包加密 (稳定模式)...');

            const key = CryptoJS.enc.Utf8.parse(pwd);
            const totalSize = fileToEncrypt.size;
            let offset = 0;

            while (offset < totalSize) {
                const chunkBlob = fileToEncrypt.slice(offset, offset + CHUNK_SIZE);
                const chunkBuf = await chunkBlob.arrayBuffer();
                const chunkWord = CryptoJS.lib.WordArray.create(chunkBuf);

                const iv = CryptoJS.lib.WordArray.random(16);

                const encrypted = CryptoJS.AES.encrypt(chunkWord, key, {
                    iv: iv,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                });

                const cipherU8 = wordArrayToUint8Array(encrypted.ciphertext);
                const ivU8 = wordArrayToUint8Array(iv);
                const lenU8 = intToBytes(cipherU8.byteLength);

                resultSegments.push(lenU8.buffer);
                resultSegments.push(ivU8.buffer);
                resultSegments.push(cipherU8.buffer);

                hiddenSize += (4 + 16 + cipherU8.byteLength);

                offset += CHUNK_SIZE;
                const progress = Math.min(100, (offset / totalSize) * 100).toFixed(0);
                if (offset % (CHUNK_SIZE * 5) === 0 || offset >= totalSize) {
                    log(logId, `加密进度: ${progress}% ...`);
                }
            }
        } else {
            log(logId, '正在合并文件 (Level 1)...');
            resultSegments.push(fileToEncrypt); 
            hiddenSize = fileToEncrypt.size;
        }

        const metadata = {
            magic: MAGIC_MARKER.slice(0, -2),
            level: encLevel === 'level2' ? 2 : 1,
            name: fileToEncrypt.name,
            hiddenSize: hiddenSize
        };
        const metaStr = JSON.stringify(metadata) + MAGIC_MARKER;
        const metaBuf = new TextEncoder().encode(metaStr);
        resultSegments.push(metaBuf);

        const finalBlob = new Blob(resultSegments, { type: 'image/png' });
        const saveName = carrierVal.replace(LOCAL_CARRIER_PREFIX, '').split('.')[0] + '_hidden.png';
        
        downloadFile(finalBlob, saveName);
        log(logId, `✅ 加密完成！文件已下载: ${saveName}`);

    } catch (e) {
        log(logId, `出错: ${e.message}`, true);
        console.error(e);
    }
}

// ====== 4. 核心解密逻辑 (独立数据包模式) ======

async function startDecryption() {
    const logId = 'decLog';
    const detailDisplay = document.getElementById('decLevelDisplay');

    if (!fileToDecrypt) return log(logId, '请先选择文件', true);

    log(logId, '正在分析文件结构...');
    try {
        const fileSize = fileToDecrypt.size;
        const tailSize = Math.min(fileSize, MAX_METADATA_SEARCH_SIZE);
        const tailBlob = fileToDecrypt.slice(fileSize - tailSize, fileSize);
        const tailBuf = await tailBlob.arrayBuffer();
        const tailU8 = new Uint8Array(tailBuf);
        const markerBytes = new TextEncoder().encode(MAGIC_MARKER);

        let markerPos = -1;
        for (let i = tailU8.length - markerBytes.length; i >= 0; i--) {
            let match = true;
            for (let j = 0; j < markerBytes.length; j++) {
                if (tailU8[i+j] !== markerBytes[j]) { match = false; break; }
            }
            if (match) { markerPos = i; break; }
        }

        if (markerPos === -1) throw new Error("未找到加密标记，文件可能未加密或已损坏");

        const decoder = new TextDecoder();
        const metaRegionStr = decoder.decode(tailU8.subarray(0, markerPos));
        const jsonStart = metaRegionStr.lastIndexOf('{');
        if (jsonStart === -1) throw new Error("无法定位元数据头");

        const jsonStr = metaRegionStr.substring(jsonStart);
        let meta;
        try { meta = JSON.parse(jsonStr); } 
        catch (e) { throw new Error("元数据损坏"); }

        const metaBytesLen = new TextEncoder().encode(jsonStr).byteLength;
        const absMarkerPos = (fileSize - tailSize) + markerPos;
        const absJsonStart = absMarkerPos - metaBytesLen;
        const hiddenEnd = absJsonStart;
        const hiddenStart = hiddenEnd - meta.hiddenSize;

        if (hiddenStart < 0) throw new Error("文件完整性校验失败");

        detailDisplay.textContent = `级别: ${meta.level}`;
        log(logId, `发现隐藏数据: ${(meta.hiddenSize/1024/1024).toFixed(2)} MB`);

        let finalBlob;

        if (meta.level === 2) {
            const pwd = prompt("输入解密密码:");
            if (!pwd) return log(logId, '已取消', true);
            
            const key = CryptoJS.enc.Utf8.parse(pwd);
            let offset = 0;
            const decSegments = [];
            const hiddenBlob = fileToDecrypt.slice(hiddenStart, hiddenEnd);
            
            log(logId, '开始解密 (独立数据包模式)...');

            while (offset < meta.hiddenSize) {
                if (offset + 4 > meta.hiddenSize) break; 
                
                const lenHeadBlob = hiddenBlob.slice(offset, offset + 4);
                const lenHeadBuf = await lenHeadBlob.arrayBuffer();
                const cipherLen = bytesToInt(new Uint8Array(lenHeadBuf));

                offset += 4;

                const ivBlob = hiddenBlob.slice(offset, offset + 16);
                const ivBuf = await ivBlob.arrayBuffer();
                const iv = CryptoJS.lib.WordArray.create(ivBuf);
                
                offset += 16;

                const cipherBlob = hiddenBlob.slice(offset, offset + cipherLen);
                const cipherBuf = await cipherBlob.arrayBuffer();
                const cipherWord = CryptoJS.lib.WordArray.create(cipherBuf);

                offset += cipherLen;

                const decrypted = CryptoJS.AES.decrypt(
                    { ciphertext: cipherWord },
                    key,
                    { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
                );

                decSegments.push(wordArrayToUint8Array(decrypted));
            }
            finalBlob = new Blob(decSegments);
        } else {
            finalBlob = fileToDecrypt.slice(hiddenStart, hiddenEnd);
        }

        downloadFile(finalBlob, meta.name);
        log(logId, `✅ 解密成功: ${meta.name}`);

    } catch (e) {
        log(logId, `解密失败: ${e.message}`, true);
        console.error(e);
    }
}

// ====== 5. 绑定事件 ======

document.addEventListener('DOMContentLoaded', () => {
    initCarrierImageSelector();
    initLocalCarrierImageSupport();
    initFileSelection('encInput', 'dropzoneEnc', 'encLog', false);
    initFileSelection('decInput', 'dropzoneDec', 'decLog', true);

    document.getElementById('startEncrypt').onclick = startEncryption;
    document.getElementById('startDecrypt').onclick = startDecryption;
});
