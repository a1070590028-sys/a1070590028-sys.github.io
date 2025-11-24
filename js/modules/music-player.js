// js/modules/music-player.js
// 终极丝滑 + 颜值拉满版

let audio = null;
let playlist = [];
let currentIndex = -1;

export function initMusicPlayer() {
    const btn = document.getElementById('music-player-btn');
    const panel = document.getElementById('music-player-panel');
    if (!btn || !panel) return;

    audio = new Audio();
    audio.volume = 0.7;
    audio.preload = 'auto';

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
                loadAndPlayIndex(0);
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

    // 渲染歌单（美化版）
    function renderPlaylist() {
        const container = document.getElementById('playlistItems');
        container.innerHTML = '';
        playlist.forEach((song, i) => {
            const div = document.createElement('div');
            div.textContent = song.name;
            div.dataset.index = i;
            if (i === currentIndex) {
                div.setAttribute('current', 'true');
            }
            div.onclick = () => loadAndPlayIndex(i);
            container.appendChild(div);
        });

        if (currentIndex >= 0) {
            setTimeout(() => {
                const el = container.children[currentIndex];
                if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 100);
        }
    }

    // 核心加载函数
    function loadAndPlayIndex(i) {
        if (i < 0 || i >= playlist.length) return;

        // 释放本地文件
        if (playlist[currentIndex]?.type === 'local' && playlist[currentIndex]?.objectURL) {
            URL.revokeObjectURL(playlist[currentIndex].objectURL);
        }

        currentIndex = i;
        const song = playlist[i];

        audio.pause();
        audio.src = song.url;
        audio.currentTime = 0;

        // UI 加载状态
        document.getElementById('songTitle').textContent = song.name + ' (加载中...)';
        document.getElementById('playBtn').textContent = 'Play';
        document.getElementById('progress').value = 0;
        document.getElementById('progress').style.setProperty('--buffered', '0%');
        document.getElementById('currentTime').textContent = '0:00';
        document.getElementById('duration').textContent = '0:00';
        renderPlaylist();

        audio.load();

        const onCanPlayThrough = () => {
            cleanup();
            audio.play().then(() => {
                document.getElementById('playBtn').textContent = 'Pause';
                document.getElementById('songTitle').textContent = song.name;
            }).catch(() => {});
        };

        const onError = () => {
            cleanup();
            document.getElementById('songTitle').textContent = song.name + ' (加载失败)';
            document.getElementById('playBtn').textContent = 'Play';
        };

        const onLoadedMetadata = () => {
            document.getElementById('duration').textContent = format(audio.duration || 0);
        };

        // 已缓冲进度（双轨效果）
        const onProgress = () => {
            if (audio.buffered.length > 0) {
                const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
                const percent = (bufferedEnd / audio.duration) * 100;
                document.getElementById('progress').style.setProperty('--buffered', percent + '%');
            }
        };

        const cleanup = () => {
            audio.removeEventListener('canplaythrough', onCanPlayThrough);
            audio.removeEventListener('error', onError);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('progress', onProgress);
        };

        audio.addEventListener('canplaythrough', onCanPlayThrough);
        audio.addEventListener('error', onError);
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('progress', onProgress);
    }

    // 播放/暂停按钮
    document.getElementById('playBtn').onclick = () => {
        if (audio.paused) {
            audio.play().then(() => {
                document.getElementById('playBtn').textContent = 'Pause';
            }).catch(() => {});
        } else {
            audio.pause();
            document.getElementById('playBtn').textContent = 'Play';
        }
    };

    // 全局事件
    audio.onplaying = () => document.getElementById('playBtn').textContent = 'Pause';
    audio.onpause = audio.onended = () => document.getElementById('playBtn').textContent = 'Play';

    audio.ontimeupdate = () => {
        if (audio.duration) {
            const p = (audio.currentTime / audio.duration) * 100;
            document.getElementById('progress').value = p;
            document.getElementById('currentTime').textContent = format(audio.currentTime);
        }
    };

    audio.onended = () => document.getElementById('nextBtn').click();

    // 切歌
    document.getElementById('prevBtn').onclick = () => loadAndPlayIndex((currentIndex - 1 + playlist.length) % playlist.length);
    document.getElementById('nextBtn').onclick = () => loadAndPlayIndex((currentIndex + 1) % playlist.length);

    // 进度条 & 音量
    document.getElementById('progress').oninput = e => {
        if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    };
    document.getElementById('volume').oninput = e => audio.volume = e.target.value / 100;

    function format(s) {
        if (!isFinite(s)) return '0:00';
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
            loadAndPlayIndex(playlist.length - 1);
        }
    };
}

document.addEventListener('DOMContentLoaded', initMusicPlayer);
