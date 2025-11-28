// js/modules/encryption.js

// ====== 1. 常量与辅助函数 ======

// 文件隐写数据的起始标记 (用于解密时定位隐藏数据)
const MAGIC_MARKER = 'FSDATA::'; // 8 characters
const MAX_METADATA_SEARCH_SIZE = 50 * 1024; // 搜索元数据的最大文件尾部大小 (50KB)

// 全局变量用于保存用户选择的待加密文件和解密文件 (File 对象，支持大文件)
let fileToEncrypt = null;
let fileToDecrypt = null;

// ⭐ 新增: 用于存储本地拖拽的载体图片文件
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

// ====== 2. 初始化函数 ======

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

        // 绑定事件处理器 (统一处理远程和本地文件预览)
        selector.onchange = (e) => updateCarrierImageSelection(e.target.value);

    } catch (error) {
        selector.innerHTML = `<option value="" disabled selected>加载失败: ${error.message}</option>`;
        log('encLog', `图片列表加载失败: ${error.message}`, true);
    }
}

/**
 * ⭐ 新增: 处理本地载体图片的拖拽逻辑
 */
function initLocalCarrierImageSupport() {
    const dropzone = document.getElementById('localCarrierDropzone');
    const selector = document.getElementById('carrierImage');
    const logElementId = 'encLog';

    if (!dropzone || !selector) return;

    // 拖拽边框样式反馈
    ['dragover', 'dragleave'].forEach(event => {
        dropzone.addEventListener(event, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.style.borderColor = (event === 'dragover') ? 'var(--accent)' : 'rgba(96,165,250,0.5)';
        });
    });

    // 文件放下时的处理
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

        // 1. 存储本地文件
        localCarrierFile = file;

        // 2. 移除任何先前的本地文件选项
        let oldOption = selector.querySelector(`option[value^="${LOCAL_CARRIER_PREFIX}"]`);
        if(oldOption) {
            oldOption.remove();
        }

        // 3. 添加新的本地文件到下拉菜单
        const option = document.createElement('option');
        const optionValue = LOCAL_CARRIER_PREFIX + file.name; 
        option.value = optionValue;
        option.textContent = `(本地文件) ${file.name}`;
        selector.appendChild(option);
        
        // 4. 选中新选项并更新预览
        selector.value = optionValue;
        updateCarrierImageSelection(optionValue);

        log(logElementId, `已添加本地载体图片：${file.name}，文件大小：${(file.size / 1024 / 1024).toFixed(2)} MB。`);
    });
}

/**
 * ⭐ 新增: 统一处理载体图片的选择和预览 (无论远程还是本地)
 */
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
    
    // 如果选择了远程文件，清除本地文件引用
    if (!selectedValue.startsWith(LOCAL_CARRIER_PREFIX)) {
        localCarrierFile = null;
    }

    if (selectedValue.startsWith(LOCAL_CARRIER_PREFIX) && localCarrierFile) {
        // 本地文件预览
        const fileName = selectedValue.replace(LOCAL_CARRIER_PREFIX, '');
        nameSpan.textContent = `(本地) ${fileName}`;
        // 使用 URL.createObjectURL 进行本地预览
        imgElement.src = URL.createObjectURL(localCarrierFile);
        previewDiv.style.display = 'block';
    } else if (!selectedValue.startsWith(LOCAL_CARRIER_PREFIX)) {
        // 远程文件预览
        const imagePath = `picture/${selectedValue}`;
        nameSpan.textContent = selectedValue;
        imgElement.src = imagePath;
        previewDiv.style.display = 'block';
    } else {
         // 理论上不应该发生，但以防万一
        previewDiv.style.display = 'none';
    }
}


/**
 * 初始化文件选择/拖拽逻辑 (待加密文件, 保持不变)
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
 * 初始化文件选择/拖拽逻辑 (待解密文件, 保持不变)
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
 * 核心加密函数 (已支持本地载体图片)
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

    log(logElementId, `开始加密文件到载体：${carrierImageName}...`);

    try {
        let carrierImageBuffer;

        // 1. 获取载体图片数据 (ArrayBuffer) - 区分本地和远程文件
        if (isLocalFile && localCarrierFile) {
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
            hiddenSize: hiddenDataBuffer.byteLength 
        };
        const metadataString = JSON.stringify(metadata) + MAGIC_MARKER; 
        const metadataBuffer = new TextEncoder().encode(metadataString).buffer;

        // 5. 拼接数据 (使用 Blob 构造函数安全拼接大文件)
        const segments = [
            carrierImageBuffer,
            hiddenDataBuffer,   // 隐藏数据
            metadataBuffer      // 元数据和标记 (在文件末尾)
        ];

        // 6. 下载结果
        const resultBlob = new Blob(segments, { type: 'image/png' }); 
        
        const baseName = carrierImageName.substring(0, carrierImageName.lastIndexOf('.'));
        const newFileName = `${baseName}_hidden.png`; 

        downloadFile(resultBlob, newFileName);

        log(logElementId, `✅ 文件加密成功！已生成并下载 ${newFileName}。`);

    } catch (error) {
        log(logElementId, `加密失败：${error.message}`, true);
    }
}

/**
 * 核心解密函数 (保持不变)
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
            return log(logElementId, '未找到文件隐写标记，这不是一个加密文件或标记已被破坏。请注意，重新压缩图片文件会导致标记丢失！', true);
        }

        // 2. 提取元数据字符串
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
        const totalMetadataBlockSize = metadataTail.length + MAGIC_MARKER.length;
        const hiddenDataEndByte = fileSize - totalMetadataBlockSize;
        const hiddenDataStartByte = hiddenDataEndByte - metadata.hiddenSize;
        
        if (hiddenDataStartByte < 0 || hiddenDataEndByte > fileSize) {
             return log(logElementId, '文件大小与元数据中隐藏文件大小不匹配，文件可能已被篡改。', true);
        }

        // 5. 提取隐藏数据 (Blob.slice() 提取数据)
        log(logElementId, `正在提取隐藏数据（大小：${(metadata.hiddenSize / 1024 / 1024).toFixed(2)} MB）...`);
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
            log(logElementId, '正在进行 AES-256 解密 (此过程可能较慢，请耐心等待)...');

            const hiddenDataBuffer = await hiddenDataBlob.arrayBuffer();
            const encryptedString = new TextDecoder().decode(hiddenDataBuffer);
            
            const decrypted = CryptoJS.AES.decrypt(encryptedString, password);
            
            if (decrypted.words.length === 0 && decrypted.sigBytes === 0) {
                 return log(logElementId, '密码错误或解密失败，请检查密码。', true);
            }
            
            const decryptedUint8Array = new Uint8Array(decrypted.sigBytes);
            for (let i = 0; i < decrypted.sigBytes; i++) {
                decryptedUint8Array[i] = (decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            }
            
            decryptedDataBlob = new Blob([decryptedUint8Array]);
            log(logElementId, '二级解密成功！');

        } else {
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
    initLocalCarrierImageSupport(); // ⭐ 启动本地拖拽支持
    initEncryptFileSelection();
    initDecryptFileSelection();

    document.getElementById('startEncrypt').onclick = startEncryption;
    document.getElementById('startDecrypt').onclick = startDecryption;
});
