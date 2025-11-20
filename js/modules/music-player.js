// js/modules/music-player.js
// 只负责功能：点击 #music-player-btn 后初始化并显示播放器（延迟加载）

let initialized = false;
let audio, panel, playlist = [], currentIndex = 0, isRandom = false;

export function initMusicPlayer() {
    if (initialized) {
        panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
        return;
    }
    initialized = true;

    // 创建播放器面板（动态插入）
    panel = document.createElement('div');
    panel.id = 'music-player-panel';
    Object.assign(panel.style, {
        position:'fixed', left:'20px', bottom:'90px', width:'280px', padding:'16px',
        borderRadius:'14px', background:'rgba(255,255,255,0.08)',
        border:'1px solid rgba(255,255,255,0.12)', backdropFilter:'blur(12px)',
        color:'#cfe8ff', zIndex:'99999', display:'flex', flexDirection:'column', gap:'12px',
        fontSize:'14px', boxShadow:'0 8px 32px rgba(0,0,0,0.4)'
    });
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;font-size:16px;color:#93c5fd">音乐播放器</h3>
            <span id="randomBtn" title="随机播放" style="cursor:pointer;opacity:0.7;font-size:18px">🔀</span>
        </div>
        <div id="songTitle" style="color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">加载中...</div>
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
        #music-player-btn,#net-monitor-btn{transition:all .25s}
        #music-player-btn:hover{transform:scale(1.08);box-shadow:0 0 14px rgba(96,165,250,0.4)}
        #music-player-panel button.mini-btn{
            width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.1);color:#cfe8ff;cursor:pointer;
            display:flex;align-items:center;justify-content:center;font-size:18px;
        }
        #music-player-panel button.mini-btn:hover{background:rgba(96,165,250,0.2);border-color:#60a5fa}
        #music-player-panel input[type=range]{
            -webkit-appearance:none;height:5px;border-radius:3px;background:rgba(255,255,255,0.15);outline:none;
        }
        #music-player-panel input[type=range]::-webkit-slider-thumb{
            -webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:#60a5fa;cursor:pointer;
        }
        #randomBtn.active{opacity:1;color:#60a5fa}
    `;
    document.head.appendChild(style);

    audio = new Audio();
    audio.volume = 0.7;

    // 加载歌单
    fetch('music/music-list.json?' + Date.now())
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(list => {
            playlist = list.map(f => 'music/' + f);
            if (playlist.length) loadTrack(0);
        })
        .catch(() => document.getElementById('songTitle').textContent = '加载失败');

    function loadTrack(i) {
        currentIndex = i;
        audio.src = playlist[i];
        document.getElementById('songTitle').textContent = 
            decodeURIComponent(playlist[i].split('/').pop().replace('.mp3', ''));
        if (!audio.paused) audio.play();
    }

    function toggle() {
        audio.paused ? audio.play().then(() => document.getElementById('playBtn').textContent = '⏸')
                     : audio.pause() && (document.getElementById('playBtn').textContent = '▶');
    }

    // 绑定事件
    document.getElementById('playBtn').onclick = toggle;
    panel.querySelectorAll('.mini-btn')[0].onclick = () => loadTrack((currentIndex - 1 + playlist.length) % playlist.length);
    panel.querySelectorAll('.mini-btn')[2].onclick = () => loadTrack(isRandom ? Math.floor(Math.random()*playlist.length) : (currentIndex + 1) % playlist.length);
    document.getElementById('randomBtn').onclick = function() { isRandom = !isRandom; this.classList.toggle('active', isRandom); };
    document.getElementById('progress').oninput = e => audio.currentTime = (e.target.value/100) * audio.duration;
    document.getElementById('volume').oninput = e => audio.volume = e.target.value / 100;
    audio.ontimeupdate = () => {
        if (audio.duration) {
            const p = (audio.currentTime / audio.duration) * 100;
            document.getElementById('progress').value = p;
            document.getElementById('currentTime').textContent = fmt(audio.currentTime);
            document.getElementById('duration').textContent = fmt(audio.duration);
        }
    };
    audio.onended = () => panel.querySelectorAll('.mini-btn')[2].click();

    function fmt(s) {
        s = Math.floor(s);
        return `${Math.floor(s/60)}:${(s%60)<10?'0':''}${s%60}`;
    }

    // 点击空白关闭
    document.addEventListener('click', e => {
        if (!e.target.closest('#music-player-btn') && !e.target.closest('#music-player-panel')) {
            panel.style.display = 'none';
        }
    });
}

// 页面加载完后自动绑定按钮（和其他模块完全统一）
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('music-player-btn');
    if (btn) btn.addEventListener('click', initMusicPlayer);
});
