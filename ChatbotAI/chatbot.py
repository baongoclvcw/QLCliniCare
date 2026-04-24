import pickle
import json

# ===== LOAD MODEL =====
model = pickle.load(open("models/model.pkl", "rb"))
vectorizer = pickle.load(open("models/vectorizer.pkl", "rb"))

# ===== LOAD ENTITY (JSONL) =====
entity_patterns = []
with open("entity.json", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            entity_patterns.append(json.loads(line))

# ===== DETECT INTENT =====
def detect_intent(text):
    X = vectorizer.transform([text])
    return model.predict(X)[0]

# ===== EXTRACT ENTITY (SIÊU ỔN ĐỊNH) =====
import re

def extract_entities(text):
    text = text.lower().strip()
    entities = {"TRIEU_CHUNG": []}

    for item in entity_patterns:
        pattern = item["pattern"].lower()

        # 🔥 match đúng từ, không dính chữ
        if re.search(rf"\b{re.escape(pattern)}\b", text):
            if item["label"] == "TRIEU_CHUNG":
                entities["TRIEU_CHUNG"].append(pattern)
            else:
                entities[item["label"]] = pattern

    return entities

# ===== CONTEXT =====
context = {}

# ===== MAP TRIỆU CHỨNG → KHOA =====
symptom_to_department = {
    "đau đầu": "khoa thần kinh",
    "chóng mặt": "khoa thần kinh",
    "co giật": "khoa thần kinh",

    "đau ngực": "khoa tim mạch",
    "tim đập nhanh": "khoa tim mạch",

    "ho": "khoa hô hấp",
    "khó thở": "khoa hô hấp",
    "sổ mũi": "khoa hô hấp",
    "nghẹt mũi": "khoa hô hấp",

    "đau bụng": "khoa tiêu hóa",
    "tiêu chảy": "khoa tiêu hóa",
    "buồn nôn": "khoa tiêu hóa",

    "nổi mẩn": "khoa da liễu",
    "ngứa da": "khoa da liễu",

    "đau họng": "khoa tai mũi họng",

    "đau răng": "khoa răng hàm mặt",

    "tiểu buốt": "khoa tiết niệu",

    "đau lưng": "khoa chấn thương chỉnh hình",
    "đau khớp": "khoa chấn thương chỉnh hình",

    "sụt cân": "khoa ung bướu",

    "sốt": "khoa nội",
    "sốt cao": "khoa nội",
    "mệt mỏi": "khoa nội"
}

# ===== VỊ TRÍ KHOA =====
department_location = {
    "khoa nội": "tầng 1, khu A",
    "khoa ngoại": "tầng 1, khu B",
    "khoa nhi": "tầng 2, khu A",
    "khoa tim mạch": "tầng 2, khu B",
    "khoa tiêu hóa": "tầng 3, khu A",
    "khoa da liễu": "tầng 3, khu B",
    "khoa hô hấp": "tầng 4, khu A",
    "khoa tai mũi họng": "tầng 4, khu B",
    "khoa sản": "tầng 5, khu A",
    "khoa răng hàm mặt": "tầng 5, khu B",
    "khoa thần kinh": "tầng 3, khu B",
    "khoa tiết niệu": "tầng 2, khu C",
    "khoa nam khoa": "tầng 2, khu C",
    "khoa ung bướu": "tầng 6, khu A",
    "khoa chấn thương chỉnh hình": "tầng 6, khu B",
    "khoa hồi sức cấp cứu": "tầng trệt",
    "khoa chẩn đoán hình ảnh": "tầng 1, khu C",
    "khoa dinh dưỡng": "tầng 2, khu A",
    "khoa vật lý trị liệu": "tầng 3, khu C"
}

# ===== CHATBOT =====
def chatbot(message):
    global context

    msg = message.lower().strip()

    # ===== GREETING =====
    if any(x in msg for x in ["chào", "hello", "hi", "alo"]):
        return "Xin chào! Bạn hãy đặt câu hỏi chung hoặc mô tả triệu chứng để mình hỗ trợ nhé"

    # ===== ENTITY =====
    
    if not message or message.strip() == "":
        return " Vui lòng nhập triệu chứng"
    intent = detect_intent(message)
    entities = extract_entities(message)

    if entities.get("TRIEU_CHUNG"):
        context["TRIEU_CHUNG"] = entities["TRIEU_CHUNG"]

    if entities.get("KHOA"):
        context["KHOA"] = entities["KHOA"]

    # ===== HỎI VỊ TRÍ =====
    if "khoa" in msg and "ở đâu" in msg:

        if "KHOA" in entities:
            dept = entities["KHOA"]
            return f"📍 {dept} nằm ở {department_location.get(dept, 'chưa có thông tin')}"

        if "KHOA" in context:
            dept = context["KHOA"]
            return f"📍 {dept} nằm ở {department_location.get(dept, 'chưa có thông tin')}"

        return "⚠️ Bạn vui lòng nói rõ tên khoa"

    # ===== TRIỆU CHỨNG =====
    symptoms = entities.get("TRIEU_CHUNG", [])

    if symptoms:
        for s in symptoms:
            if s in symptom_to_department:
                dept = symptom_to_department[s]
                context["KHOA"] = dept
                return f"📌 Bạn nên khám {dept}"

        return "Chưa xác định được khoa phù hợp, vui lòng cung cấp thêm thông tin hoặc gọi số hotline để được hỗ trợ"

    # ===== INTENT =====
    intent = detect_intent(message)

    if intent == "HOSPITAL_INFO":

        if "địa chỉ" in msg or "ở đâu" in msg:
            return "📍 234 Bạch Đằng, Hải Châu, Đà Nẵng"

        if "giờ" in msg:
            return "⏰ 7h đến 16h30, từ thứ 2 tới thứ 6"

        if "số điện thoại" in msg:
            return "📞 0925012402"

        return "🏥 234 Bạch Đằng | 7h-16h30 | 0925012402"

    if intent == "GOODBYE":
        return "Tạm biệt!"

    return "Xin lỗi, tôi chưa hiểu câu hỏi. Bạn có thể hỏi lại rõ hơn không?"