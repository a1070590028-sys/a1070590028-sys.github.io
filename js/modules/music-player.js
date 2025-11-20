// js/modules/music-player.js
// 终极版：默认不自动播放 + 只有点击按钮关闭面板 + 切歌丝滑 + 防内存泄漏

let audio = null;
let playlist = [];      // { name: string, url: string, type: 'online'|'local', objectURL?: string }
let currentIndex = -1;

export function initMusicPlayer() {
    const btn = document.getElementById('music-player-btn');
    const panel = document.getElementById('music-player-panel');
    if (!btn || !panel) return;

    // 初始化音频
    audio = new Audio();
    audio.volume = 0.7;
    audio.preload = 'metadata';

    // ==================== 只有点击按钮本身才能开/关面板 ====================
    btn.onclick = () => {
        const isVisible = panel.style.display === 'block';
        panel.style.display = isVisible ? 'none' : 'block';
    };
    panel.addEventListener('click', e => e.stopPropagation());

    // 加载在线歌单（关键修改：加载完只选中第一首，不自动播放）
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

            // ★★★★★ 这里是关键修改 ★★★★★
            if (playlist.length > 0) {
                currentIndex = 0;  // 选中第一首
                document.getElementById('songTitle').textContent = playlist[0].name;
                document.getElementById('playBtn').textContent = '▶';  // 明确显示播放图标
                renderPlaylist();  // 高亮第一首
                // 不调用 playIndex(0)，所以默认不播放
            }
        })
        .catch(() => { /* 失败也没事，本地拖拽还能用 */ });

    // ========== 展开/收起歌单 ==========
    const toggleListBtn = document.getElementById('toggleList');
    const songTitle = document.getElementById('songTitle');
    const playlistContainer = document.getElementById('playlistContainer');

    const togglePlaylist = (e) => {
        e.stopPropagation();
        const visible = playlistContainer.style.display === 'block';
        playlistContainer.style.display = visible ? 'none' : 'block';
        toggleListBtn.textContent = visible ? '♪' : '−';
    };
    toggleListBtn.onclick = songTitle.onclick = togglePlaylist;

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

        if (currentIndex >= 0) {
            setTimeout(() => {
                const el = container.children[currentIndex];
                if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 100);
        }
    }

    // ========== 核心：无缝播放 ==========
    function playIndex(i) {
        if (i < 0 || i >= playlist.length || !audio) return;

        if (currentIndex === i && !audio.paused && audio.src === playlist[i].url) {
            return;
        }

        // 释放上一首本地文件内存
        if (playlist[currentIndex]?.type === 'local' && playlist[currentIndex]?.objectURL) {
            URL.revokeObjectURL(playlist[currentIndex].objectURL);
        }

        currentIndex = i;
        const song = playlist[i];

        // 清理旧事件与资源
        audio.pause();
        audio.removeEventListener('canplaythrough', onCanPlay);
        audio.removeEventListener('loadeddata', onCanPlay);
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('pause', onPauseOrEnded);
        audio.removeEventListener('ended', onPauseOrEnded);

        audio.src = '';
        audio.removeAttribute('src');
        try { audio.load(); } catch(e) {}

        // UI 更新
        document.getElementById('songTitle').textContent = song.name + ' (加载中...)';
        document.getElementById('playBtn').textContent = '▶';
        document.getElementById('currentTime').textContent = '0:00';
        document.getElementById('duration').textContent = '0:00';
        document.getElementById('progress').value = 0;
        renderPlaylist();

        // 设置新 src 并播放
        audio.src = song.url;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                console.warn('自动播放被阻止:', err);
                document.getElementById('playBtn').textContent = '▶';
            });
        }

        function onCanPlay() {
            document.getElementById('songTitle').textContent = song.name;
            document.getElementById('playBtn').textContent = '⏸';
            cleanup();
        }
        function onPlaying() { document.getElementById('playBtn').textContent = '⏸'; }
        function onPauseOrEnded() { document.getElementById('playBtn').textContent = '▶'; }
        function cleanup() {
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.removeEventListener('loadeddata', onCanPlay);
            audio.removeEventListener('playing', onPlaying);
            audio.removeEventListener('pause', onPauseOrEnded);
            audio.removeEventListener('ended', onPauseOrEnded);
        }

        audio.addEventListener('canplaythrough', onCanPlay);
        audio.addEventListener('loadeddata', onCanPlay);
        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('pause', onPauseOrEnded);
        audio.addEventListener('ended', onPauseOrEnded);
    }

    // ========== 控件 ==========
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

    document.getElementById('prevBtn').onclick = () => playIndex((currentIndex - 1 + playlist.length) % playlist.length);
    document.getElementById('nextBtn').onclick = () => playIndex((currentIndex + 1) % playlist.length);

    document.getElementById('progress').oninput = e => {
        if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    };

    document.getElementById('volume').oninput = e => audio.volume = e.target.value / 100;

    // ========== 进度更新 ==========
    audio.ontimeupdate = () => {
        if (!isNaN(audio.duration)) {
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

    // ========== 拖拽本地文件 ==========
    const dropZone = panel;
    dropZone.ondragover = e => { e.preventDefault(); dropZone.style.background = 'rgba(96,165,250,0.15)'; };
    dropZone.ondragleave = () => dropZone.style.background = '';
    dropZone.ondrop = e => {
        e.preventDefault();
        dropZone.style.background = '';

        const files = e.dataTransfer.files;
        for (const file of files) {
            if (file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')) {
                const objectURL = URL.createObjectURL(file);
                const name = file.name.replace(/\.mp3$/i, '');
                playlist.push({ name, url: objectURL, type: 'local', objectURL });
            }
        }
        renderPlaylist();
        if (playlist.length > 0 && currentIndex < 0) {
            currentIndex = playlist.length - 1;
            document.getElementById('songTitle').textContent = playlist[currentIndex].name;
            renderPlaylist();
            // 拖入本地文件后也不自动播放，用户需手动点▶
        }
    };
}

document.addEventListener('DOMContentLoaded', initMusicPlayer);
