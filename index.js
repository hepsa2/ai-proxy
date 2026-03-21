import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
app.use(cors()); // 允许所有域名访问
const app = express();
app.use(cors());
app.use(express.json());

const OPENROUTER_KEY = process.env.OPENROUTER_KEY;

app.post('/ai', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "No prompt provided" });

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

    const data = await response.json();
    const msg = data.choices?.[0]?.message?.content || "AI 未返回内容";
    res.json({ result: msg });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
