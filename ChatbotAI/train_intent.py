import pandas as pd
import pickle
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB

# đọc dữ liệu
data = pd.read_csv("intent.csv").dropna()

# vector hóa
vectorizer = CountVectorizer()
X = vectorizer.fit_transform(data["text"])
y = data["intent"]

# train model
model = MultinomialNB()
model.fit(X, y)

# lưu model
with open("models/model.pkl", "wb") as f:
    pickle.dump(model, f)

with open("models/vectorizer.pkl", "wb") as f:
    pickle.dump(vectorizer, f)

print("✅ Train xong!")