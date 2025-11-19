 jsmodulesmusic-player.js —— 终极融合版（零外部依赖）
(() = {
    const e = document.getElementById('music-player-entry');
    if (!e) return;

    const defaultList = [
        {t雨的旋律, a周杰伦, smusic01.mp3},
        {t青花瓷, a周杰伦, smusic02.mp3},
        {t夜曲, a周杰伦, smusic03.mp3},
         支持在线：{t在线歌曲, a未知, shttpsxxx.comxxx.mp3},
    ];

    e.innerHTML = `div id=music-player-btndiv class=icon♫divdiv
    div id=music-player-panel
        h3♪ 音乐播放器h3
        div id=now-title点击播放列表开始div
        div id=now-artistFrey's Playlistdiv
        div id=mp-controls
            button id=mp-prev⏮button
            button id=mp-play▶button
            button id=mp-next⏭button
        div
        div id=mp-progressdiv id=mp-progress-filldivdiv id=mp-progress-thumbdivdiv
        div id=mp-timespan id=mp-cur000spanspan id=mp-dur000spandiv
        div id=mp-volumediv id=mp-volume-fill style=width70%divdiv id=mp-volume-thumb style=left70%divdiv
        button id=mp-plist-btn播放列表 ▾button
        div id=mp-playlistdiv
    divaudio id=mp-audio preload=metadataaudio`;

    const audio = document.getElementById('mp-audio');
    const panel = document.getElementById('music-player-panel');
    const btn = document.getElementById('music-player-btn');
    const playBtn = document.getElementById('mp-play');
    const prev = document.getElementById('mp-prev');
    const next = document.getElementById('mp-next');
    const prog = document.getElementById('mp-progress');
    const progFill = document.getElementById('mp-progress-fill');
    const curT = document.getElementById('mp-cur');
    const durT = document.getElementById('mp-dur');
    const vol = document.getElementById('mp-volume');
    const volFill = document.getElementById('mp-volume-fill');
    const title = document.getElementById('now-title');
    const artist = document.getElementById('now-artist');
    const plistBtn = document.getElementById('mp-plist-btn');
    const plist = document.getElementById('mp-playlist');

    let list = [...defaultList], idx = 0;

    const fmt = s = `${Math.floor(s60)}${(Math.floor(s%60)+'').padStart(2,'0')}`;
    const render = () = {
        plist.innerHTML = list.map((x,i)=`div class=mp-item ${i===idx'active'''} data-i=${i}${x.t} - ${x.a}div`).join('');
    };
    const load = i = {
        idx = (i + list.length) % list.length;
        const s = list[idx];
        audio.src = s.s; title.textContent = s.t; artist.textContent = s.a;
        render(); audio.play().catch(()=0); playBtn.textContent='❚❚';
    };

    audio.addEventListener('timeupdate', () = {
        if(!audio.duration) return;
        const p = audio.currentTime  audio.duration;
        progFill.style.width = p100+'%';
        curT.textContent = fmt(audio.currentTime);
    });
    audio.addEventListener('loadedmetadata',()=durT.textContent=fmt(audio.duration));
    audio.addEventListener('ended',()=load(idx+1));

    prog.onclick = e = { const r=prog.getBoundingClientRect(); audio.currentTime = audio.duration  (e.clientX-r.left)r.width; };
    vol.onclick = e = { const r=vol.getBoundingClientRect(); const v=(e.clientX-r.left)r.width; audio.volume=v; volFill.style.width=v100+'%'; };
    playBtn.onclick = () = audio.paused  (audio.play(),playBtn.textContent='❚❚')  (audio.pause(),playBtn.textContent='▶');
    prev.onclick = () = load(idx-1);
    next.onclick = () = load(idx+1);
    plist.onclick = e = { const el=e.target.closest('.mp-item'); if(el) load(+el.dataset.i); };
    plistBtn.onclick = () = {
        const on = plist.style.display==='block';
        plist.style.display = on'none''block';
        plistBtn.textContent = on'播放列表 ▾''播放列表 ▴';
    };
    btn.onclick = () = panel.style.display = panel.style.display==='block''none''block';

     初始化
    audio.volume = 0.7;
    render();
    list.length && load(0);

     彩蛋：拖拽本地音乐文件到页面任意位置即可播放
    document.body.addEventListener('dragover', e=e.preventDefault());
    document.body.addEventListener('drop', e={
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if(f && f.type.startsWith('audio')){
            const url = URL.createObjectURL(f);
            list.push({t f.name.replace(.[^.]+$,''), a'本地音乐', surl});
            render(); load(list.length-1);
        }
    });
})();