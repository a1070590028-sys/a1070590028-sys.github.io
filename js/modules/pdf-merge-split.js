// js/modules/pdf-merge-split.js

// === 公共方法 ===
function logMsg(elementId, msg) {
    const logEl = document.getElementById(elementId);
    logEl.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${msg}</div>`;
    logEl.scrollTop = logEl.scrollHeight;
}

function clearLog(elementId) {
    document.getElementById(elementId).innerHTML = '';
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ======================= 合并 PDF 逻辑 =======================
let mergeFiles = [];

const dropzoneMerge = document.getElementById('dropzonePdfMerge');
const mergeInput = document.getElementById('pdfMergeInput');
const mergeListContainer = document.getElementById('pdfMergeList');
const mergeCountEl = document.getElementById('pdfMergeCount');

if (dropzoneMerge && mergeInput) {
    dropzoneMerge.addEventListener('click', () => mergeInput.click());
    dropzoneMerge.addEventListener('dragover', e => { e.preventDefault(); dropzoneMerge.style.borderColor = 'var(--accent)'; });
    dropzoneMerge.addEventListener('dragleave', () => dropzoneMerge.style.borderColor = 'var(--border)');
    dropzoneMerge.addEventListener('drop', e => {
        e.preventDefault();
        dropzoneMerge.style.borderColor = 'var(--border)';
        handleMergeFiles(e.dataTransfer.files);
    });
    mergeInput.addEventListener('change', e => handleMergeFiles(e.target.files));
}

function handleMergeFiles(files) {
    for (let file of files) {
        if (file.type === 'application/pdf') {
            mergeFiles.push(file);
        }
    }
    updateMergeUI();
}

// ⭐ 核心升级：优雅截断防挤压版本 (修复长文件名破坏 UI 问题)
function updateMergeUI() {
    if (!mergeCountEl || !mergeListContainer) return;
    mergeCountEl.innerText = mergeFiles.length;
    mergeListContainer.innerHTML = '';
    
    // 恢复垂直滚动，关闭横向滚动
    mergeListContainer.style.overflowY = 'auto';
    mergeListContainer.style.overflowX = 'hidden';
    
    if (mergeFiles.length === 0) {
        mergeListContainer.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:10px;">列表为空，请上传 PDF 文件</div>';
        return;
    }

    mergeFiles.forEach((file, index) => {
        // 创建列表项容器
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px 10px';
        item.style.marginBottom = '6px';
        item.style.background = 'rgba(255,255,255,0.03)';
        item.style.border = '1px solid var(--border)';
        item.style.borderRadius = '8px';
        item.style.transition = 'all 0.2s';
        item.style.width = '100%'; // 限制最大宽度
        item.style.boxSizing = 'border-box';

        // 文件信息文本
        const infoSpan = document.createElement('span');
        const fullText = `${index + 1}. ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
        infoSpan.innerText = fullText;
        infoSpan.title = fullText; // 鼠标悬浮时显示完整文本

        // 【关键修复核心】让文本容器在空间不足时优雅截断
        infoSpan.style.flex = '1 1 0%'; // 允许收缩
        infoSpan.style.minWidth = '0';  // 打破 flex 子元素的最小宽度限制（关键！）
        infoSpan.style.whiteSpace = 'nowrap'; // 不换行
        infoSpan.style.overflow = 'hidden'; // 隐藏超出部分
        infoSpan.style.textOverflow = 'ellipsis'; // 显示省略号
        infoSpan.style.marginRight = '12px'; // 和右侧按钮保持距离
        infoSpan.style.fontSize = '13px';

        // 按钮容器
        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '6px';
        // 【关键修复核心】死保按钮容器不被压缩
        actionsDiv.style.flex = '0 0 auto'; 

        // 通用按钮生成函数
        const createBtn = (text, onClick, disabled = false, isDanger = false) => {
            const btn = document.createElement('button');
            btn.innerHTML = text;
            btn.style.padding = '2px 8px';
            btn.style.fontSize = '12px';
            btn.style.border = isDanger ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border)';
            btn.style.background = isDanger ? 'rgba(239,68,68,0.1)' : 'transparent';
            btn.style.color = isDanger ? '#fca5a5' : 'var(--text)';
            btn.style.borderRadius = '4px';
            btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
            btn.style.opacity = disabled ? '0.3' : '1';
            btn.style.transition = 'all 0.2s';
            
            if (!disabled) {
                btn.onclick = onClick;
                btn.onmouseover = () => {
                    btn.style.background = isDanger ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)';
                    btn.style.borderColor = isDanger ? 'rgba(239,68,68,0.6)' : 'var(--accent)';
                };
                btn.onmouseout = () => {
                    btn.style.background = isDanger ? 'rgba(239,68,68,0.1)' : 'transparent';
                    btn.style.borderColor = isDanger ? 'rgba(239,68,68,0.4)' : 'var(--border)';
                };
            }
            return btn;
        };

        // 上移按钮 (如果是第一个则禁用)
        const upBtn = createBtn('↑', () => {
            [mergeFiles[index - 1], mergeFiles[index]] = [mergeFiles[index], mergeFiles[index - 1]];
            updateMergeUI();
        }, index === 0);

        // 下移按钮 (如果是最后一个则禁用)
        const downBtn = createBtn('↓', () => {
            [mergeFiles[index], mergeFiles[index + 1]] = [mergeFiles[index + 1], mergeFiles[index]];
            updateMergeUI();
        }, index === mergeFiles.length - 1);

        // 删除按钮
        const delBtn = createBtn('✕', () => {
            mergeFiles.splice(index, 1);
            updateMergeUI();
        }, false, true);

        // 组装节点
        actionsDiv.appendChild(upBtn);
        actionsDiv.appendChild(downBtn);
        actionsDiv.appendChild(delBtn);

        item.appendChild(infoSpan);
        item.appendChild(actionsDiv);
        mergeListContainer.appendChild(item);
    });
}

const clearPdfMergeBtn = document.getElementById('clearPdfMergeBtn');
if (clearPdfMergeBtn) {
    clearPdfMergeBtn.addEventListener('click', () => {
        mergeFiles = [];
        updateMergeUI();
        clearLog('pdfMergeLog');
    });
}

const startPdfMergeBtn = document.getElementById('startPdfMergeBtn');
if (startPdfMergeBtn) {
    startPdfMergeBtn.addEventListener('click', async () => {
        if (mergeFiles.length === 0) return alert('请先上传至少一个 PDF 文件。');
        if (!window.PDFLib) return alert('PDF-lib 库未加载，请检查文件是否引入。');

        clearLog('pdfMergeLog');
        logMsg('pdfMergeLog', `开始合并 ${mergeFiles.length} 个文件...`);
        
        try {
            const { PDFDocument } = window.PDFLib;
            const mergedPdf = await PDFDocument.create();

            for (let i = 0; i < mergeFiles.length; i++) {
                const file = mergeFiles[i];
                logMsg('pdfMergeLog', `正在处理: ${file.name}`);
                const arrayBuffer = await file.arrayBuffer();
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            
            let filename = document.getElementById('pdfMergeFilename').value || 'merged_document.pdf';
            if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';
            
            triggerDownload(blob, filename);
            logMsg('pdfMergeLog', `✅ 合并完成！已触发下载。`);
        } catch (err) {
            console.error(err);
            logMsg('pdfMergeLog', `<span style="color:#ef4444">合并失败: ${err.message}</span>`);
        }
    });
}

// ======================= 拆分 PDF 逻辑 =======================
let splitFile = null;
let splitDocInfo = null;

const dropzoneSplit = document.getElementById('dropzonePdfSplit');
const splitInput = document.getElementById('pdfSplitInput');
const splitDetail = document.getElementById('pdfSplitDetail');
const splitBtn = document.getElementById('startPdfSplitBtn');

if (dropzoneSplit && splitInput) {
    dropzoneSplit.addEventListener('click', () => splitInput.click());
    dropzoneSplit.addEventListener('dragover', e => { e.preventDefault(); dropzoneSplit.style.borderColor = 'var(--accent)'; });
    dropzoneSplit.addEventListener('dragleave', () => dropzoneSplit.style.borderColor = 'var(--border)';
    dropzoneSplit.addEventListener('drop', e => {
        e.preventDefault();
        dropzoneSplit.style.borderColor = 'var(--border)';
        if(e.dataTransfer.files.length) loadSplitFile(e.dataTransfer.files[0]);
    });
    splitInput.addEventListener('change', e => {
        if(e.target.files.length) loadSplitFile(e.target.files[0]);
    });
}

async function loadSplitFile(file) {
    if (file.type !== 'application/pdf') return alert('请上传 PDF 文件。');
    splitFile = file;
    clearLog('pdfSplitLog');
    logMsg('pdfSplitLog', `正在读取 ${file.name} ...`);
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const { PDFDocument } = window.PDFLib;
        splitDocInfo = await PDFDocument.load(arrayBuffer);
        
        document.getElementById('pdfSplitName').innerText = file.name;
        document.getElementById('pdfSplitPageCount').innerText = splitDocInfo.getPageCount();
        if(splitDetail) splitDetail.style.display = 'block';
        if(splitBtn) splitBtn.disabled = false;
        logMsg('pdfSplitLog', `读取成功，共 ${splitDocInfo.getPageCount()} 页。`);
    } catch (err) {
        logMsg('pdfSplitLog', `<span style="color:#ef4444">读取失败: ${err.message}</span>`);
    }
}

if (splitBtn) {
    splitBtn.addEventListener('click', async () => {
        if (!splitDocInfo) return;
        const mode = document.getElementById('pdfSplitMode').value;
        const prefix = document.getElementById('pdfSplitFilename').value || 'split_document';
        const totalPages = splitDocInfo.getPageCount();
        const { PDFDocument } = window.PDFLib;

        clearLog('pdfSplitLog');
        
        try {
            if (mode === 'all') {
                logMsg('pdfSplitLog', `模式：逐页拆分。正在打包中...`);
                if (!window.JSZip) throw new Error("JSZip库未加载");
                const zip = new window.JSZip();
                
                for (let i = 0; i < totalPages; i++) {
                    const newPdf = await PDFDocument.create();
                    const [copiedPage] = await newPdf.copyPages(splitDocInfo, [i]);
                    newPdf.addPage(copiedPage);
                    const pdfBytes = await newPdf.save();
                    zip.file(`${prefix}_page_${i+1}.pdf`, pdfBytes);
                }
                
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                triggerDownload(zipBlob, `${prefix}_all.zip`);
                logMsg('pdfSplitLog', `✅ 拆分并打包完成！已触发下载。`);
                
            } else if (mode === 'range') {
                const rangeStr = document.getElementById('pdfSplitRange').value;
                const targetIndices = parseRange(rangeStr, totalPages);
                if (targetIndices.length === 0) throw new Error("页码范围无效或为空。");
                
                logMsg('pdfSplitLog', `模式：按范围提取 (${targetIndices.map(n=>n+1).join(', ')})`);
                const newPdf = await PDFDocument.create();
                const copiedPages = await newPdf.copyPages(splitDocInfo, targetIndices);
                copiedPages.forEach(page => newPdf.addPage(page));
                
                const pdfBytes = await newPdf.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                triggerDownload(blob, `${prefix}_extracted.pdf`);
                logMsg('pdfSplitLog', `✅ 提取完成！已触发下载。`);
            }
        } catch (err) {
            console.error(err);
            logMsg('pdfSplitLog', `<span style="color:#ef4444">拆分出错: ${err.message}</span>`);
        }
    });
}

// 解析页码范围，例如 "1-3,5, 7-9" -> [0, 1, 2, 4, 6, 7, 8]
function parseRange(str, maxPages) {
    if (!str.trim()) return [];
    let indices = new Set();
    const parts = str.split(',');
    for (let part of parts) {
        part = part.trim();
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (start && end && start <= end) {
                for (let i = start; i <= end; i++) {
                    if (i >= 1 && i <= maxPages) indices.add(i - 1);
                }
            }
        } else {
            const num = Number(part);
            if (num >= 1 && num <= maxPages) indices.add(num - 1);
        }
    }
    return Array.from(indices).sort((a,b) => a-b);
}
