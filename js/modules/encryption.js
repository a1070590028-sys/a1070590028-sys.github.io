// js/modules/encryption.js

// ====== 1. 常量与辅助函数 ======

// 文件隐写数据的起始标记 (用于解密时定位隐藏数据)
const MAGIC_MARKER = 'FSDATA::'; // 8 characters
const MAX_METADATA_SEARCH_SIZE = 50 * 1024; // 搜索元数据的最大文件尾部大小 (50KB)
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB 分块大小，用于二级加密

// 全局变量用于保存用户选择的待加密文件和解密文件 (File 对象，支持大文件)
let fileToEncrypt = null;
let fileToDecrypt = null;

// 用于存储本地拖拽的载体图片文件
let localCarrierFile = null; 
const LOCAL_CARRIER_PREFIX = 'LOCAL::'; // 用于区分本地文件选项的前缀

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

/**
 * ⭐ 辅助函数: 将 CryptoJS WordArray (二进制数据) 转换为 Uint8Array
 * 确保 WordArray 不会被错误地转换为 Base64 字符串，用于分块读写。
 */
function wordArrayToUint8Array(wordArray) {
    const numBytes = wordArray.sigBytes; 
    const numWords = wordArray.words.length;
    const uint8Array = new Uint8Array(numBytes);

    for (let i = 0; i < numBytes; i++) {
        const wordIndex = i >>> 2;
        if (wordIndex >= numWords) break; 
        
        const word = wordArray.words[wordIndex];
        const byteIndex = i % 4;
        // 使用位运算提取字节 (大端序)
        uint8Array[i] = (word >>> (24 - byteIndex * 8)) & 0xff;
    }
    return uint8Array;
}


// ====== 2. 初始化函数 (保持不变) ======

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

        selector.onchange = (e) => updateCarrierImageSelection(e.target.value);

    } catch (error) {
        selector.innerHTML = `<option value="" disabled selected>加载失败: ${error.message}</option>`;
        log('encLog', `图片列表加载失败: ${error.message}`, true);
    }
}

function initLocalCarrierImageSupport() {
    const dropzone = document.getElementById('localCarrierDropzone');
    const selector = document.getElementById('carrierImage');
    const logElementId = 'encLog';

    if (!dropzone || !selector) return;

    ['dragover', 'dragleave'].forEach(event => {
        dropzone.addEventListener(event, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.style.borderColor = (event === 'dragover') ? 'var(--accent)' : 'rgba(96,165,250,0.5)';
        });
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = 'rgba(96,165,250,0.5)';

        const files = e.dataTransfer.files;
        if (files.length === 0) {
            return log(logElementId, '未拖入文件。');
        }
        
        const file = files[0];
        if (!file.type.startsWith('image/')) {
            return log(logElementId, '错误：拖入的文件不是图片格式，请拖入 JPEG, PNG 或 WebP 文件。', true);
        }

        localCarrierFile = file;

        let oldOption = selector.querySelector(`option[value^="${LOCAL_CARRIER_PREFIX}"]`);
        if(oldOption) {
            oldOption.remove();
        }

        const option = document.createElement('option');
        const optionValue = LOCAL_CARRIER_PREFIX + file.name; 
        option.value = optionValue;
        option.textContent = `(本地文件) ${file.name}`;
        selector.appendChild(option);
        
        selector.value = optionValue;
        updateCarrierImageSelection(optionValue);

        log(logElementId, `已添加本地载体图片：${file.name}，文件大小：${(file.size / 1024 / 1024).toFixed(2)} MB。`);
    });
}

function updateCarrierImageSelection(selectedValue) {
    const previewDiv = document.getElementById('carrierPreview');
    const nameSpan = document.getElementById('carrierName');
    const imgElement = document.getElementById('carrierImagePreview');

    if (!selectedValue) {
        previewDiv.style.display = 'none';
        nameSpan.textContent = '--';
        imgElement.src = '';
        localCarrierFile = null;
        return;
    }
    
    if (!selectedValue.startsWith(LOCAL_CARRIER_PREFIX)) {
        localCarrierFile = null;
    }

    if (selectedValue.startsWith(LOCAL_CARRIER_PREFIX) && localCarrierFile) {
        const fileName = selectedValue.replace(LOCAL_CARRIER_PREFIX, '');
        nameSpan.textContent = `(本地) ${fileName}`;
        // 使用 URL.createObjectURL 进行本地预览
        imgElement.src = URL.createObjectURL(localCarrierFile);
        previewDiv.style.display = 'block';
    } else if (!selectedValue.startsWith(LOCAL_CARRIER_PREFIX)) {
        const imagePath = `picture/${selectedValue}`;
        nameSpan.textContent = selectedValue;
        imgElement.src = imagePath;
        previewDiv.style.display = 'block';
    } else {
        previewDiv.style.display = 'none';
    }
}


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
 * 核心加密函数 (已修复二级加密 IV 链式传递)
 */
async function startEncryption() {
    const logElementId = 'encLog';
    const selectedValue = document.getElementById('carrierImage').value;
    const isLocalFile = selectedValue.startsWith(LOCAL_CARRIER_PREFIX);
    const carrierImageName = isLocalFile ? selectedValue.replace(LOCAL_CARRIER_PREFIX, '') : selectedValue;

    const encLevel = document.getElementById('encLevel').value;
    
    if (!fileToEncrypt) {
        return log(logElementId, '请先选择待加密文件！', true);
    }
    if (!selectedValue) {
        return log(logElementId, '请选择一张图片作为载体！', true);
    }
    if (!fileToEncrypt.arrayBuffer) {
        return log(logElementId, '待加密文件引用已丢失，请重新选择文件。', true);
    }

    log(logElementId, `开始加密文件到载体：${carrierImageName}...`);

    try {
        let carrierImageBuffer;

        // 1. 获取载体图片数据 (ArrayBuffer)
        if (isLocalFile && localCarrierFile) {
            if (!localCarrierFile.arrayBuffer) {
                return log(logElementId, '本地载体文件引用已丢失，请重新拖入图片。', true);
            }
            log(logElementId, `正在读取本地载体图片 (${carrierImageName})...`);
            carrierImageBuffer = await localCarrierFile.arrayBuffer();
        } else if (!isLocalFile) {
            const carrierImageResponse = await fetch(`picture/${carrierImageName}`);
            if (!carrierImageResponse.ok) {
                throw new Error(`无法加载载体图片: picture/${carrierImageName}。请检查文件是否存在。`);
            }
            carrierImageBuffer = await carrierImageResponse.arrayBuffer();
        } else {
            throw new Error("无法获取载体图片数据。");
        }

        let hiddenDataSegments = [];
        let hiddenDataSize = 0;
        let originalFileName = fileToEncrypt.name;
        
        // 2. 处理待加密文件内容
        if (encLevel === 'level2') {
            // ⭐ Level 2: 分块加密 - 修复 IV 链式传递
            const password = prompt("请输入二级加密密码 (必须记住，解密时需要):");
            if (!password) {
                return log(logElementId, '加密取消：未输入密码。', true);
            }
            if (typeof CryptoJS === 'undefined' || !CryptoJS.AES) {
                return log(logElementId, '未加载 Crypto-JS 库。', true);
            }
            log(logElementId, '正在进行 AES-256 二级加密 (分块模式，此过程可能较慢，请耐心等待)...');

            const key = CryptoJS.enc.Utf8.parse(password);
            
            // 初始 IV
            let iv = CryptoJS.lib.WordArray.random(16); 
            const INITIAL_IV_BASE64 = CryptoJS.enc.Base64.stringify(iv); // 存储初始 IV

            const totalSize = fileToEncrypt.size;

            for (let offset = 0; offset < totalSize; offset += CHUNK_SIZE) {
                const chunk = fileToEncrypt.slice(offset, offset + CHUNK_SIZE);
                
                // 异步读取文件块
                const chunkBuffer = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = (e) => reject(new Error('Chunk read error: ' + e.target.error));
                    reader.readAsArrayBuffer(chunk);
                });

                const chunkWordArray = CryptoJS.lib.WordArray.create(chunkBuffer);
                
                // Encrypt the chunk using the current IV value
                const encryptedChunk = CryptoJS.AES.encrypt(chunkWordArray, key, {
                    iv: iv, 
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                });
                
                // ⭐ IV 链式传递：获取密文的最后 16 字节作为下一块的 IV
                const ciphertextWords = encryptedChunk.ciphertext.words;
                const lastBlockWordsStart = ciphertextWords.length - 4; // 16 bytes = 4 words
                
                iv = CryptoJS.lib.WordArray.create(
                    ciphertextWords.slice(lastBlockWordsStart, lastBlockWordsStart + 4),
                    16 // 确保 IV 是 16 字节
                );

                // 将密文 WordArray 转换为安全的 ArrayBuffer (10MB以内)
                const ciphertextUint8Array = wordArrayToUint8Array(encryptedChunk.ciphertext);
                
                hiddenDataSegments.push(ciphertextUint8Array.buffer);
                hiddenDataSize += ciphertextUint8Array.buffer.byteLength;
                
                const currentMB = (offset + chunk.size) / 1024 / 1024;
                log(logElementId, `已加密 ${currentMB.toFixed(2)} MB / ${(totalSize / 1024 / 1024).toFixed(2)} MB...`);
            }

            // 3. 准备元数据 (Level 2)
            const metadata = {
                magic: MAGIC_MARKER.slice(0, -2), 
                level: 2,
                name: originalFileName,
                hiddenSize: hiddenDataSize, 
                iv: INITIAL_IV_BASE64, // 存储初始 IV
            };
            
            log(logElementId, '二级加密完成。');

            // 4. 将元数据转换为 Buffer
            const metadataString = JSON.stringify(metadata) + MAGIC_MARKER; 
            const metadataBuffer = new TextEncoder().encode(metadataString).buffer;

            // 5. 拼接数据
            hiddenDataSegments = [
                carrierImageBuffer,
                ...hiddenDataSegments,   // 展开所有加密块
                metadataBuffer      
            ];
            
        } else {
            // ⭐ Level 1: 直接拼接
            log(logElementId, '正在读取待加密文件内容...');
            const fileDataBuffer = await fileToEncrypt.arrayBuffer();
            
            hiddenDataSize = fileDataBuffer.byteLength;
            
            // 3. 准备元数据 (Level 1)
            const metadata = {
                magic: MAGIC_MARKER.slice(0, -2), 
                level: 1,
                name: originalFileName,
                hiddenSize: hiddenDataSize, 
            };
            
            // 4. 将元数据转换为 Buffer
            const metadataString = JSON.stringify(metadata) + MAGIC_MARKER; 
            const metadataBuffer = new TextEncoder().encode(metadataString).buffer;

            // 5. 拼接数据
            hiddenDataSegments = [
                carrierImageBuffer,
                fileDataBuffer,   
                metadataBuffer      
            ];
        }

        // 6. 下载结果
        const resultBlob = new Blob(hiddenDataSegments, { type: 'image/png' }); 
        
        const baseName = carrierImageName.substring(0, carrierImageName.lastIndexOf('.'));
        const newFileName = `${baseName}_hidden.png`; 

        downloadFile(resultBlob, newFileName);

        log(logElementId, `✅ 文件加密成功！已生成并下载 ${newFileName}。`);

    } catch (error) {
        if (error.message.includes('file could not be read')) {
             log(logElementId, '加密失败：文件读取权限丢失。这通常发生在处理超大文件时。请尝试重启浏览器或选择较小文件。', true);
        } else {
             log(logElementId, `加密失败：${error.message}`, true);
        }
    }
}

/**
 * 核心解密函数 (已修复二级解密 IV 链式传递)
 */
async function startDecryption() {
    const logElementId = 'decLog';
    const detailLevelDisplay = document.getElementById('decLevelDisplay');
    
    if (!fileToDecrypt) {
        return log(logElementId, '请先选择待解密文件！', true);
    }
    if (!fileToDecrypt.slice) {
        return log(logElementId, '待解密文件引用已丢失，请重新选择文件。', true);
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
            return log(logElementId, '未找到文件隐写标记，这不是一个加密文件或标记已被破坏。请注意，重新压缩图片文件会导致标记丢失！', true);
        }

        // 2. 提取 JSON 字符串 (智能搜索)
        const metadataPlusHiddenTail = tailUint8Array.subarray(0, markerIndexInTail);
        const potentialMetadataString = textDecoder.decode(metadataPlusHiddenTail);

        const jsonStartIndex = potentialMetadataString.lastIndexOf('{');

        if (jsonStartIndex === -1) {
            return log(logElementId, '无法在文件末尾找到有效的 JSON 元数据起始标记 { 。', true);
        }

        const metadataString = potentialMetadataString.substring(jsonStartIndex);
        
        let metadata;
        try {
            metadata = JSON.parse(metadataString);
        } catch (e) {
            return log(logElementId, '无法解析隐藏的元数据，JSON格式损坏或文件已被篡改。', true);
        }

        // 3. 验证元数据
        if (metadata.magic !== MAGIC_MARKER.slice(0, -2) || typeof metadata.hiddenSize !== 'number' || !metadata.name) { 
            return log(logElementId, '元数据格式不正确或缺少关键字段。', true);
        }
        
        // 4. 计算隐藏数据位置
        const jsonLength = new TextEncoder().encode(metadataString).byteLength;
        const totalMetadataBlockSize = jsonLength + MAGIC_MARKER.length;
        
        const hiddenDataEndByte = fileSize - totalMetadataBlockSize;
        const hiddenDataStartByte = hiddenDataEndByte - metadata.hiddenSize;
        
        if (hiddenDataStartByte < 0 || hiddenDataEndByte > fileSize) {
             return log(logElementId, '文件大小与元数据中隐藏文件大小不匹配，文件可能已被篡改。', true);
        }

        // 5. 提取隐藏数据 (Blob.slice() 提取数据)
        log(logElementId, `正在提取隐藏数据（总大小：${(metadata.hiddenSize / 1024 / 1024).toFixed(2)} MB）...`);
        const hiddenDataBlob = fileToDecrypt.slice(hiddenDataStartByte, hiddenDataEndByte);
        
        let decryptedDataBlob;
        detailLevelDisplay.textContent = `已识别（${metadata.level} 级）`;

        // 6. 解密/提取
        if (metadata.level === 2) {
            const password = prompt("文件已进行二级加密，请输入解密密码:");
            if (!password) {
                return log(logElementId, '解密取消：未输入密码。', true);
            }
            if (typeof CryptoJS === 'undefined' || !CryptoJS.AES) {
                return log(logElementId, '未加载 Crypto-JS 库。', true);
            }
            if (!metadata.iv) {
                return log(logElementId, '元数据中缺少 IV 向量，无法解密。', true);
            }
            
            log(logElementId, '正在进行 AES-256 分块解密 (此过程可能较慢，请耐心等待)...');

            const key = CryptoJS.enc.Utf8.parse(password);
            // 还原初始 IV
            let iv = CryptoJS.enc.Base64.parse(metadata.iv); 
            
            let currentOffset = 0;
            const totalEncryptedSize = metadata.hiddenSize;
            let decryptedSegments = [];
            
            while (currentOffset < totalEncryptedSize) {
                const chunkSize = Math.min(CHUNK_SIZE, totalEncryptedSize - currentOffset);
                
                // 1. Slice the ENCRYPTED data blob
                const encryptedChunkBlob = hiddenDataBlob.slice(currentOffset, currentOffset + chunkSize);
                
                // 2. Read the encrypted chunk into ArrayBuffer
                const encryptedChunkBuffer = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = (e) => reject(new Error('Chunk read error: ' + e.target.error));
                    reader.readAsArrayBuffer(encryptedChunkBlob);
                });

                // 3. ArrayBuffer -> WordArray
                const encryptedWordArray = CryptoJS.lib.WordArray.create(encryptedChunkBuffer);

                // 4. Decrypt
                const decrypted = CryptoJS.AES.decrypt({ ciphertext: encryptedWordArray }, key, {
                    iv: iv, // 使用上一块的密文作为当前块的 IV
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                });

                // 5. 检查密码错误 (只需检查第一块，密码错误会导致第一块解密失败)
                if (currentOffset === 0 && decrypted.words.length === 0 && decrypted.sigBytes === 0) {
                     return log(logElementId, '密码错误或解密失败，请检查密码。', true);
                }
                
                // ⭐ IV 链式传递：更新下一块的 IV (下一块的 IV 是当前块的密文)
                const ciphertextWords = encryptedWordArray.words;
                const lastBlockWordsStart = ciphertextWords.length - 4; 
                
                iv = CryptoJS.lib.WordArray.create(
                    ciphertextWords.slice(lastBlockWordsStart, lastBlockWordsStart + 4),
                    16
                );

                // 6. WordArray -> Uint8Array (Decrypted chunk)
                const decryptedUint8Array = wordArrayToUint8Array(decrypted);
                
                decryptedSegments.push(decryptedUint8Array.buffer);
                currentOffset += chunkSize;
                
                log(logElementId, `已解密 ${(currentOffset / 1024 / 1024).toFixed(2)} MB / ${(totalEncryptedSize / 1024 / 1024).toFixed(2)} MB...`);
            }

            decryptedDataBlob = new Blob(decryptedSegments);
            log(logElementId, '二级分块解密成功！');

        } else {
            // Level 1: 直接读取整个 Blob (一次性)
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
    initLocalCarrierImageSupport();
    initEncryptFileSelection();
    initDecryptFileSelection();

    document.getElementById('startEncrypt').onclick = startEncryption;
    document.getElementById('startDecrypt').onclick = startDecryption;
});
