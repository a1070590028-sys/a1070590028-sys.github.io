// js/modules/encryption.js

// ====== 1. 常量与辅助函数 ======

// 文件隐写数据的起始标记 (用于解密时定位隐藏数据)
const MAGIC_MARKER = 'FSDATA::'; // File Steganography Data Marker

// 全局变量用于保存用户选择的待加密文件和解密文件
let fileToEncrypt = null;
let fileToDecrypt = null;

/**
 * 辅助函数: 记录日志到指定元素
 */
function log(elementId, message, isError = false) {
    const logElement = document.getElementById(elementId);
    if (logElement) {
        const color = isError ? 'var(--danger)' : 'var(--text-muted)';
        logElement.innerHTML = `<span style="color:${color};">${message}</span>`;
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

// ====== 2. 初始化函数 ======

/**
 * 初始化图片载体选择下拉菜单 (#carrierImage)
 * 📢 修正：通过 fetch 请求 picture/picture-list.json 获取列表
 */
async function initCarrierImageSelector() {
    const selector = document.getElementById('carrierImage');
    if (!selector) return;

    selector.innerHTML = '<option value="" disabled selected>正在加载图片列表...</option>';

    try {
        const response = await fetch('picture/picture-list.json');
        if (!response.ok) {
            throw new Error('无法加载 picture-list.json，请检查文件是否存在于 /picture 目录。');
        }
        const imageList = await response.json();
        
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

    // 处理文件选择后的逻辑
    const handleFile = (files) => {
        fileToEncrypt = files.length > 0 ? files[0] : null;
        if (fileToEncrypt) {
            const sizeMB = (fileToEncrypt.size / 1024 / 1024).toFixed(2);
            dropzoneEnc.querySelector('.dropzone-title').textContent = `已选择待加密文件: ${fileToEncrypt.name}`;
            log(logElementId, `文件已加载：${fileToEncrypt.name} (${sizeMB} MB)。`);
        } else {
            dropzoneEnc.querySelector('.dropzone-title').textContent = '拖拽待加密文件到这里，或点击选择';
            log(logElementId, '请选择文件。');
        }
    };
    
    // 1. 点击选择
    dropzoneEnc.onclick = () => encInput.click();

    // 2. 文件选择后的处理
    encInput.onchange = () => handleFile(encInput.files);

    // 3. 拖拽逻辑
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

    // 清空文件详情
    const clearDetails = () => {
        detailDiv.style.display = 'none';
        document.getElementById('decFileName').textContent = '--';
        document.getElementById('decFileSize').textContent = '--';
        document.getElementById('decLevelDisplay').textContent = '--';
    };
    
    // 处理文件选择后的逻辑
    const handleFile = (files) => {
        clearDetails();
        fileToDecrypt = files.length > 0 ? files[0] : null;
        if (fileToDecrypt) {
            const sizeMB = (fileToDecrypt.size / 1024 / 1024).toFixed(2);
            dropzoneDec.querySelector('.dropzone-title').textContent = `已选择文件: ${fileToDecrypt.name}`;
            log(logElementId, `已加载文件：${fileToDecrypt.name} (${sizeMB} MB)。请点击“开始解密”。`);

            // 仅显示文件信息，实际解密识别在点击按钮后进行
            document.getElementById('decFileName').textContent = fileToDecrypt.name;
            document.getElementById('decFileSize').textContent = `${sizeMB} MB`;
            document.getElementById('decLevelDisplay').textContent = '待识别...';
            detailDiv.style.display = 'block';

        } else {
            dropzoneDec.querySelector('.dropzone-title').textContent = '拖拽待解密文件到这里，或点击选择';
            log(logElementId, '请选择文件。');
        }
    };
    
    // 1. 点击选择
    dropzoneDec.onclick = () => decInput.click();
    decInput.onchange = () => handleFile(decInput.files);

    // 2. 拖拽逻辑
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


// ====== 3. 加密/解密核心逻辑 (保持不变，但依赖 Crypto-JS) ======

/**
 * 核心加密函数
 */
async function startEncryption() {
    const logElementId = 'encLog';
    const carrierImageName = document.getElementById('carrierImage').value;
    const encLevel = document.getElementById('encLevel').value;
    
    if (!fileToEncrypt) {
        return log(logElementId, '错误：请先选择待加密文件！', true);
    }
    if (!carrierImageName) {
        return log(logElementId, '错误：请选择一张图片作为载体！', true);
    }

    log(logElementId, `开始加密文件到载体：${carrierImageName}...`);

    try {
        // 1. 获取载体图片数据 (通过 fetch 获取仓库图片)
        const carrierImageResponse = await fetch(`picture/${carrierImageName}`);
        if (!carrierImageResponse.ok) {
            throw new Error(`无法加载载体图片: picture/${carrierImageName}。请检查文件是否存在。`);
        }
        const carrierImageBuffer = await carrierImageResponse.arrayBuffer();

        // 2. 读取待加密文件数据
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
                return log(logElementId, '错误：未加载 Crypto-JS 库，无法进行二级加密。请在 index.html 中引入 js/lib/crypto-js.min.js。', true);
            }
            log(logElementId, '正在进行 AES-256 二级加密...');

            // Buffer to Word Array (CryptoJS uses WordArray)
            const fileWordArray = CryptoJS.lib.WordArray.create(fileDataBuffer);
            
            // 加密
            const encrypted = CryptoJS.AES.encrypt(fileWordArray, password);
            // 隐藏数据是加密结果的字符串，转回 ArrayBuffer
            const encryptedString = encrypted.toString();
            hiddenDataBuffer = new TextEncoder().encode(encryptedString).buffer;

            log(logElementId, '二级加密完成。');
        }

        // 4. 准备元数据 (Metadata)
        const metadata = {
            magic: MAGIC_MARKER.slice(0, -2), // 只保留 FSDATA
            level: encLevel === 'level2' ? 2 : 1,
            name: originalFileName,
            size: fileToEncrypt.size,
            hiddenSize: hiddenDataBuffer.byteLength // 隐藏数据实际大小
        };
        const metadataString = JSON.stringify(metadata) + MAGIC_MARKER; // 重复 Marker 确保唯一结束

        // 5. 拼接数据
        const metadataBuffer = new TextEncoder().encode(metadataString).buffer;
        
        // 合并：载体图片 + 元数据 + 隐藏数据
        const finalBuffer = new Uint8Array(
            carrierImageBuffer.byteLength + metadataBuffer.byteLength + hiddenDataBuffer.byteLength
        );
        
        finalBuffer.set(new Uint8Array(carrierImageBuffer), 0);
        finalBuffer.set(new Uint8Array(metadataBuffer), carrierImageBuffer.byteLength);
        finalBuffer.set(new Uint8Array(hiddenDataBuffer), carrierImageBuffer.byteLength + metadataBuffer.byteLength);

        // 6. 下载结果
        const resultBlob = new Blob([finalBuffer], { type: 'image/png' }); 
        
        // 构建新文件名：保留载体图片的基础名，添加后缀，并确保文件类型仍为图片
        const carrierBaseName = carrierImageName.substring(0, carrierImageName.lastIndexOf('.'));
        const newFileName = `${carrierBaseName}_hidden.png`; 

        downloadFile(resultBlob, newFileName);

        log(logElementId, `✅ 文件加密成功！已生成并下载 ${newFileName}。`);

    } catch (error) {
        log(logElementId, `加密失败：${error.message}`, true);
    }
}

/**
 * 核心解密函数
 */
async function startDecryption() {
    const logElementId = 'decLog';
    const detailLevelDisplay = document.getElementById('decLevelDisplay');
    
    if (!fileToDecrypt) {
        return log(logElementId, '错误：请先选择待解密文件！', true);
    }

    log(logElementId, '开始解析文件，查找隐藏数据...');
    detailLevelDisplay.textContent = '解析中...';

    try {
        const fileData = await fileToDecrypt.arrayBuffer();
        const fileUint8Array = new Uint8Array(fileData);
        const textDecoder = new TextDecoder('utf-8');

        // 1. 查找标记：从文件末尾向文件起始方向搜索 MAGIC_MARKER
        const markerBytes = new TextEncoder().encode(MAGIC_MARKER);
        
        // 搜索范围：文件末尾 500KB，以提高效率
        const searchStart = Math.max(0, fileUint8Array.length - 500 * 1024); 
        let metadataStartIndex = -1;

        // 线性搜索，找到隐藏数据和元数据开始的位置（即载体图片结束的位置）
        for (let i = searchStart; i < fileUint8Array.length; i++) {
            let match = true;
            for (let j = 0; j < markerBytes.length; j++) {
                if (fileUint8Array[i + j] !== markerBytes[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                // 找到第一个 MAGIC_MARKER 的起始位置
                metadataStartIndex = i;
                break;
            }
        }
        
        if (metadataStartIndex === -1) {
            return log(logElementId, '错误：未找到文件隐写标记，这不是一个加密文件或标记已被破坏。', true);
        }

        // 2. 提取元数据字符串
        const metadataRawString = textDecoder.decode(fileUint8Array.subarray(metadataStartIndex));
        const metadataEndIndex = metadataRawString.indexOf(MAGIC_MARKER, MAGIC_MARKER.length); // 查找第二个标记

        if (metadataEndIndex === -1) {
             return log(logElementId, '错误：元数据结构损坏，无法定位隐藏数据起始点。', true);
        }

        const metadataString = metadataRawString.substring(0, metadataEndIndex);
        
        let metadata;
        try {
            metadata = JSON.parse(metadataString);
        } catch (e) {
            return log(logElementId, '错误：无法解析隐藏的元数据。', true);
        }

        // 3. 验证元数据
        if (metadata.magic !== MAGIC_MARKER.slice(0, -2)) { 
            return log(logElementId, '错误：元数据魔术字不匹配。', true);
        }

        const hiddenDataStartByte = metadataStartIndex + metadataEndIndex + MAGIC_MARKER.length;
        const hiddenDataEndByte = hiddenDataStartByte + metadata.hiddenSize;
        
        if (hiddenDataEndByte > fileUint8Array.length) {
             return log(logElementId, '错误：文件大小与元数据中隐藏文件大小不匹配。', true);
        }

        // 4. 提取隐藏数据
        const hiddenDataBuffer = fileUint8Array.slice(hiddenDataStartByte, hiddenDataEndByte).buffer;
        
        let decryptedDataBlob;
        detailLevelDisplay.textContent = `已识别（${metadata.level} 级）`;

        // 5. 解密/提取
        if (metadata.level === 2) {
            const password = prompt("文件已进行二级加密，请输入解密密码:");
            if (!password) {
                return log(logElementId, '解密取消：未输入密码。', true);
            }
            if (typeof CryptoJS === 'undefined' || !CryptoJS.AES) {
                return log(logElementId, '错误：未加载 Crypto-JS 库，无法进行二级解密。', true);
            }
            log(logElementId, '正在进行 AES-256 解密...');

            // ArrayBuffer to encrypted string
            const encryptedString = new TextDecoder().decode(hiddenDataBuffer);
            
            // 解密
            const decrypted = CryptoJS.AES.decrypt(encryptedString, password);
            
            // 检查解密是否失败 (CryptoJS 失败时返回空 WordArray)
            if (decrypted.words.length === 0 && decrypted.sigBytes === 0) {
                 return log(logElementId, '错误：密码错误或解密失败，请检查密码。', true);
            }
            
            // Word Array to Uint8Array
            const decryptedUint8Array = new Uint8Array(decrypted.sigBytes);
            for (let i = 0; i < decrypted.sigBytes; i++) {
                decryptedUint8Array[i] = (decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            }
            
            decryptedDataBlob = new Blob([decryptedUint8Array]);
            log(logElementId, '二级解密成功！');

        } else {
            // 一级解密：直接使用提取的数据
            decryptedDataBlob = new Blob([hiddenDataBuffer]);
            log(logElementId, '一级伪装提取成功！');
        }

        // 6. 下载原文件
        downloadFile(decryptedDataBlob, metadata.name);
        log(logElementId, `✅ 文件解密成功！已下载原文件：${metadata.name}`, false);

    } catch (error) {
        log(logElementId, `解密失败：${error.message}`, true);
    }
}


// ====== 4. 初始化和事件绑定 ======

document.addEventListener('DOMContentLoaded', () => {
    // 初始化下拉菜单和拖拽区
    initCarrierImageSelector(); // 📢 异步加载列表
    initEncryptFileSelection();
    initDecryptFileSelection();

    // 绑定加密/解密按钮
    document.getElementById('startEncrypt').onclick = startEncryption;
    document.getElementById('startDecrypt').onclick = startDecryption;

    console.log('Encryption Module loaded and event listeners attached.');
});
