// js/modules/music-player.js
// 极简 · 纯本地 · 秒开 · 专为 /music/music-list.json 设计
(() => {
  // 如果入口 div 不存在就直接退出（防止重复执行）
  if (!document.getElementById('music-player-entry')) return;

  const html = `
    <div id="music-player-btn"><div class="icon">🎵</div></div>
    <div id="music-player-panel">
      <h3>Frey 的小宇宙电台</h3>
      <div id="now-title">加载歌单中…</div>
      <div id="now-info">共 <span id="total">0</span> 首</div>
      
      <div id="mp-controls">
        <button id="mp-prev" title="上一首">⏮</button>
        <button id="mp-play" title="播放/暂停">▶</button>
        <button id="mp-next" title="下一首">⏭</button>
      </div>
      
      <div id="mp-progress">
        <div id="mp-progress-fill"></div>
        <div id="mp-progress-thumb"></div>
      </div>
      <div id="mp-time">
        <span id="mp-cur">0:00</span> / <span id="mp-dur">0:00</span>
      </div>
      
      <div id="mp-volume">
        <div id="mp-volume-fill" style="width:70%"></div>
        <div id="mp-volume-thumb" style="left:70%"></div>
      </div>
      
      <button id="mp-plist-btn">播放列表 <span id="plist-count">0</span> 首 ▼</button>
      <div id="mp-playlist"></div>
    </div>
    <audio id="mp-audio" preload="metadata"></audio>
  `;

  document.getElementById('music-player-entry').innerHTML = html;

  // 元素缓存
  const audio   = document.getElementById('mp-audio');
  const panel   = document.getElementById('music-player-panel');
  const btn     = document.getElementById('music-player-btn');
  const playBtn = document.getElementById('mp-play');
  const prevBtn = document.getElementById('mp-prev');
  const nextBtn = document.getElementById('mp-next');
  const progress= document.getElementById('mp-progress');
  const fill    = document.getElementById('mp-progress-fill');
  const thumb   = document.getElementById('mp-progress-thumb');
  const curTime = document.getElementById('mp-cur');
  const durTime = document.getElementById('mp-dur');
  const volumeBar = document.getElementById('mp-volume');
  const volumeFill= document.getElementById('mp-volume-fill');
  const volumeThumb= document.getElementById('mp-volume-thumb');
  const title   = document.getElementById('now-title');
  const totalEl = document.getElementById('total');
  const plistBtn= document.getElementById('mp-plist-btn');
  const plist   = document.getElementById('mp-playlist');
  const plistCount = document.getElementById('plist-count');

  let songs = [];   // [{name:xxx, file:xxx}]
  let idx   = 0;

  // 格式化文件名
  const niceName = name => name
    .replace(/^\d+[\s.\-_·]*/g, '')
    .replace(/\.[^.]+$/, '')
    .trim();

  const fmt = s => isNaN(s) ? '0:00' : 
    `${Math.floor(s/60)}:${('0'+Math.floor(s%60)).slice(-2)}`;

  // 渲染播放列表
  const renderList = () => {
    plist.innerHTML = songs.map((s,i) => 
      `<div class="plist-item ${i===idx?'active':''}" data-i="${i}">
        <span class="plist-name">${s.name}</span>
      </div>`
    ).join('');
    totalEl.textContent = plistCount.textContent = songs.length;
  };

  // 播放指定索引
  const play = i => {
    idx = (i + songs.length) % songs.length;
    const s = songs[idx];
    audio.src = `music/${s.file}`;   // 强制走 /music/ 目录
    title.textContent = s.name;
    renderList();
    audio.play().catch(() => {});
    playBtn.textContent = '❚❚';
  };

  // 加载歌单
  fetch('music/music-list.json?t=' + Date.now())
    .then(r => r.ok ? r.json() : [])
    .then(arr => {
      songs = arr
        .filter(f => typeof f === 'string' && /\.(mp3|wav|flac|m4a|aac|ogg)$/i.test(f))
        .map(f => ({ name: niceName(f), file: f.trim() }));

      if (songs.length === 0) {
        title.textContent = '歌单为空';
        return;
      }

      renderList();
      play(0); // 自动播放第一首
    })
    .catch(() => title.textContent = '加载失败');

  // 音频事件
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const per = audio.currentTime / audio.duration;
    fill.style.width = thumb.style.left = (per * 100) + '%';
    curTime.textContent = fmt(audio.currentTime);
  });

  audio.addEventListener('loadedmetadata', () => {
    durTime.textContent = fmt(audio.duration);
  });

  audio.addEventListener('ended', () => play(idx + 1));
  audio.addEventListener('play',  () => playBtn.textContent = '❚❚');
  audio.addEventListener('pause', () => playBtn.textContent = '▶');

  // 交互
  progress.onclick = e => {
    const rect = progress.getBoundingClientRect();
    const per = (e.clientX - rect.left) / rect.width;
    audio.currentTime = audio.duration * per;
  };

  volumeBar.onclick = e => {
    const rect = volumeBar.getBoundingClientRect();
    const per = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.volume = per;
    volumeFill.style.width = volumeThumb.style.left = (per * 100) + '%';
  };

  playBtn.onclick = () => audio.paused ? audio.play() : audio.pause();
  prevBtn.onclick = () => play(idx - 1);
  nextBtn.onclick = () => play(idx + 1);

  plist.onclick = e => {
    const item = e.target.closest('.plist-item');
    if (item) play(+item.dataset.i);
  };

  plistBtn.onclick = () => {
    const isShow = plist.style.display === 'block';
    plist.style.display = isShow ? 'none' : 'block';
    plistBtn.innerHTML = isShow 
      ? `播放列表 ${songs.length} 首 ▼` 
      : `播放列表 ${songs.length} 首 ▲`;
  };

  btn.onclick = () => {
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  };

  // 默认音量 70%
  audio.volume = 0.7;

  // 彩蛋：拖拽本地音乐直接播放（保留原功能）
  document.body.addEventListener('dragover', e => e.preventDefault());
  document.body.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('audio/')) {
      const url = URL.createObjectURL(file);
      const name = niceName(file.name) + ' (本地拖入)';
      songs.push({ name, file: url });
      renderList();
      play(songs.length - 1);
    }
  });

  // ============ 样式注入（只执行一次）============
  if (!document.getElementById('simple-music-player-css')) {
    const css = `
      #music-player-entry{position:fixed;right:20px;bottom:20px;z-index:9999;font-size:28px;cursor:pointer;}
      #music-player-btn{width:56px;height:56px;background:rgba(0,255,136,0.18);backdrop-filter:blur(12px);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 25px rgba(0,255,136,0.25);transition:.3s;}
      #music-player-btn:hover{transform:scale(1.2) rotate(15deg);}
      #music-player-panel{display:none;position:fixed;right:20px;bottom:90px;width:320px;background:rgba(15,23,42,0.92);backdrop-filter:blur(20px);border:1px solid rgba(100,150,255,0.15);border-radius:16px;padding:16px;box-sizing:border-box;color:#e2e8f0;font-family:system-ui,sans-serif;box-shadow:0 20px 40px rgba(0,0,0,0.5);z-index:9999;}
      #music-player-panel h3{margin:0 0 12px;font-size:16px;color:#60a5fa;text-align:center;}
      #now-title{font-size:15px;font-weight:600;margin:8px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      #now-info{font-size:13px;color:#94a3b8;margin-bottom:12px;}
      #mp-controls{display:flex;justify-content:center;gap:20px;margin:12px 0;}
      #mp-controls button{background:none;border:none;color:#fff;font-size:28px;cursor:pointer;opacity:0.8;transition:.2s;}
      #mp-controls button:hover{opacity:1;transform:scale(1.15);}
      #mp-progress{position:relative;height:6px;background:rgba(255,255,255,0.15);border-radius:3px;cursor:pointer;margin:10px 0;overflow:hidden;}
      #mp-progress-fill{height:100%;width:0;background:#00ff88;border-radius:3px;transition:width .1s;}
      #mp-progress-thumb{position:absolute;top:50%;left:0;width:14px;height:14px;background:#00ff88;border-radius:50%;transform:translate(-50%,-50%);opacity:0;transition:all .2s;box-shadow:0 0 12px #00ff8822;}
      #mp-progress:hover #mp-progress-thumb{opacity:1;transform:translate(-50%,-50%) scale(1.4);}
      #mp-time{font-size:12px;color:#94a3b8;text-align:center;margin-bottom:8px;}
      #mp-volume{position:relative;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;cursor:pointer;margin:12px 0;}
      #mp-volume-fill{height:100%;width:70%;background:#00ff88;border-radius:2px;}
      #mp-volume-thumb{position:absolute;top:50%;left:70%;width:10px;height:10px;background:#00ff88;border-radius:50%;transform:translate(-50%,-50%);}
      #mp-plist-btn{width:100%;background:none;border:1px solid rgba(100,150,255,0.3);color:#94a3b8;padding:8px;border-radius:8px;cursor:pointer;font-size:13px;transition:.2s;}
      #mp-plist-btn:hover{background:rgba(100,150,255,0.1);color:#fff;}
      #mp-playlist{display:none;max-height:240px;overflow-y:auto;margin-top:8px;border-radius:8px;background:rgba(0,0,0,0.2);padding:4px 0;}
      .plist-item{padding:8px 12px;cursor:pointer;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:.2s;}
      .plist-item:hover{background:rgba(100,150,255,0.15);}
      .plist-item.active{color:#00ff88;font-weight:600;background:rgba(0,255,136,0.12);}
      ::-webkit-scrollbar{width:6px;}
      ::-webkit-scrollbar-track{background:transparent;}
      ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2);border-radius:3px;}
      ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.35);}
    `;
    const style = document.createElement('style');
    style.id = 'simple-music-player-css';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
