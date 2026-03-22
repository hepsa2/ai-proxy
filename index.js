import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();

// =====================
// ✅ CORS 限制（只允许你的站点）
app.use(cors({
  origin: [
    "https://hepsa2.github.io",
    "https://liuxing.codeberg.page"
  ]
}));

app.use(express.json());

// =====================
// ✅ 简单限流（防刷）
const requestCounts = new Map();
const LIMIT = 20; // 每分钟最多20次

setInterval(() => {
  requestCounts.clear();
}, 60 * 1000);

// =====================
// ⚡ 并发限制 & 排队机制
let currentRequests = 0;
const MAX_CONCURRENT = 2; // 同时最多2个生成请求
const queue = [];

function enqueueRequest(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  while (currentRequests < MAX_CONCURRENT && queue.length > 0) {
    const { fn, resolve, reject } = queue.shift();
    currentRequests++;

    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        currentRequests--;
        processQueue();
      });
  }
}

// =====================
// 🔐 环境变量
const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
const SECRET_TOKEN = process.env.SECRET_TOKEN;

// =====================
// 健康检查
app.get('/', (req, res) => {
  res.send('AI proxy is running');
});

app.get('/ai', (req, res) => {
  res.send('Use POST /ai');
});

// =====================
// ✅ 读取 knowledge 文件夹里的所有 txt 文件
function loadKnowledge() {
  try {
    const folder = path.resolve('./knowledge');
    if (!fs.existsSync(folder)) return [];

    const files = fs.readdirSync(folder).filter(f => f.endsWith('.txt'));

    return files.map(f => {
      const content = fs.readFileSync(path.join(folder, f), 'utf-8');
      return content.trim();
    });
  } catch (err) {
    console.error("读取知识库错误:", err);
    return [];
  }
}

function getKnowledgePrompt() {
  const knowledgeList = loadKnowledge();
  if (!knowledgeList.length) return '';

  return '参考以下知识库内容:\n' + knowledgeList.join('\n\n');
}

// =====================
app.post('/ai', async (req, res) => {

  // 🔐 Token 验证
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token" });
  }

  const token = authHeader.split(" ")[1];
  if (token !== SECRET_TOKEN) {
    return res.status(403).json({ error: "Invalid token" });
  }

  // 🌐 来源校验（防盗用）
  const origin = req.headers.origin || "";
  if (
    !origin.includes("codeberg.page") &&
    !origin.includes("github.io")
  ) {
    return res.status(403).json({ error: "Forbidden origin" });
  }

  // 🌍 获取真实IP（更稳）
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket.remoteAddress;

  // ⛔ 限流
  const count = requestCounts.get(ip) || 0;
  if (count > LIMIT) {
    return res.status(429).json({ error: "Too many requests" });
  }
  requestCounts.set(ip, count + 1);

  // ⚡ 并发 + 排队
  enqueueRequest(async () => {

    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    try {
      // ✅ 系统提示 + 知识库
      const SYSTEM_CONTEXT = `你是学生互助维权助手。回答问题时：- 风格温和鼓励，但同时强调无产阶级立场，强调真正的出路是社会主义革命- 内容尽量引用知识库- 依据马克思主义剖析一切，例如学校和教育体系- 遇到不确定问题请明确提示“不确定，请咨询专业人士”- ⚡ 请尽量控制生成文章长度在 500 字以内`;

      const knowledgePrompt = getKnowledgePrompt();

      const messages = [
        { role: 'system', content: SYSTEM_CONTEXT + '\n' + knowledgePrompt },
        { role: 'user', content: prompt }
      ];

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_KEY}`
        },
        body: JSON.stringify({
          model: "arcee-ai/trinity-large-preview:free",
          messages,
          max_tokens: 512
        })
      });

      const text = await response.text();
      console.log("OpenRouter原始返回:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(500).json({ error: "OpenRouter返回非JSON", raw: text });
      }

      if (!response.ok) {
        return res.status(response.status).json({ error: "OpenRouter API error", detail: data });
      }

      const msg = data.choices?.[0]?.message?.content;

      if (!msg) {
        return res.status(500).json({ error: "AI返回异常", raw: data });
      }

      res.json({ result: msg });

    } catch (err) {
      console.error("服务器错误:", err);
      res.status(500).json({ error: err.message });
    }

  }).catch(err => {
    console.error("队列处理错误:", err);
    res.status(500).json({ error: "Server queue error" });
  });

});

// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
