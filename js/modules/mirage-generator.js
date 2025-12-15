// js/modules/mirage-generator.js

/**
 * 视觉幻影（Mirage）增强生成器核心逻辑。
 * 该功能用于制作一个在白底上看到图 A，在黑底上看到图 B 的 PNG 图像。
 */
export function initMirageGenerator() {
    const MSG_ELEMENT = document.getElementById('mirage-message');
    const CANVAS_ELEMENT = document.getElementById('mirage-canvas');

    // 检查元素是否存在，防止在其他页面报错
    if (!MSG_ELEMENT || !CANVAS_ELEMENT) return; 

    const CTX = CANVAS_ELEMENT.getContext('2d', { willReadFrequently: true });
    
    /**
     * 消息提示
     * @param {string} msg 
     * @param {boolean} isError 
     */
    function showMessage(msg, isError = false) {
        MSG_ELEMENT.textContent = msg;
        MSG_ELEMENT.style.color = isError ? '#dc3545' : '#28a745';
        MSG_ELEMENT.style.display = 'block'; // 确保消息显示
    }
    
    /**
     * 加载并返回 Image 对象
     * @param {File} file 
     * @returns {Promise<HTMLImageElement>}
     */
    function loadImage(file) {
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
        showMessage("正在加载图片...");
        const whiteFile = document.getElementById('whiteBgFile').files[0];
        const blackFile = document.getElementById('blackBgFile').files[0];

        if (!whiteFile || !blackFile) {
            showMessage("请确保两张图片都已选择。", true);
            return;
        }

        try {
            const imgW = await loadImage(whiteFile);
            const imgB = await loadImage(blackFile);

            // 检查尺寸是否相同，否则使用较小的尺寸
            let width = imgW.width;
            let height = imgW.height;

            if (imgW.width !== imgB.width || imgW.height !== imgB.height) {
                showMessage("警告：两张图片尺寸不一致，将以 '白底图' 的尺寸为准进行缩放。", true);
                // 默认以 imgW 的尺寸为准
                // 可以添加更复杂的逻辑，例如取最小公约数，但此处保持原逻辑的简单处理
            }
            
            const size = width * height;
            
            showMessage(`图片加载成功。正在处理 ${width}x${height} 像素...`);

            // 统一尺寸并转为 Float32 数组 (H*W*3)
            const wArr = imageToFloat32Array(imgW, width, height);
            const bArr = imageToFloat32Array(imgB, width, height);

            // 初始化结果 ImageData
            const resultImageData = CTX.createImageData(width, height);
            const resultData = resultImageData.data;

            // --- 核心数学逻辑（RGB 三通道并行） ---

            for (let i = 0; i < size; i++) {
                const idx3 = i * 3; // 3通道 (R, G, B) 索引
                const idx4 = i * 4; // 4通道 (R, G, B, A) 索引

                let maxDiff = 0;
                
                // 循环处理 R, G, B 三个通道
                for (let c = 0; c < 3; c++) {
                    const w_pix = wArr[idx3 + c];
                    const b_pix = bArr[idx3 + c];

                    // 1. 兼容性增强：明度强力压缩 (与 Python 逻辑一致)
                    const b_arr_compressed = b_pix * (100.0 / 255.0);
                    const w_arr_compressed = (w_pix * (105.0 / 255.0)) + 150.0;
                    
                    // 2. 计算差异值，并找到最大的差异值
                    const diff = w_arr_compressed - b_arr_compressed;
                    if (diff > maxDiff) {
                        maxDiff = diff;
                    }
                    
                    // 存储压缩后的黑底图值，用于后续计算 RGB
                    bArr[idx3 + c] = b_arr_compressed; 
                }
                
                // 3. Alpha 通道计算: Alpha = 255 - max_diff
                let alpha = 255.0 - maxDiff;
                alpha = Math.max(1, Math.min(255, alpha)); // 钳位到 [1, 255]

                // 4. 计算 RGB 通道： RGB = B' / (Alpha / 255)
                const alpha_factor = alpha / 255.0; // 必然大于等于 1/255

                for (let c = 0; c < 3; c++) {
                    const b_arr_compressed = bArr[idx3 + c];
                    
                    let rgb_channel = b_arr_compressed / alpha_factor;
                    
                    // 5. 最终钳位处理并写入结果
                    rgb_channel = Math.max(0, Math.min(255, rgb_channel));
                    
                    resultData[idx4 + c] = Math.round(rgb_channel); // R, G, B
                }
                
                // 写入 Alpha 通道
                resultData[idx4 + 3] = Math.round(alpha); // A
            }
            
            // 6. 绘制结果并下载
            CANVAS_ELEMENT.width = width;
            CANVAS_ELEMENT.height = height;
            CTX.putImageData(resultImageData, 0, 0);

            // 使用 setTimeout 确保浏览器有时间渲染 Canvas
            setTimeout(() => {
                const dataURL = CANVAS_ELEMENT.toDataURL("image/png");
                
                // 触发下载
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

    // 绑定事件
    document.getElementById('startMirageBtn').onclick = makeMirageEnhanced;
}

// 在模块加载时自动运行初始化函数
document.addEventListener('DOMContentLoaded', initMirageGenerator);
