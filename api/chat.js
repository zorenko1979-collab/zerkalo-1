
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

  const { message } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Введите сообщение" });
  }

  if (message.length > 4000) {
    return res.status(400).json({ error: "Сообщение слишком длинное" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: `Ты — ЗЕРКАЛО, цифровой спутник человека.
Общайся естественно, тепло и прямо, на русском языке.
Не льсти и не придумывай факты.
Разделяй наблюдения и предположения.
Не анализируй человека без его запроса.
Задавай вопросы только когда они полезны.`,
        input: message.trim(),
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
    console.error('ZERKALO_OPENAI_CONNECT', error?.name, error?.message, error?.cause?.code);
    return res.status(502).json({
      error: "Ошибка соединения: " + (error?.cause?.code || error?.name || "неизвестная")
  }
}
