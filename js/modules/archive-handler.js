/**
 * 压缩包处理模块 (支持 RAR, 7z, ZIP)
 */

// 1. 导入整个模块对象
import * as LibArchiveModule from '/js/lib/libarchive/libarchive.js';

// 2. 自动识别 Archive 类所在的层级
// 有些版本是 LibArchiveModule.Archive，有些是 LibArchiveModule.default
const Archive = LibArchiveModule.Archive || LibArchiveModule.default || LibArchiveModule;

// 3. 防御性初始化
if (Archive && typeof Archive.init === 'function') {
    Archive.init({
        workerUrl: '/js/lib/libarchive/worker-bundle.js'
    });
    console.log('Archive 引擎初始化成功');
} else if (Archive) {
    console.warn('该版本的 libarchive 可能不需要 init，或者 init 方法不在静态属性上。');
    // 如果没有 init 方法，我们将在 Archive.open 时尝试传入 workerUrl
} else {
    console.error('无法从模块中提取 Archive 对象，请检查 libarchive.js 是否加载正确。');
}

const arcInput = document.getElementById('arcInput');
// ... 剩下的逻辑保持不变 ...
const dropzoneArc = document.getElementById('dropzoneArc');
const arcFileList = document.getElementById('arcFileList');
const arcLog = document.getElementById('arcLog');

// ... 后面的 handleArchive 和 renderFiles 函数保持不变 ...

// 绑定上传事件
dropzoneArc.onclick = () => arcInput.click();

arcInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) handleArchive(file);
};

// 处理档案
async function handleArchive(file) {
    arcLog.innerHTML = `准备解析档案: ${file.name}...`;
    arcFileList.innerHTML = '<div style="text-align:center; padding:50px;">正在调用 Wasm 引擎解析列表...</div>';
    document.getElementById('arcInfoName').innerText = file.name;
    document.getElementById('arcStatus').innerText = '解析中';

    try {
        // 打开档案
        const archive = await Archive.open(file);
        // 获取文件列表数组
        const files = await archive.getFilesArray();
        
        renderFiles(files);
        arcLog.innerHTML = `解析完成：共检测到 ${files.length} 个项目`;
        document.getElementById('arcStatus').innerText = '解析完成';
    } catch (err) {
        console.error(err);
        arcLog.innerHTML = `<span style="color:#f87171">解析失败：${err.message || '文件格式不支持'}</span>`;
        arcFileList.innerHTML = '<div style="text-align:center; padding:50px; color:#f87171;">无法读取此压缩包</div>';
    }
}

// 渲染文件列表
function renderFiles(files) {
    arcFileList.innerHTML = '';
    
    if (files.length === 0) {
        arcFileList.innerHTML = '<div style="text-align:center; padding:40px;">压缩包内无内容</div>';
        return;
    }

    files.forEach(obj => {
        // 过滤空文件夹项
        if (obj.file.size === 0 && obj.path.endsWith('/')) return;

        const row = document.createElement('div');
        row.className = 'small';
        row.style = `
            display: flex; justify-content: space-between; align-items: center;
            padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);
            cursor: pointer; transition: background 0.2s;
        `;
        
        // 鼠标滑过效果
        row.onmouseenter = () => row.style.background = 'rgba(255,255,255,0.05)';
        row.onmouseleave = () => row.style.background = 'transparent';

        const sizeKB = (obj.file.size / 1024).toFixed(1);
        row.innerHTML = `
            <span style="color:var(--text); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📄 ${obj.path}</span>
            <span style="color:var(--text-muted); font-family:monospace; margin-left:10px;">${sizeKB} KB</span>
        `;

        // 点击提取下载
        row.onclick = async () => {
            const originalText = arcLog.innerHTML;
            arcLog.innerHTML = `正在从压缩包提取: ${obj.path}...`;
            try {
                const extractedFile = await obj.extract();
                const url = URL.createObjectURL(extractedFile);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = obj.path.split('/').pop();
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                URL.revokeObjectURL(url);
                arcLog.innerHTML = `提取成功: ${obj.path}`;
            } catch (e) {
                arcLog.innerHTML = `<span style="color:#f87171">提取失败: ${e.message}</span>`;
            }
        };

        arcFileList.appendChild(row);
    });
}
