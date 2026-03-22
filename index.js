import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();

// ✅ 限制跨域（可改成只允许你的 github pages 域名）
app.use(cors({ origin: "*" }));

app.use(express.json());

// ✅ 简单限流（防刷）
const requestCounts = new Map();
const LIMIT = 20; // 每分钟最多20次
setInterval(() => { requestCounts.clear(); }, 60 * 1000);

const OPENROUTER_KEY = process.env.OPENROUTER_KEY;

// ✅ 健康检查（浏览器直接访问用）
app.get('/', (req, res) => { res.send('AI proxy is running'); });
app.get('/ai', (req, res) => { res.send('Use POST /ai'); });

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
    // ✅ 系统提示 + 知识库
    const SYSTEM_CONTEXT = `你是学生互助维权助手。
回答问题时：
- 风格温和鼓励，但同时强调无产阶级立场，强调真正的出路是社会主义革命
- 内容尽量引用知识库
- 依据马克思主义针对性剖析问题，例如学校和教育体系
- 可以把生成的文本字数控制在800字内”`;



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
        messages
      })
    });

    const text = await response.text();
    console.log("OpenRouter原始返回:", text);

    let data;
    try { data = JSON.parse(text); } 
    catch (e) { return res.status(500).json({ error: "OpenRouter返回非JSON", raw: text }); }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "OpenRouter API error",
        detail: data
      });
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
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
