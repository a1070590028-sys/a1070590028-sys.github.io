// js/modules/mirage-generator.js (修改版)

/**
 * 视觉幻影（Mirage）增强生成器核心逻辑。
 * 该功能用于制作一个在白底上看到图 A，在黑底上看到图 B 的 PNG 图像。
 */
export function initMirageGenerator() {
    const MSG_ELEMENT = document.getElementById('mirage-message');
    const CANVAS_ELEMENT = document.getElementById('mirage-canvas');
    
    // ⭐ NEW: 获取文件输入和 Dropzone 元素
    const WHITE_FILE_INPUT = document.getElementById('whiteBgFile');
    const BLACK_FILE_INPUT = document.getElementById('blackBgFile');
    const WHITE_DROPZONE = document.getElementById('whiteFileDropzone');
    const BLACK_DROPZONE = document.getElementById('blackFileDropzone');

    // 检查元素是否存在，防止在其他页面报错
    if (!MSG_ELEMENT || !CANVAS_ELEMENT || !WHITE_FILE_INPUT || !BLACK_FILE_INPUT) return; 

    const CTX = CANVAS_ELEMENT.getContext('2d', { willReadFrequently: true });
    
    /**
     * 消息提示
     * @param {string} msg 
     * @param {boolean} isError 
     */
    function showMessage(msg, isError = false) {
        MSG_ELEMENT.textContent = msg;
        MSG_ELEMENT.style.color = isError ? '#dc3545' : '#28a745';
        MSG_ELEMENT.style.display = 'block';
    }
    
    /**
     * 加载并返回 Image 对象
     * @param {File} file 
     * @returns {Promise<HTMLImageElement>}
     */
    function loadImage(file) {
        // ... (loadImage 函数保持不变，与您之前提供的代码一致)
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error("未选择文件。"));
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error("图片加载失败。"));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error("文件读取失败。"));
            reader.readAsDataURL(file);
        });
    }

    /**
     * 将图片像素数据转为 Float32 数组 (H*W*3)
     * @param {HTMLImageElement} img 
     * @param {number} width 
     * @param {number} height 
     * @returns {Float32Array}
     */
    function imageToFloat32Array(img, width, height) {
        // ... (imageToFloat32Array 函数保持不变)
        CANVAS_ELEMENT.width = width;
        CANVAS_ELEMENT.height = height;
        CTX.clearRect(0, 0, width, height);
        // 强制裁剪/缩放图片到目标尺寸
        CTX.drawImage(img, 0, 0, width, height);

        const imageData = CTX.getImageData(0, 0, width, height);
        const data = imageData.data;
        const size = width * height;
        const floatArray = new Float32Array(size * 3); // R, G, B

        for (let i = 0; i < size; i++) {
            // 从 RGBA 数组中取出 R, G, B
            floatArray[i * 3 + 0] = data[i * 4 + 0]; // R
            floatArray[i * 3 + 1] = data[i * 4 + 1]; // G
            floatArray[i * 3 + 2] = data[i * 4 + 2]; // B
            // 忽略 Alpha 通道
        }
        return floatArray;
    }


    /**
     * 核心幻影图像生成逻辑
     */
    async function makeMirageEnhanced() {
        // ... (makeMirageEnhanced 函数保持不变)
        showMessage("正在加载图片...");
        const whiteFile = WHITE_FILE_INPUT.files[0];
        const blackFile = BLACK_FILE_INPUT.files[0];
        // ... (接下来的逻辑保持不变)
        if (!whiteFile || !blackFile) {
            showMessage("请确保两张图片都已选择。", true);
            return;
        }

        try {
            const imgW = await loadImage(whiteFile);
            const imgB = await loadImage(blackFile);
            
            // ... (核心处理逻辑不变)
            let width = imgW.width;
            let height = imgW.height;

            if (imgW.width !== imgB.width || imgW.height !== imgB.height) {
                showMessage("警告：两张图片尺寸不一致，将以 '白底图' 的尺寸为准进行缩放。", true);
            }
            
            const size = width * height;
            
            showMessage(`图片加载成功。正在处理 ${width}x${height} 像素...`);

            const wArr = imageToFloat32Array(imgW, width, height);
            const bArr = imageToFloat32Array(imgB, width, height);

            const resultImageData = CTX.createImageData(width, height);
            const resultData = resultImageData.data;

            for (let i = 0; i < size; i++) {
                const idx3 = i * 3;
                const idx4 = i * 4;

                let maxDiff = 0;
                
                for (let c = 0; c < 3; c++) {
                    const w_pix = wArr[idx3 + c];
                    const b_pix = bArr[idx3 + c];

                    const b_arr_compressed = b_pix * (100.0 / 255.0);
                    const w_arr_compressed = (w_pix * (105.0 / 255.0)) + 150.0;
                    
                    const diff = w_arr_compressed - b_arr_compressed;
                    if (diff > maxDiff) {
                        maxDiff = diff;
                    }
                    
                    bArr[idx3 + c] = b_arr_compressed; 
                }
                
                let alpha = 255.0 - maxDiff;
                alpha = Math.max(1, Math.min(255, alpha));

                const alpha_factor = alpha / 255.0;

                for (let c = 0; c < 3; c++) {
                    const b_arr_compressed = bArr[idx3 + c];
                    
                    let rgb_channel = b_arr_compressed / alpha_factor;
                    
                    rgb_channel = Math.max(0, Math.min(255, rgb_channel));
                    
                    resultData[idx4 + c] = Math.round(rgb_channel);
                }
                
                resultData[idx4 + 3] = Math.round(alpha);
            }
            
            CANVAS_ELEMENT.width = width;
            CANVAS_ELEMENT.height = height;
            CTX.putImageData(resultImageData, 0, 0);

            setTimeout(() => {
                const dataURL = CANVAS_ELEMENT.toDataURL("image/png");
                
                const link = document.createElement('a');
                link.href = dataURL;
                link.download = 'mirage_enhanced_result.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showMessage("✅ 制作完成！文件已开始下载。\n请在白底和黑底背景下测试。", false);
            }, 50);


        } catch (e) {
            console.error(e);
            showMessage("❌ 处理失败: " + e.message, true);
        }
    }


    // ==========================================================
    // ⭐ NEW: 通用 Dropzone 激活逻辑 ⭐
    // ==========================================================

    /**
     * 激活 Dropzone 功能
     * @param {HTMLElement} dropzoneElement Dropzone 区域
     * @param {HTMLInputElement} fileInputElement 对应的 file input
     */
    function activateDropzone(dropzoneElement, fileInputElement) {
        // 1. 点击激活
        dropzoneElement.addEventListener('click', () => {
            fileInputElement.click();
        });

        // 2. 拖拽文件进入
        dropzoneElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneElement.style.borderColor = 'var(--accent)';
        });

        // 3. 拖拽文件离开/结束
        dropzoneElement.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneElement.style.borderColor = 'var(--border)';
        });

        // 4. 放置文件
        dropzoneElement.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneElement.style.borderColor = 'var(--border)';

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                // 将拖放的文件设置给 input 元素
                fileInputElement.files = e.dataTransfer.files;
                // 可选：触发一个 change 事件来更新 UI 或启动处理
                fileInputElement.dispatchEvent(new Event('change'));
                
                // 提示用户文件已上传（可选：更改 dropzone 标题）
                const title = dropzoneElement.querySelector('.dropzone-title');
                if (title) {
                    title.textContent = `已选择: ${e.dataTransfer.files[0].name}`;
                }
            }
        });
        
        // 5. 监听 input 变化，用于更新 dropzone 标题（用户点击上传或拖拽后）
        fileInputElement.addEventListener('change', () => {
            const title = dropzoneElement.querySelector('.dropzone-title');
            if (title && fileInputElement.files.length > 0) {
                 title.textContent = `已选择: ${fileInputElement.files[0].name}`;
            } else if (title) {
                 title.textContent = `拖拽或点击上传图片`; // 重置
            }
        });
    }

    // 激活两个 Dropzone
    activateDropzone(WHITE_DROPZONE, WHITE_FILE_INPUT);
    activateDropzone(BLACK_DROPZONE, BLACK_FILE_INPUT);
    
    // 绑定开始按钮事件
    document.getElementById('startMirageBtn').onclick = makeMirageEnhanced;
}

// 在模块加载时自动运行初始化函数
document.addEventListener('DOMContentLoaded', initMirageGenerator);
