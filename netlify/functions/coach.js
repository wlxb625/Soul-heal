const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const STRUCTURED_PLAN_PROMPT = [
  "你是【愈格】软件的专属AI性格成长助手。",
  "你必须先阅读用户的性格特点、MBTI、测试可信度、雷达画像、当前场景和历史对话，再针对用户这一次的问题做分析。",
  "你的输出必须只是一段 JSON 对象，不要输出 Markdown、解释文字或代码块。",
  "JSON 结构必须是：{\"summary\":string,\"analysis\":string,\"plan_groups\":[{\"group_name\":string,\"group_description\":string,\"plans\":[{\"plan_name\":string,\"plan_description\":string,\"estimated_days\":number,\"completion_threshold\":number,\"tasks\":[{\"task_description\":string}]}]}]}",
  "summary 要先说明你读取到的性格特点和本次问题之间的关系。",
  "analysis 要指出用户在该场景里的核心卡点，必须结合 MBTI 或未完成测试状态来表达。",
  "计划分组 2 到 4 组，每组 2 到 3 个计划，每个计划 3 到 6 个任务。",
  "任务必须具体、可勾选、适合放入计划簿，不能写空泛口号。",
  "所有字段名必须使用英文；所有字段值必须使用中文。"
].join("\n");

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

function sanitizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch (error) {
    return "";
  }
}

function normalizeBaseUrl(provider, value) {
  const raw = sanitizeBaseUrl(value).replace(/\/chat\/completions\/?$/i, "");
  if (!raw) return provider === "gemini_native" ? DEFAULT_GEMINI_BASE_URL : DEFAULT_OPENAI_BASE_URL;
  if (provider === "gemini_native") return raw;
  try {
    const url = new URL(raw);
    if (url.hostname === "api.openai.com" && (url.pathname === "" || url.pathname === "/")) {
      return `${url.origin}/v1`;
    }
  } catch (error) {
    return raw;
  }
  return raw;
}

async function readJsonResponseSafe(response) {
  const rawText = await response.text();
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch (error) {
    return { message: rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
  }
}

function extractErrorMessage(error) {
  const message = String(error?.error?.message || error?.message || "未知错误").trim();
  return message.replace(/\s+/g, " ").slice(0, 240);
}

function extractOpenAiReply(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => typeof part === "string" ? part : String(part?.text || ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractGeminiReply(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => String(part?.text || "").trim()).filter(Boolean).join("\n").trim();
}

function parseJsonObject(rawText) {
  const text = String(rawText || "").trim();
  try {
    return JSON.parse(text);
  } catch (error) {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) throw error;
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  }
}

function cleanText(value, fallback = "") {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function normalizeStructuredPlan(candidate) {
  if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.plan_groups)) return null;
  const groups = candidate.plan_groups.slice(0, 4).map((group, groupIndex) => {
    const plans = Array.isArray(group?.plans)
      ? group.plans.slice(0, 3).map((plan, planIndex) => {
          const tasks = Array.isArray(plan?.tasks)
            ? plan.tasks.slice(0, 6).map((task) => ({
                task_description: cleanText(task?.task_description)
              })).filter((task) => task.task_description)
            : [];
          if (tasks.length < 3) return null;
          return {
            plan_name: cleanText(plan?.plan_name, `行动计划 ${planIndex + 1}`),
            plan_description: cleanText(plan?.plan_description, "围绕当前问题设计的一组练习。"),
            estimated_days: Math.max(3, Math.min(60, Math.round(Number(plan?.estimated_days) || 14))),
            completion_threshold: Math.max(0.3, Math.min(1, Number(plan?.completion_threshold) || 0.75)),
            tasks
          };
        }).filter(Boolean)
      : [];
    if (plans.length < 1) return null;
    return {
      group_name: cleanText(group?.group_name, `计划分组 ${groupIndex + 1}`),
      group_description: cleanText(group?.group_description, "结合性格特点设计的阶段练习。"),
      plans
    };
  }).filter(Boolean);
  return groups.length ? { plan_groups: groups } : null;
}

function formatWarning(rawReply) {
  const text = cleanText(rawReply, "模型已返回内容，但没有按计划 JSON 格式输出。");
  return text.length > 260 ? `${text.slice(0, 260)}...` : text;
}

function buildFallbackStructuredPlan(input, rawReply) {
  const scenario = cleanText(input.scenario, "当前场景");
  const message = cleanText(input.message, "当前问题");
  const modelAdvice = formatWarning(rawReply);
  return {
    plan_groups: [
      {
        group_name: "先理解问题",
        group_description: "先把模型给出的建议和你的性格特点对应起来，避免直接套模板行动。",
        plans: [
          {
            plan_name: `${scenario}分析整理`,
            plan_description: modelAdvice,
            estimated_days: 7,
            completion_threshold: 0.67,
            tasks: [
              { task_description: `写下这次问题的具体表现：${message}` },
              { task_description: "标出其中最受性格特点影响的一处卡点" },
              { task_description: "把模型建议里最容易执行的一条改成今天能做的小动作" }
            ]
          }
        ]
      },
      {
        group_name: "低成本行动",
        group_description: "先用小动作验证建议是否适合你，再逐步增加难度。",
        plans: [
          {
            plan_name: "一次微练习",
            plan_description: "选择一个压力较低的场景做最小尝试。",
            estimated_days: 7,
            completion_threshold: 0.67,
            tasks: [
              { task_description: "选择一个 10 分钟内可以完成的行动" },
              { task_description: "行动前写下自己最担心的一个点" },
              { task_description: "行动后记录实际结果和下一次调整" }
            ]
          }
        ]
      }
    ]
  };
}

function parsePlanOrFallback(rawReply, input) {
  try {
    const parsed = parseJsonObject(rawReply);
    const structuredPlan = normalizeStructuredPlan(parsed);
    if (structuredPlan) {
      return {
        reply: cleanText(parsed.summary, "我已结合你的性格特点和当前问题整理出一套建议。"),
        analysis: cleanText(parsed.analysis),
        structuredPlan,
        usedFallback: false
      };
    }
  } catch (error) {
    // Fall through to preserve the model's natural-language advice.
  }

  return {
    reply: "模型已经接通，但没有按计划 JSON 格式输出；我先把它转成可执行计划。",
    analysis: formatWarning(rawReply),
    structuredPlan: buildFallbackStructuredPlan(input, rawReply),
    usedFallback: true
  };
}

function buildSystemContext(input) {
  const context = input.personalityContext || {};
  const history = Array.isArray(input.historyMessages) ? input.historyMessages.slice(-8) : [];
  return [
    `当前场景：${cleanText(input.scenario, "通用成长场景")}`,
    `用户问题：${cleanText(input.message)}`,
    `MBTI：${cleanText(context.mbti, "未完成测试")}`,
    `MBTI 来源：${cleanText(context.mbtiSource, "none")}`,
    `测试信度：${Number(context.reliability) || 0}`,
    `匹配度：${Number(context.match) || 0}`,
    `性格特点雷达：${Array.isArray(context.radar) && context.radar.length ? context.radar.join(", ") : "暂无"}`,
    history.length
      ? `历史对话摘要：${history.map((item) => `${item.role === "assistant" ? "AI" : "用户"}：${cleanText(item.text || item.content).slice(0, 500)}`).join("\n")}`
      : "历史对话摘要：暂无"
  ].join("\n");
}

async function requestOpenAiCompatible(input, systemContext) {
  const baseUrl = normalizeBaseUrl("openai_compatible", input.baseUrl);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`
    },
    body: JSON.stringify({
      model: input.model || "gpt-4.1-mini",
      temperature: 0.65,
      messages: [
        { role: "system", content: STRUCTURED_PLAN_PROMPT },
        { role: "system", content: `性格特点与上下文：\n${systemContext}` },
        { role: "user", content: input.message }
      ]
    })
  });
  const payload = await readJsonResponseSafe(response);
  if (!response.ok) throw new Error(extractErrorMessage(payload));
  return { rawReply: extractOpenAiReply(payload), baseUrl };
}

async function requestGeminiNative(input, systemContext) {
  const baseUrl = normalizeBaseUrl("gemini_native", input.baseUrl);
  const response = await fetch(`${baseUrl}/models/${encodeURIComponent(input.model || "gemini-1.5-flash")}:generateContent?key=${encodeURIComponent(input.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${STRUCTURED_PLAN_PROMPT}\n\n性格特点与上下文：\n${systemContext}` }] },
      contents: [{ role: "user", parts: [{ text: input.message }] }],
      generationConfig: { temperature: 0.65 }
    })
  });
  const payload = await readJsonResponseSafe(response);
  if (!response.ok) throw new Error(extractErrorMessage(payload));
  return { rawReply: extractGeminiReply(payload), baseUrl };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch (error) {
    return json(400, { message: "请求格式不正确" });
  }

  input.message = cleanText(input.message);
  input.apiKey = cleanText(input.apiKey);
  input.provider = input.provider === "gemini_native" ? "gemini_native" : "openai_compatible";

  if (!input.message) return json(400, { message: "请先输入你想对助手说的话" });
  if (!input.apiKey) return json(400, { message: "请先到设置里填写 API Key" });

  try {
    const systemContext = buildSystemContext(input);
    const aiResult = input.provider === "gemini_native"
      ? await requestGeminiNative(input, systemContext)
      : await requestOpenAiCompatible(input, systemContext);
    const planResult = parsePlanOrFallback(aiResult.rawReply, input);

    return json(200, {
      source: "custom-api",
      mode: "structured-plan",
      provider: input.provider,
      model: input.model,
      baseUrl: aiResult.baseUrl,
      reply: planResult.reply,
      analysis: planResult.analysis,
      structuredPlan: planResult.structuredPlan,
      formatWarning: planResult.usedFallback
    });
  } catch (error) {
    return json(502, { message: `你的 AI 接口请求失败：${extractErrorMessage(error)}` });
  }
};
