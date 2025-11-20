// js/modules/music-player.js
// 终极版：支持在线歌单 + 本地拖拽 + 可展开列表 + 当前曲目高亮

let audio = null;
let playlist = [];      // { name: string, url: string, type: 'online'|'local' }
let currentIndex = -1;

export function initMusicPlayer() {
    const btn = document.getElementById('music-player-btn');
    const panel = document.getElementById('music-player-panel');
    if (!btn || !panel) return;

    // 按钮开关面板
    btn.onclick = () => {
        const visible = panel.style.display === 'block';
        panel.style.display = visible ? 'none' : 'block';
    };

    // 初始化音频
    audio = new Audio();
    audio.volume = 0.7;

    // 加载在线歌单
    fetch('music/music-list.json?' + Date.now(), { cache: 'no-store' })
        .then(r => r.ok ? r.json() : [])
        .then(list => {
            const onlineSongs = list.map(f => ({
                name: decodeURIComponent(f.trim()).replace('.mp3', ''),
                url: 'music/' + f.trim(),
                type: 'online'
            }));
            playlist = onlineSongs;
            renderPlaylist();
            if (playlist.length > 0) playIndex(0);
        })
        .catch(() => { /* 失败也无所谓，本地拖拽还能用 */ });

    // ========== 展开/收起歌单 ==========
    document.getElementById('toggleList').onclick =
    document.getElementById('songTitle').onclick = (e) => {
        e.stopPropagation();
        const container = document.getElementById('playlistContainer');
        container.style.display = container.style.display === 'block' ? 'none' : 'block';
        document.getElementById('toggleList').textContent = container.style.display === 'block' ? '−' : '♪';
    };

    // ========== 渲染歌单 ==========
    function renderPlaylist() {
        const container = document.getElementById('playlistItems');
        container.innerHTML = '';
        playlist.forEach((song, i) => {
            const div = document.createElement('div');
            div.textContent = song.name;
            div.style.cssText = 'padding:6px 4px;cursor:pointer;border-radius:4px;margin:2px 0;transition:0.2s;';
            if (i === currentIndex) {
                div.style.background = 'rgba(96,165,250,0.3)';
                div.style.fontWeight = '600';
            }
            div.onclick = () => playIndex(i);
            container.appendChild(div);
        });
        // 自动滚动到当前曲目
        if (currentIndex >= 0) {
            setTimeout(() => {
                const el = container.children[currentIndex];
                if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 100);
        }
    }

    // ========== 播放指定索引 ==========
    function playIndex(i) {
        if (i < 0 || i >= playlist.length) return;
        currentIndex = i;
        const song = playlist[i];
        audio.src = song.url;
        document.getElementById('songTitle').textContent = song.name;
        renderPlaylist();
        audio.play().catch(() => {});
    }

    // ========== 控件 ==========
    document.getElementById('playBtn').onclick = () => {
        if (audio.paused) {
            audio.play().then(() => document.getElementById('playBtn').textContent = '⏸');
        } else {
            audio.pause();
            document.getElementById('playBtn').textContent = '▶';
        }
    };

    document.getElementById('prevBtn').onclick = () => playIndex((currentIndex - 1 + playlist.length) % playlist.length);
    document.getElementById('nextBtn').onclick = () => playIndex((currentIndex + 1) % playlist.length);

    document.getElementById('progress').oninput = e => {
        if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    };

    document.getElementById('volume').oninput = e => audio.volume = e.target.value / 100;

    // ========== 进度更新 ==========
    audio.ontimeupdate = () => {
        if (!audio.duration) return;
        const p = (audio.currentTime / audio.duration) * 100;
        document.getElementById('progress').value = p;
        document.getElementById('currentTime').textContent = format(audio.currentTime);
        document.getElementById('duration').textContent = format(audio.duration);
    };

    audio.onended = () => document.getElementById('nextBtn').click();

    function format(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' + sec : sec}`;
    }

    // ========== 拖拽本地文件 ==========
    const dropZone = panel;
    dropZone.ondragover = e => { e.preventDefault(); dropZone.style.background = 'rgba(96,165,250,0.15)'; };
    dropZone.ondragleave = () => dropZone.style.background = '';
    dropZone.ondrop = e => {
        e.preventDefault();
        dropZone.style.background = '';
        const files = e.dataTransfer.files;
        for (const file of files) {
            if (file.type === 'audio/mpeg' || file.name.endsWith('.mp3')) {
                const url = URL.createObjectURL(file);
                const name = file.name.replace('.mp3', '');
                playlist.push({ name, url, type: 'local' });
            }
        }
        renderPlaylist();
        if (currentIndex < 0 && playlist.length > 0) playIndex(playlist.length - 1); // 播放最后拖入的
    };

    // 点击空白关闭
    document.addEventListener('click', e => {
        if (!e.target.closest('#music-player-btn') && !e.target.closest('#music-player-panel')) {
            panel.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', initMusicPlayer);
