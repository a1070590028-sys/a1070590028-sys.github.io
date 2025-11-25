// 获取中文星期几的名称
function getChineseWeekDay(dayIndex) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return '星期' + days[dayIndex];
}

// 北京时间卡片和面板更新
function updateBeijingTime() {
    const now = new Date();
    // 1. 计算 UTC 时间 (毫秒)
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    // 2. 转换为北京时间 (UTC + 8 小时)
    const bj = new Date(utc + 8 * 3600000);
    const pad = n => String(n).padStart(2, '0');

    const year = bj.getFullYear();
    const month = pad(bj.getMonth() + 1);
    const date = pad(bj.getDate());
    const hours = pad(bj.getHours());
    const minutes = pad(bj.getMinutes());
    const seconds = pad(bj.getSeconds());
    const weekDay = getChineseWeekDay(bj.getDay());

    // --- 1. 更新时间按钮 (#time-btn) ---
    const timeBtnDate = document.querySelector('#time-btn .date');
    const timeBtnTime = document.querySelector('#time-btn .time');
    if (timeBtnDate) timeBtnDate.textContent = `${year}-${month}-${date}`;
    if (timeBtnTime) timeBtnTime.textContent = `${hours}:${minutes}:${seconds}`;

    // --- 2. 更新详细面板 (#time-panel) ---
    const tpDate = document.getElementById('tp-date');
    const tpTime = document.getElementById('tp-time');
    const tpWeek = document.getElementById('tp-week');

    if (tpDate) tpDate.textContent = `${year} 年 ${month} 月 ${date} 日`;
    if (tpTime) tpTime.textContent = `${hours}:${minutes}:${seconds}`;
    if (tpWeek) tpWeek.textContent = weekDay;
}

// 面板开关逻辑
const timeBtn = document.getElementById('time-btn');
const timePanel = document.getElementById('time-panel');

if (timeBtn && timePanel) {
    // 切换面板显示/隐藏
    timeBtn.onclick = (e) => {
        e.stopPropagation();
        // 切换 display 状态
        timePanel.style.display = timePanel.style.display === 'block' ? 'none' : 'block';
    };

    // 确保点击面板内部不关闭
    timePanel.addEventListener('click', e => e.stopPropagation());
}


// 初始化和定时器
updateBeijingTime();
setInterval(updateBeijingTime, 1000);
