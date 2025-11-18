// js/modules/image-compress.js
// 立即执行函数，彻底隔离变量，不污染全局
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

    let files = [];   // {file, id, resultBlob}

    // 日志
    function log(msg) {
        const div = document.createElement('div');
        div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logEl.prepend(div);
    }

    // 字节转人类可读
    function bytesToSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }

    // 清空
    function reset() {
        files = [];
        thumbs.innerHTML = '';
        countEl.textContent = '0';
        logEl.innerHTML = '';
    }

    // 处理拖拽与选择的文件
    function handleFiles(selectedFiles) {
        const imageFiles = selectedFiles.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            log('没有检测到图片文件');
            return;
        }

        imageFiles.forEach(f => {
            const id = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
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

    // 事件绑定
    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', e => {
        handleFiles(Array.from(e.target.files));
        fileInput.value = '';
    });

    dropzone.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.style.borderColor = '#60a5fa';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'rgba(255,255,255,0.06)';
    });

    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.style.borderColor = 'rgba(255,255,255,0.06)';
        handleFiles(Array.from(e.dataTransfer.files));
    });

    clearBtn.addEventListener('click', () => {
        reset();
        log('已清空所选文件');
    });

    qualityRange.addEventListener('input', () => {
        qualityVal.textContent = qualityRange.value;
    });

    // 开始压缩
    compressBtn.addEventListener('click', async () => {
        if (files.length === 0) {
            log('请先选择图片');
            return;
        }

        compressBtn.disabled = true;
        downloadAllBtn.disabled = true;
        log('开始压缩所有图片…');

        const zip = new JSZip();

        for (const item of files) {
            const file = item.file;
            const beforeSize = file.size;

            const options = {
                maxWidthOrHeight: parseInt(maxSideInput.value) || 1024,
                maxSizeMB: parseFloat(maxSizeMBInput.value) || 1,
                useWebWorker: useWorker.checked,
                initialQuality: parseFloat(qualityRange.value) || 0.8,
                fileType: outFormatSelect.value === 'original'
                    ? undefined
                    : `image/${outFormatSelect.value === 'jpeg' ? 'jpeg' : outFormatSelect.value}`
            };

            try {
                log(`正在压缩：${file.name}`);
                const compressedBlob = await imageCompression(file, options);

                item.resultBlob = compressedBlob;
                const afterSize = compressedBlob.size;
                const savePercent = ((1 - afterSize / beforeSize) * 100).toFixed(1);

                // 更新缩略图信息
                const resEl = document.getElementById('res_' + item.id);
                if (resEl) {
                    resEl.innerHTML = `压缩后：${bytesToSize(afterSize)}<br><span class="small">节省 ${savePercent}%</span>`;
                }

                // 生成输出文件名
                const outName = outFormatSelect.value === 'original'
                    ? file.name
                    : file.name.replace(/\.[^/.]+$/, '') + (outFormatSelect.value === 'jpeg' ? '.jpg' : '.' + outFormatSelect.value);

                zip.file(outName, compressedBlob);
                addSingleDownloadButton(item.id, outName, compressedBlob);

                log(`✔ ${file.name} → ${outName}（${bytesToSize(afterSize)}，节省 ${savePercent}%）`);
            } catch (err) {
                log(`✖ 处理 ${file.name} 失败：${err.message || err}`);
            }
        }

        // 打包下载按钮（只绑定一次）
        downloadAllBtn.onclick = async () => {
            downloadAllBtn.disabled = true;
            log('正在生成 ZIP 包…');
            try {
                const content = await zip.generateAsync({ type: 'blob' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(content);
                a.download = `compressed_images_${Date.now()}.zip`;
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
        log('全部压缩完成！');
    });

    // 单张下载按钮
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
