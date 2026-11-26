

import { createHash, timingSafeEqual } from "node:crypto";

const digest = value =>
  createHash("sha256").update(value).digest();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  const key = process.env.OPENAI_API_KEY;
  const accessCode = process.env.ZERKALO_ACCESS_CODE;

  if (!key || !accessCode || accessCode.length < 20) {
    return res.status(503).json({ error: "Сервер не настроен" });
  }

  const supplied = req.headers["x-zerkalo-access-code"];

  if (
    typeof supplied !== "string" ||
    !timingSafeEqual(digest(supplied), digest(accessCode))
  ) {
    return res.status(401).json({ error: "Неверный код доступа" });
  }

  const { message, history } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Введите сообщение" });
  }

  if (message.length > 4000) {
    return res.status(400).json({ error: "Сообщение слишком длинное" });
  }

  const context = Array.isArray(history)
    ? history.slice(-12)
        .filter(item =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string" &&
          item.content.trim()
        )
        .map(item => ({
          role: item.role,
          content: item.content.slice(0, 4000)
        }))
    : [];

  context.push({
    role: "user",
    content: message.trim()
  });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        store: false,
        instructions: `Ты — ЗЕРКАЛО, цифровой спутник человека.
Общайся естественно, тепло и прямо, на русском языке.
Учитывай предыдущие сообщения разговора.
Не заставляй человека повторять то, что он уже рассказал.
Не льсти и не придумывай факты.
Разделяй наблюдения и предположения.
Не анализируй человека без его запроса.
Задавай вопросы только когда они полезны.
Помогай человеку увидеть себя, но не навязывай выводы.`,
        input: context,
        max_output_tokens: 600
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(502).json({
          error: "Проверь баланс и лимиты OpenAI API"
        });
      }
      return res.status(502).json({
        error: "OpenAI не принял запрос"
      });
    }

    const data = await response.json();

    const reply = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n");

    return res.status(200).json({
      reply: reply || "Ответ не получен"
    });
  } catch (error) {
    console.error("ZERKALO_CONNECT", error?.name);
    return res.status(502).json({
      error: "Не удалось связаться с OpenAI"
    });
  }
}
