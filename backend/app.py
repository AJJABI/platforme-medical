from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime
from werkzeug.utils import secure_filename
from predict import PneumoniaPredictor

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
DATABASE = os.path.join(BASE_DIR, "predictions.db")
MODEL_PATH = os.path.join(BASE_DIR, "../model/pneumonia_cnn.pth")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)

try:
    predictor = PneumoniaPredictor(MODEL_PATH)
    MODEL_AVAILABLE = True
except Exception as e:
    MODEL_AVAILABLE = False
    print(f"⚠️ Modèle non chargé: {e}")

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            prediction TEXT,
            confidence REAL
        )
    """)
    conn.commit()
    conn.close()

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def index():
    return send_from_directory("../frontend", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("../frontend", path)

@app.route("/api/predict", methods=["POST"])
def predict():
    if not MODEL_AVAILABLE:
        return jsonify({"error": "Modèle non disponible"}), 500

    if "image" not in request.files:
        return jsonify({"error": "Aucune image envoyée"}), 400

    file = request.files["image"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Fichier invalide"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    result = predictor.predict(filepath)
    
    if result.get("success"):
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO predictions (timestamp, prediction, confidence) VALUES (?, ?, ?)",
            (datetime.now().isoformat(), result["prediction"], result["confidence"])
        )
        conn.commit()
        conn.close()

    return jsonify(result)

@app.route("/api/predictions", methods=["GET"])
def get_predictions():
    try:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM predictions ORDER BY timestamp DESC")
        rows = cursor.fetchall()
        conn.close()
        return jsonify([dict(row) for row in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/predictions", methods=["POST"])
def save_prediction():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Pas de données"}), 400
        
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO predictions (timestamp, prediction, confidence) VALUES (?, ?, ?)",
            (data.get("timestamp"), data.get("prediction"), data.get("confidence"))
        )
        conn.commit()
        cursor.execute("SELECT last_insert_rowid()")
        last_id = cursor.fetchone()[0]
        conn.close()
        
        return jsonify({"success": True, "id": last_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/predictions/<int:prediction_id>", methods=["DELETE"])
def delete_prediction(prediction_id):
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM predictions WHERE id = ?", (prediction_id,))
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        return jsonify({"success": success}), 200 if success else 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    init_db()
    app.run(debug=True)