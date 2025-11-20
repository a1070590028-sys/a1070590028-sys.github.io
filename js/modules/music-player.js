// js/modules/music-player.js
// 延迟初始化：只有点击左下角按钮时才加载播放器（0 预加载）

let initialized = false;

export function initMusicPlayerOnDemand() {
    if (initialized) {
        // 已经初始化过，只是切换面板显示/隐藏
        const panel = document.getElementById('music-player-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
        }
        return;
    }

    initialized = true;

    // ====================== 开始真正初始化 ======================

    let playlist = [];
    let currentIndex = 0;
    const audio = new Audio();
    let isRandom = false;

    // 创建按钮（左下角，和网络监控完全对称）
    const btn = document.createElement('div');
    btn.id = 'music-player-btn';
    btn.innerHTML = '🎵';
    btn.title = '音乐播放器';
    Object.assign(btn.style, {
        position: 'fixed',
        left: '20px',
        bottom: '20px',
        width: '54px',
        height: '54px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: '99999',
        transition: 'all 0.25s',
        fontSize: '24px',
        userSelect: 'none'
    });
    btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseout  = () => btn.style.transform = '';
    document.body.appendChild(btn);

    // 创建面板
    const panel = document.createElement('div');
    panel.id = 'music-player-panel';
    Object.assign(panel.style, {
        position: 'fixed',
        left: '20px',
        bottom: '90px',
        width: '280px',
        padding: '16px',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(12px)',
        color: '#cfe8ff',
        zIndex: '99999',
        display: 'none',
        flexDirection: 'column',
        gap: '12px',
        fontSize: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
    });
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;font-size:16px;color:#93c5fd">音乐播放器</h3>
            <span id="randomBtn" title="随机播放" style="cursor:pointer;opacity:0.7;font-size:18px">🔀</span>
        </div>
        <div id="songTitle" style="color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            加载中...
        </div>
        <input type="range" id="progress" value="0" max="100" style="width:100%">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8">
            <span id="currentTime">0:00</span>
            <span id="duration">0:00</span>
        </div>
        <div style="display:flex;justify-content:center;gap:20px;">
            <button class="mini-btn">⏮</button>
            <button id="playBtn" class="mini-btn" style="font-size:22px">▶</button>
            <button class="mini-btn">⏭</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">🔈</span>
            <input type="range" id="volume" min="0" max="100" value="70" style="flex:1">
        </div>
    `;
    document.body.appendChild(panel);

    // 注入样式（只执行一次）
    const style = document.createElement('style');
    style.textContent = `
        #music-player-btn:hover { box-shadow: 0 0 14px rgba(96,165,250,0.4); }
        #music-player-panel button.mini-btn {
            width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.1);color:#cfe8ff;cursor:pointer;
            display:flex;align-items:center;justify-content:center;font-size:18px;
        }
        #music-player-panel button.mini-btn:hover {
            background:rgba(96,165,250,0.2);border-color:#60a5fa;
        }
        #music-player-panel input[type=range] {
            -webkit-appearance:none;height:5px;border-radius:3px;background:rgba(255,255,255,0.15);outline:none;
        }
        #music-player-panel input[type=range]::-webkit-slider-thumb {
            -webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:#60a5fa;cursor:pointer;
        }
        #randomBtn.active { opacity:1;color:#60a5fa; }
    `;
    document.head.appendChild(style);

    // 加载播放列表（纯静态，完全兼容 GitHub Pages）
    fetch('music/music-list.json?' + Date.now())  // 防缓存
        .then(r => {
            if (!r.ok) throw new Error('列表加载失败');
            return r.json();
        })
        .then(list => {
            playlist = list.map(f => 'music/' + f);  // 相对路径
            if (playlist.length === 0) {
                document.getElementById('songTitle').textContent = '无音乐文件';
                return;
            }
            loadTrack(0);
            audio.play().catch(() => {}); // 自动播放（浏览器可能拦截）
        })
        .catch(() => {
            document.getElementById('songTitle').textContent = '列表加载失败';
        });

    function loadTrack(i) {
        currentIndex = i;
        const path = playlist[i];
        audio.src = path;
        const name = decodeURIComponent(path.split('/').pop()).replace('.mp3', '');
        document.getElementById('songTitle').textContent = name;
    }

    function togglePlay() {
        if (audio.paused) {
            audio.play();
            document.getElementById('playBtn').textContent = '⏸';
        } else {
            audio.pause();
            document.getElementById('playBtn').textContent = '▶';
        }
    }

    function nextTrack() {
        currentIndex = isRandom 
            ? Math.floor(Math.random() * playlist.length)
            : (currentIndex + 1) % playlist.length;
        loadTrack(currentIndex);
        if (!audio.paused) audio.play();
    }

    function prevTrack() {
        currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        loadTrack(currentIndex);
        if (!audio.paused) audio.play();
    }

    // 事件绑定
    btn.onclick = () => panel.style.display = 'flex';  // 第一次点这里触发整个初始化
    panel.querySelector('#playBtn').onclick = togglePlay;
    panel.querySelectorAll('.mini-btn')[0].onclick = prevTrack;   // 上一首
    panel.querySelectorAll('.mini-btn')[2].onclick = nextTrack;   // 下一首
    panel.querySelector('#randomBtn').onclick = function() {
        isRandom = !isRandom;
        this.classList.toggle('active', isRandom);
    };

    // 进度条
    audio.ontimeupdate = () => {
        if (audio.duration) {
            const percent = (audio.currentTime / audio.duration) * 100;
            panel.querySelector('#progress').value = percent;
            panel.querySelector('#currentTime').textContent = formatTime(audio.currentTime);
            panel.querySelector('#duration').textContent = formatTime(audio.duration);
        }
    };
    panel.querySelector('#progress').oninput = (e) => {
        audio.currentTime = (e.target.value / 100) * audio.duration;
    };

    // 音量
    panel.querySelector('#volume').oninput = (e) => {
        audio.volume = e.target.value / 100;
    };

    // 自动下一首
    audio.onended = nextTrack;

    // 时间格式化（已修复语法错误）
    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' + s : s}`;
    }

    // 点击空白处关闭
    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !panel.contains(e.target)) {
            panel.style.display = 'none';
        }
    });

    // 初始化完成，自动打开面板
    panel.style.display = 'flex';
}
