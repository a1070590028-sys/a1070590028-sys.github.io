// js/modules/pdf-convert.js
const { jsPDF } = window.jspdf;

// 关键：手动指定 worker 路径（解决 90% 的 PDF 加载失败问题）
if (typeof pdfjsLib !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "js/lib/pdf.worker.min.js";
}

document.addEventListener("DOMContentLoaded", () => {
    // ====================== Tab 切换 ======================
    document.querySelectorAll(".pdf-tools-tabs button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".pdf-tools-tabs button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            document.querySelectorAll(".pdf-tab").forEach(tab => tab.style.display = "none");
            document.getElementById(btn.dataset.tab).style.display = "block";
        });
    });

    // ====================== 图片 → PDF ======================
    const imgFiles = [];
    const imgThumbsContainer = document.getElementById("imgThumbs");
    const imgDropzone = document.getElementById("dropzoneImg");
    const imgInput = document.getElementById("imgInput");
    const imgLog = document.getElementById("imgLog");

    const logImg = msg => {
        imgLog.innerHTML += `<div>${new Date().toLocaleTimeString()} ${msg}</div>`;
        imgLog.scrollTop = imgLog.scrollHeight;
    };

    // 拖拽上传
    ["dragover", "dragenter"].forEach(evt =>
        imgDropzone.addEventListener(evt, e => {
            e.preventDefault();
            imgDropzone.style.borderColor = "#60a5fa";
        })
    );
    ["dragleave", "dragend", "drop"].forEach(evt =>
        imgDropzone.addEventListener(evt, e => {
            e.preventDefault();
            imgDropzone.style.borderColor = "rgba(255,255,255,0.06)";
        })
    );
    imgDropzone.addEventListener("drop", e => handleImgFiles(e.dataTransfer.files));
    imgDropzone.addEventListener("click", () => imgInput.click());
    imgInput.addEventListener("change", () => handleImgFiles(imgInput.files));

    function handleImgFiles(files) {
        [...files].filter(f => f.type.startsWith("image/")).forEach(file => {
            imgFiles.push(file);
            const reader = new FileReader();
            reader.onload = e => {
                const thumb = document.createElement("div");
                thumb.className = "thumb";
                thumb.innerHTML = `<img src="${e.target.result}">
                                   <div>${file.name}<br><small>${(file.size/1024/1024).toFixed(2)} MB</small></div>`;
                imgThumbsContainer.appendChild(thumb);
            };
            reader.readAsDataURL(file);
        });
        logImg(`Added ${files.length} images (total ${imgFiles.length})`);
    }

    // 自定义尺寸显示控制
    document.getElementById("pageSize").addEventListener("change", function () {
        const show = this.value === "custom";
        document.getElementById("customW").style.display = show ? "inline-block" : "none";
        document.getElementById("customH").style.display = show ? "inline-block" : "none";
    });

    // 清空列表
    document.getElementById("clearImgList").addEventListener("click", () => {
        imgFiles.length = 0;
        imgThumbsContainer.innerHTML = "";
        imgLog.innerHTML = "";
        imgInput.value = "";
        logImg("Image list cleared");
    });

    // 生成 PDF
    document.getElementById("generatePdf").addEventListener("click", async () => {
        if (imgFiles.length === 0) return alert("Please upload images first");

        let width = 595.28, height = 841.89; // A4 vertical
        const size = document.getElementById("pageSize").value;
        if (size === "a4l") [width, height] = [841.89, 595.28]; // A4 landscape
        else if (size === "letter") { width = 612; height = 792; }
        else if (size === "custom") {
            width = parseFloat(document.getElementById("customW").value) || 1920;
            height = parseFloat(document.getElementById("customH").value) || 1080;
            width *= 72 / 96;   // px → pt
            height *= 72 / 96;
        }
        const margin = parseFloat(document.getElementById("margin").value) || 0;

        const pdf = new jsPDF({
            orientation: width > height ? "l" : "p",
            unit: "pt",
            format: [width, height]
        });

        logImg("Generating PDF...");

        for (let i = 0; i < imgFiles.length; i++) {
            if (i > 0) pdf.addPage();

            const dataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(imgFiles[i]);
            });

            const imgProps = pdf.getImageProperties(dataUrl);
            const pdfWidth = width - margin * 2;
            const pdfHeight = height - margin * 2;

            let drawWidth = pdfWidth;
            let drawHeight = pdfHeight;
            if (imgProps.width / imgProps.height > pdfWidth / pdfHeight) {
                drawHeight = pdfWidth * imgProps.height / imgProps.width;
            } else {
                drawWidth = pdfHeight * imgProps.width / imgProps.height;
            }

            const x = margin + (pdfWidth - drawWidth) / 2;
            const y = margin + (pdfHeight - drawHeight) / 2;

            pdf.addImage(dataUrl, imgProps.fileType.toUpperCase(), x, y, drawWidth, drawHeight, "", "FAST");
        }

        const filename = `frey-images-to-pdf-${Date.now()}.pdf`;
        pdf.save(filename);
        logImg(`PDF generated: ${filename}`);
    });

    // ====================== PDF → 图片 ======================
    const pdfThumbs = document.getElementById("pdfThumbs");
    const pdfDropzone = document.getElementById("dropzonePdf");
    const pdfInput = document.getElementById("pdfInput");
    const pdfLog = document.getElementById("pdfLog");
    let extractedBlobs = [];

    const logPdf = msg => {
        pdfLog.innerHTML += `<div>${new Date().toLocaleTimeString()} ${msg}</div>`;
        pdfLog.scrollTop = pdfLog.scrollHeight;
    };

    ["dragover", "dragenter"].forEach(evt =>
        pdfDropzone.addEventListener(evt, e => {
            e.preventDefault();
            pdfDropzone.style.borderColor = "#60a5fa";
        })
    );
    ["dragleave", "dragend", "drop"].forEach(evt =>
        pdfDropzone.addEventListener(evt, () => pdfDropzone.style.borderColor = "rgba(255,255,255,0.06)")
    );

    pdfDropzone.addEventListener("drop", e => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) processPdf(e.dataTransfer.files[0]);
    });
    pdfDropzone.addEventListener("click", () => pdfInput.click());
    pdfInput.addEventListener("change", () => {
        if (pdfInput.files[0]) processPdf(pdfInput.files[0]);
    });

    async function processPdf(file) {
        pdfThumbs.innerHTML = "";
        extractedBlobs = [];
        logPdf(`Loading PDF: ${file.name}`);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2 });

                const canvas = document.createElement("canvas");
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext("2d");

                await page.render({ canvasContext: ctx, viewport }).promise;

                const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.95));
                extractedBlobs.push(blob);

                const thumb = document.createElement("div");
                thumb.className = "thumb";
                thumb.innerHTML = `<img src="${URL.createObjectURL(blob)}"><div>Page ${i}<br><small>${(blob.size/1024).toFixed(1)} KB</small></div>`;
                pdfThumbs.appendChild(thumb);
            }
            logPdf(`Extracted ${pdf.numPages} pages`);
        } catch (err) {
            logPdf(`Error: ${err.message}`);
            console.error(err);
        }
    }

    document.getElementById("extractImages").addEventListener("click", () => {
        if (!pdfInput.files[0]) return alert("Please upload a PDF file first");
        processPdf(pdfInput.files[0]);
    });

    document.getElementById("clearPdfList").addEventListener("click", () => {
        pdfThumbs.innerHTML = "";
        extractedBlobs = [];
        pdfLog.innerHTML = "";
        pdfInput.value = "";
        logPdf("PDF list cleared");
    });

    document.getElementById("downloadAllImages").addEventListener("click", async () => {
        if (extractedBlobs.length === 0) return alert("Please extract images first");
        const zip = new JSZip();
        extractedBlobs.forEach((blob, i) => {
            zip.file(`page-${String(i + 1).padStart(3, "0")}.webp`, blob);
        });
        const content = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(content);
        a.download = `frey-pdf-to-images-${Date.now()}.zip`;
        a.click();
        logPdf("ZIP download completed");
    });
});
