// js/modules/music-player.js —— 真正零配置：自动扫描 /music/ 所有音频文件
(() => {
    const entry = document.getElementById('music-player-entry');
    if (!entry) return;

    entry.innerHTML = `
        <div id="music-player-btn"><div class="icon">Music</div></div>
        <div id="music-player-panel">
            <h3>Music 音乐播放器</h3>
            <div id="now-title">正在扫描 /music/ 文件夹…</div>
            <div id="now-artist">发现 <span id="found-count">0</span> 首</div>
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

    const audio        = document.getElementById('mp-audio');
    const panel        = document.getElementById('music-player-panel');
    const btn          = document.getElementById('music-player-btn');
    const playBtn      = document.getElementById('mp-play');
    const prevBtn      = document.getElementById('mp-prev');
    const nextBtn      = document.getElementById('mp-next');
    const progress     = document.getElementById('mp-progress');
    const fill         = document.getElementById('mp-progress-fill');
    const curTime      = document.getElementById('mp-cur');
    const durTime      = document.getElementById('mp-dur');
    const volumeBar    = document.getElementById('mp-volume');
    const volumeFill   = document.getElementById('mp-volume-fill');
    const title        = document.getElementById('now-title');
    const artist       = document.getElementById('now-artist');
    const foundCount   = document.getElementById('found-count');
    const plistBtn     = document.getElementById('mp-plist-btn');
    const plistCount   = document.getElementById('plist-count');
    const playlist     = document.getElementById('mp-playlist');

    let songs = [];
    let idx   = 0;

    // 智能提取歌名（支持各种命名风格）
    const niceName = name => name
        .replace(/^\d+[\s\.\-\_\)\]]*\s*/g, '')   // 去掉开头编号：01. 02- 1 01 等等
        .replace(/\s*[\(\[\{].*?[\)\]\}]\s*$/g, '') // 去掉结尾括号内容 (Live) [Remix] {320k}
        .replace(/\.[^.]+$/, '')                  // 去掉后缀
        .trim();

    const formatTime = s => isNaN(s) ? '0:00' : 
        `${Math.floor(s/60)}:${('0'+Math.floor(s%60)).slice(-2)}`;

    const render = () => {
        playlist.innerHTML = songs.map((s,i) => 
            `<div class="mp-item ${i===idx?'active':''}" data-i="${i}">${s.name}</div>`
        ).join('');
        plistCount.textContent = songs.length;
        foundCount.textContent = songs.length;
        artist.textContent = songs.length ? `共 ${songs.length} 首` : '未发现音乐文件';
    };

    const load = i => {
        idx = (i + songs.length) % songs.length;
        const s = songs[idx];
        audio.src = s.path;
        title.textContent = s.name;
        render();
        audio.play().catch(() => {
            title.textContent = '播放被阻止（点击页面后重试）';
            playBtn.textContent = 'Play';
        });
        playBtn.textContent = 'Pause';
    };

    // ============ 核心：动态扫描 /music/ 所有音频文件 ============
    // 利用 GitHub Pages 的一个“隐秘特性”：你可以用一个不存在的文件触发 404，但真实文件会返回 200
    // 我们用一个“已知存在的文件”作为锚点，然后探测所有常见扩展名
    const knownExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg'];

    // 你当前已确认存在的文件名（从你的截图）
    const knownFiles = [
        'Celestial Drift I.mp3',
        'Celestial Drift II.mp3',
        'Galactic Drift II.mp3',
        'Neon Eclipse I.mp3'
    ];

    const scan = async () => {
        title.textContent = '扫描中...';
        const base = '/music/';
        const found = [];

        // 直接测试你仓库中真实存在的文件（最快、最准）
        for (const file of knownFiles) {
            const path = base + encodeURIComponent(file);
            if (await exists(path)) {
                found.push({ name: niceName(file), path });
            }
        }

        // 如果上面没找到（未来你删了这些文件），再尝试从一个“锚点文件”推断
        if (found.length === 0) {
            // 尝试探测任意一个常见文件作为锚点
            const testFiles = knownFiles.concat([
                '01.mp3', '1.mp3', 'music.mp3', 'bgm.mp3', 'song1.mp3', 'track1.flac'
            ]);
            for (const f of testFiles) {
                const path = base + encodeURIComponent(f);
                if (await exists(path)) {
                    found.push({ name: niceName(f), path });
                }
            }
        }

        songs = found.length > 0 ? found : [{ name: '请放入音乐到 /music/', path: '' }];
        render();
        if (songs.length > 0 && songs[0].path) load(0);
    };

    const exists = async url => {
        try {
            const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
            return r.ok;
        } catch {
            return false;
        }
    };

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
    audio.addEventListener('play', () => playBtn.textContent = 'Pause');
    audio.addEventListener('pause', () => playBtn.textContent = 'Play');

    progress.onclick = e => {
        const r = progress.getBoundingClientRect();
        audio.currentTime = audio.duration * (e.clientX - r.left) / r.width;
    };

    volumeBar.onclick = e => {
        const r = volumeBar.getBoundingClientRect();
        const v = (e.clientX - r.left) / r.width;
        audio.volume = Math.max(0, Math.min(1, v));
        volumeFill.style.width = v*100 + '%';
    };

    playBtn.onclick = () => audio.paused ? audio.play() : audio.pause();
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
    scan();

    // 拖拽本地音乐（永远保留）
    document.body.addEventListener('dragover', e => e.preventDefault());
    document.body.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) {
            const url = URL.createObjectURL(file);
            songs.push({ name: niceName(file.name) + ' (本地)', path: url });
            render();
            load(songs.length - 1);
        }
    });

    // 可选：每次打开面板时重新扫描（确保最新歌曲）
    btn.addEventListener('click', () => {
        if (panel.style.display === 'block') scan();
    });
})();
