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

/**
 * 将 CryptoJS WordArray 转换为 Uint8Array
 */
function wordArrayToUint8Array(wordArray) {
    const len = wordArray.sigBytes;
    const words = wordArray.words;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return u8;
}

/**
 * 整数转 4字节 Uint8Array (大端序)
 */
function intToBytes(num) {
    const arr = new Uint8Array(4);
    arr[0] = (num >>> 24) & 0xff;
    arr[1] = (num >>> 16) & 0xff;
    arr[2] = (num >>> 8) & 0xff;
    arr[3] = num & 0xff;
    return arr;
}

/**
 * 4字节 Uint8Array 转整数 (大端序)
 */
function bytesToInt(arr) {
    let num = 0;
    num = (arr[0] << 24) | (arr[1] << 16) | (arr[2] << 8) | arr[3];
    return num >>> 0; 
}

// ====== 2. 初始化逻辑 (UI 相关) ======
async function initCarrierImageSelector() { /* 原始代码保持不变 */ }
function initLocalCarrierImageSupport() { /* 原始代码保持不变 */ }
function updateCarrierImageSelection(val) { /* 原始代码保持不变 */ }
function initFileSelection(inputId, dropzoneId, logId, isDecrypt = false) { /* 原始代码保持不变 */ }

// ====== 3. 核心加密逻辑 ======
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

        let resultSegments = [new Uint8Array(carrierBuf)];
        let hiddenSize = 0;

        if (encLevel === 'level2') {
            const pwd = prompt("设置加密密码:");
            if (!pwd) return log(logId, '操作取消', true);
            if (typeof CryptoJS === 'undefined') return log(logId, 'CryptoJS 未加载', true);
            
            log(logId, '正在进行 AES-256 数据包加密...');

            const key = CryptoJS.enc.Utf8.parse(pwd);
            let offset = 0;
            const totalSize = fileToEncrypt.size;

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

                // 修复：用 Uint8Array 拼接每个块，保证无损
                const block = new Uint8Array(4 + 16 + cipherU8.byteLength);
                block.set(lenU8, 0);
                block.set(ivU8, 4);
                block.set(cipherU8, 20);
                resultSegments.push(block);

                hiddenSize += block.byteLength;
                offset += CHUNK_SIZE;

                const progress = Math.min(100, (offset / totalSize) * 100).toFixed(0);
                if (offset % (CHUNK_SIZE*5) === 0 || offset >= totalSize) {
                    log(logId, `加密进度: ${progress}% ...`);
                }
            }
        } else {
            resultSegments.push(await fileToEncrypt.arrayBuffer());
            hiddenSize = fileToEncrypt.size;
        }

        const metadata = {
            magic: MAGIC_MARKER.slice(0, -2),
            level: encLevel === 'level2' ? 2 : 1,
            name: fileToEncrypt.name,
            hiddenSize: hiddenSize
        };
        const metaStr = JSON.stringify(metadata) + MAGIC_MARKER;
        resultSegments.push(new TextEncoder().encode(metaStr));

        const finalBlob = new Blob(resultSegments, { type: 'image/png' });
        const saveName = carrierVal.replace(LOCAL_CARRIER_PREFIX, '').split('.')[0] + '_hidden.png';
        
        downloadFile(finalBlob, saveName);
        log(logId, `✅ 加密完成！文件已下载: ${saveName}`);

    } catch (e) {
        log(logId, `出错: ${e.message}`, true);
        console.error(e);
    }
}

// ====== 4. 核心解密逻辑 ======
async function startDecryption() {
    const logId = 'decLog';
    const detailDisplay = document.getElementById('decLevelDisplay');

    if (!fileToDecrypt) return log(logId, '请先选择文件', true);

    log(logId, '正在分析文件结构...');
    try {
        const fileSize = fileToDecrypt.size;
        const tailSize = Math.min(fileSize, MAX_METADATA_SEARCH_SIZE);
        const tailBuf = await fileToDecrypt.slice(fileSize - tailSize, fileSize).arrayBuffer();
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
        let meta = JSON.parse(jsonStr);

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
            const hiddenBuf = await fileToDecrypt.slice(hiddenStart, hiddenEnd).arrayBuffer();
            const u8 = new Uint8Array(hiddenBuf);
            let offset = 0;
            const decSegments = [];

            log(logId, '开始解密...');

            while (offset < u8.length) {
                const cipherLen = bytesToInt(u8.slice(offset, offset+4));
                offset += 4;

                const iv = CryptoJS.lib.WordArray.create(u8.slice(offset, offset+16), 16);
                offset += 16;

                const cipherWord = CryptoJS.lib.WordArray.create(u8.slice(offset, offset+cipherLen), cipherLen);
                offset += cipherLen;

                const decrypted = CryptoJS.AES.decrypt({ ciphertext: cipherWord }, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
                decSegments.push(wordArrayToUint8Array(decrypted));
            }

            finalBlob = new Blob(decSegments);
        } else {
            finalBlob = await fileToDecrypt.slice(hiddenStart, hiddenEnd);
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
