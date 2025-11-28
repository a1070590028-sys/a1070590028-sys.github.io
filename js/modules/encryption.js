// js/modules/encryption.js

// 模拟 /picture 目录下的图片列表
// 静态网站模式下，我们假设这些图片是已知的，并位于根目录的 /picture 文件夹中
const MOCK_CARRIER_IMAGES = [
    'default_cover.jpg',
    'bg_pattern.png',
    'secret_carrier.webp',
    'user_image_1.jpeg',
    'landscape_1080p.png'
];

/**
 * 初始化加密模块的图片载体选择下拉菜单 (#carrierImage)
 */
function initCarrierImageSelector() {
    const selector = document.getElementById('carrierImage');
    if (!selector) return;

    // 清除占位符并设置默认选项
    selector.innerHTML = '<option value="" disabled selected>请选择一张图片作为载体...</option>';

    MOCK_CARRIER_IMAGES.forEach(fileName => {
        const option = document.createElement('option');
        option.value = fileName;
        option.textContent = fileName;
        selector.appendChild(option);
    });
}

/**
 * 初始化文件选择/拖拽逻辑（待加密文件）
 */
function initEncryptFileSelection() {
    const encInput = document.getElementById('encInput');
    const dropzoneEnc = document.getElementById('dropzoneEnc');
    const logElement = document.getElementById('encLog');

    if (!encInput || !dropzoneEnc) return;

    // 1. 点击选择
    dropzoneEnc.onclick = () => encInput.click();

    // 2. 文件选择后的处理
    encInput.onchange = () => {
        if (encInput.files.length > 0) {
            const file = encInput.files[0];
            dropzoneEnc.querySelector('.dropzone-title').textContent = `已选择文件: ${file.name}`;
            logElement.innerHTML = `已加载文件：${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)。`;
        } else {
            dropzoneEnc.querySelector('.dropzone-title').textContent = '拖拽待加密文件到这里，或点击选择';
            logElement.innerHTML = '请选择文件。';
        }
    };

    // 3. 拖拽逻辑 (与图片压缩/PDF互转逻辑相同)
    dropzoneEnc.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzoneEnc.style.borderColor = 'var(--accent)';
    });

    dropzoneEnc.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzoneEnc.style.borderColor = 'var(--border)';
    });

    dropzoneEnc.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzoneEnc.style.borderColor = 'var(--border)';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            // 静态网站文件输入框只处理第一个文件
            encInput.files = files; 
            encInput.onchange(); 
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    initCarrierImageSelector();
    initEncryptFileSelection(); // 初始化待加密文件的选择逻辑
});
