// js/modules/music-player.js —— 100% 纯本地 · 秒开 · 已修复所有已知 bug
(() => {
    const entry = document.getElementById('music-player-entry');
    if (!entry) return;

    entry.innerHTML = `
        <div id="music-player-btn"><div class="icon">🎧</div></div>
        <div id="music-player-panel">
            <h3>Stellar 音乐播放器</h3>
            <div id="now-title">加载歌单中…</div>
            <div id="now-artist">共 <span id="total">0</span> 首</div>
            <div id="mp-controls">
                <button id="mp-prev">⏮</button>
                <button id="mp-play">▶</button>
                <button id="mp-next">⏭</button>
            </div>
            <div id="mp-progress"><div id="mp-progress-fill"></div><div id="mp-progress-thumb"></div></div>
            <div id="mp-time"><span id="mp-cur">0:00</span><span id="mp-dur">0:00</span></div>
            <div id="mp-volume"><div id="mp-volume-fill" style="width:70%"></div><div id="mp-volume-thumb" style="left:70%"></div></div>
            <button id="mp-plist-btn">播放列表 <span id="plist-count">0</span> 首 ▼</button>
            <div id="mp-playlist"></div>
        </div>
        <audio id="mp-audio" preload="metadata"></audio>`;

    const audio = document.getElementById('mp-audio');
    const panel = document.getElementById('music-player-panel');
    const btn = document.getElementById('music-player-btn');
    const playBtn = document.getElementById('mp-play');
    const prevBtn = document.getElementById('mp-prev');
    const nextBtn = document.getElementById('mp-next');
    const progress = document.getElementById('mp-progress');
    const fill = document.getElementById('mp-progress-fill');
    const curTime = document.getElementById('mp-cur');
    const durTime = document.getElementById('mp-dur');
    const volumeBar = document.getElementById('mp-volume');
    const volumeFill = document.getElementById('mp-volume-fill');
    const title = document.getElementById('now-title');
    const totalEl = document.getElementById('total');
    const plistBtn = document.getElementById('mp-plist-btn');
    const plistCount = document.getElementById('plist-count');
    const playlist = document.getElementById('mp-playlist');

    let songs = [];
    let idx = 0;
    let hasUserInteracted = false; // 解决自动播放策略

    const niceName = n => n.replace(/^\d+[\s\.\-\_\)\]]*\s*/g, '').replace(/\.[^.]+$/, '').trim();
    const fmt = s => isNaN(s) ? '0:00' : `${Math.floor(s/60)}:${('0'+Math.floor(s%60)).slice(-2)}`;

    const render = () => {
        playlist.innerHTML = songs.map((s,i) =>
            `<div class="mp-item ${i===idx?'active':''}" data-i="${i}">${s.name}</div>`
        ).join('');
        plistCount.textContent = totalEl.textContent = songs.length;
    };

    const load = i => {
        idx = ((i % songs.length) + songs.length) % songs.length; // 正确支持负数取模
        const s = songs[idx];
        if (!s || !s.file) return;

        // 严格区分完整 URL 与相对路径
        const isFullUrl = /^(https?:|blob:|data:|ipfs:)/i.test(s.file);
        audio.src = isFullUrl ? s.file : `/music/${s.file}`;

        title.textContent = s.name || '未知歌曲';
        render();

        // 智能播放：只有用户交互过才自动播放
        if (hasUserInteracted && audio.paused) {
            audio.play().then(() => {
                playBtn.textContent = '❚❚';
            }).catch(e => console.warn('自动播放失败', e));
        } else {
            playBtn.textContent = '▶';
        }
    };

    // 加载歌单
    fetch('/music/music-list.json?t=' + Date.now())
        .then(r => r.ok ? r.json() : [])
        .then(arr => {
            if (!Array.isArray(arr) || arr.length === 0) {
                title.textContent = '歌单为空';
                return;
            }

            songs = arr
                .filter(f => typeof f === 'string' && /\.(mp3|flac|wav|m4a|aac|ogg)$/i.test(f))
                .map(f => ({ name: niceName(f), file: f }))
                .sort((a,b) => a.name.localeCompare(b.name));

            if (songs.length === 0) {
                title.textContent = '无支持的音乐文件';
                return;
            }

            title.textContent = songs[0].name;
            load(0);        // 只加载，不自动播放
            render();
        })
        .catch(() => { title.textContent = '加载歌单失败'; });

    // 播放进度
    audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const percent = audio.currentTime / audio.duration * 100;
        fill.style.width = percent + '%';
        curTime.textContent = fmt(audio.currentTime);
        durTime.textContent = fmt(audio.duration);
    });

    audio.addEventListener('ended', () => load(idx + 1));
    audio.addEventListener('7play', () => playBtn.textContent = '❚❚');
    audio.addEventListener('pause', () => playBtn.textContent = '▶');

    // 交互
    progress.onclick = e => {
        const rect = progress.getBoundingClientRect();
        audio.currentTime = audio.duration * (e.clientX - rect.left) / rect.width;
    };

    volumeBar.onclick = e => {
        const rect = volumeBar.getBoundingClientRect();
        const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.volume = v;
        volumeFill.style.width = (v*100) + '%';
    };

    const userInteract = () => hasUserInteracted = true;

    playBtn.onclick = () => {
        userInteract();
        audio.paused ? audio.play().then(() => playBtn.textContent = '❚❚') : audio.pause();
    };

    prevBtn.onclick = () => { userInteract(); load(idx - 1); };
    nextBtn.onclick = () => { userInteract(); load(idx + 1); };

    playlist.onclick = e => {
        const el = e.target.closest('.mp-item');
        if (el) { userInteract(); load(+el.dataset.i); }
    };

    plistBtn.onclick = () => {
        const show = playlist.style.display !== 'block';
        playlist.style.display = show ? 'block' : 'none';
        plistBtn.innerHTML = show ? `播放列表 ${songs.length} 首 ▲` : `播放列表 ${songs.length} 首 ▼`;
    };

    btn.onclick = () => panel.style.display = panel.style.display === 'block' ? 'none' : 'block';

    audio.volume = 0.7;

    // 拖拽本地音乐彩蛋（自动 revoke 旧 blob，防止内存泄漏）
    let currentBlobUrl = null;
    document.body.addEventListener('dragover', e => e.preventDefault());
    document.body.addEventListener('drop', e => {
        e.preventDefault();
        const f = e.dataTransfer?.files[0];
        if (f?.type.startsWith('audio/')) {
            if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = URL.createObjectURL(f);
            songs.push({ name: niceName(f.name) + ' (本地)', file: currentBlobUrl });
            render();
            userInteract();
            load(songs.length - 1);
        }
    });
})();
