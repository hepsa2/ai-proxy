import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();

// ✅ 限制跨域（更安全）
app.use(cors({
  origin: "*", // 你可以后面改成只允许你的 github pages 域名
}));

app.use(express.json());

// ✅ 简单限流（防刷）
const requestCounts = new Map();
const LIMIT = 20; // 每分钟最多20次

setInterval(() => {
  requestCounts.clear();
}, 60 * 1000);

const OPENROUTER_KEY = process.env.OPENROUTER_KEY;

// ✅ 健康检查（浏览器直接访问用）
app.get('/', (req, res) => {
  res.send('AI proxy is running');
});

app.get('/ai', (req, res) => {
  res.send('Use POST /ai');
});

app.post('/ai', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // ✅ 限流检查
  const count = requestCounts.get(ip) || 0;
  if (count > LIMIT) {
    return res.status(429).json({ error: "Too many requests" });
  }
  requestCounts.set(ip, count + 1);

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "No prompt provided" });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_KEY}`
      },
      body: JSON.stringify({
        model: "arcee-ai/trinity-large-preview:free",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const text = await response.text(); // ✅ 先拿原始内容
    console.log("OpenRouter原始返回:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({ error: "OpenRouter返回非JSON", raw: text });
    }

    // ✅ 检查 API 错误
    if (!response.ok) {
      return res.status(response.status).json({
        error: "OpenRouter API error",
        detail: data
      });
    }

    const msg = data.choices?.[0]?.message?.content;

    if (!msg) {
      return res.status(500).json({
        error: "AI返回异常",
        raw: data
      });
    }

    res.json({ result: msg });

  } catch (err) {
    console.error("服务器错误:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
