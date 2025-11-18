// js/modules/image-compress.js
(() => {
    const fileInput        = document.getElementById('fileInput');
    const dropzone         = document.getElementById('dropzone');
    const thumbs           = document.getElementById('thumbs');
    const countEl          = document.getElementById('count');
    const compressBtn      = document.getElementById('compressBtn');
    const clearBtn         = document.getElementById('clearBtn');
    const downloadAllBtn   = document.getElementById('downloadAllBtn');
    const logEl            = document.getElementById('log');
    const maxSideInput     = document.getElementById('maxSide');
    const maxSizeMBInput   = document.getElementById('maxSizeMB');
    const outFormatSelect  = document.getElementById('outFormat');
    const qualityRange     = document.getElementById('quality');
    const qualityVal       = document.getElementById('qualityVal');
    const useWorker        = document.getElementById('useWorker');
    const onlyConvertCheck = document.getElementById('onlyConvert');

    const compressControls = document.querySelector('.controls');

    let files = [];

    function log(msg) {
        const div = document.createElement('div');
        div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logEl.prepend(div);
    }

    function bytesToSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }

    function reset() {
        files = [];
        thumbs.innerHTML = '';
        countEl.textContent = '0';
        logEl.innerHTML = '';
    }

    function toggleCompressControls() {
        if (onlyConvertCheck.checked) {
            compressControls.classList.add('compress-controls-disabled');
        } else {
            compressControls.classList.remove('compress-controls-disabled');
        }
    }

    // 无损格式转换（仅使用 canvas）
    async function convertOnly(file, mimeType) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;

        return new Promise((resolve, reject) => {
            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(resolve, mimeType, 1.0);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('图片加载失败'));
            };
        });
    }

    function handleFiles(selectedFiles) {
        const imageFiles = Array.from(selectedFiles).filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif|bmp|tiff?|heic)$/i.test(f.name));
        if (imageFiles.length === 0) {
            log('没有检测到图片文件');
            return;
        }

        imageFiles.forEach(f => {
            const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            files.push({ file: f, id, resultBlob: null });

            const reader = new FileReader();
            reader.onload = e => {
                const box = document.createElement('div');
                box.className = 'thumb';
                box.id = 'thumb_' + id;
                box.innerHTML = `
                    <img src="${e.target.result}" alt="${f.name}">
                    <div style="font-weight:600">${f.name}</div>
                    <div class="small">原始：${bytesToSize(f.size)}</div>
                    <div class="small" id="res_${id}" style="margin-top:6px"></div>
                `;
                thumbs.appendChild(box);
            };
            reader.readAsDataURL(f);
        });

        countEl.textContent = files.length;
        log(`已添加 ${imageFiles.length} 张图片`);
    }

    // ==================== 事件绑定 ====================
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
        handleFiles(e.target.files);
        fileInput.value = '';
    });

    ['dragover', 'dragenter'].forEach(evt => {
        dropzone.addEventListener(evt, e => {
            e.preventDefault();
            dropzone.style.borderColor = '#60a5fa';
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, e => {
            e.preventDefault();
            dropzone.style.borderColor = 'rgba(255,255,255,0.06)';
        });
    });

    dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

    clearBtn.addEventListener('click', () => {
        reset();
        log('已清空所选文件');
    });

    qualityRange.addEventListener('input', () => {
        qualityVal.textContent = qualityRange.value;
    });

    onlyConvertCheck.addEventListener('change', toggleCompressControls);
    toggleCompressControls(); // 初始化

    // ==================== 开始处理 ====================
    compressBtn.addEventListener('click', async () => {
        if (files.length === 0) {
            log('请先选择图片');
            return;
        }

        compressBtn.disabled = true;
        downloadAllBtn.disabled = true;
        log(onlyConvertCheck.checked ? '开始批量转换格式…' : '开始压缩所有图片…');

        const zip = new JSZip();

        for (const item of files) {
            const file = item.file;
            const beforeSize = file.size;

            const selectedFormat = outFormatSelect.value;
            let mimeType = file.type;
            let ext = '';

            switch (selectedFormat) {
                case 'jpeg': mimeType = 'image/jpeg'; ext = '.jpg'; break;
                case 'png':  mimeType = 'image/png';  ext = '.png'; break;
                case 'webp': mimeType = 'image/webp'; ext = '.webp'; break;
                case 'avif': mimeType = 'image/avif'; ext = '.avif'; break;
            }

            const outName = selectedFormat === 'original'
                ? file.name
                : file.name.replace(/\.[^/.]+$/, '') + ext;

            try {
                let outputBlob;

                if (onlyConvertCheck.checked) {
                    log(`正在转换：${file.name} → ${outName}`);
                    outputBlob = await convertOnly(file, mimeType);
                } else {
                    const options = {
                        maxWidthOrHeight: parseInt(maxSideInput.value) || 1024,
                        maxSizeMB: parseFloat(maxSizeMBInput.value) || 1,
                        useWebWorker: useWorker.checked,
                        initialQuality: parseFloat(qualityRange.value) || 0.8,
                        fileType: selectedFormat === 'original' ? undefined : mimeType
                    };
                    log(`正在压缩：${file.name}`);
                    outputBlob = await imageCompression(file, options);
                }

                item.resultBlob = outputBlob;
                const afterSize = outputBlob.size;
                const savePercent = ((1 - afterSize / beforeSize) * 100).toFixed(1);

                const resEl = document.getElementById('res_' + item.id);
                if (resEl) {
                    if (onlyConvertCheck.checked) {
                        resEl.innerHTML = `转换后：${bytesToSize(afterSize)}<br><span class="small">大小变化 ${savePercent}%</span>`;
                    } else {
                        resEl.innerHTML = `压缩后：${bytesToSize(afterSize)}<br><span class="small">节省 ${savePercent}%</span>`;
                    }
                }

                zip.file(outName, outputBlob);
                addSingleDownloadButton(item.id, outName, outputBlob);

                log(`✔ ${file.name} → ${outName}（${bytesToSize(afterSize)}）`);
            } catch (err) {
                log(`✖ ${file.name} 处理失败：${err.message || err}`);
            }
        }

        downloadAllBtn.onclick = async () => {
            downloadAllBtn.disabled = true;
            log('正在生成 ZIP 包…');
            try {
                const content = await zip.generateAsync({ type: 'blob' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(content);
                a.download = `${onlyConvertCheck.checked ? 'converted' : 'compressed'}_images_${Date.now()}.zip`;
                a.click();
                URL.revokeObjectURL(a.href);
                log('ZIP 包下载完成');
            } catch (e) {
                log('生成 ZIP 失败：' + e);
            } finally {
                downloadAllBtn.disabled = false;
            }
        };

        compressBtn.disabled = false;
        downloadAllBtn.disabled = false;
        log('全部处理完成！');
    });

    function addSingleDownloadButton(id, name, blob) {
        const thumb = document.getElementById('thumb_' + id);
        if (!thumb) return;

        let btn = thumb.querySelector('.btn-download');
        if (!btn) {
            btn = document.createElement('button');
            btn.textContent = '下载';
            btn.className = 'btn btn-download';
            thumb.appendChild(btn);
        }
        btn.onclick = () => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name;
            a.click();
            URL.revokeObjectURL(a.href);
        };
    }
})();
