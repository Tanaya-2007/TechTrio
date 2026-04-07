import os
import pandas as pd
import numpy as np
import ast
import joblib
from utils import extract_features
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import warnings

warnings.filterwarnings("ignore")

# Define the datasets and their true labels
datasets = [
    ("Afib_Human.csv", "AFib"),
    ("Afib_Synthetic.csv", "AFib"),
    ("Normal_Sinus_Rhythm_Synthetic.csv", "Normal"),
    ("Vfib_Human.csv", "VFib"),
    ("Vfib_Synthetic.csv", "VFib")
]

# Load models
print("Loading model files...")
model = joblib.load("ecg_model.pkl")
scaler = joblib.load("ecg_scaler.pkl")
le = joblib.load("ecg_label_encoder.pkl")
print("Model loaded successfully.\n")

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

all_true_labels = []
all_pred_labels = []

# Process each internal dataset
for file_name, true_label in datasets:
    if not os.path.exists(file_name):
        print(f"Missing file: {file_name}")
        continue
        
    print(f"Processing {file_name} (Expected Output: {true_label})...")
    df = pd.read_csv(file_name)
    
    if "signal" not in df.columns:
        # Check if the first column is the signal
        df.rename(columns={df.columns[0]: "signal"}, inplace=True)

    features_list = []
    
    for row in df["signal"]:
        sig = parse_signal(row)
        if sig is not None and len(sig) >= 50:
            feats = extract_features(sig)
            features_list.append(feats)
            
    valid_count = len(features_list)
    if valid_count == 0:
        print(f"  --> Skipping {file_name}: No valid signals found.")
        continue
        
    X = np.array(features_list)
    X = np.nan_to_num(X)
    X_scaled = scaler.transform(X)
    
    preds_idx = model.predict(X_scaled)
    preds_labels = le.inverse_transform(preds_idx)
    
    acc = accuracy_score([true_label] * valid_count, preds_labels)
    all_true_labels.extend([true_label] * valid_count)
    all_pred_labels.extend(preds_labels)
    
    print(f"  Evaluated {valid_count} samples. Accuracy: {acc * 100:.2f}%")

print("\n" + "="*50)
print("   Overall Evaluation Results")
print("="*50)
if all_true_labels:
    overall_acc = accuracy_score(all_true_labels, all_pred_labels)
    print(f"Overall Accuracy: {overall_acc * 100:.2f}%\n")
    print("Classification Report:")
    print(classification_report(all_true_labels, all_pred_labels, target_names=le.classes_))
    
    print("Confusion Matrix:")
    cm = confusion_matrix(all_true_labels, all_pred_labels, labels=le.classes_)
    print("Rows: True Labels, Columns: Predicted Labels")
    print(f"Classes: {list(le.classes_)}")
    print(cm)
else:
    print("No data was evaluated.")
