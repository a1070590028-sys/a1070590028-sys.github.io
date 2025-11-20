// js/modules/music-player.js
// 终极优化版：修复所有已知BUG + 加载状态 + 防卡顿 + 更丝滑体验

let audio = null;
let playlist = [];      // { name: string, url: string, type: 'online'|'local', id: number }
let currentIndex = -1;
let isLoading = false;
let playlistIdCounter = 0;

export function initMusicPlayer() {
    const btn = document.getElementById('music-player-btn');
    const panel = document.getElementById('music-player-panel');
    if (!btn || !panel) return;

    // 初始化音频
    audio = new Audio();
    audio.volume = 0.7;

    // ============== 按钮开关面板 ==============
    btn.onclick = (e) => {
        e.stopPropagation(); // 防止被全局点击关闭
        const visible = panel.style.display === 'block';
        panel.style.display = visible ? 'none' : 'block';
    };

    // ============== 加载在线歌单 ==============
    fetch('music/music-list.json?' + Date.now(), { cache: 'no-store' })
        .then(r => r.ok ? r.json() : [])
        .then(list => {
            const onlineSongs = list.map(f => ({
                id: playlistIdCounter++,
                name: decodeURIComponent(f.trim()).replace('.mp3', ''),
                url: 'music/' + f.trim(),
                type: 'online'
            }));
            playlist = onlineSongs;
            renderPlaylist();
            if (playlist.length > 0) playIndex(0);
        })
        .catch(() => {});

    // ============== 展开/收起歌单 ==============
    const toggleList = document.getElementById('toggleList');
    const songTitle = document.getElementById('songTitle');
    const playlistContainer = document.getElementById('playlistContainer');

    const togglePlaylist = (e) => {
        e.stopPropagation();
        const visible = playlistContainer.style.display === 'block';
        playlistContainer.style.display = visible ? 'none' : 'block';
        toggleList.textContent = visible ? '♪' : '−';
    };
    toggleList.onclick = songTitle.onclick = togglePlaylist;

    // ============== 渲染歌单（防卡顿版）==============
    function renderPlaylist() {
        const container = document.getElementById('playlistItems');
        const fragment = document.createDocumentFragment();

        container.innerHTML = ''; // 先清空

        playlist.forEach((song, i) => {
            const div = document.createElement('div');
            div.textContent = song.name;
            div.dataset.index = i;
            div.style.cssText = 'padding:6px 4px;cursor:pointer;border-radius:4px;margin:2px 0;transition:0.2s;';
            if (i === currentIndex) {
                div.style.background = 'rgba(96,165,250,0.3)';
                div.style.fontWeight = '600';
            }
            div.onclick = (e) => {
                e.stopPropagation();
                playIndex(i);
            };
            fragment.appendChild(div);
        });

        container.appendChild(fragment);

        // 滚动到当前曲目（防卡顿延迟执行）
        if (currentIndex >= 0) {
            setTimeout(() => {
                const el = container.children[currentIndex];
                el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 150);
        }
    }

    // ============== 播放指定索引 ==============
    function playIndex(i) {
        if (i < 0 || i >= playlist.length || isLoading) return;

        currentIndex = i;
        const song = playlist[i];

        isLoading = true;
        setLoadingState(true);

        // 重置进度条和时间
        document.getElementById('progress').value = 0;
        document.getElementById('currentTime').textContent = '0:00';
        document.getElementById('duration').textContent = '0:00';

        audio.src = song.url;
        document.getElementById('songTitle').textContent = song.name;

        renderPlaylist();

        // 关键：等可以播放再播，避免被浏览器拒绝
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }

        // 加载成功后移除 loading
        audio.onloadedmetadata = audio.oncanplay = () => {
            if (isLoading) {
                isLoading = false;
                setLoadingState(false);
            }
        };
    }

    function setLoadingState(loading) {
        const playBtn = document.getElementById('playBtn');
        const titleEl = document.getElementById('songTitle');
        if (loading) {
            playBtn.textContent = '⌛';
            titleEl.textContent = playlist[currentIndex]?.name + ' (加载中…)';
            playBtn.disabled = true;
        } else {
            playBtn.textContent = audio.paused ? '▶' : '⏸';
            titleEl.textContent = playlist[currentIndex]?.name || '';
            playBtn.disabled = false;
        }
    }

    // ============== 控件 ==============
    document.getElementById('playBtn').onclick = (e) => {
        e.stopPropagation();
        if (isLoading) return;

        if (audio.paused) {
            audio.play().then(() => {
                document.getElementById('playBtn').textContent = '⏸';
            });
        } else {
            audio.pause();
            document.getElementById('playBtn').textContent = '▶';
        }
    };

    document.getElementById('prevBtn').onclick = (e) => {
        e.stopPropagation();
        playIndex((currentIndex - 1 + playlist.length) % playlist.length);
    };

    document.getElementById('nextBtn').onclick = (e) => {
        e.stopPropagation();
        playIndex((currentIndex + 1) % playlist.length);
    };

    document.getElementById('progress').oninput = (e) => {
        if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    };

    document.getElementById('volume').oninput = (e) => {
        audio.volume = e.target.value / 100;
    };

    // 初始同步一次音量滑块
    document.getElementById('volume').value = audio.volume * 100;

    // ============== 进度更新 ==============
    audio.ontimeupdate = () => {
        if (audio.duration && !isLoading) {
            const p = (audio.currentTime / audio.duration) * 100;
            document.getElementById('progress').value = p;
            document.getElementById('currentTime').textContent = format(audio.currentTime);
            document.getElementById('duration').textContent = format(audio.duration);
        }
    };

    audio.onended = () => {
        if (!isLoading) document.getElementById('nextBtn').click();
    };

    function format(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' + sec : sec}`;
    }

    // ============== 拖拽本地文件（去重）==============
    const dropZone = panel;
    dropZone.ondragover = e => { e.preventDefault(); dropZone.style.background = 'rgba(96,165,250,0.15)'; };
    dropZone.ondragleave = () => dropZone.style.background = '';
    dropZone.ondrop = e => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.background = '';

        const files = Array.from(e.dataTransfer.files);
        let added = 0;

        for (const file of files) {
            if (file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')) {
                // 简单去重：文件名相同就不加
                const name = file.name.replace(/\.mp3$/i, '');
                if (playlist.some(s => s.name === name)) continue;

                const url = URL.createObjectURL(file);
                playlist.push({
                    id: playlistIdCounter++,
                    name,
                    url,
                    type: 'local'
                });
                added++;
            }
        }

        if (added > 0) {
            renderPlaylist();
            if (currentIndex < 0) playIndex(playlist.length - 1);
        }
    };

    // ============== 全局点击关闭（精准判断）==============
    document.addEventListener('click', e => {
        if (!e.target.closest('#music-player-btn') && 
            !e.target.closest('#music-player-panel')) {
            panel.style.display = 'none';
            playlistContainer.style.display = 'none'; // 顺便收起歌单
            toggleList.textContent = '♪';
        }
    });

    // 面板内的点击不冒泡到 document
    panel.addEventListener('click', e => e.stopPropagation());
}

document.addEventListener('DOMContentLoaded', initMusicPlayer);
