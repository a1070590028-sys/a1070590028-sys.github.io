// js/modules/music-player.js
// 终极优化版：无缝切歌 + 按钮永不卡死 + 本地文件防内存泄漏 + 加载提示

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
    audio.preload = 'metadata'; // 更快获取时长

    // 按钮开关面板
    btn.onclick = () => {
        const visible = panel.style.display === 'block';
        panel.style.display = visible ? 'none' : 'block';
    };

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

        // 自动滚动到当前曲目
        if (currentIndex >= 0) {
            setTimeout(() => {
                const el = container.children[currentIndex];
                if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 100);
        }
    }

    // ========== 核心：无缝播放指定索引（彻底解决所有切换bug）==========
    function playIndex(i) {
        if (i < 0 || i >= playlist.length || !audio) return;

        // 同一首且正在播放，直接忽略
        if (currentIndex === i && !audio.paused && audio.src === playlist[i].url) {
            return;
        }

        // 释放上一首本地文件的 objectURL（防止内存泄漏）
        if (playlist[currentIndex]?.type === 'local' && playlist[currentIndex]?.objectURL) {
            URL.revokeObjectURL(playlist[currentIndex].objectURL);
        }

        currentIndex = i;
        const song = playlist[i];

        // 重置音频状态
        audio.pause();
        audio.removeEventListener('canplaythrough', onCanPlay);
        audio.removeEventListener('loadeddata', onCanPlay);
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('ended', onEnded);

        // 关键：彻底清理旧 src
        audio.src = '';
        audio.removeAttribute('src');
        try { audio.load(); } catch(e) {}

        // 更新 UI（立即显示新歌名 + 加载中）
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
                console.warn('自动播放被阻止（常见于未交互时）:', err);
                document.getElementById('playBtn').textContent = '▶';
            });
        }

        // 资源就绪 → 移除“加载中” + 更新按钮
        function onCanPlay() {
            document.getElementById('songTitle').textContent = song.name;
            document.getElementById('playBtn').textContent = '⏸';
            cleanup();
        }

        // 正在播放时确保按钮正确
        function onPlaying() {
            document.getElementById('playBtn').textContent = '⏸';
        }

        function onPause() {
            document.getElementById('playBtn').textContent = '▶';
        }

        function onEnded() {
            document.getElementById('playBtn').textContent = '▶';
        }

        function cleanup() {
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.removeEventListener('loadeddata', onCanPlay);
            audio.removeEventListener('playing', onPlaying);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
        }

        audio.addEventListener('canplaythrough', onCanPlay);
        audio.addEventListener('loadeddata', onCanPlay);
        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
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

    document.getElementById('prevBtn').onclick = () => {
        playIndex((currentIndex - 1 + playlist.length) % playlist.length);
    };

    document.getElementById('nextBtn').onclick = () => {
        playIndex((currentIndex + 1) % playlist.length);
    };

    document.getElementById('progress').oninput = e => {
        if (audio.duration) {
            audio.currentTime = (e.target.value / 100) * audio.duration;
        }
    };

    document.getElementById('volume').oninput = e => {
        audio.volume = e.target.value / 100;
    };

    // ========== 进度 & 时间更新 ==========
    audio.ontimeupdate = () => {
        if (!isNaN(audio.duration)) {
            const p = (audio.currentTime / audio.duration) * 100;
            document.getElementById('progress').value = p;
            document.getElementById('currentTime').textContent = format(audio.currentTime);
            document.getElementById('duration').textContent = format(audio.duration);
        }
    };

    audio.onended = () => {
        document.getElementById('nextBtn').click();
    };

    function format(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' + sec : sec}`;
    }

    // ========== 拖拽本地文件（支持内存释放）==========
    const dropZone = panel;
    dropZone.ondragover = e => {
        e.preventDefault();
        dropZone.style.background = 'rgba(96,165,250,0.15)';
    };
    dropZone.ondragleave = () => dropZone.style.background = '';
    dropZone.ondrop = e => {
        e.preventDefault();
        dropZone.style.background = '';

        const files = e.dataTransfer.files;
        for (const file of files) {
            if (file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')) {
                const objectURL = URL.createObjectURL(file);
                const name = file.name.replace(/\.mp3$/i, '');
                playlist.push({
                    name,
                    url: objectURL,
                    type: 'local',
                    objectURL // 用来后续释放
                });
            }
        }
        renderPlaylist();
        if (playlist.length > 0 && currentIndex < 0) {
            playIndex(playlist.length - 1); // 播放最后拖入的
        }
    };

    // 点击空白处关闭面板
    document.addEventListener('click', e => {
        if (!e.target.closest('#music-player-btn') && !e.target.closest('#music-player-panel')) {
            panel.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', initMusicPlayer);
