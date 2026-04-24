const express = require("express");

const router = express.Router();

const CHATBOT_URL = (process.env.CHATBOT_URL || "http://127.0.0.1:5001").replace(/\/$/, "");

router.post("/chat", async (req, res) => {
  const message = req.body && typeof req.body.message === "string" ? req.body.message : "";

  try {
    const r = await fetch(`${CHATBOT_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        reply: "Trợ lý AI trả về dữ liệu không hợp lệ. Vui lòng thử lại sau."
      });
    }

    if (!r.ok) {
      return res.status(502).json({
        reply:
          (data && typeof data.reply === "string" && data.reply) ||
          "Trợ lý AI tạm thời không phản hồi. Vui lòng thử lại sau."
      });
    }

    res.json({ reply: String(data && data.reply != null ? data.reply : "") });
  } catch (err) {
    console.error("[chatbot proxy]", err.message);
    res.status(502).json({
      reply: "Không kết nối được dịch vụ trợ lý. Hãy bật server ChatbotAI (Flask) theo hướng dẫn trong ChatbotAI/HUONG_DAN_CHATBOT.md."
    });
  }
});

module.exports = router;
