import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const OPENROUTER_KEY = process.env.OPENROUTER_KEY; // 安全

app.post('/ai', async (req, res) => {
  const { prompt } = req.body;
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
    res.json({ result: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running...'));
