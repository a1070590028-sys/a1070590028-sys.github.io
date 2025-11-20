// js/modules/music-player.js   ← 直接完整替换这个文件
let initialized = false;
let audio = null;
let panel = null;
let playlist = [];
let currentIndex = 0;
let isRandom = false;

export function initMusicPlayer() {
    if (initialized) {
        panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
        return;
    }
    initialized = true;

    // ============== 创建播放器面板 ==============
    panel = document.createElement('div');
    panel.id = 'music-player-panel';
    panel.style.cssText = `
        position:fixed;left:20px;bottom:90px;width:280px;padding:16px;
        border-radius:14px;background:rgba(255,255,255,0.08);
        border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(12px);
        color:#cfe8ff;z-index:99999;display:flex;flex-direction:column;gap:12px;
        font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.4);
    `;
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;font-size:16px;color:#93c5fd">音乐播放器</h3>
            <span id="randomBtn" title="随机播放" style="cursor:pointer;opacity:0.7;font-size:18px">🔀</span>
        </div>
        <div id="songTitle" style="color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            加载中...
        </div>
        <input type="range" id="progress" value="0" max="100" step="0.1" style="width:100%">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8">
            <span id="currentTime">0:00</span>
            <span id="duration">--:--</span>
        </div>
        <div style="display:flex;justify-content:center;gap:20px;margin-top:4px">
            <button class="mini-btn">⏮</button>
            <button id="playBtn" class="mini-btn" style="font-size:22px">▶</button>
            <button class="mini-btn">⏭</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
            <span style="font-size:18px">🔈</span>
            <input type="range" id="volume" min="0" max="100" value="70" style="flex:1">
        </div>
    `;
    document.body.appendChild(panel);

    // ============== 注入所有必要样式 ==============
    const style = document.createElement('style');
    style.textContent = `
        #music-player-btn {
            position:fixed;left:20px;bottom:20px;width:54px;height:54px;
            border-radius:50%;background:rgba(255,255,255,0.08);
            border:1px solid rgba(255,255,255,0.15);backdrop-filter:blur(10px);
            display:flex;align-items:center;justify-content:center;cursor:pointer;
            z-index:99999;transition:all .25s;font-size:24px;user-select:none;
        }
        #music-player-btn:hover {transform:scale(1.08);box-shadow:0 0 14px rgba(96,165,250,0.4);}
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
        #randomBtn.active {opacity:1;color:#60a5fa;}
    `;
    document.head.appendChild(style);

    // ============== 初始化音频 ==============
    audio = new Audio();
    audio.volume = 0.7;
    audio.preload = 'metadata';

    // ============== 加载歌单 ==============
    fetch('music/music-list.json?' + Date.now(), {cache: "no-store"})
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(list => {
            playlist = list.map(f => 'music/' + f.trim());
            if (playlist.length > 0) {
                currentIndex = 0;
                loadTrack(currentIndex);
            } else {
                document.getElementById('songTitle').textContent = '歌单为空';
            }
        })
        .catch(() => {
            document.getElementById('songTitle').textContent = '歌单加载失败';
        });

    function loadTrack(i) {
        currentIndex = i;
        const url = playlist[i];
        audio.src = url;
        const name = decodeURIComponent(url.split('/').pop().replace('.mp3', ''));
        document.getElementById('songTitle').textContent = name;
        audio.load();
        // 自动播放（浏览器可能拦截，但用户已点击按钮，所以通常允许）
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
        currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        loadTrack(currentIndex);
    };
    panel.querySelectorAll('.mini-btn')[2].onclick = () => {
        currentIndex = isRandom ? Math.floor(Math.random() * playlist.length)
                                : (currentIndex + 1) % playlist.length;
        loadTrack(currentIndex);
    };

    document.getElementById('randomBtn').onclick = () => {
        isRandom = !isRandom;
        document.getElementById('randomBtn').classList.toggle('active', isRandom);
    };

    document.getElementById('progress').oninput = e => {
        if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    };

    document.getElementById('volume').oninput = e => {
        audio.volume = e.target.value / 100;
    };

    // ============== 进度 & 时间 ==============
    audio.ontimeupdate = () => {
        if (audio.duration) {
            const percent = (audio.currentTime / audio.duration) * 100;
            document.getElementById('progress').value = percent;
            document.getElementById('currentTime').textContent = format(audio.currentTime);
            document.getElementById('duration').textContent = format(audio.duration);
        }
    };

    audio.onended = () => panel.querySelectorAll('.mini-btn')[2].click();

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

// 绑定按钮
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('music-player-btn')?.addEventListener('click', initMusicPlayer);
});
