// js/modules/music-player.js
class MusicPlayer {
  constructor() {
    this.playlist = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.shuffleMode = false;
    this.repeatMode = false; // true=单曲循环，false=列表循环

    this.audio = new Audio();
    this.musicBasePath = 'music/';                  // mp3 文件所在文件夹
    this.listPath = 'music/music-list.json';        // 歌单文件路径

    this.initDOM();
    this.loadPlaylist();
    this.bindEvents();
    this.createEntryButton();
  }

  initDOM() {
    const playerHTML = `
      <div id="music-player">
        <div class="player-bg"></div>
        <div class="player-content">
          <div class="player-header">
            <div class="player-title">Frey 的小宇宙电台</div>
            <div class="player-close">✕</div>
          </div>

          <div class="player-cover">
            <div class="cover-rotating">
              <div class="cover-img" style="background-image:url('music/cover.jpg')"></div>
            </div>
            <div class="play-pause-center" id="bigPlayBtn">
              <svg viewBox="0 0 100 100"><path d="M30 25 L30 75 L75 50 Z"/></svg>
            </div>
          </div>

          <div class="player-info">
            <div class="song-title" id="songTitle">加载中...</div>
            <div class="song-artist">Frey's Collection</div>
          </div>

          <div class="player-progress">
            <span id="currentTime">0:00</span>
            <div class="progress-bar" id="progressBar">
              <div class="progress-filled" id="progressFilled"></div>
              <div class="progress-knob" id="progressKnob"></div>
            </div>
            <span id="duration">--:--</span>
          </div>

          <div class="player-controls">
            <button id="shuffleBtn" class="ctrl-btn" title="随机播放">🔀</button>
            <button id="prevBtn" class="ctrl-btn">⏮</button>
            <button id="playBtn" class="ctrl-btn play-btn">▶</button>
            <button id="nextBtn" class="ctrl-btn">⏭</button>
            <button id="repeatBtn" class="ctrl-btn" title="重复模式">🔁</button>
          </div>

          <div class="player-volume">
            <span>🔊</span>
            <div class="volume-bar" id="volumeBar">
              <div class="volume-filled" id="volumeFilled"></div>
              <div class="volume-knob" id="volumeKnob"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', playerHTML);

    // 注入 CSS（只注入一次）
    if (!document.getElementById('music-player-style')) {
      const style = document.createElement('style');
      style.id = 'music-player-style';
      style.textContent = `
        #music-player{width:360px;height:560px;position:fixed;right:20px;bottom:80px;z-index:9999;opacity:0;pointer-events:none;transition:all .4s cubic-bezier(0.22,1,0.36,1);border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.6);backdrop-filter:blur(20px);}
        #music-player.visible{opacity:1;pointer-events:all;bottom:90px;}
        .player-bg{position:absolute;inset:0;background:linear-gradient(135deg,rgba(30,10,60,0.8),rgba(10,30,60,0.8));background-size:400% 400%;animation:gradient 15s ease infinite;}
        .player-content{position:relative;height:100%;padding:20px;box-sizing:border-box;display:flex;flex-direction:column;color:#fff;font-family:system-ui,-apple-system,sans-serif;}
        .player-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
        .player-title{font-size:16px;font-weight:600;}
        .player-close{cursor:pointer;font-size:20px;opacity:0.7;transition:.3s;}
        .player-close:hover{opacity:1;transform:scale(1.2);}
        .player-cover{position:relative;width:100%;height:260px;margin:10px 0;}
        .cover-rotating{width:200px;height:200px;margin:0 auto;border-radius:50%;overflow:hidden;background:#111;position:relative;box-shadow:0 10px 30px rgba(0,0,0,0.6);animation:rotate 20s linear infinite paused;}
        .cover-rotating.playing{animation-play-state:running;}
        .cover-img{background-size:cover;background-position:center;width:100%;height:100%;}
        .play-pause-center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:.3s;}
        .play-pause-center:hover{opacity:0.8;}
        .play-pause-center svg{width:80px;height:80px;fill:#fff;}
        .player-info{text-align:center;margin:16px 0;}
        .song-title{font-size:18px;font-weight:600;overflow:hidden;white-space:nowrap;text-shadow:0 0 10px rgba(0,255,136,0.5);}
        .song-title span{display:inline-block;padding-left:100%;animation:marquee 15s linear infinite;}
        .song-artist{font-size:14px;opacity:0.8;margin-top:4px;}
        .player-progress{display:flex;align-items:center;gap:10px;font-size:13px;margin:10px 0;}
        .progress-bar{flex:1;height:6px;background:rgba(255,255,255,0.2);border-radius:3px;position:relative;cursor:pointer;}
        .progress-filled{height:100%;width:0;background:#00ff88;border-radius:3px;transition:width .1s;}
        .progress-knob{position:absolute;top:50%;left:0;width:14px;height:14px;background:#00ff88;border-radius:50%;transform:translate(-50%,-50%);opacity:0;transition:all .2s;box-shadow:0 0 10px #00ff8833;}
        .progress-bar:hover .progress-knob{opacity:1;transform:translate(-50%,-50%) scale(1.3);}
        .player-controls{display:flex;justify-content:center;align-items:center;gap:20px;margin:10px 0;}
        .ctrl-btn{background:none;border:none;color:#fff;font-size:28px;cursor:pointer;opacity:0.7;transition:.3s;}
        .ctrl-btn:hover{opacity:1;transform:scale(1.15);}
        .ctrl-btn.active{opacity:1;color:#00ff88;}
        .play-btn{font-size:36px !important;}
        .player-volume{display:flex;align-items:center;gap:8px;font-size:13px;}
        .volume-bar{width:80px;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;position:relative;cursor:pointer;}
        .volume-filled{height:100%;width:70%;background:#00ff88;border-radius:2px;}
        .volume-knob{position:absolute;top:50%;left:70%;width:10px;height:10px;background:#00ff88;border-radius:50%;transform:translate(-50%,-50%);}
        #music-player-entry{position:fixed;right:24px;bottom:24px;z-index:999;cursor:pointer;width:56px;height:56px;background:rgba(0,255,136,0.15);backdrop-filter:blur(10px);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 8px 20px rgba(0,255,136,0.3);transition:all .3s;}
        #music-player-entry:hover{transform:scale(1.15) rotate(20deg);}
        @keyframes rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes marquee{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
        @keyframes gradient{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
      `;
      document.head.appendChild(style);
    }
  }

  createEntryButton() {
    const entry = document.createElement('div');
    entry.id = 'music-player-entry';
    entry.innerHTML = '🎵';
    entry.title = '打开音乐播放器';
    document.body.appendChild(entry);

    entry.onclick = () => document.getElementById('music-player').classList.toggle('visible');
    document.querySelector('.player-close').onclick = () => document.getElementById('music-player').classList.remove('visible');
  }

  async loadPlaylist() {
    try {
      const res = await fetch(this.listPath + '?t=' + Date.now());
      if (!res.ok) throw new Error('加载歌单失败');
      const files = await res.json();
      this.playlist = files.map(file => this.musicBasePath + file.trim());
      if (this.playlist.length > 0) this.playIndex(0);
    } catch (e) {
      document.getElementById('songTitle').textContent = '歌单加载失败';
      console.error(e);
    }
  }

  bindEvents() {
    const audio = this.audio;

    document.getElementById('playBtn').onclick = () => this.togglePlay();
    document.getElementById('bigPlayBtn').onclick = () => this.togglePlay();
    document.getElementById('nextBtn').onclick = () => this.next();
    document.getElementById('prevBtn').onclick = () => this.prev();
    document.getElementById('shuffleBtn').onclick = () => this.toggleShuffle();
    document.getElementById('repeatBtn').onclick = () => this.toggleRepeat();

    // 进度条拖动
    const progressBar = document.getElementById('progressBar');
    progressBar.onclick = e => {
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audio.currentTime = percent * audio.duration;
    };

    // 音量条
    const volumeBar = document.getElementById('volumeBar');
    volumeBar.onclick = e => {
      const rect = volumeBar.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.volume = percent;
      this.updateVolumeUI();
    };

    // Audio 事件
    audio.addEventListener('loadedmetadata', () => this.updateDuration());
    audio.addEventListener('timeupdate', () => this.updateProgress());
    audio.addEventListener('ended', () => this.next());

    // 默认音量 70%
    audio.volume = 0.7;
    this.updateVolumeUI();
  }

  playIndex(idx) {
    if (this.playlist.length === 0) return;
    this.currentIndex = ((idx % this.playlist.length) + this.playlist.length) % this.playlist.length;
    this.audio.src = this.playlist[this.currentIndex];
    this.audio.play().then(() => {
      this.isPlaying = true;
      this.updatePlayState();
      this.updateSongInfo();
    }).catch(e => console.error('播放失败', e));
  }

  togglePlay() {
    if (this.audio.paused) {
      if (!this.audio.src) this.playIndex(0);
      else this.audio.play();
    } else {
      this.audio.pause();
    }
    this.isPlaying = !this.audio.paused;
    this.updatePlayState();
  }

  next() {
    if (this.shuffleMode) {
      this.playIndex(Math.floor(Math.random() * this.playlist.length));
    } else {
      this.playIndex(this.currentIndex + 1);
    }
  }

  prev() {
    this.playIndex(this.currentIndex - 1);
  }

  toggleShuffle() {
    this.shuffleMode = !this.shuffleMode;
    document.getElementById('shuffleBtn').classList.toggle('active', this.shuffleMode);
  }

  toggleRepeat() {
    this.repeatMode = !this.repeatMode;
    const btn = document.getElementById('repeatBtn');
    btn.classList.toggle('active', this.repeatMode);
    btn.textContent = this.repeatMode ? '🔂' : '🔁';
  }

  updateSongInfo() {
    if (this.playlist.length === 0) return;
    const fileName = this.playlist[this.currentIndex].split('/').pop();
    const name = fileName.replace('.mp3', '').replace(/[ⅠⅡⅢ]/g, '').trim();
    document.getElementById('songTitle').innerHTML = `<span>${name}</span>`;
  }

  updatePlayState() {
    const playing = !this.audio.paused;
    document.querySelectorAll('#playBtn, #bigPlayBtn svg path').forEach(el => {
      el.setAttribute('d', playing ? 'M30 25 L30 75 M55 25 L55 75' : 'M30 25 L30 75 L75 50 Z');
    });
    document.querySelector('.cover-rotating').classList.toggle('playing', playing);
  }

  updateProgress() {
    if (!this.audio.duration) return;
    const percent = this.audio.currentTime / this.audio.duration;
    document.getElementById('progressFilled').style.width = (percent * 100) + '%';
    document.getElementById('progressKnob').style.left = (percent * 100) + '%';
    document.getElementById('currentTime').textContent = this.formatTime(this.audio.currentTime);
  }

  updateDuration() {
    document.getElementById('duration').textContent = this.formatTime(this.audio.duration);
  }

  updateVolumeUI() {
    const vol = this.audio.volume;
    document.getElementById('volumeFilled').style.width = (vol * 100) + '%';
    document.getElementById('volumeKnob').style.left = (vol * 100) + '%';
  }

  formatTime(sec) {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' + s : s}`;
  }
}

// 启动播放器
document.addEventListener('DOMContentLoaded', () => {
  window.musicPlayer = new MusicPlayer();
});
