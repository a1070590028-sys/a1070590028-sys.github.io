// js/modules/music-player.js —— 自动读取根目录 /music/ 文件夹（零配置版）
(() => {
    const entry = document.getElementById('music-player-entry');
    if (!entry) return;

    entry.innerHTML = `
        <div id="music-player-btn"><div class="icon">Music</div></div>
        <div id="music-player-panel">
            <h3>Music 音乐播放器</h3>
            <div id="now-title">正在扫描音乐文件…</div>
            <div id="now-artist">Frey's Music</div>
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
    const title       = document.getElementById('now-title');
    const artist     = document.getElementById('now-artist');
    const plistBtn   = document.getElementById('mp-plist-btn');
    const plistCount = document.getElementById('plist-count');
    const playlist    = document.getElementById('mp-playlist');

    let songs = [];           // [{name: "青花瓷", path: "/music/青花瓷.mp3"}]
    let idx   = 0;

    // 智能提取歌名（去掉前面的 01. 02- 01 等编号 + 后缀）
    const niceName = filename => filename
        .replace(/^\d+[\s\.\-\_\)\]]*\s*/g, '')  // 去掉开头编号
        .replace(/\.[^.]+$/, '')                   // 去掉后缀
        .trim();

    const formatTime = s => isNaN(s) ? '0:00' : 
        `${Math.floor(s/60)}:${('0'+Math.floor(s%60)).slice(-2)}`;

    const renderList = () => {
        playlist.innerHTML = songs.map((s,i) => 
            `<div class="mp-item ${i===idx?'active':''}" data-i="${i}">${s.name}</div>`
        ).join('');
        plistCount.textContent = songs.length;
    };

    const load = i => {
        idx = (i + songs.length) % songs.length;
        const s = songs[idx];
        audio.src = s.path;
        title.textContent = s.name;
        artist.textContent = `${idx+1} / ${songs.length}`;
        renderList();
        audio.play().catch(()=>{}); 
        playBtn.textContent = 'Pause';
    };

    // ============ 自动读取根目录 /music/ 所有音乐 ============
    const loadMusicList = async () => {
        const base = '/music/';

        // 推荐方式（最稳、最快）：在根目录放一个 music-list.json
        try {
            const r = await fetch(base + 'music-list.json?t=' + Date.now());
            if (r.ok) {
                const arr = await r.json();
                songs = arr.map(f => ({ name: niceName(f), path: base + f }));
                if (songs.length) { load(0); return; }
            }
        } catch(e) {}

        // 备选方式：自动探测常见文件名（GitHub Pages 能用）
        const common = [
            '01.mp3','1.mp3','01.mp3','青花瓷.mp3','夜曲.mp3','雨的旋律.mp3',
            '01.青花瓷.mp3','02-夜曲.mp3','bgm.mp3','music.mp3','song1.mp3',
            '01.flac','02.flac','01.m4a','01.ogg','01.wav'
        ];

        const found = [];
        for (const f of common) {
            const url = base + f;
            if (await urlExists(url)) {
                found.push({ name: niceName(f), path: url });
            }
        }

        if (found.length) {
            songs = found;
            load(0);
            return;
        }

        // 最后兜底
        title.textContent = '未发现音乐文件';
        artist.textContent = '请放入 /music/ 文件夹';
    };

    const urlExists = url => new Promise(r => {
        const img = new Image();
        img.onload = () => r(true);
        img.onerror = () => r(false);
        img.src = url;
    });

    // ============ 事件 ============
    audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const p = audio.currentTime / audio.duration * 100;
        fill.style.width = p + '%';
        curTime.textContent = formatTime(audio.currentTime);
        durTime.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('ended', () => load(idx + 1));
    audio.addEventListener('loadedmetadata', () => durTime.textContent = formatTime(audio.duration));

    progress.onclick = e => {
        const rect = progress.getBoundingClientRect();
        audio.currentTime = audio.duration * (e.clientX - rect.left) / rect.width;
    };

    volumeBar.onclick = e => {
        const rect = volumeBar.getBoundingClientRect();
        const v = (e.clientX - rect.left) / rect.width;
        audio.volume = v;
        volumeFill.style.width = v*100 + '%';
    };

    playBtn.onclick = () => audio.paused ? audio.play() : audio.pause();
    audio.onplay  = () => playBtn.textContent = 'Pause';
    audio.onpause = () => playBtn.textContent = 'Play';

    prevBtn.onclick = () => load(idx - 1);
    nextBtn.onclick = () => load(idx + 1);

    playlist.onclick = e => {
        const item = e.target.closest('.mp-item');
        if (item) load(+item.dataset.i);
    };

    plistBtn.onclick = () => {
        const show = playlist.style.display !== 'block';
        playlist.style.display = show ? 'block' : 'none';
        plistBtn.innerHTML = show ? `播放列表 ${songs.length} 首 Up Arrow` : `播放列表 ${songs.length} 首 Down Arrow`;
    };

    btn.onclick = () => panel.style.display = panel.style.display === 'block' ? 'none' : 'block';

    // 初始化
    audio.volume = 0.7;
    loadMusicList();

    // 拖拽本地音乐彩蛋依然保留
    document.body.addEventListener('dragover', e => e.preventDefault());
    document.body.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) {
            const url = URL.createObjectURL(file);
            const name = niceName(file.name);
            songs.push({ name: name + ' (本地)', path: url });
            renderList();
            load(songs.length - 1);
        }
    });
})();
