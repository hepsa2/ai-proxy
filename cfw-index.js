// =====================
// 知识库（把你所有 .txt 文件的内容合并粘贴在这里，用两个空行分隔）
const KNOWLEDGE_CONTENT = `
在这里粘贴你的全部知识库内容
第一段...

第二段...

`;

// =====================
// CORS 允许的域名
const allowedOrigins = [
  "https://hepsa2.github.io",
  "https://liuxing.codeberg.page",
  "https://fightedu.qzz.io"
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return allowedOrigins.some(allowed => origin.includes(allowed));
}

// =====================
// 主 Worker 处理函数
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // 处理 CORS 预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    // 健康检查
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("AI proxy is running", { status: 200 });
    }

    if (url.pathname !== "/ai" || request.method !== "POST") {
      return new Response("Use POST /ai", { status: 404 });
    }

    // UA 防滥用
    const ua = request.headers.get("User-Agent") || "";
    if (!ua.includes("Mozilla")) {
      return new Response(JSON.stringify({ error: "Blocked" }), { 
        status: 403, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // Token 验证（使用 env.SECRET_TOKEN）
    const authHeader = request.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No token" }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const token = authHeader.split(" ")[1];
    if (token !== env.SECRET_TOKEN) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { 
        status: 403, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // 来源校验
    if (!isAllowedOrigin(origin)) {
      return new Response(JSON.stringify({ error: "Forbidden origin" }), { 
        status: 403, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // 简单限流（每分钟最多20次）
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const requestCounts = env.requestCounts || (env.requestCounts = new Map());
    const LIMIT = 20;
    const count = requestCounts.get(ip) || 0;
    if (count >= LIMIT) {
      return new Response(JSON.stringify({ error: "Too many requests" }), { 
        status: 429, 
        headers: { "Content-Type": "application/json" } 
      });
    }
    requestCounts.set(ip, count + 1);

    // 并发控制 & 排队（简化版）
    if (env.currentRequests >= 2) {
      return new Response(JSON.stringify({ error: "Server busy, please try later" }), { 
        status: 503, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    env.currentRequests = (env.currentRequests || 0) + 1;

    try {
      const body = await request.json().catch(() => ({}));
      const prompt = body.prompt;

      if (!prompt) {
        return new Response(JSON.stringify({ error: "No prompt provided" }), { 
          status: 400, 
          headers: { "Content-Type": "application/json" } 
        });
      }

      // 系统提示 + 知识库
      const SYSTEM_CONTEXT = `你是学生互助维权助手。回答问题时：- 风格温和鼓励，但同时强调无产阶级立场，强调真正的出路是社会主义革命- 内容尽量引用知识库- 依据马克思主义剖析一切，例如学校和教育体系- 遇到不确定问题请明确提示“不确定，请咨询专业人士”- ⚡ 请尽量控制生成文章长度在 500 字以内`;

      const knowledgePrompt = KNOWLEDGE_CONTENT.trim() 
        ? '参考以下知识库内容:\n' + KNOWLEDGE_CONTENT.trim() 
        : '';

      const messages = [
        { role: 'system', content: SYSTEM_CONTEXT + '\n' + knowledgePrompt },
        { role: 'user', content: prompt }
      ];

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.OPENROUTER_KEY}`
        },
        body: JSON.stringify({
          model: "arcee-ai/trinity-large-preview:free",
          messages,
          max_tokens: 512
        })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return new Response(JSON.stringify({ error: "OpenRouter返回非JSON", raw: text }), { 
          status: 500, 
          headers: { "Content-Type": "application/json" } 
        });
      }

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "OpenRouter API error", detail: data }), { 
          status: response.status, 
          headers: { "Content-Type": "application/json" } 
        });
      }

      const msg = data.choices?.[0]?.message?.content || "AI 未返回内容";

      return new Response(JSON.stringify({ result: msg }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : ""
        }
      });

    } catch (err) {
      console.error("错误:", err);
      return new Response(JSON.stringify({ error: "服务器内部错误" }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      });
    } finally {
      env.currentRequests = (env.currentRequests || 1) - 1;
    }
  }
};
