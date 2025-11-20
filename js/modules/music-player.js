// js/modules/music-player.js
// 绝对稳定版：切歌再快也不卡死 + 默认暂停 + 首次点▶立即播放

let audio = null;
let playlist = [];
let currentIndex = -1;

export function initMusicPlayer() {
    const btn = document.getElementById('music-player-btn');
    const panel = document.getElementById('music-player-panel');
    if (!btn || !panel) return;

    audio = new Audio();
    audio.volume = 0.7;
    audio.preload = 'metadata';

    // 面板开关
    btn.onclick = () => {
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    };
    panel.addEventListener('click', e => e.stopPropagation());

    // 加载在线歌单
    fetch('music/music-list.json?' + Date.now(), { cache: 'no-store' })
        .then(r => r.ok ? r.json() : [])
        .then(list => {
            playlist = list.map(f => ({
                name: decodeURIComponent(f.trim()).replace('.mp3', ''),
                url: 'music/' + f.trim(),
                type: 'online'
            }));
            renderPlaylist();
            if (playlist.length > 0) {
                currentIndex = 0;
                audio.src = playlist[0].url;  // 提前设置 src
                document.getElementById('songTitle').textContent = playlist[0].name;
                document.getElementById('playBtn').textContent = '▶';
                renderPlaylist();
            }
        })
        .catch(() => {});

    // 展开/收起歌单
    document.getElementById('toggleList').onclick =
    document.getElementById('songTitle').onclick = e => {
        e.stopPropagation();
        const c = document.getElementById('playlistContainer');
        const visible = c.style.display === 'block';
        c.style.display = visible ? 'none' : 'block';
        document.getElementById('toggleList').textContent = visible ? '♪' : '−';
    };

    // 渲染歌单
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
        if (currentIndex >= 0) {
            setTimeout(() => {
                const el = container.children[currentIndex];
                if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 100);
        }
    }

    // 最稳定的切歌写法（不再反复 load + 绑定事件）
    function playIndex(i) {
        if (i < 0 || i >= playlist.length) return;

        // 释放本地文件内存
        if (playlist[currentIndex]?.type === 'local' && playlist[currentIndex]?.objectURL) {
            URL.revokeObjectURL(playlist[currentIndex].objectURL);
        }

        currentIndex = i;
        const song = playlist[i];

        // 最简最稳的切换方式
        audio.pause();
        audio.src = song.url;                 // 直接换 src
        audio.currentTime = 0;                // 重置进度

        document.getElementById('songTitle').textContent = song.name;
        document.getElementById('playBtn').textContent = '▶';
        document.getElementById('progress').value = 0;
        document.getElementById('currentTime').textContent = '0:00';
        document.getElementById('duration').textContent = '0:00';
        renderPlaylist();

        // 直接播放，不等任何事件
        audio.play().catch(() => {});         // 静默处理自动播放拦截
    }

    // 播放/暂停按钮（最简单可靠）
    document.getElementById('playBtn').onclick = () => {
        if (audio.paused) {
            audio.play().then(() => {
                document.getElementById('playBtn').textContent = '⏸';
            }).catch(() => {});
        } else {
            audio.pause();
            document.getElementById('playBtn').textContent = '▶';
        }
    };

    // 自动更新按钮和进度（全局事件，只绑定一次！）
    audio.onplaying = () => document.getElementById('playBtn').textContent = '⏸';
    audio.onpause = audio.onended = () => document.getElementById('playBtn').textContent = '▶';

    audio.ontimeupdate = () => {
        if (audio.duration) {
            const p = (audio.currentTime / audio.duration) * 100;
            document.getElementById('progress').value = p;
            document.getElementById('currentTime').textContent = format(audio.currentTime);
            document.getElementById('duration').textContent = format(audio.duration);
        }
    };

    audio.onended = () => document.getElementById('nextBtn').click();

    // 前/后切歌
    document.getElementById('prevBtn').onclick = () => playIndex((currentIndex - 1 + playlist.length) % playlist.length);
    document.getElementById('nextBtn').onclick = () => playIndex((currentIndex + 1) % playlist.length);

    // 进度条拖动 & 音量
    document.getElementById('progress').oninput = e => audio.currentTime = (e.target.value / 100) * audio.duration;
    document.getElementById('volume').oninput = e => audio.volume = e.target.value / 100;

    function format(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' + sec : sec}`;
    }

    // 拖拽本地文件
    panel.ondragover = e => { e.preventDefault(); panel.style.background = 'rgba(96,165,250,0.15)'; };
    panel.ondragleave = () => panel.style.background = '';
    panel.ondrop = e => {
        e.preventDefault();
        panel.style.background = '';
        for (const file of e.dataTransfer.files) {
            if (file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')) {
                const url = URL.createObjectURL(file);
                playlist.push({
                    name: file.name.replace(/\.mp3$/i, ''),
                    url,
                    type: 'local',
                    objectURL: url
                });
            }
        }
        renderPlaylist();
        if (currentIndex < 0 && playlist.length > 0) {
            playIndex(playlist.length - 1);
        }
    };
}

document.addEventListener('DOMContentLoaded', initMusicPlayer);
