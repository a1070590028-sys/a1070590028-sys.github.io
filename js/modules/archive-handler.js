/**
 * 压缩包处理模块 (支持 RAR, 7z, ZIP)
 * 依赖: js/lib/libarchive/
 */

// 关键点：必须使用 { Archive } 这种解构赋值的方式引入
import { Archive } from '../lib/libarchive/libarchive.js';

// 动态获取当前项目正确的根路径（兼容本地和 GitHub Pages 子目录）
const getWorkerUrl = () => {
    let path = window.location.pathname;
    
    // 情况1：如果当前 URL 带有 index.html，把它去掉，保留前面的目录
    if (path.endsWith('.html')) {
        path = path.substring(0, path.lastIndexOf('/') + 1);
    } 
    // 情况2：如果是 GitHub Pages 且末尾没有 '/'（例如 ...github.io/my-repo）
    else if (!path.endsWith('/')) {
        path += '/';
    }
    
    // 拼出完整的绝对 URL: https://你的用户名.github.io/你的仓库名/js/lib/libarchive/worker-bundle.js
    return window.location.origin + path + 'js/lib/libarchive/worker-bundle.js';
};

// 初始化
Archive.init({
    // 使用动态计算的路径
    workerUrl: getWorkerUrl(),
});

const arcInput = document.getElementById('arcInput');
const dropzoneArc = document.getElementById('dropzoneArc');
const arcFileList = document.getElementById('arcFileList');
const arcLog = document.getElementById('arcLog');

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
