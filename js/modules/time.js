// 北京时间卡片
function updateBeijingTime() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const bj = new Date(utc + 8 * 3600000);
    const pad = n => String(n).padStart(2, '0');
    document.querySelector('#time-card .date').textContent = 
        `${bj.getFullYear()}-${pad(bj.getMonth()+1)}-${pad(bj.getDate())}`;
    document.querySelector('#time-card .time').textContent = 
        `${pad(bj.getHours())}:${pad(bj.getMinutes())}:${pad(bj.getSeconds())}`;
}
updateBeijingTime();
setInterval(updateBeijingTime, 1000);
