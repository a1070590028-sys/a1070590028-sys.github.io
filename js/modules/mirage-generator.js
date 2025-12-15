// js/modules/mirage-generator.js (最终优化版)

/**
 * 视觉幻影（Mirage）增强生成器核心逻辑。
 * 该功能用于制作一个在白底上看到图 A，在黑底上看到图 B 的 PNG 图像。
 */
export function initMirageGenerator() {
    const MSG_ELEMENT = document.getElementById('mirage-message');
    // 用于像素处理的隐藏画布
    const CANVAS_ELEMENT = document.getElementById('mirage-canvas'); 
    
    // 获取文件输入和 Dropzone 元素
    const WHITE_FILE_INPUT = document.getElementById('whiteBgFile');
    const BLACK_FILE_INPUT = document.getElementById('blackBgFile');
    const WHITE_DROPZONE = document.getElementById('whiteFileDropzone');
    const BLACK_DROPZONE = document.getElementById('blackFileDropzone');
    
    // ⭐ 按钮和预览区域
    const PREVIEW_SECTION = document.getElementById('mirage-result-preview');
    const PREVIEW_CANVAS = document.getElementById('miragePreviewCanvas');
    const GENERATE_BUTTON = document.getElementById('generateMirageBtn');
    const DOWNLOAD_BUTTON = document.getElementById('downloadMirageBtn');

    // ⭐ 新增参数元素
    const SIZE_BASE_SELECT = document.getElementById('sizeBase');
    const MISMATCH_POLICY_SELECT = document.getElementById('sizeMismatchPolicy');
    const BGA_COLOR_INPUT = document.getElementById('bgAColor');
    const BGB_COLOR_INPUT = document.getElementById('bgBColor');


    // 检查元素是否存在
    if (!MSG_ELEMENT || !CANVAS_ELEMENT || !WHITE_FILE_INPUT || !BLACK_FILE_INPUT || !PREVIEW_CANVAS || !DOWNLOAD_BUTTON || !GENERATE_BUTTON || !SIZE_BASE_SELECT || !MISMATCH_POLICY_SELECT || !BGA_COLOR_INPUT || !BGB_COLOR_INPUT) return; 

    const CTX = CANVAS_ELEMENT.getContext('2d', { willReadFrequently: true });
    const PREVIEW_CTX = PREVIEW_CANVAS.getContext('2d');
    
    let generatedDataURL = null; 
    
    /**
     * 消息提示
     * @param {string} msg 
     * @param {boolean} isError 
     */
    function showMessage(msg, isError = false) {
        // 确保日志框内有内容，至少有一个空格占位
        MSG_ELEMENT.innerHTML = msg || '&nbsp;'; 
        MSG_ELEMENT.style.color = isError ? '#dc3545' : '#28a745';
    }
    
    /**
     * 启用/禁用下载按钮 (仅使用 disabled 属性控制)
     * @param {boolean} enable 
     */
    function setDownloadButtonState(enable) {
        DOWNLOAD_BUTTON.disabled = !enable;
        // 如果您的 CSS 中有针对 disabled 按钮的样式，它会自动应用
    }

    /**
     * 解析 RGB 颜色输入
     * @param {string} input 
     * @returns {[number, number, number]} [R, G, B]
     */
    function parseRgbColor(input) {
        const parts = input.split(',').map(s => parseInt(s.trim(), 10));
        if (parts.length === 3 && parts.every(n => !isNaN(n) && n >= 0 && n <= 255)) {
            return parts;
        }
        // 默认返回白色 (255,255,255) 以防解析失败
        return [255, 255, 255]; 
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
     * 将图片像素数据转为 Float32 数组 (H*W*3)，并应用尺寸策略
     * @param {HTMLImageElement} img 
     * @param {number} targetWidth 目标宽度
     * @param {number} targetHeight 目标高度
     * @param {string} policy 尺寸不一致处理策略 ('stretch' 或 'fill')
     * @param {[number, number, number]} bgColor 空白填充时的背景色 [R, G, B]
     * @returns {Float32Array}
     */
    function imageToFloat32Array(img, targetWidth, targetHeight, policy, bgColor) {
        CANVAS_ELEMENT.width = targetWidth;
        CANVAS_ELEMENT.height = targetHeight;

        // 1. 清空画布，填充背景色 (用于 'fill' 策略的空白区域)
        CTX.fillStyle = `rgb(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]})`;
        CTX.fillRect(0, 0, targetWidth, targetHeight);

        let drawX = 0;
        let drawY = 0;
        let drawW = targetWidth;
        let drawH = targetHeight;

        if (policy === 'fill') {
            const imgRatio = img.width / img.height;
            const targetRatio = targetWidth / targetHeight;

            if (imgRatio > targetRatio) { // 图片更宽，按宽度缩放
                drawH = targetWidth / imgRatio;
                drawW = targetWidth;
                drawY = (targetHeight - drawH) / 2; // 垂直居中
                drawX = 0;
            } else { // 图片更高，按高度缩放
                drawW = targetHeight * imgRatio;
                drawH = targetHeight;
                drawX = (targetWidth - drawW) / 2; // 水平居中
                drawY = 0;
            }
        }
        // 如果 policy 是 'stretch'，则 drawW=targetWidth, drawH=targetHeight，覆盖整个画布

        // 2. 绘制图片 (根据策略缩放/居中)
        CTX.drawImage(img, drawX, drawY, drawW, drawH);

        // 3. 读取像素数据
        const imageData = CTX.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;
        const size = targetWidth * targetHeight;
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
     * 核心幻影图像生成逻辑 - 只负责生成数据
     */
    async function makeMirageEnhanced() {
        showMessage("正在加载图片...");
        
        // 禁用下载按钮和隐藏预览区域
        setDownloadButtonState(false);
        PREVIEW_SECTION.style.display = 'none'; 
        generatedDataURL = null; 
        
        const whiteFile = WHITE_FILE_INPUT.files[0];
        const blackFile = BLACK_FILE_INPUT.files[0];
        const sizeBase = SIZE_BASE_SELECT.value;
        const policy = MISMATCH_POLICY_SELECT.value;
        const bgA = parseRgbColor(BGA_COLOR_INPUT.value);
        const bgB = parseRgbColor(BGB_COLOR_INPUT.value);


        if (!whiteFile || !blackFile) {
            showMessage("请确保两张图片都已选择。", true);
            return;
        }

        try {
            const imgA = await loadImage(whiteFile);
            const imgB = await loadImage(blackFile);
            
            // 确定最终输出的尺寸
            let width, height;
            if (sizeBase === 'A') {
                width = imgA.width;
                height = imgA.height;
            } else { // sizeBase === 'B' (默认)
                width = imgB.width;
                height = imgB.height;
            }

            if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
                showMessage(`警告：两张图片尺寸不一致，将以 '图 ${sizeBase}' 的尺寸 (${width}x${height}) 为基准，并使用 '${policy === 'stretch' ? '拉伸' : '空白填充'}' 策略处理另一张图。`, true);
            }
            
            CANVAS_ELEMENT.width = width;
            CANVAS_ELEMENT.height = height;
            
            const size = width * height;
            
            showMessage(`图片加载成功。正在处理 ${width}x${height} 像素...`);

            // 根据尺寸基准和策略，确定每张图的加载参数
            const wArr = imageToFloat32Array(imgA, width, height, policy, bgA);
            const bArr = imageToFloat32Array(imgB, width, height, policy, bgB);


            const resultImageData = CTX.createImageData(width, height);
            const resultData = resultImageData.data;

            // 核心像素处理逻辑（使用自定义背景色）
            // C_png = (C_bg * (1 - A/255) + C_img * A/255)
            // 目标:
            // 1. 白底 (BG_A) 上显示 W_img (图A)
            //    W_img = BG_A * (1 - A/255) + C_png * A/255
            //    => C_png = (W_img - BG_A) / (A/255) + BG_A
            // 2. 黑底 (BG_B) 上显示 B_img (图B)
            //    B_img = BG_B * (1 - A/255) + C_png * A/255
            //    => C_png = (B_img - BG_B) / (A/255) + BG_B

            // 简化计算，避免浮点数除法，使用近似算法：
            // A/255 接近 1 时，W_img 接近 C_png。A/255 接近 0 时，W_img 接近 BG_A。
            // W_img 和 B_img 之间的差异，主要由 Alpha 通道控制。
            
            for (let i = 0; i < size; i++) {
                const idx3 = i * 3;
                const idx4 = i * 4;

                let minAlpha = 255;
                
                for (let c = 0; c < 3; c++) {
                    const W_pix = wArr[idx3 + c]; // 图 A 像素
                    const B_pix = bArr[idx3 + c]; // 图 B 像素
                    const BG_A_c = bgA[c]; // 图 A 模拟背景色
                    const BG_B_c = bgB[c]; // 图 B 模拟背景色

                    // 为了使结果更清晰，我们通常要求 alpha 因子 (A/255) 在 0.1 到 0.9 之间
                    // A/255 = (W_pix - BG_A_c) / (C_png - BG_A_c) 
                    // A/255 = (B_pix - BG_B_c) / (C_png - BG_B_c) 

                    // 基于 W_pix 和 B_pix 差异计算 Alpha (简化模型)
                    // 使用 B_pix 减去 W_pix 在白底下的“残影”来估计 Alpha
                    // 这里我们继续使用原版优化后的经验公式，确保效果，但替换固定值
                    
                    // 经验公式简化：假设 C_png 约等于 B_pix
                    // W_img ≈ BG_A * (1 - A/255) + B_pix * A/255 
                    // 目标 Alpha (A/255) 越大，W_img 越接近 B_pix (黑底图)

                    // 为了让两图都能清晰显示，需要计算一个能同时满足两个条件的 Alpha
                    // Alpha 越小，越偏向白底图 (W_pix)
                    // Alpha 越大，越偏向黑底图 (B_pix)
                    
                    // 新经验公式（调整以支持自定义背景色）：
                    // 计算出 C_png 使其在 BG_A 下产生 W_pix，在 BG_B 下产生 B_pix
                    // C_png * a/255 - C_png * a/255 * (BG_A_c + BG_B_c) + BG_A_c * (1 - a/255) = W_pix * (BG_B_c) + B_pix * (BG_A_c)
                    
                    // 简单粗暴方法：C_png = B_pix；计算出满足 W_pix 的 Alpha 值
                    
                    let targetAlpha;
                    // 避免除以 0，确保 B_pix 和 BG_A_c 不相等
                    if (Math.abs(B_pix - BG_A_c) > 1) { 
                        // A/255 ≈ (W_pix - BG_A_c) / (B_pix - BG_A_c)
                        targetAlpha = (W_pix - BG_A_c) / (B_pix - BG_A_c) * 255.0;
                    } else {
                        targetAlpha = 0; // 无法计算，设为 0（完全透明）
                    }
                    
                    targetAlpha = Math.max(0, Math.min(255, targetAlpha));
                    
                    // 取三个通道中 Alpha 最小的值，确保所有通道都满足白底图 (W_pix) 的要求
                    if (targetAlpha < minAlpha) {
                        minAlpha = targetAlpha;
                    }
                }
                
                // 最终 Alpha 值
                let alpha = minAlpha;
                
                // 强制 Alpha 在 [1, 255] 之间，避免完全透明或溢出
                alpha = Math.max(1, Math.min(255, alpha));

                const alpha_factor = alpha / 255.0;

                for (let c = 0; c < 3; c++) {
                    const B_pix = bArr[idx3 + c]; // 图 B 像素
                    const BG_B_c = bgB[c]; // 图 B 模拟背景色

                    // 反推出 C_png (PNG 图的 RGB 通道值)
                    // B_pix = BG_B * (1 - A/255) + C_png * A/255
                    // C_png * A/255 = B_pix - BG_B * (1 - A/255)
                    let rgb_channel = (B_pix - BG_B_c * (1.0 - alpha_factor)) / alpha_factor;
                    
                    rgb_channel = Math.max(0, Math.min(255, rgb_channel));
                    
                    resultData[idx4 + c] = Math.round(rgb_channel);
                }
                
                resultData[idx4 + 3] = Math.round(alpha);
            }
            
            // 将结果写入临时 CANVAS_ELEMENT
            CTX.putImageData(resultImageData, 0, 0);

            // 调用处理结果展示和下载的函数
            handleMirageResult(width, height);

        } catch (e) {
            console.error(e);
            showMessage("❌ 处理失败: " + e.message, true);
            // 失败时禁用下载按钮
            setDownloadButtonState(false);
        }
    }
    
    /**
     * 处理生成结果：预览和存储下载链接
     */
    function handleMirageResult(width, height) {
        // 1. 生成 DataURL
        // 延时是为了确保 putImageData 渲染完成
        setTimeout(() => {
            generatedDataURL = CANVAS_ELEMENT.toDataURL("image/png");
            
            // 2. 预览：调整预览画布尺寸，并复制图像数据
            // 限制预览图的最大尺寸，保持美观
            const maxPreviewSize = 190;
            let previewW = width;
            let previewH = height;
            
            if (width > maxPreviewSize || height > maxPreviewSize) {
                 const scale = Math.min(maxPreviewSize / width, maxPreviewSize / height);
                 previewW = width * scale;
                 previewH = height * scale;
            }
            
            PREVIEW_CANVAS.width = previewW;
            PREVIEW_CANVAS.height = previewH;
            
            // 绘制到预览画布，实现缩放
            PREVIEW_CTX.drawImage(CANVAS_ELEMENT, 0, 0, width, height, 0, 0, previewW, previewH);
            
            // 3. 显示结果区域，启用下载按钮
            PREVIEW_SECTION.style.display = 'block';
            setDownloadButtonState(true);
            
            showMessage("✅ 制作完成！请点击下载按钮。\n请在前景图 A 模拟底色和背景图 B 模拟底色下测试。", false);
        }, 50);
    }
    
    /**
     * 下载生成的 PNG 文件
     */
    function downloadMirage() {
        if (!generatedDataURL) {
            showMessage("❌ 错误：未找到生成的图片数据，请先点击生成按钮。", true);
            return;
        }
        
        const link = document.createElement('a');
        link.href = generatedDataURL;
        link.download = 'mirage_enhanced_result.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showMessage("📥 文件已开始下载。", false);
    }


    // ==========================================================
    // 通用 Dropzone 激活逻辑 (保持不变)
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
                fileInputElement.files = e.dataTransfer.files;
                fileInputElement.dispatchEvent(new Event('change'));
                
                const title = dropzoneElement.querySelector('.dropzone-title');
                if (title) {
                    title.textContent = `已选择: ${e.dataTransfer.files[0].name}`;
                }
            }
        });
        
        // 5. 监听 input 变化
        fileInputElement.addEventListener('change', () => {
            const title = dropzoneElement.querySelector('.dropzone-title');
            if (title && fileInputElement.files.length > 0) {
                 title.textContent = `已选择: ${fileInputElement.files[0].name}`;
            } else if (title) {
                 title.textContent = `拖拽或点击上传图片`; // 重置
            }
        });
    }

    // 激活 Dropzone
    activateDropzone(WHITE_DROPZONE, WHITE_FILE_INPUT);
    activateDropzone(BLACK_DROPZONE, BLACK_FILE_INPUT);
    
    // 绑定按钮事件
    GENERATE_BUTTON.onclick = makeMirageEnhanced;
    DOWNLOAD_BUTTON.onclick = downloadMirage; 
    
    // 首次运行时确保下载按钮是禁用的，日志框是空的
    setDownloadButtonState(false);
    showMessage("");
}

// 在模块加载时自动运行初始化函数
document.addEventListener('DOMContentLoaded', initMirageGenerator);
