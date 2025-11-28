// js/modules/encryption.js

// ====== 1. 常量与辅助函数 ======

const MAGIC_MARKER = 'FSDATA::'; 
const MAX_METADATA_SEARCH_SIZE = 50 * 1024; // 50KB
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB (必须是 16 的倍数)

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
    a.click(); // 触发下载
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
        // 清理旧的本地选项
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
        localCarrierFile = null; // 清除本地引用
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

// ====== 3. 核心加密逻辑 (分块 + 填充修正) ======

async function startEncryption() {
    const logId = 'encLog';
    const carrierVal = document.getElementById('carrierImage').value;
    const encLevel = document.getElementById('encLevel').value;
    
    if (!fileToEncrypt) return log(logId, '请先选择待加密文件', true);
    if (!carrierVal) return log(logId, '请选择载体图片', true);

    try {
        log(logId, '正在准备加密...');

        // 1. 获取载体数据
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
        let ivBase64 = null; // 仅 Level 2 使用

        if (encLevel === 'level2') {
            const pwd = prompt("设置加密密码:");
            if (!pwd) return log(logId, '操作取消', true);
            if (typeof CryptoJS === 'undefined') return log(logId, 'CryptoJS 未加载', true);
            
            log(logId, '正在进行 AES-256 分块加密 (NoPadding模式)...');

            const key = CryptoJS.enc.Utf8.parse(pwd);
            let iv = CryptoJS.lib.WordArray.random(16);
            ivBase64 = CryptoJS.enc.Base64.stringify(iv); // 保存初始 IV

            const totalSize = fileToEncrypt.size;
            let offset = 0;

            while (offset < totalSize) {
                const isLastChunk = (offset + CHUNK_SIZE) >= totalSize;
                const chunkBlob = fileToEncrypt.slice(offset, offset + CHUNK_SIZE);
                const chunkBuf = await chunkBlob.arrayBuffer();
                const chunkWord = CryptoJS.lib.WordArray.create(chunkBuf);

                // ⭐ 关键修正：中间块使用 NoPadding，最后一块使用 Pkcs7
                // 这样中间块加密后大小不变，不会破坏数据结构
                const paddingMode = isLastChunk ? CryptoJS.pad.Pkcs7 : CryptoJS.pad.NoPadding;

                const encrypted = CryptoJS.AES.encrypt(chunkWord, key, {
                    iv: iv,
                    mode: CryptoJS.mode.CBC,
                    padding: paddingMode
                });

                // 获取加密后的二进制
                const cipherU8 = wordArrayToUint8Array(encrypted.ciphertext);
                resultSegments.push(cipherU8);
                hiddenSize += cipherU8.byteLength;

                // ⭐ IV 链式传递：下一块的 IV 是当前密文的最后 16 字节
                if (!isLastChunk) {
                    // 必须从 ciphertext 重新提取，确保准确
                    const cipherWords = encrypted.ciphertext.words;
                    const last4Words = cipherWords.slice(cipherWords.length - 4);
                    iv = CryptoJS.lib.WordArray.create(last4Words, 16);
                }

                offset += CHUNK_SIZE;
                const progress = Math.min(100, (offset / totalSize) * 100).toFixed(0);
                if (offset % (CHUNK_SIZE * 5) === 0 || isLastChunk) { // 减少日志频率
                    log(logId, `加密进度: ${progress}% ...`);
                }
            }
        } else {
            // Level 1: 直接拼接
            log(logId, '正在合并文件 (Level 1)...');
            resultSegments.push(fileToEncrypt); // 直接放入 Blob
            hiddenSize = fileToEncrypt.size;
        }

        // 构造元数据
        const metadata = {
            magic: MAGIC_MARKER.slice(0, -2),
            level: encLevel === 'level2' ? 2 : 1,
            name: fileToEncrypt.name,
            hiddenSize: hiddenSize,
            iv: ivBase64 
        };
        const metaStr = JSON.stringify(metadata) + MAGIC_MARKER;
        const metaBuf = new TextEncoder().encode(metaStr);
        resultSegments.push(metaBuf);

        // 生成最终文件
        const finalBlob = new Blob(resultSegments, { type: 'image/png' });
        const saveName = carrierVal.replace(LOCAL_CARRIER_PREFIX, '').split('.')[0] + '_hidden.png';
        
        downloadFile(finalBlob, saveName);
        log(logId, `✅ 加密完成！文件已下载: ${saveName}`);

    } catch (e) {
        log(logId, `出错: ${e.message}`, true);
        console.error(e);
    }
}

// ====== 4. 核心解密逻辑 (分块 + 填充修正) ======

async function startDecryption() {
    const logId = 'decLog';
    const detailDisplay = document.getElementById('decLevelDisplay');

    if (!fileToDecrypt) return log(logId, '请先选择文件', true);

    log(logId, '正在分析文件结构...');
    try {
        const fileSize = fileToDecrypt.size;
        // 1. 读取尾部寻找标记
        const tailSize = Math.min(fileSize, MAX_METADATA_SEARCH_SIZE);
        const tailBlob = fileToDecrypt.slice(fileSize - tailSize, fileSize);
        const tailBuf = await tailBlob.arrayBuffer();
        const tailU8 = new Uint8Array(tailBuf);
        const markerBytes = new TextEncoder().encode(MAGIC_MARKER);

        // 从后向前搜索标记
        let markerPos = -1;
        for (let i = tailU8.length - markerBytes.length; i >= 0; i--) {
            let match = true;
            for (let j = 0; j < markerBytes.length; j++) {
                if (tailU8[i+j] !== markerBytes[j]) { match = false; break; }
            }
            if (match) { markerPos = i; break; }
        }

        if (markerPos === -1) throw new Error("未找到加密标记，文件可能未加密或已损坏");

        // 2. 解析元数据
        // 标记前面是 JSON，我们需要找到 JSON 的开始 '{'
        // 将尾部数据转为字符串进行查找 (仅在找到的标记之前查找)
        const decoder = new TextDecoder();
        // 取标记之前的所有数据作为潜在的 JSON 区域
        // 注意：这里我们假设 JSON 不会超过 tailSize。如果 JSON 超大，逻辑需调整，但通常足够。
        const metaRegionStr = decoder.decode(tailU8.subarray(0, markerPos));
        const jsonStart = metaRegionStr.lastIndexOf('{');
        
        if (jsonStart === -1) throw new Error("无法定位元数据头");
        
        const jsonStr = metaRegionStr.substring(jsonStart);
        let meta;
        try {
            meta = JSON.parse(jsonStr);
        } catch (e) {
            throw new Error("元数据损坏");
        }

        // 3. 计算隐藏数据位置
        const metaBytesLen = new TextEncoder().encode(jsonStr).byteLength;
        const totalFooterLen = metaBytesLen + MAGIC_MARKER.length; // JSON + FSDATA::
        
        // 绝对结束位置 = 文件总大小 - 页脚大小
        const hiddenEnd = fileSize - (tailU8.length - markerPos + metaBytesLen - markerBytes.length); 
        // 修正计算：更稳健的方式
        // Footer 位于文件最末端。
        // hiddenEnd = fileSize - (JSON长度 + 标记长度)
        // 其实我们可以直接用 fileSize - totalFooterLen
        // 但是要注意 markerPos 是相对于 tailBuf 的。
        // tailBuf 对应文件区间 [fileSize - tailSize, fileSize]
        // 标记在文件中的绝对位置 = (fileSize - tailSize) + markerPos
        // 元数据开始绝对位置 = (fileSize - tailSize) + (markerPos对应的字节位置 - JSON字节长度)
        // 让我们用最简单的方式：隐藏数据就在元数据之前。
        
        const absMarkerStart = (fileSize - tailSize) + markerPos;
        const absJsonStart = absMarkerStart - metaBytesLen;
        const absHiddenEnd = absJsonStart;
        const absHiddenStart = absHiddenEnd - meta.hiddenSize;

        if (absHiddenStart < 0) throw new Error("文件完整性校验失败");

        detailDisplay.textContent = `级别: ${meta.level}`;
        log(logId, `发现隐藏数据: ${(meta.hiddenSize/1024/1024).toFixed(2)} MB`);

        let finalBlob;

        if (meta.level === 2) {
            const pwd = prompt("输入解密密码:");
            if (!pwd) return log(logId, '已取消', true);
            
            const key = CryptoJS.enc.Utf8.parse(pwd);
            let iv = CryptoJS.enc.Base64.parse(meta.iv);
            
            let offset = 0;
            const totalEnc = meta.hiddenSize;
            const decSegments = [];
            
            log(logId, '开始分块解密...');

            // 隐藏数据区域 Blob
            const hiddenBlob = fileToDecrypt.slice(absHiddenStart, absHiddenEnd);

            while (offset < totalEnc) {
                // 计算块大小 (注意 NoPadding 导致的块对齐)
                // 加密时我们按 10MB 分块。
                // 中间块加密后大小仍为 10MB (NoPadding)。
                // 最后一块加密后大小 = 原始剩余 + Padding (即 > 剩余)。
                // 所以我们可以安全地按 CHUNK_SIZE 读取中间块。
                
                let readSize = CHUNK_SIZE;
                // 如果剩余不足或刚好是 CHUNK_SIZE，这是最后一块
                const remaining = totalEnc - offset;
                
                // 修正：最后一块的大小可能比 CHUNK_SIZE 大一点点（因为Padding），
                // 但也可能小。关键是中间块一定是 CHUNK_SIZE。
                // 如果 remaining <= CHUNK_SIZE + 16 (Padding max)，那这就是最后一块。
                // 由于我们加密时每 10MB 一块，且中间块 NoPadding，
                // 只有最后一块有 Padding。
                // 此时 hiddenBlob 的总大小 = (N-1)*10MB + (LastChunk + Pad).
                // 所以我们只需要按 10MB 切分即可。最后一块会自动处理剩余所有。
                
                if (offset + CHUNK_SIZE >= totalEnc) {
                    readSize = remaining; // 读取剩余所有
                }

                const chunkBlob = hiddenBlob.slice(offset, offset + readSize);
                const chunkBuf = await chunkBlob.arrayBuffer();
                const chunkWord = CryptoJS.lib.WordArray.create(chunkBuf);
                
                // ⭐ 关键修正：最后一块使用 Pkcs7 解除填充，中间块 NoPadding
                const isLast = (offset + readSize >= totalEnc);
                const paddingMode = isLast ? CryptoJS.pad.Pkcs7 : CryptoJS.pad.NoPadding;

                const decrypted = CryptoJS.AES.decrypt(
                    { ciphertext: chunkWord }, 
                    key, 
                    { iv: iv, mode: CryptoJS.mode.CBC, padding: paddingMode }
                );

                if (offset === 0 && decrypted.sigBytes < 0) {
                     return log(logId, '密码错误', true);
                }

                // 更新 IV 为当前密文块的最后 16 字节
                if (!isLast) {
                    // 从 ArrayBuffer 中直接取最后 16 字节，最稳健
                    const last16Bytes = chunkBuf.slice(chunkBuf.byteLength - 16);
                    iv = CryptoJS.lib.WordArray.create(new Uint8Array(last16Bytes));
                }

                decSegments.push(wordArrayToUint8Array(decrypted));
                
                offset += readSize;
                if (offset % (CHUNK_SIZE * 5) === 0) log(logId, `解密进度: ${Math.min(100, (offset/totalEnc)*100).toFixed(0)}%`);
            }
            finalBlob = new Blob(decSegments);
        } else {
            // Level 1
            finalBlob = fileToDecrypt.slice(absHiddenStart, absHiddenEnd);
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
