// js/modules/music-player.js —— 100% 纯本地 · 秒开 · 专为 music-list.json 打造
(() => {
    const entry = document.getElementById('music-player-entry');
    if (!entry) return;

    entry.innerHTML = `
        <div id="music-player-btn"><div class="icon">Music</div></div>
        <div id="music-player-panel">
            <h3>Music 音乐播放器</h3>
            <div id="now-title">加载歌单中…</div>
            <div id="now-artist">共 <span id="total">0</span> 首</div>
            <div id="mp-controls">
                <button id="mp-prev">Previous</button>
                <button id="mp-play">Play</button>
                <button id="mp-next">Next</button>
            </div>
            <div id="mp-progress"><div id="mp-progress-fill"></div><div id="mp-progress-thumb"></div></div>
            <div id="mp-time"><span id="mp-cur">0:00</span><span id="mp-dur">0:00</span></div>
            <div id="mp-volume"><div id="mp-volume-fill" style="width:70%"></div><div id="mp-volume-thumb" style="left:70%"></div></div>
            <button id="mp-plist-btn">播放列表 <span id="plist-count">0</span> 首 Down Arrow</button>
            <div id="mp-playlist"></div>
        </div>
        <audio id="mp-audio" preload="metadata"></audio>`;

    const audio      = document.getElementById('mp-audio');
    const panel      = document.getElementById('music-player-panel');
    const btn        = document.getElementById('music-player-btn');
    const playBtn    = document.getElementById('mp-play');
    const prevBtn    = document.getElementById('mp-prev');
    const nextBtn    = document.getElementById('mp-next');
    const progress   = document.getElementById('mp-progress');
    const fill       = document.getElementById('mp-progress-fill');
    const curTime    = document.getElementById('mp-cur');
    const durTime    = document.getElementById('mp-dur');
    const volumeBar  = document.getElementById('mp-volume');
    const volumeFill = document.getElementById('mp-volume-fill');
    const title      = document.getElementById('now-title');
    const totalEl    = document.getElementById('total');
    const plistBtn   = document.getElementById('mp-plist-btn');
    const plistCount = document.getElementById('plist-count');
    const playlist   = document.getElementById('mp-playlist');

    let songs = [];
    let idx = 0;

    const niceName = n => n.replace(/^\d+[\s\.\-\_\)\]]*\s*/g, '').replace(/\.[^.]+$/, '').trim();
    const fmt = s => isNaN(s) ? '0:00' : `${Math.floor(s/60)}:${('0'+Math.floor(s%60)).slice(-2)}`;

    const render = () => {
        playlist.innerHTML = songs.map((s,i) => 
            `<div class="mp-item ${i===idx?'active':''}" data-i="${i}">${s.name}</div>`
        ).join('');
        plistCount.textContent = totalEl.textContent = songs.length;
    };

    const load = i => {
        idx = (i + songs.length) % songs.length;
        const s = songs[idx];
        audio.src = `/music/${encodeURIComponent(s.file)}`;
        title.textContent = s.name;
        render();
        audio.play().catch(() => {});
        playBtn.textContent = 'Pause';
    };

    // 纯本地读取 music-list.json（瞬间完成）
    fetch('/music-list.json?t=' + Date.now())
        .then(r => r.ok ? r.json() : [])
        .then(arr => {
            songs = arr
                .filter(f => /\.(mp3|flac|wav|m4a|aac|ogg)$/i.test(f))
                .map(f => ({ name: niceName(f), file: f }))
                .sort((a,b) => a.name.localeCompare(b.name));  // 字母序排序（可选）

            if (songs.length) {
                title.textContent = songs[0].name;
                load(0);
            } else {
                title.textContent = '未发现音乐文件';
            }
            render();
        })
        .catch(() => { title.textContent = '加载失败'; });

    // 播放器交互（极简）
    audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
        curTime.textContent = fmt(audio.currentTime);
        durTime.textContent = fmt(audio.duration);
    });
    audio.addEventListener('ended', () => load(idx + 1));
    audio.addEventListener('play', () => playBtn.textContent = 'Pause');
    audio.addEventListener('pause', () => playBtn.textContent = 'Play');

    progress.onclick   = e => { const r=progress.getBoundingClientRect(); audio.currentTime = audio.duration * (e.clientX-r.left)/r.width; };
    volumeBar.onclick  = e => { const r=volumeBar.getBoundingClientRect(); const v=(e.clientX-r.left)/r.width; audio.volume=v; volumeFill.style.width=v*100+'%'; };
    playBtn.onclick    = () => audio.paused ? audio.play() : audio.pause();
    prevBtn.onclick    = () => load(idx - 1);
    nextBtn.onclick    = () => load(idx + 1);
    playlist.onclick   = e => { const el=e.target.closest('.mp-item'); if(el) load(+el.dataset.i); };
    plistBtn.onclick   = () => {
        const show = playlist.style.display !== 'block';
        playlist.style.display = show ? 'block' : 'none';
        plistBtn.innerHTML = show ? `播放列表 ${songs.length} 首 Up Arrow` : `播放列表 ${songs.length} 首 Down Arrow`;
    };
    btn.onclick = () => panel.style.display = panel.style.display === 'block' ? 'none' : 'block';

    audio.volume = 0.7;

    // 拖拽本地音乐彩蛋
    document.body.addEventListener('dragover', e => e.preventDefault());
    document.body.addEventListener('drop', e => {
        e.preventDefault();
        const f = e.dataTransfer?.files[0];
        if (f?.type.startsWith('audio/')) {
            const url = URL.createObjectURL(f);
            songs.push({ name: niceName(f.name)+' (本地)', file: url });
            render(); load(songs.length-1);
        }
    });
})();
