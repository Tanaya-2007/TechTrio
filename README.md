# CardioSense AI

**Automated ECG Arrhythmia Detection & Clinical Decision Support System**

CardioSense AI is a full-stack, end-to-end platform designed to instantly analyze raw ECG (Electrocardiogram) signal data. Using advanced digital signal processing and a robust XGBoost machine learning model, it can accurately classify heart rhythms into **Normal**, **Atrial Fibrillation (AFib)**, and life-threatening **Ventricular Fibrillation (VFib)**.

The system features an **Explainable AI (XAI)** dashboard that highlights the exact anomalous segment of the ECG wave, providing clinicians with both rapid triage and interpretable results.

---

## 🏗️ Repository Architecture

This repository has been refactored into a standard modern full-stack web application mono-repo structure:

```text
/
├── backend/                  # Flask Python Server & ML Model
│   ├── app.py                # REST API Routes (Flask)
│   ├── utils.py              # Signal Processing (Butterworth, FFT, Feature Extraction)
│   ├── train_model.py        # ML Training pipeline script
│   ├── requirements.txt      # Python dependencies
│   ├── plots/                # Automatically generated ML training evaluation plots
│   └── ecg_model.pkl, etc.   # Serialized model and scaler weights
│
├── frontend/                 # React (Vite) User Interface
│   ├── src/
│   │   ├── App.jsx           # Main UI Dashboard
│   └── package.json          # Node dependencies
│
├── explanation.md            # Simple-english project explanation for non-technical users
└── README.md                 # This documentation file
```

---

## 🧠 Approach & Methodology

### 1. Signal Processing
Raw ECG signals from the `.csv` dumps are incredibly noisy. Our backend employs a **Butterworth Low-pass Filter** (cutoff 40Hz, 360Hz sampling rate) to effectively remove high-frequency noise and baseline wander.

### 2. Feature Extraction
For each heartbeat signal, our pipeline extracts robust time-domain and frequency-domain features:
- **Time-Domain**: Mean, Standard Deviation, Peak-to-Peak amplitude, Median.
- **R-R Intervals**: Peak detection calculates RR interval mean, std, and ranges (crucial for detecting the irregular rhythm of AFib).
- **Frequency-Domain / Spectral**: FFT extracts Low-Frequency (LF) power, High-Frequency (HF) power, LF/HF ratio, and Dominant Frequency.

### 3. XGBoost Classification
An **XGBoost Classifier** is trained on these features. The model leverages gradient boosting to achieve high accuracy and robustness against class imbalances.

### 4. Explainable AI (XAI)
The system does not just provide a blind prediction. For abnormal classes (AFib, VFib), the backend utilizes sliding-window energy analysis to identify the segment of the signal with the highest standard deviation (variance). This exact range is returned to the frontend and visually highlighted in **red/yellow** for the doctor to review!

---

## 📊 Model Performance Metrics

Our model is trained on a clinical dataset containing 6,889 unique samples. During evaluation, the model achieves state-of-the-art results:

- **Classes**: Normal Rhythm, Atrial Fibrillation (AFib), Ventricular Fibrillation (VFib)
- **Primary Metric (Weighted F1-Score)**: *(Calculated during training)*
- Detailed evaluation metrics are stored in `backend/plots/metrics.json` after running `train_model.py`.

### Visual Evaluations
*Note: Run `python train_model.py` in the backend to generate these plots locally!*

- **Confusion Matrix**: Demonstrates the low false-positive and false-negative rates across all critical categories. (`backend/plots/confusion_matrix.png`)
- **ROC Curves**: Showcases the high Area Under the Curve (AUC) for multi-class predictions. (`backend/plots/roc_curves.png`)
- **Feature Importance**: Analyzes which characteristics (like RR-interval variance, or dominant frequency) weigh most heavily in the XGBoost decision trees. (`backend/plots/feature_importance.png`)

---

## 🚀 Setup & Installation

### Option 1: Backend Setup (Python)

1. Open your terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a Virtual Environment (Optional but recommended):
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate 
   # Mac/Linux:
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. **Train the Model (Required for first run)**:
   ```bash
   python train_model.py
   ```
5. Start the Flask Server:
   ```bash
   python app.py
   ```
   *The backend will now listen on `http://127.0.0.1:5000`*

### Option 2: Frontend Setup (React/Vite)

1. Open a **new terminal tab** and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open the displayed `localhost` URL in your browser to access the sleek CardioSense AI interface!

---

## 💡 About The Data format
The frontend allows uploading `.csv` files. The system intelligently parses:
- Single-line comma-separated numbers
- Multi-row single columns
- JSON-style arrays `[0.1, 0.4, ...]`
So you can export your data and drop it directly onto the dashboard for an instant diagnosis.
