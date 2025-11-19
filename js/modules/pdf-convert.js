// js/modules/pdf-convert.js
const { jsPDF } = window.jspdf;

document.addEventListener('DOMContentLoaded', () => {
    // Tab 切换
    document.querySelectorAll('.pdf-tools-tabs button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pdf-tools-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.pdf-tab').forEach(tab => tab.classList.remove('active'));
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // ====================== 图片 → PDF ======================
    const imgFiles = [];
    const imgThumbsContainer = document.getElementById('imgThumbs');
    const imgDropzone = document.getElementById('dropzoneImg');
    const imgInput = document.getElementById('imgInput');

    const logImg = msg => document.getElementById('imgLog').innerHTML += `<div>${msg}</div>`;

    // 拖拽上传
    ['dragover', 'dragenter'].forEach(evt => imgDropzone.addEventListener(evt, e => { e.preventDefault(); imgDropzone.style.borderColor = '#60a5fa'; }));
    ['dragleave', 'dragend'].forEach(evt => imgDropzone.addEventListener(evt, () => imgDropzone.style.borderColor = 'rgba(255,255,255,0.06)'));
    imgDropzone.addEventListener('drop', e => {
        e.preventDefault();
        imgDropzone.style.borderColor = 'rgba(255,255,255,0.06)';
        handleFiles(e.dataTransfer.files);
    });
    imgDropzone.addEventListener('click', () => imgInput.click());
    imgInput.addEventListener('change', () => handleFiles(imgInput.files));

    function handleFiles(files) {
        [...files].forEach(file => {
            if (!file.type.startsWith('image/')) return;
            imgFiles.push(file);
            const reader = new FileReader();
            reader.onload = e => {
                const thumb = document.createElement('div');
                thumb.className = 'thumb';
                thumb.innerHTML = `<img src="${e.target.result}"><div>${file.name}<br><small>${(file.size/1024/1024).toFixed(2)} MB</small></div>`;
                imgThumbsContainer.appendChild(thumb);
            };
            reader.readAsDataURL(file);
        });
        logImg(`已添加 ${files.length} 张图片，共 ${imgFiles.length} 张`);
    }

    // 页面尺寸切换
    document.getElementById('pageSize').addEventListener('change', function () {
        const custom = this.value === 'custom';
        document.getElementById('customW').style.display = custom ? 'inline-block' : 'none';
        document.getElementById('customH').style.display = custom ? 'inline-block' : 'none';
    });

    // 生成 PDF
    document.getElementById('generatePdf').addEventListener('click', async () => {
        if (imgFiles.length === 0) return alert('请先上传图片');

        let width = 595, height = 842; // A4 pt
        const size = document.getElementById('pageSize').value;
        if (size === 'letter') { width = 612; height = 792; }
        if (size === 'custom') {
            width = parseInt(document.getElementById('customW').value) || 1080;
            height = parseInt(document.getElementById('customH').value) || 1920;
            width = width * 0.752;   // px → pt (1inch=72pt, 1inch≈96px)
            height = height * 0.752;
        }
        const margin = parseInt(document.getElementById('margin').value) || 0;

        const pdf = new jsPDF({
            orientation: width > height ? 'l' : 'p',
            unit: 'pt',
            format: [width, height]
        });

        logImg('正在生成 PDF...');
        for (let i = 0; i < imgFiles.length; i++) {
            if (i > 0) pdf.addPage();
            const dataUrl = await new Promise(r => {
                const reader = new FileReader();
                reader.onload = () => r(reader.result);
                reader.readAsDataURL(imgFiles[i]);
            });
            pdf.addImage(dataUrl, dataUrl.split(';')[0].slice(5).toUpperCase(), margin, margin, width - margin * 2, height - margin * 2, '', 'FAST');
        }

        const filename = `frey-images-to-pdf-${new Date().getTime()}.pdf`;
        pdf.save(filename);
        logImg(`✅ 生成完成：${filename}`);
    });

    // ====================== PDF → 图片 ======================
    const pdfThumbs = document.getElementById('pdfThumbs');
    const pdfDropzone = document.getElementById('dropzonePdf');
    const pdfInput = document.getElementById('pdfInput');
    let extractedBlobs = [];

    const logPdf = msg => document.getElementById('pdfLog').innerHTML += `<div>${msg}</div>`;

    ['dragover', 'dragenter'].forEach(evt => pdfDropzone.addEventListener(evt, e => { e.preventDefault(); pdfDropzone.style.borderColor = '#60a5fa'; }));
    ['dragleave', 'dragend'].forEach(evt => pdfDropzone.addEventListener(evt, () => pdfDropzone.style.borderColor = 'rgba(255,255,255,0.06)'));
    pdfDropzone.addEventListener('drop', e => {
        e.preventDefault();
        pdfDropzone.style.borderColor = 'rgba(255,255,255,0.06)';
        if (e.dataTransfer.files[0]) processPdf(e.dataTransfer.files[0]);
    });
    pdfDropzone.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', () => processPdf(pdfInput.files[0]));

    async function processPdf(file) {
        pdfThumbs.innerHTML = '';
        extractedBlobs = [];
        logPdf(`正在加载 PDF：${file.name}`);

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport }).promise;

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.95));
            extractedBlobs.push(blob);

            const thumb = document.createElement('div');
            thumb.className = 'thumb';
            thumb.innerHTML = `<img src="${URL.createObjectURL(blob)}"><div>第 ${pageNum} 页</div>`;
            pdfThumbs.appendChild(thumb);
        }
        logPdf(`✅ 提取完成，共 ${pdf.numPages} 页`);
    }

    document.getElementById('extractImages').addEventListener('click', () => {
        if (pdfInput.files[0]) processPdf(pdfInput.files[0]);
    });

    document.getElementById('downloadAllImages').addEventListener('click', async () => {
        if (extractedBlobs.length === 0) return alert('请先提取图片');
        const zip = new JSZip();
        extractedBlobs.forEach((blob, i) => {
            zip.file(`page-${String(i + 1).padStart(3, '0')}.webp`, blob);
        });
        const content = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = `frey-pdf-to-images-${Date.now()}.zip`;
        a.click();
        logPdf('打包下载完成');
    });
});