const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");

// ===== TIME =====
function getCurrentTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${hours}:${minutes} ${ampm}`;
}

// ===== CREATE MESSAGE =====
function createMessageElement(text, type, time = "") {
  const message = document.createElement("div");
  message.className = `message ${type}`;
  message.innerHTML = `
    ${text}
    ${time ? `<div class="message-time">${time}</div>` : ""}
  `;
  return message;
}

// ===== SCROLL =====
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== ADD USER =====
function appendUserMessage(text) {
  const userMessage = createMessageElement(text, "user", getCurrentTime());
  chatMessages.appendChild(userMessage);
  scrollToBottom();
}

// ===== ADD BOT =====
function appendBotMessage(text) {
  const botMessage = createMessageElement(text, "bot", getCurrentTime());
  chatMessages.appendChild(botMessage);
  scrollToBottom();
}

// ===== SEND MESSAGE (GỌI BACKEND) =====
window.sendMessage = async function () {
  const value = chatInput.value.trim();

  if (!value) {
    alert("Vui lòng nhập nội dung.");
    return;
  }

  appendUserMessage(value);
  chatInput.value = "";

  // 👉 loading fake
  const loading = createMessageElement("🤖 Đang xử lý...", "bot");
  chatMessages.appendChild(loading);
  scrollToBottom();

  try {
    const res = await fetch("http://127.0.0.1:5000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: value })
    });

    const data = await res.json();

    // xóa loading
    chatMessages.removeChild(loading);

    appendBotMessage(data.reply);

  } catch (error) {
    chatMessages.removeChild(loading);
    appendBotMessage("⚠️ Không kết nối được server!");
  }
};

// ===== ENTER KEY =====
document.addEventListener("DOMContentLoaded", function () {
  chatInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      window.sendMessage();
    }
  });

  scrollToBottom();
});