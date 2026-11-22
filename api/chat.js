export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Метод не поддерживается" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "API-ключ не настроен" });
  }

  try {
    const { message } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Введите сообщение" });
    }

    if (message.length > 4000) {
      return res.status(400).json({ error: "Сообщение слишком длинное" });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
        input: message,
        max_output_tokens: 600
      })
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "Не удалось получить ответ от ИИ"
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
    return res.status(500).json({
      error: "Ошибка сервера"
    });
  }
}
