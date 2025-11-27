const express = require('express');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const path = require('path'); 

const app = express();
const port = 3000;

// 1. 中间件配置
app.use(bodyParser.json());

// ⭐ 静态文件服务：将所有前端文件（HTML, CSS, JS等）暴露给 /public 目录 ⭐
// 必须将您本地仓库的所有前端文件上传到服务器的 /home/FreyMessageAPI/public 目录下
app.use(express.static(path.join(__dirname, 'public')));


// 2. 数据库初始化 (使用 SQLite)
// 数据库文件将创建在 /home/FreyMessageAPI/guestbook.db
const db = new Database('guestbook.db');

// 创建留言表 (如果不存在)
db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// ===================================
// 3. API 路由
// ===================================

// A. 提交新留言 (POST /api/message)
app.post('/api/message', (req, res) => {
    const { name, content } = req.body;
    
    if (!name || !content) {
        return res.status(400).json({ error: '姓名和内容不能为空' });
    }
    
    try {
        const stmt = db.prepare('INSERT INTO messages (name, content) VALUES (?, ?)');
        const info = stmt.run(name, content);
        // 返回包含时间戳的完整对象
        res.status(201).json({ 
            success: true, 
            id: info.lastInsertRowid, 
            name, 
            content, 
            timestamp: new Date().toISOString() 
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: '留言保存失败' });
    }
});

// B. 获取所有留言 (GET /api/messages)
app.get('/api/messages', (req, res) => {
    try {
        // 按时间倒序返回所有留言
        const messages = db.prepare('SELECT id, name, content, timestamp FROM messages ORDER BY timestamp DESC').all();
        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: '获取留言失败' });
    }
});

// 4. 启动服务器
app.listen(port, () => {
    console.log(`🚀 留言板 API/静态服务 运行在端口 ${port}`);
});
