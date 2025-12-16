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
    const SIZE_BASIS_SELECT = document.getElementById('mirageSizeBasis');
    const SCALE_STRATEGY_SELECT = document.getElementById('mirageScaleStrategy');


    // 检查元素是否存在
    if (!MSG_ELEMENT || !CANVAS_ELEMENT || !WHITE_FILE_INPUT || !BLACK_FILE_INPUT || !PREVIEW_CANVAS || !DOWNLOAD_BUTTON || !GENERATE_BUTTON || !SIZE_BASIS_SELECT || !SCALE_STRATEGY_SELECT) return; 

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

    // ... (loadImage 函数保持不变)
    
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
     * @param {string} scaleStrategy - 'stretch' 或 'fit' (新增参数)
     * @returns {Float32Array}
     */
    function imageToFloat32Array(img, width, height, scaleStrategy) {
        CANVAS_ELEMENT.width = width;
        CANVAS_ELEMENT.height = height;
        CTX.clearRect(0, 0, width, height);

        if (scaleStrategy === 'fit') {
            // 居中填充 (保持比例)
            const scale = Math.min(width / img.width, height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (width - w) / 2;
            const y = (height - h) / 2;
            
            // 居中绘制保持比例的图片
            CTX.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);
        } else {
            // 拉伸/缩放 (原有的行为，忽略比例)
            // 强制裁剪/缩放图片到目标尺寸
            CTX.drawImage(img, 0, 0, width, height);
        }

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

        if (!whiteFile || !blackFile) {
            showMessage("请确保两张图片都已选择。", true);
            return;
        }

        try {
            const imgW = await loadImage(whiteFile);
            const imgB = await loadImage(blackFile);
            
            // ⭐ 读取新参数
            const sizeBasis = SIZE_BASIS_SELECT.value; // 'white' 或 'black'
            const scaleStrategy = SCALE_STRATEGY_SELECT.value; // 'stretch' 或 'fit'

            let width = 0;
            let height = 0;
            
            // 1. 确定输出尺寸
            let imgBaseName = '';
            if (sizeBasis === 'white') {
                width = imgW.width;
                height = imgW.height;
                imgBaseName = '白底图 (A)';
            } else { // sizeBasis === 'black'
                width = imgB.width;
                height = imgB.height;
                imgBaseName = '黑底图 (B)';
            }

            // 2. 检查并给出警告
            if (imgW.width !== imgB.width || imgW.height !== imgB.height) {
                showMessage(`警告：两张图片尺寸不一致，将以 '${imgBaseName}' 的尺寸 ${width}x${height} 为准进行处理。`, true);
            }
            
            CANVAS_ELEMENT.width = width;
            CANVAS_ELEMENT.height = height;
            
            const size = width * height;
            
            showMessage(`图片加载成功。正在处理 ${width}x${height} 像素...`);

            let wArr, bArr;
            
            // 3. 根据尺寸基准，决定哪张图需要传入用户选择的 scaleStrategy 参数
            if (sizeBasis === 'white') {
                // imgW 是基准，直接拉伸（如果尺寸不匹配，它已经被确定为目标尺寸）
                wArr = imageToFloat32Array(imgW, width, height, 'stretch'); 
                // imgB 是被处理图，使用用户选择的策略
                bArr = imageToFloat32Array(imgB, width, height, scaleStrategy); 
            } else { // sizeBasis === 'black'
                // imgW 是被处理图，使用用户选择的策略
                wArr = imageToFloat32Array(imgW, width, height, scaleStrategy);
                // imgB 是基准，直接拉伸
                bArr = imageToFloat32Array(imgB, width, height, 'stretch'); 
            }


            const resultImageData = CTX.createImageData(width, height);
            const resultData = resultImageData.data;

            // 核心像素处理逻辑 (保持不变)
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
        setTimeout(() => {
            generatedDataURL = CANVAS_ELEMENT.toDataURL("image/png");
            
            // 2. 预览：调整预览画布尺寸，并复制图像数据
            PREVIEW_CANVAS.width = width;
            PREVIEW_CANVAS.height = height;
            PREVIEW_CTX.drawImage(CANVAS_ELEMENT, 0, 0, width, height, 0, 0, width, height);
            
            // 3. 显示结果区域，启用下载按钮
            PREVIEW_SECTION.style.display = 'block';
            setDownloadButtonState(true);
            
            showMessage("✅ 制作完成！请点击下载按钮。\n请在白底和黑底背景下测试。", false);
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
