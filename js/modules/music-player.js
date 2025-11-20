// js/modules/music-player.js
let initialized = false;  // 标记是否已经初始化过（只初始化一次）

export function initMusicPlayerOnDemand() {
    if (initialized) {
        // 已经初始化过了，直接显示/隐藏面板即可
        const panel = document.getElementById('music-player-panel');
        const visible = panel && panel.style.display === 'flex';
        if (panel) panel.style.display = visible ? 'none' : 'flex';
        return;
    }

    initialized = true;  // 标记已初始化，后面再点就只是切换显隐

    // ==================== 下面才是真正初始化代码 ====================

    let playlist = [];
    let currentIndex = 0;
    let audio = new Audio();
    let isRandom = false;

    // 创建按钮（左下角，和网络检测完全对称）
    const btn = document.createElement('div');
    btn.id = 'music-player-btn';
    btn.innerHTML = '<div class="music-icon">🎵</div>';
    btn.title = '音乐播放器';
    Object.assign(btn.style, {
        position: 'fixed', left: '20px', bottom: '20px', width: '54px', height: '54px',
        borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', zIndex: '99999', transition: '0.25s', fontSize: '22px'
    });
    btn.onmouseover = () => btn.style.transform = 'scale(1.08)';
    btn.onmouseout  = () => btn.style.transform = '';
    document.body.appendChild(btn);

    // 创建面板（初始隐藏）
    const panel = document.createElement('div');
    panel.id = 'music-player-panel';
    Object.assign(panel.style, {
        position: 'fixed', left: '20px', bottom: '90px', width: '280px', padding: '16px',
        borderRadius: '14px', background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
        color: '#cfe8ff', zIndex: '99999', display: 'none',
        flexDirection: 'column', gap: '10px', fontSize: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
    });
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h3 style="margin:0;font-size:16px;color:#93c5fd">音乐播放器</h3>
            <span id="randomBtn" title="随机播放" style="cursor:pointer;opacity:0.7">🔀</span>
        </div>
        <div id="songTitle" style="color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            加载中...
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
            <input type="range" id="progress" value="0" max="100" style="width:100%">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8">
                <span id="currentTime">0:00</span>
                <span id="duration">0:00</span>
            </div>
        </div>
        <div style="display:flex;justify-content:center;gap:16px;align-items:center">
            <button id="prevBtn" class="mini-btn">⏮</button>
            <button id="playBtn" class="mini-btn" style="font-size:20px">▶</button>
            <button id="nextBtn" class="mini-btn">⏭</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:20px">🔈</span>
            <input type="range" id="volume" min="0" max="100" value="70" style="width:100%">
        </div>
    `;
    document.body.appendChild(panel);

    // 注入统一美化样式（只注入一次）
    const style = document.createElement('style');
    style.textContent = `
        #music-player-btn:hover{box-shadow:0 0 14px rgba(96,165,250,0.4)}
        #music-player-panel button.mini-btn{
            background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
            width:40px;height:40px;border-radius:50%;color:#cfe8ff;cursor:pointer;
            display:flex;align-items:center;justify-content:center;font-size:16px;
        }
        #music-player-panel button.mini-btn:hover{
            background:rgba(96,165,250,0.2);border-color:#60a5fa;
        }
        #music-player-panel input[type=range]{
            -webkit-appearance:none;height:4px;border-radius:2px;
            background:rgba(255,255,255,0.15);outline:none;
        }
        #music-player-panel input[type=range]::-webkit-slider-thumb{
            -webkit-appearance:none;width:14px;height:14px;border-radius:50%;
            background:#60a5fa;cursor:pointer;
        }
        #randomBtn.active{opacity:1;color:#60a5fa}
    `;
    document.head.appendChild(style);

    // 加载播放列表
    fetch('music/music-list.json?t=' + Date.now())  // 加时间戳防止缓存
        .then(r => r.json())
        .then(list => {
            playlist = list.map(f => 'music/' + f);
            if (playlist.length > 0) loadTrack(0);
            else document.getElementById('songTitle').textContent = '无音乐文件';
        })
        .catch(err => {
            console.error(err);
            document.getElementById('songTitle').textContent = '列表加载失败';
        });

    function loadTrack(i) {
        if (!playlist[i]) return;
        currentIndex = i;
        const file = playlist[i];
        audio.src = file;
        audio.load();
        document.getElementById('songTitle').textContent =
            decodeURIComponent(file.split('/').pop().replace('.mp3', ''));
        audio.play().catch(() => {});
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

    function next() {
        currentIndex = isRandom
            ? Math.floor(Math.random() * playlist.length)
            : (currentIndex + 1) % playlist.length;
        loadTrack(currentIndex);
    }

    function prev() {
        currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        loadTrack(currentIndex);
    }

    // 事件绑定
    btn.onclick = () => panel.style.display = 'flex';  // 第一次点击时触发整个初始化
    document.getElementById('playBtn').onclick = togglePlay;
    document.getElementById('nextBtn').onclick = next;
    document.getElementById('prevBtn').onclick = prev;
    document.getElementById('randomBtn').onclick = () => {
        isRandom = !isRandom;
        document.getElementById('randomBtn').classList.toggle('active', isRandom);
    };

    // 进度条 & 音量
    audio.ontimeupdate = () => {
        if (audio.duration) {
            const p = (audio.currentTime / audio.duration) * 100;
            document.getElementById('progress').value = p;
            document.getElementById('currentTime').textContent = format(audio.currentTime);
            document.getElementById('duration').textContent = format(audio.duration);
        }
    };
    document.getElementById('progress').oninput = e =>
        audio.currentTime = (e.target.value / 100) * audio.duration;
    document.getElementById('volume').oninput = e =>
        audio.volume = e.target.value / 100;

    audio.onended = next;

    function format(s) {
        s = Math.floor(s);
        return `${Math.floor(s/60)}:${(s%60).<10?'0':''}${s%60}`;
    }

    // 点击页面空白处关闭面板
    document.addEventListener('click', e => {
        if (!btn.contains(e.target) && !panel.contains(e.target)) {
            panel.style.display = 'none';
        }
    });

    // 初始化完成，显示面板（第一次点击后自动打开）
    panel.style.display = 'flex';
}
