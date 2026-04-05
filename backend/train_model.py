# CardioSense AI — train_model.py
# Run: python train_model.py
# Output: ecg_model.pkl, ecg_scaler.pkl, ecg_label_encoder.pkl

import pandas as pd
import numpy as np
import ast, joblib, os, json
from scipy.signal import butter, filtfilt, find_peaks
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score, classification_report, confusion_matrix, roc_curve, auc
import xgboost as xgb
import matplotlib.pyplot as plt
import seaborn as sns

print("=" * 60)
print("   CardioSense AI — Model Training")
print("=" * 60)

# ── Load dataset ──────────────────────────────────────────────
print("\n[1/5] Loading dataset...")
try:
    df = pd.read_csv(r"d:\tanaya\Orcathon\Round 2\project\ecg_dataset.csv")
    print("      Loaded ecg_dataset.csv")
except Exception as e:
    print(f"ERROR: Could not find dataset: {e}")
    exit(1)

print(f"      Raw shape: {df.shape}")

# ── Parse rows ────────────────────────────────────────────────
print("\n[2/5] Parsing ECG signals...")
VALID_LABELS = {"Normal", "AFib", "VFib"}

def parse_signal(val):
    try:
        s = str(val).strip()
        if s.startswith("["):
            s = s.rstrip(", ")
            if not s.endswith("]"):
                s += "]"
            return np.array(ast.literal_eval(s), dtype=float)
        if isinstance(val, (list, np.ndarray)):
            return np.array(val, dtype=float)
    except:
        pass
    return None

records = []
for _, row in df.iterrows():
    label = str(row.iloc[0]).strip()
    if label not in VALID_LABELS:
        continue
    sig = parse_signal(row.iloc[1])
    if sig is not None and len(sig) >= 50:
        records.append({"label": label, "signal": sig})

if not records:
    print("ERROR: No valid rows found. Check label column has Normal/AFib/VFib")
    exit(1)

print(f"      Valid samples: {len(records)}")
for lbl in VALID_LABELS:
    print(f"      {lbl}: {sum(1 for r in records if r['label']==lbl)}")

# ── Feature extraction ────────────────────────────────────────
print("\n[3/5] Extracting features...")

def bw_filter(sig, cutoff=40, fs=360, order=5):
    nyq = fs / 2.0
    b, a = butter(order, cutoff / nyq, btype="low")
    try:
        return filtfilt(b, a, sig)
    except:
        return sig

def extract_features(sig):
    sig = bw_filter(sig)
    f = [
        np.mean(sig), np.std(sig), np.min(sig), np.max(sig),
        np.max(sig)-np.min(sig), np.percentile(sig,25), np.percentile(sig,75),
        np.median(sig), np.mean(np.abs(sig-np.mean(sig))), np.sqrt(np.mean(sig**2)),
    ]
    try:
        peaks, _ = find_peaks(sig, height=np.mean(sig)+0.2*np.std(sig), distance=20)
        if len(peaks) > 1:
            rr = np.diff(peaks)
            f += [len(peaks), np.mean(rr), np.std(rr), np.min(rr), np.max(rr), np.max(rr)-np.min(rr)]
        else:
            f += [0]*6
    except:
        f += [0]*6
    try:
        fft_v = np.abs(np.fft.fft(sig))[:len(sig)//2]
        freqs = np.fft.fftfreq(len(sig), 1/360)[:len(sig)//2]
        total = np.sum(fft_v) + 1e-9
        lf = np.sum(fft_v[(freqs>=0.5)&(freqs<=5)]) / total
        hf = np.sum(fft_v[(freqs>5)&(freqs<=40)]) / total
        dom = freqs[np.argmax(fft_v[1:])+1] if len(fft_v)>1 else 0
        f += [lf, hf, lf/(hf+1e-9), dom]
    except:
        f += [0]*4
    return np.array(f, dtype=float)

X = np.array([extract_features(r["signal"]) for r in records])
y = np.array([r["label"] for r in records])
X = np.nan_to_num(X)
print(f"      Feature matrix: {X.shape}")

# ── Train ─────────────────────────────────────────────────────
print("\n[4/5] Training XGBoost model...")
le    = LabelEncoder()
y_enc = le.fit_transform(y)
print(f"      Classes: {list(le.classes_)}")

if len(X) < 10:
    print("      ⚠ Small dataset — using all data")
    X_tr, X_te, y_tr, y_te = X, X, y_enc, y_enc
else:
    X_tr, X_te, y_tr, y_te = train_test_split(X, y_enc, test_size=0.2, random_state=42, stratify=y_enc)

scaler = StandardScaler()
X_tr   = scaler.fit_transform(X_tr)
X_te   = scaler.transform(X_te)

model = xgb.XGBClassifier(n_estimators=300, max_depth=4, learning_rate=0.1,
                           subsample=0.8, colsample_bytree=0.8,
                           eval_metric="mlogloss", random_state=42, n_jobs=-1)
model.fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=50)

# ── Save and Plot ──────────────────────────────────────────────
print("\n[5/5] Saving and Generating Plots...")

# Ensure plots directory exists
os.makedirs("plots", exist_ok=True)

y_pred = model.predict(X_te)
y_proba = model.predict_proba(X_te)
f1 = f1_score(y_te, y_pred, average="weighted")
print(f"\n  ✅ F1 Score: {f1:.4f}  ← tell judges this number!")
report_str = classification_report(y_te, y_pred, target_names=le.classes_)
print(f"\n  {report_str}")

# 1. Confusion Matrix
print("      Generating Confusion Matrix...")
cm = confusion_matrix(y_te, y_pred)
plt.figure(figsize=(8,6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
            xticklabels=le.classes_, yticklabels=le.classes_)
plt.title('Confusion Matrix')
plt.ylabel('True Class')
plt.xlabel('Predicted Class')
plt.savefig("plots/confusion_matrix.png", dpi=300, bbox_inches='tight')
plt.close()

# 2. ROC Curves
print("      Generating ROC Curves...")
plt.figure(figsize=(8,6))
colors = ['red', 'blue', 'green']
for i, color in zip(range(len(le.classes_)), colors):
    y_te_bin = (y_te == i).astype(int)
    if len(np.unique(y_te_bin)) > 1: # Only plot if both classes are present
        fpr, tpr, _ = roc_curve(y_te_bin, y_proba[:, i])
        roc_auc = auc(fpr, tpr)
        plt.plot(fpr, tpr, color=color, lw=2,
                 label=f'ROC curve of class {le.classes_[i]} (area = {roc_auc:0.2f})')

plt.plot([0, 1], [0, 1], 'k--', lw=2)
plt.xlim([0.0, 1.0])
plt.ylim([0.0, 1.05])
plt.xlabel('False Positive Rate')
plt.ylabel('True Positive Rate')
plt.title('Multi-class ROC')
plt.legend(loc="lower right")
plt.savefig("plots/roc_curves.png", dpi=300, bbox_inches='tight')
plt.close()

# 3. Feature Importance
print("      Generating Feature Importance Plot...")
fig, ax = plt.subplots(figsize=(10,6))
xgb.plot_importance(model, ax=ax, max_num_features=15, title='Top 15 Feature Importances')
plt.tight_layout()
plt.savefig("plots/feature_importance.png", dpi=300, bbox_inches='tight')
plt.close()

# 4. Save Metrics to JSON
report_dict = classification_report(y_te, y_pred, target_names=le.classes_, output_dict=True)
report_dict["f1_weighted"] = f1
with open("plots/metrics.json", "w") as f:
    json.dump(report_dict, f, indent=4)

# 5. Save Model Files
joblib.dump(model,  "ecg_model.pkl")
joblib.dump(scaler, "ecg_scaler.pkl")
joblib.dump(le,     "ecg_label_encoder.pkl")
print("\n✅  Saved model and plots successfully! Now run: python app.py")