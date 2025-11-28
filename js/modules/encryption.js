// js/modules/encryption.js

// ====== 1. 常量与辅助函数 ======

// 文件隐写数据的起始标记 (用于解密时定位隐藏数据)
const MAGIC_MARKER = 'FSDATA::'; // 8 characters
const MAX_METADATA_SEARCH_SIZE = 50 * 1024; // 搜索元数据的最大文件尾部大小 (50KB)

// 全局变量用于保存用户选择的待加密文件和解密文件 (File 对象，支持大文件)
let fileToEncrypt = null;
let fileToDecrypt = null;

/**
 * 辅助函数: 记录日志到指定元素
 */
function log(elementId, message, isError = false) {
    const logElement = document.getElementById(elementId);
    if (logElement) {
        const color = isError ? 'var(--danger)' : 'var(--text-muted)';
        const prefix = isError ? '❌ 错误：' : (message.startsWith('✅') ? '' : '');
        logElement.innerHTML = `<span style="color:${color};">${prefix}${message}</span>`;
    }
}

/**
 * 辅助函数: 下载文件
 */
function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ====== 2. 初始化函数 (保持不变，用于加载图片列表和拖拽) ======

/**
 * 初始化图片载体选择下拉菜单 (#carrierImage)
 */
async function initCarrierImageSelector() {
    const selector = document.getElementById('carrierImage');
    if (!selector) return;

    selector.innerHTML = '<option value="" disabled selected>正在加载图片列表...</option>';

    try {
        const response = await fetch('picture/picture-list.json');
        
        if (!response.ok) {
            throw new Error(`网络错误: 状态码 ${response.status}。请检查文件路径和权限。`);
        }
        
        const rawContent = await response.text();

        let imageList;
        try {
            imageList = JSON.parse(rawContent);
            if (!Array.isArray(imageList)) {
                 throw new Error("文件内容不是有效的 JSON 数组。");
            }
        } catch (e) {
            const snippet = rawContent.substring(0, 100);
            const errorMsg = `JSON 解析失败。请检查 **picture/picture-list.json** 文件格式是否正确，内容开头: "${snippet.replace(/\n/g, ' ')}..."`;
            throw new Error(errorMsg);
        }
        
        selector.innerHTML = '<option value="" disabled selected>请选择一张图片作为载体...</option>';

        imageList.forEach(fileName => {
            const option = document.createElement('option');
            option.value = fileName;
            option.textContent = fileName;
            selector.appendChild(option);
        });
    } catch (error) {
        selector.innerHTML = `<option value="" disabled selected>加载失败: ${error.message}</option>`;
        log('encLog', `图片列表加载失败: ${error.message}`, true);
    }
}

/**
 * 初始化文件选择/拖拽逻辑 (待加密文件)
 */
function initEncryptFileSelection() {
    const encInput = document.getElementById('encInput');
    const dropzoneEnc = document.getElementById('dropzoneEnc');
    const logElementId = 'encLog';

    if (!encInput || !dropzoneEnc) return;

    const handleFile = (files) => {
        fileToEncrypt = files.length > 0 ? files[0] : null;
        if (fileToEncrypt) {
            const sizeGB = (fileToEncrypt.size / 1024 / 1024 / 1024).toFixed(3);
            dropzoneEnc.querySelector('.dropzone-title').textContent = `已选择待加密文件: ${fileToEncrypt.name}`;
            log(logElementId, `文件已加载：${fileToEncrypt.name} (${sizeGB} GB)。`);
        } else {
            dropzoneEnc.querySelector('.dropzone-title').textContent = '拖拽待加密文件到这里，或点击选择';
            log(logElementId, '请选择文件。');
        }
    };
    
    dropzoneEnc.onclick = () => encInput.click();
    encInput.onchange = () => handleFile(encInput.files);

    ['dragover', 'dragleave', 'drop'].forEach(event => {
        dropzoneEnc.addEventListener(event, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneEnc.style.borderColor = (event === 'dragover') ? 'var(--accent)' : 'var(--border)';
        });
    });

    dropzoneEnc.addEventListener('drop', (e) => {
        handleFile(e.dataTransfer.files);
    });
}

/**
 * 初始化文件选择/拖拽逻辑 (待解密文件)
 */
function initDecryptFileSelection() {
    const decInput = document.getElementById('decInput');
    const dropzoneDec = document.getElementById('dropzoneDec');
    const logElementId = 'decLog';
    const detailDiv = document.getElementById('decFileDetail');

    if (!decInput || !dropzoneDec) return;

    const clearDetails = () => {
        detailDiv.style.display = 'none';
        document.getElementById('decFileName').textContent = '--';
        document.getElementById('decFileSize').textContent = '--';
        document.getElementById('decLevelDisplay').textContent = '--';
    };
    
    const handleFile = (files) => {
        clearDetails();
        fileToDecrypt = files.length > 0 ? files[0] : null;
        if (fileToDecrypt) {
            const sizeGB = (fileToDecrypt.size / 1024 / 1024 / 1024).toFixed(3);
            dropzoneDec.querySelector('.dropzone-title').textContent = `已选择文件: ${fileToDecrypt.name}`;
            log(logElementId, `已加载文件：${fileToDecrypt.name} (${sizeGB} GB)。请点击“开始解密”。`);

            document.getElementById('decFileName').textContent = fileToDecrypt.name;
            document.getElementById('decFileSize').textContent = `${sizeGB} GB`;
            document.getElementById('decLevelDisplay').textContent = '待识别...';
            detailDiv.style.display = 'block';

        } else {
            dropzoneDec.querySelector('.dropzone-title').textContent = '拖拽待解密文件到这里，或点击选择';
            log(logElementId, '请选择文件。');
        }
    };
    
    dropzoneDec.onclick = () => decInput.click();
    decInput.onchange = () => handleFile(decInput.files);

    ['dragover', 'dragleave', 'drop'].forEach(event => {
        dropzoneDec.addEventListener(event, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneDec.style.borderColor = (event === 'dragover') ? 'var(--accent)' : 'var(--border)';
        });
    });

    dropzoneDec.addEventListener('drop', (e) => {
        handleFile(e.dataTransfer.files);
    });
}


// ====== 3. 加密/解密核心逻辑 (支持大文件) ======

/**
 * 核心加密函数 (已修复大文件拼接结构)
 * 新结构: [图片载体] [隐藏文件数据] [元数据JSON] [FSDATA::]
 */
async function startEncryption() {
    const logElementId = 'encLog';
    const carrierImageName = document.getElementById('carrierImage').value;
    const encLevel = document.getElementById('encLevel').value;
    
    if (!fileToEncrypt) {
        return log(logElementId, '请先选择待加密文件！', true);
    }
    if (!carrierImageName) {
        return log(logElementId, '请选择一张图片作为载体！', true);
    }

    log(logElementId, `开始加密文件到载体：${carrierImageName}...`);

    try {
        // 1. 获取载体图片数据 (ArrayBuffer)
        const carrierImageResponse = await fetch(`picture/${carrierImageName}`);
        if (!carrierImageResponse.ok) {
            throw new Error(`无法加载载体图片: picture/${carrierImageName}。请检查文件是否存在。`);
        }
        const carrierImageBuffer = await carrierImageResponse.arrayBuffer();

        // 2. 读取待加密文件数据 (ArrayBuffer)
        log(logElementId, '正在读取待加密文件内容...');
        const fileDataBuffer = await fileToEncrypt.arrayBuffer();
        
        let hiddenDataBuffer = fileDataBuffer;
        let originalFileName = fileToEncrypt.name;
        
        // 3. 处理二级加密 (Level 2)
        if (encLevel === 'level2') {
            const password = prompt("请输入二级加密密码 (必须记住，解密时需要):");
            if (!password) {
                return log(logElementId, '加密取消：未输入密码。', true);
            }
            if (typeof CryptoJS === 'undefined' || !CryptoJS.AES) {
                return log(logElementId, '未加载 Crypto-JS 库。', true);
            }
            log(logElementId, '正在进行 AES-256 二级加密 (此过程可能较慢，请耐心等待)...');

            const fileWordArray = CryptoJS.lib.WordArray.create(fileDataBuffer);
            const encrypted = CryptoJS.AES.encrypt(fileWordArray, password);
            const encryptedString = encrypted.toString();
            hiddenDataBuffer = new TextEncoder().encode(encryptedString).buffer;

            log(logElementId, '二级加密完成。');
        }

        // 4. 准备元数据 (Metadata)
        const metadata = {
            magic: MAGIC_MARKER.slice(0, -2), 
            level: encLevel === 'level2' ? 2 : 1,
            name: originalFileName,
            // 注意: 这里存储的是加密或伪装后的数据大小，用于解密定位
            hiddenSize: hiddenDataBuffer.byteLength 
        };
        // 元数据字符串 + 标记，用于解密时在文件末尾进行搜索
        const metadataString = JSON.stringify(metadata) + MAGIC_MARKER; 
        const metadataBuffer = new TextEncoder().encode(metadataString).buffer;

        // 5. 拼接数据 (使用 Blob 构造函数安全拼接大文件)
        // FIX: 确保元数据和标记在文件末尾，方便解密时搜索。
        const segments = [
            carrierImageBuffer,
            hiddenDataBuffer,   // 隐藏数据
            metadataBuffer      // 元数据和标记 (在文件末尾)
        ];

        // 6. 下载结果
        const resultBlob = new Blob(segments, { type: 'image/png' }); 
        
        const carrierBaseName = carrierImageName.substring(0, carrierImageName.lastIndexOf('.'));
        const newFileName = `${carrierBaseName}_hidden.png`; 

        downloadFile(resultBlob, newFileName);

        log(logElementId, `✅ 文件加密成功！已生成并下载 ${newFileName}。`);

    } catch (error) {
        log(logElementId, `加密失败：${error.message}`, true);
    }
}

/**
 * 核心解密函数 (已修复大文件提取和定位逻辑)
 */
async function startDecryption() {
    const logElementId = 'decLog';
    const detailLevelDisplay = document.getElementById('decLevelDisplay');
    
    if (!fileToDecrypt) {
        return log(logElementId, '请先选择待解密文件！', true);
    }

    log(logElementId, '开始解析文件，查找隐藏数据...');
    detailLevelDisplay.textContent = '解析中...';
    
    const fileSize = fileToDecrypt.size;

    try {
        // 1. 查找标记：仅加载文件末尾一小段数据 (MAX_METADATA_SEARCH_SIZE) 进行搜索
        const searchSize = Math.min(fileSize, MAX_METADATA_SEARCH_SIZE);
        const searchStart = fileSize - searchSize;

        const tailBlob = fileToDecrypt.slice(searchStart, fileSize);
        const tailBuffer = await tailBlob.arrayBuffer();
        const tailUint8Array = new Uint8Array(tailBuffer);
        const textDecoder = new TextDecoder('utf-8');

        // 查找标记
        const markerBytes = new TextEncoder().encode(MAGIC_MARKER);
        let markerIndexInTail = -1;

        // 从后往前搜索，确保找到最末尾的标记
        for (let i = tailUint8Array.length - markerBytes.length; i >= 0; i--) {
            let match = true;
            for (let j = 0; j < markerBytes.length; j++) {
                if (tailUint8Array[i + j] !== markerBytes[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                markerIndexInTail = i;
                break;
            }
        }
        
        if (markerIndexInTail === -1) {
            // 这是用户遇到的错误：未找到标记。
            return log(logElementId, '未找到文件隐写标记，这不是一个加密文件或标记已被破坏。请注意，重新压缩图片文件会导致标记丢失！', true);
        }

        // 2. 提取元数据字符串
        // 元数据字符串紧接在 MAGIC_MARKER 之前。
        // FIX: 元数据是 tailUint8Array 中从索引 0 到 markerIndexInTail 之间的所有内容。
        const metadataTail = tailUint8Array.subarray(0, markerIndexInTail);
        const metadataString = textDecoder.decode(metadataTail);
        
        let metadata;
        try {
            metadata = JSON.parse(metadataString);
        } catch (e) {
            return log(logElementId, '无法解析隐藏的元数据，文件可能已部分损坏。', true);
        }

        // 3. 验证元数据
        if (metadata.magic !== MAGIC_MARKER.slice(0, -2) || !metadata.hiddenSize || !metadata.name) { 
            return log(logElementId, '元数据格式不正确或缺少关键字段。', true);
        }
        
        // 4. 计算隐藏数据位置
        // 文件结构: [Image] [Hidden Data] [JSON] [FSDATA::]
        // 总元数据块大小 = JSON 长度 + 标记长度
        const totalMetadataBlockSize = metadataTail.length + MAGIC_MARKER.length;
        
        // 隐藏数据结束位置 (即 JSON 元数据开始的位置)
        const hiddenDataEndByte = fileSize - totalMetadataBlockSize;
        
        // 隐藏数据开始位置
        const hiddenDataStartByte = hiddenDataEndByte - metadata.hiddenSize;
        
        if (hiddenDataStartByte < 0 || hiddenDataEndByte > fileSize) {
             return log(logElementId, '文件大小与元数据中隐藏文件大小不匹配，文件可能已被篡改。', true);
        }

        // 5. 提取隐藏数据 (Blob.slice() 提取数据)
        log(logElementId, `正在提取隐藏数据（大小：${(metadata.hiddenSize / 1024 / 1024).toFixed(2)} MB）...`);
        // fileToDecrypt 是一个 File 对象（Blob 的子类），可以直接 slice 提取
        const hiddenDataBlob = fileToDecrypt.slice(hiddenDataStartByte, hiddenDataEndByte);
        
        let decryptedDataBlob;
        detailLevelDisplay.textContent = `已识别（${metadata.level} 级）`;

        // 6. 解密/提取
        if (metadata.level === 2) {
            // ⭐ 修复后这里会正常弹出密码框
            const password = prompt("文件已进行二级加密，请输入解密密码:");
            if (!password) {
                return log(logElementId, '解密取消：未输入密码。', true);
            }
            if (typeof CryptoJS === 'undefined' || !CryptoJS.AES) {
                return log(logElementId, '未加载 Crypto-JS 库。', true);
            }
            log(logElementId, '正在进行 AES-256 解密 (此过程可能较慢，请耐心等待)...');

            const hiddenDataBuffer = await hiddenDataBlob.arrayBuffer();
            const encryptedString = new TextDecoder().decode(hiddenDataBuffer);
            
            // 解密
            const decrypted = CryptoJS.AES.decrypt(encryptedString, password);
            
            // 检查解密是否失败
            if (decrypted.words.length === 0 && decrypted.sigBytes === 0) {
                 return log(logElementId, '密码错误或解密失败，请检查密码。', true);
            }
            
            // Word Array to Uint8Array/Blob
            const decryptedUint8Array = new Uint8Array(decrypted.sigBytes);
            for (let i = 0; i < decrypted.sigBytes; i++) {
                decryptedUint8Array[i] = (decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            }
            
            decryptedDataBlob = new Blob([decryptedUint8Array]);
            log(logElementId, '二级解密成功！');

        } else {
            // 一级解密：直接使用提取的 Blob
            decryptedDataBlob = hiddenDataBlob;
            log(logElementId, '一级伪装提取成功！');
        }

        // 7. 下载原文件
        downloadFile(decryptedDataBlob, metadata.name);
        log(logElementId, `✅ 文件解密成功！已下载原文件：${metadata.name}`, false);

    } catch (error) {
        log(logElementId, `解密失败：${error.message}`, true);
    }
}


// ====== 4. 初始化和事件绑定 ======

document.addEventListener('DOMContentLoaded', () => {
    initCarrierImageSelector(); 
    initEncryptFileSelection();
    initDecryptFileSelection();

    document.getElementById('startEncrypt').onclick = startEncryption;
    document.getElementById('startDecrypt').onclick = startDecryption;
});
