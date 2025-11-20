// js/modules/music-player.js  ——  GitHub Pages 终极防弹版
let initialized = false;
let audio = null;
let panel = null;
let playlist = [];
let currentIndex = 0;
let isRandom = false;

export function initMusicPlayer() {
    if (initialized) {
        panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
        return;
    }
    initialized = true;

    // 创建面板（省略样式，和之前一样） —— 直接用你上个版本的面板代码即可
    panel = document.createElement('div');
    panel.id = 'music-player-panel';
    panel.style.cssText = 'position:fixed;left:20px;bottom:90px;width:280px;padding:16px;border-radius:14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(12px);color:#cfe8ff;z-index:99999;display:flex;flex-direction:column;gap:12px;font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.4)';
    panel.innerHTML = `/* 你之前复制的面板 HTML 保持不变 */`;

    document.body.appendChild(panel);

    // 样式注入（保持不变）
    const style = document.createElement('style');
    style.textContent = `/* 你之前复制的样式保持不变 */`;
    document.head.appendChild(style);

    audio = new Audio();
    audio.volume = 0.7;

    // 关键修复：用相对路径 + HEAD 检查文件是否存在
    fetch('music/music-list.json?' + Date.now())
        .then(r => r.json())
        .then(list => {
            playlist = list.map(f => 'music/' + f.trim());

            // 预检查第一首是否真的能访问
            tryPlayNextValidSong();
        })
        .catch(() => {
            document.getElementById('songTitle').textContent = '歌单加载失败';
        });

    async function tryPlayNextValidSong() {
        if (playlist.length === 0) {
            document.getElementById('songTitle').textContent = '无音乐文件';
            return;
        }

        while (playlist.length > 0) {
            const url = playlist[currentIndex];
            const exists = await checkFileExists(url);
            if (exists) {
                loadAndPlay(url);
                updateSongTitle(url);
                return;
            } else {
                console.warn('文件不存在，跳过:', url);
                playlist.splice(currentIndex, 1); // 删除坏文件
                if (playlist.length === 0) {
                    document.getElementById('songTitle').textContent = '无有效音乐文件';
                    return;
                }
                currentIndex = currentIndex % playlist.length;
            }
        }
    }

    // 检查文件是否真的存在（治愈 404 的终极方案）
    async function checkFileExists(url) {
        try {
            const r = await fetch(url, { method: 'HEAD' });
            return r.ok;
        } catch (e) {
            return false;
        }
    }

    function loadAndPlay(url) {
        audio.src = url;
        audio.load();
        audio.play().catch(() => {
            document.getElementById('playBtn').textContent = '▶';
        });
    }

    function updateSongTitle(url) {
        const name = decodeURIComponent(url.split('/').pop().replace('.mp3', ''));
        document.getElementById('songTitle').textContent = name;
    }

    // 播放/暂停（防报错）
    document.getElementById('playBtn').onclick = () => {
        if (audio.paused) {
            audio.play().then(() => document.getElementById('playBtn').textContent = '⏸');
        } else {
            audio.pause();
            document.getElementById('playBtn').textContent = '▶';
        }
    };

    // 上一首 / 下一首（自动跳过坏文件）
    panel.querySelectorAll('.mini-btn')[0].onclick = () => {
        currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        tryPlayNextValidSong();
    };
    panel.querySelectorAll('.mini-btn')[2].onclick = () => {
        currentIndex = isRandom ? Math.floor(Math.random() * playlist.length) : (currentIndex + 1) % playlist.length;
        tryPlayNextValidSong();
    };

    // 其他事件（进度条、音量、随机）保持不变……
    // （直接复制你上个版本的对应代码即可）

    // 自动下一首
    audio.onended = () => panel.querySelectorAll('.mini-btn')[2].click();
}

// DOM 加载完绑定按钮
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('music-player-btn')?.addEventListener('click', initMusicPlayer);
});
