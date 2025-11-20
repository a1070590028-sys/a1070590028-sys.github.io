// js/modules/music-player.js
// 绝对最终版：无任何拼写错误 + 默认暂停 + 首次点▶立即播放 + 切歌丝滑

let audio = null;
let playlist = [];      // { name, url, type: 'online'|'local', objectURL? }
let currentIndex = -1;

export function initMusicPlayer() {
    const btn = document.getElementById('music-player-btn');
    const panel = document.getElementById('music-player-panel');
    if (!btn || !panel) return;

    audio = new Audio();
    audio.volume = 0.7;
    audio.preload = 'metadata';

    btn.onclick = () => {
        const isVisible = panel.style.display === 'block';
        panel.style.display = isVisible ? 'none' : 'block';
    };
    panel.addEventListener('click', e => e.stopPropagation());

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

            if (playlist.length > 0) {
                currentIndex = 0;
                const firstSong = playlist[0];
                audio.src = firstSong.url;
                audio.load();
                document.getElementById('songTitle').textContent = firstSong.name;
                document.getElementById('playBtn').textContent = '▶';
                renderPlaylist();
            }
        })
        .catch(() => {});

    // 展开/收起歌单
    const toggleListBtn = document.getElementById('toggleList');
    const songTitle = document.getElementById('songTitle');
    const playlistContainer = document.getElementById('playlistContainer');
    const togglePlaylist = e => {
        e.stopPropagation();
        const visible = playlistContainer.style.display === 'block';
        playlistContainer.style.display = visible ? 'none' : 'block';
        toggleListBtn.textContent = visible ? '♪' : '−';
    };
    toggleListBtn.onclick = songTitle.onclick = togglePlaylist;

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

    // 核心播放函数
    function playIndex(i) {
        if (i < 0 || i >= playlist.length || !audio) return;
        if (currentIndex === i && !audio.paused && audio.src === playlist[i].url) return;

        if (playlist[currentIndex]?.type === 'local' && playlist[currentIndex]?.objectURL) {
            URL.revokeObjectURL(playlist[currentIndex].objectURL);
        }

        currentIndex = i;
        const song = playlist[i];

        audio.pause();
        audio.removeEventListener('canplaythrough', onCanPlay);
        audio.removeEventListener('loadeddata', onCanPlay);
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('ended', onPause);

        audio.src = '';
        audio.removeAttribute('src');
        try { audio.load(); } catch(e) {}

        document.getElementById('songTitle').textContent = song.name + ' (加载中...)';
        document.getElementById('playBtn').textContent = '▶';
        document.getElementById('currentTime').textContent = '0:00';
        document.getElementById('duration').textContent = '0:00';
        document.getElementById('progress').value = 0;
        renderPlaylist();

        audio.src = song.url;
        audio.load();
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => document.getElementById('playBtn').textContent = '▶');
        }

        function onCanPlay() {
            document.getElementById('songTitle').textContent = song.name;
            document.getElementById('playBtn').textContent = '⏸';
            cleanup();
        }
        function onPlaying() { document.getElementById('playBtn').textContent = '⏸'; }
        function onPause() { document.getElementById('playBtn').textContent = '▶'; }
        function cleanup() {
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.removeEventListener('loadeddata', onCanPlay);
            audio.removeEventListener('playing', onPlaying);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onPause);
        }

        audio.addEventListener('canplaythrough', onCanPlay);
        audio.addEventListener('loadeddata', onCanPlay);
        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onPause);
    }

    document.getElementById('playBtn').onclick = () => {
        if (audio.paused) {
            audio.play().then(() => document.getElementById('playBtn').textContent = '⏸').catch(() => {});
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

    // 拖拽本地文件
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
            const lastSong = playlist[currentIndex];
            audio.src = lastSong.url;
            audio.load();
            document.getElementById('songTitle').textContent = lastSong.name;
            document.getElementById('playBtn').textContent = '▶';
            renderPlaylist();
        }
    };
}

document.addEventListener('DOMContentLoaded', initMusicPlayer);
