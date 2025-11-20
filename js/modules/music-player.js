// js/modules/music-player.js
// 最终版：带歌曲列表（点击即播） + 删除随机播放 + 完全对称按钮

let initialized = false;
let audio = null;
let panel = null;
let playlist = [];
let currentIndex = 0;

export function initMusicPlayer() {
    if (initialized) {
        panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
        return;
    }
    initialized = true;

    // ============== 创建面板 ==============
    panel = document.createElement('div');
    panel.id = 'music-player-panel';
    panel.style.cssText = `
        position:fixed;left:20px;bottom:90px;width:320px;max-height:70vh;padding:16px;
        border-radius:14px;background:rgba(255,255,255,0.08);
        border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(12px);
        color:#cfe8ff;z-index:99999;display:flex;flex-direction:column;gap:12px;
        font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.4);overflow:hidden;
    `;

    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;font-size:16px;color:#93c5fd">音乐播放器</h3>
            <span style="font-size:18px;cursor:pointer;" id="closePanel">✕</span>
        </div>

        <div id="songTitle" style="color:#e2e8f0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            加载中...
        </div>

        <input type="range" id="progress" value="0" max="100" step="0.1" style="width:100%">

        <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8">
            <span id="currentTime">0:00</span>
            <span id="duration">--:--</span>
        </div>

        <div style="display:flex;justify-content:center;gap:20px;margin:8px 0;">
            <button class="mini-btn">⏮</button>
            <button id="playBtn" class="mini-btn" style="font-size:22px">▶</button>
            <button class="mini-btn">⏭</button>
        </div>

        <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px">🔈</span>
            <input type="range" id="volume" min="0" max="100" value="70" style="flex:1">
        </div>

        <!-- 新增歌曲列表 -->
        <div id="songList" style="flex:1;overflow-y:auto;margin-top:8px;font-size:13px;color:#94a3b8;">
            加载歌单...
        </div>
    `;
    document.body.appendChild(panel);

    // ============== 样式注入 ==============
    const style = document.createElement('style');
    style.textContent = `
        #music-player-btn { /* 按钮样式已经在 style.css 或 index.html 中定义，无需重复 */ }
        #music-player-panel button.mini-btn {
            width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.1);color:#cfe8ff;cursor:pointer;
            display:flex;align-items:center;justify-content:center;font-size:18px;
        }
        #music-player-panel button.mini-btn:hover {
            background:rgba(96,165,250,0.2);border-color:#60a5fa;
        }
        #music-player-panel input[type=range] {
            -webkit-appearance:none;height:5px;border-radius:3px;
            background:rgba(255,255,255,0.15);outline:none;
        }
        #music-player-panel input[type=range]::-webkit-slider-thumb {
            -webkit-appearance:none;width:15px;height:15px;border-radius:50%;
            background:#60a5fa;cursor:pointer;
        }
        #songList div {
            padding:6px 8px;border-radius:6px;cursor:pointer;transition:0.2s;
        }
        #songList div:hover {background:rgba(255,255,255,0.1);}
        #songList div.playing {background:rgba(96,165,250,0.25);color:#fff;font-weight:600;}
        #closePanel:hover {opacity:0.7;}
    `;
    document.head.appendChild(style);

    // ============== 初始化音频 ==============
    audio = new Audio();
    audio.volume = 0.7;
    audio.preload = 'metadata';

    // ============== 加载歌单 ==============
    fetch('music/music-list.json?' + Date.now(), {cache:'no-store'})
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(list => {
            playlist = list.map(f => 'music/' + f.trim());
            renderSongList();
            if (playlist.length > 0) loadTrack(0);
        })
        .catch(() => {
            document.getElementById('songList').textContent = '歌单加载失败';
        });

    // ============== 渲染歌曲列表 ==============
    function renderSongList() {
        const container = document.getElementById('songList');
        container.innerHTML = '';
        playlist.forEach((url, i) => {
            const name = decodeURIComponent(url.split('/').pop().replace('.mp3', ''));
            const div = document.createElement('div');
            div.textContent = `${i+1}. ${name}`;
            div.onclick = () => loadTrack(i);
            if (i === currentIndex) div.classList.add('playing');
            container.appendChild(div);
        });
    }

    function updateSongListHighlight() {
        const items = document.querySelectorAll('#songList div');
        items.forEach((el, i) => {
            el.classList.toggle('playing', i === currentIndex);
        });
    }

    // ============== 加载并播放 ==============
    function loadTrack(i) {
        if (i < 0 || i >= playlist.length) return;
        currentIndex = i;
        const url = playlist[i];
        audio.src = url;
        const name = decodeURIComponent(url.split('/').pop().replace('.mp3', ''));
        document.getElementById('songTitle').textContent = name;
        updateSongListHighlight();
        audio.load();
        audio.play().catch(() => {});
    }

    // ============== 控件事件 ==============
    document.getElementById('playBtn').onclick = () => {
        if (audio.paused) {
            audio.play().then(() => document.getElementById('playBtn').textContent = '⏸');
        } else {
            audio.pause();
            document.getElementById('playBtn').textContent = '▶';
        }
    };

    panel.querySelectorAll('.mini-btn')[0].onclick = () => {
        loadTrack((currentIndex - 1 + playlist.length) % playlist.length);
    };
    panel.querySelectorAll('.mini-btn')[2].onclick = () => {
        loadTrack((currentIndex + 1) % playlist.length);
    };

    document.getElementById('closePanel').onclick = () => panel.style.display = 'none';

    document.getElementById('progress').oninput = e => {
        if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    };

    document.getElementById('volume').oninput = e => {
        audio.volume = e.target.value / 100;
    };

    // ============== 进度更新 ==============
    audio.ontimeupdate = () => {
        if (audio.duration && isFinite(audio.duration)) {
            const percent = (audio.currentTime / audio.duration) * 100;
            document.getElementById('progress').value = percent;
            document.getElementById('currentTime').textContent = format(audio.currentTime);
            document.getElementById('duration').textContent = format(audio.duration);
        }
    };

    audio.onended = () => {
        loadTrack((currentIndex + 1) % playlist.length);
    };

    function format(s) {
        if (!isFinite(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' + sec : sec}`;
    }

    // ============== 点击空白关闭 ==============
    document.addEventListener('click', e => {
        if (!e.target.closest('#music-player-btn') && !e.target.closest('#music-player-panel')) {
            panel.style.display = 'none';
        }
    });
}

// DOM 加载完毕后绑定按钮
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('music-player-btn');
    if (btn) btn.addEventListener('click', initMusicPlayer);
});
