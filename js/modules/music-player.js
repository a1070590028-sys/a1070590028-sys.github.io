// js/modules/music-player.js
// 完全复用网速面板的样式和交互逻辑，极简可靠

let audio = null;
let playlist = [];
let currentIndex = 0;

export function initMusicPlayer() {
    const btn = document.getElementById('music-player-btn');
    const panel = document.getElementById('music-player-panel');

    if (!btn || !panel) return;

    // 复用网速面板的显示逻辑
    btn.onclick = () => {
        const visible = panel.style.display === 'block';
        panel.style.display = visible ? 'none' : 'block';
    };

    // 初始化音频
    audio = new Audio();
    audio.volume = 0.7;

    // 加载歌单
    fetch('music/music-list.json?' + Date.now(), {cache:'no-store'})
        .then(r => r.json())
        .then(list => {
            playlist = list.map(f => 'music/' + f.trim());
            if (playlist.length > 0) loadTrack(0);
        });

    function loadTrack(i) {
        currentIndex = i;
        const url = playlist[i];
        audio.src = url;
        const name = decodeURIComponent(url.split('/').pop().replace('.mp3', ''));
        document.getElementById('songTitle').textContent = name;
        audio.load();
        audio.play().catch(() => {});
    }

    // 控件
    document.getElementById('playBtn').onclick = () => {
        if (audio.paused) {
            audio.play().then(() => document.getElementById('playBtn').textContent = '⏸');
        } else {
            audio.pause();
            document.getElementById('playBtn').textContent = '▶';
        }
    };

    document.getElementById('prevBtn').onclick = () => {
        currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        loadTrack(currentIndex);
    };

    document.getElementById('nextBtn').onclick = () => {
        currentIndex = (currentIndex + 1) % playlist.length;
        loadTrack(currentIndex);
    };

    document.getElementById('progress').oninput = e => {
        if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    };

    document.getElementById('volume').oninput = e => {
        audio.volume = e.target.value / 100;
    };

    // 进度更新
    audio.ontimeupdate = () => {
        if (audio.duration) {
            const p = (audio.currentTime / audio.duration) * 100;
            document.getElementById('progress').value = p;
            document.getElementById('currentTime').textContent = format(audio.currentTime);
            document.getElementById('duration').textContent = format(audio.duration);
        }
    };

    audio.onended = () => document.getElementById('nextBtn').click();

    function format(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' + sec : sec}`;
    }

    // 点击空白关闭（和网速面板一致）
    document.addEventListener('click', e => {
        if (!e.target.closest('#music-player-btn') && !e.target.closest('#music-player-panel')) {
            panel.style.display = 'none';
        }
    });
}

// DOM 加载完初始化
document.addEventListener('DOMContentLoaded', initMusicPlayer);
