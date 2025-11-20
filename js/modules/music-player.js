// js/modules/music-player.js
let initialized = false;

export function initMusicPlayerOnDemand() {
    if (initialized) {
        const panel = document.getElementById('music-player-panel');
        if (panel) panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
        return;
    }
    initialized = true;

    let playlist = [];
    let currentIndex = 0;
    let audio = new Audio();
    let isRandom = false;

    // 创建按钮（左下角）
    const btn = document.createElement('div');
    btn.id = 'music-player-btn';
    btn.innerHTML = '🎵';
    btn.title = '音乐播放器';
    Object.assign(btn.style, {
        position:'fixed',left:'20px',bottom:'20px',width:'54px',height:'54px',
        borderRadius:'50%',background:'rgba(255,255,255,0.08)',
        border:'1px solid rgba(255,255,255,0.15)',backdropFilter:'blur(10px)',
        display:'flex',alignItems:'center',justifyContent:'center',
        cursor:'pointer',zIndex:'99999',transition:'0.25s',fontSize:'22px'
    });
    btn.onmouseover = () => btn.style.transform = 'scale(1.08)';
    btn.onmouseout  = () => btn.style.transform = '';
    document.body.appendChild(btn);

    // 创建面板
    const panel = document.createElement('div');
    panel.id = 'music-player-panel';
    Object.assign(panel.style, {
        position:'fixed',left:'20px',bottom:'90px',width:'280px',padding:'16px',
        borderRadius:'14px',background:'rgba(255,255,255,0.08)',
        border:'1px solid rgba(255,255,255,0.12)',backdropFilter:'blur(12px)',
        color:'#cfe8ff',zIndex:'99999',display:'none',
        flexDirection:'column',gap:'10px',fontSize:'14px',
        boxShadow:'0 8px 32px rgba(0,0,0,0.4)'
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

    // 样式
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

    // 关键修复：路径必须是 ./music/music-list.json 或 /music/music-list.json
    fetch('./music/music-list.json')   // ← 修复这行！加了 ./music/
        .then(r => {
            if (!r.ok) throw new Error('404');
            return r.json();
        })
        .then(list => {
            playlist = list.map(f => `./music/${f}`);  // ← 也要加 ./music/
            if (playlist.length === 0) {
                document.getElementById('songTitle').textContent = '播放列表为空';
                return;
            }
            loadTrack(0);
        })
        .catch(err => {
            console.error('音乐列表加载失败：', err);
            document.getElementById('songTitle').textContent = '加载失败（检查路径）';
        });

    function loadTrack(i) {
        currentIndex = i;
        audio.src = playlist[i];
        audio.load();
        document.getElementById('songTitle').textContent =
            decodeURIComponent(playlist[i].split('/').pop().replace('.mp3', ''));
        audio.play().catch(() => {});
    }

    function togglePlay() {
        audio.paused ? audio.play() : audio.pause();
        document.getElementById('playBtn').textContent = audio.paused ? '▶' : '⏸';
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

    btn.onclick = () => panel.style.display = 'flex';

    document.getElementById('playBtn').onclick = togglePlay;
    document.getElementById('nextBtn').onclick = next;
    document.getElementById('prevBtn').onclick = prev;
    document.getElementById('randomBtn').onclick = () => {
        isRandom = !isRandom;
        document.getElementById('randomBtn').classList.toggle('active', isRandom);
    };

    audio.ontimeupdate = () => {
        if (audio.duration) {
            const p = (audio.currentTime / audio.duration) * 100;
            document.getElementById('progress').value = p;
            document.getElementById('currentTime').textContent = fmt(audio.currentTime);
            document.getElementById('duration').textContent = fmt(audio.duration);
        }
    };
    document.getElementById('progress').oninput = e => audio.currentTime = (e.target.value / 100) * audio.duration;
    document.getElementById('volume').oninput = e => audio.volume = e.target.value / 100;
    audio.onended = next;

    function fmt(s) {
        s = Math.floor(s);
        return `${Math.floor(s/60)}:${(s%60)<10?'0':''}${s%60}`;
    }

    document.addEventListener('click', e => {
        if (!btn.contains(e.target) && !panel.contains(e.target)) {
            panel.style.display = 'none';
        }
    });

    panel.style.display = 'flex';  // 第一次点击后自动打开
}
