/**
 * Trợ lý chat — dùng chung mọi trang bệnh nhân.
 * Cần: config.js (CONFIG.API_BASE_URL), nút .chat-btn trên trang.
 * API: POST {API_BASE_URL}/chatbot/chat  body: { message }
 */
(function () {
  if (window.__clinicarePatientChatbotInit) return;
  window.__clinicarePatientChatbotInit = true;

  function apiBase() {
    if (typeof CONFIG !== "undefined" && CONFIG && CONFIG.API_BASE_URL) {
      return String(CONFIG.API_BASE_URL).replace(/\/$/, "");
    }
    return "http://localhost:5000/api";
  }

  function chatUrl() {
    return apiBase() + "/chatbot/chat";
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function nowTime() {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  const STYLE_ID = "clinicare-patient-chatbot-styles";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .clinicare-chat-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.35);z-index:10050;display:none;align-items:flex-end;justify-content:flex-end;padding:16px;box-sizing:border-box;}
      .clinicare-chat-overlay.is-open{display:flex;}
      .clinicare-chat-panel{width:min(420px,calc(100vw - 32px));max-height:min(560px,calc(100vh - 32px));background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.18);display:flex;flex-direction:column;overflow:hidden;font-family:Inter,system-ui,sans-serif;}
      .clinicare-chat-head{background:#2F56C0;color:#fff;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0;}
      .clinicare-chat-head-title{display:flex;align-items:center;gap:10px;font-weight:600;font-size:15px;}
      .clinicare-chat-head-icon{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;}
      .clinicare-chat-close{background:transparent;border:none;color:#fff;cursor:pointer;padding:6px;line-height:1;border-radius:8px;font-size:20px;}
      .clinicare-chat-close:hover{background:rgba(255,255,255,0.15);}
      .clinicare-chat-hint{background:#f1f5f9;color:#475569;font-size:12px;line-height:1.45;padding:10px 14px;border-bottom:1px solid #e2e8f0;flex-shrink:0;}
      .clinicare-chat-messages{flex:1;min-height:200px;max-height:340px;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;background:#fafafa;}
      .clinicare-chat-msg{max-width:88%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5;word-wrap:break-word;}
      .clinicare-chat-msg.bot{align-self:flex-start;background:#e2e8f0;color:#1e293b;}
      .clinicare-chat-msg.user{align-self:flex-end;background:#3754bf;color:#fff;}
      .clinicare-chat-msg .clinicare-chat-time{margin-top:6px;font-size:11px;opacity:0.75;}
      .clinicare-chat-foot{border-top:1px solid #e2e8f0;padding:12px 14px;background:#fff;flex-shrink:0;}
      .clinicare-chat-row{display:flex;gap:8px;align-items:center;}
      .clinicare-chat-input{flex:1;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font-size:14px;outline:none;}
      .clinicare-chat-input:focus{border-color:#2F56C0;box-shadow:0 0 0 2px rgba(47,86,192,0.15);}
      .clinicare-chat-send{width:42px;height:42px;border:none;border-radius:12px;background:#2F56C0;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .clinicare-chat-send:hover{filter:brightness(1.05);}
      .clinicare-chat-send:disabled{opacity:0.5;cursor:not-allowed;}
      .clinicare-chat-disclaimer{font-size:11px;color:#64748b;text-align:center;margin-top:10px;line-height:1.4;}
    `;
    document.head.appendChild(style);
  }

  function buildPanel() {
    injectStyles();
    const overlay = document.createElement("div");
    overlay.className = "clinicare-chat-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Trợ lý CliniCare");

    overlay.innerHTML = `
      <div class="clinicare-chat-panel">
        <div class="clinicare-chat-head">
          <div class="clinicare-chat-head-title">
            <span class="clinicare-chat-head-icon">+</span>
            <span>Trợ lý CliniCare</span>
          </div>
          <button type="button" class="clinicare-chat-close" aria-label="Đóng">&times;</button>
        </div>
        <div class="clinicare-chat-hint">Gợi ý: mô tả triệu chứng (vd: &quot;tôi bị đau đầu&quot;), hỏi địa chỉ/giờ làm việc, hoặc &quot;khoa nội ở đâu&quot;.</div>
        <div class="clinicare-chat-messages" id="clinicareChatMessages"></div>
        <div class="clinicare-chat-foot">
          <div class="clinicare-chat-row">
            <input type="text" class="clinicare-chat-input" id="clinicareChatInput" placeholder="Nhập câu hỏi hoặc triệu chứng..." autocomplete="off" />
            <button type="button" class="clinicare-chat-send" id="clinicareChatSend" aria-label="Gửi">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
          <div class="clinicare-chat-disclaimer">Tư vấn sơ bộ, không thay thế khám bác sĩ.</div>
        </div>
      </div>
    `;

    const panel = overlay.querySelector(".clinicare-chat-panel");
    const messagesEl = overlay.querySelector("#clinicareChatMessages");
    const input = overlay.querySelector("#clinicareChatInput");
    const sendBtn = overlay.querySelector("#clinicareChatSend");
    const closeBtn = overlay.querySelector(".clinicare-chat-close");

    function appendMessage(text, who) {
      const div = document.createElement("div");
      div.className = "clinicare-chat-msg " + who;
      div.innerHTML =
        escapeHtml(text) +
        `<div class="clinicare-chat-time">${escapeHtml(nowTime())}</div>`;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    appendMessage(
      "Xin chào, tôi có thể gợi ý khoa theo triệu chứng hoặc trả lời thông tin phòng khám.",
      "bot"
    );

    function setOpen(open) {
      overlay.classList.toggle("is-open", open);
      if (open) {
        setTimeout(() => input.focus(), 80);
      }
    }

    function toggle() {
      setOpen(!overlay.classList.contains("is-open"));
    }

    closeBtn.addEventListener("click", () => setOpen(false));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) setOpen(false);
    });

    async function send() {
      const value = input.value.trim();
      if (!value) return;

      appendMessage(value, "user");
      input.value = "";

      const loading = document.createElement("div");
      loading.className = "clinicare-chat-msg bot";
      loading.textContent = "Đang xử lý…";
      messagesEl.appendChild(loading);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      sendBtn.disabled = true;
      try {
        const res = await fetch(chatUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: value })
        });
        const data = await res.json().catch(() => ({}));
        messagesEl.removeChild(loading);
        const reply =
          typeof data.reply === "string"
            ? data.reply
            : "Không nhận được phản hồi hợp lệ.";
        appendMessage(reply, "bot");
      } catch {
        messagesEl.removeChild(loading);
        appendMessage("Không kết nối được máy chủ. Hãy chạy backend Node và dịch vụ ChatbotAI.", "bot");
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        send();
      }
    });

    document.body.appendChild(overlay);

    return { overlay, toggle, setOpen };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const ui = buildPanel();
    document.querySelectorAll(".chat-btn").forEach((btn) => {
      btn.setAttribute("role", "button");
      if (!btn.getAttribute("tabindex")) btn.setAttribute("tabindex", "0");
      const openChat = (e) => {
        e.preventDefault();
        e.stopPropagation();
        ui.toggle();
      };
      btn.addEventListener("click", openChat);
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ui.toggle();
        }
      });
    });
  });
})();
