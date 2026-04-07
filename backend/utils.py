import numpy as np
import pandas as pd
import ast
from scipy.signal import butter, filtfilt, find_peaks

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

def get_highlight(signal, prediction):
    if prediction == "Normal":
        return None
    try:
        cleaned = bw_filter(signal)
        window  = min(50, len(cleaned)//4)
        energy  = np.array([np.std(cleaned[i:i+window]) for i in range(len(cleaned)-window)])
        start   = int(np.argmax(energy))
        return {"start": start, "end": start + window}
    except:
        n = len(signal)
        return {"start": n//3, "end": (2*n)//3}

def parse_csv_signal(file):
    """
    Supports multiple CSV formats:
    1. Single row, single column with JSON string: '[0.03, 0.04, ...]'
    2. Multiple rows, single numeric column
    3. Single row, multiple columns
    4. Header 'signal' with string array
    """
    content = file.read().decode("utf-8")
    file.seek(0)
    
    # Try reading it via pandas to handle 'signal' header natively
    try:
        df = pd.read_csv(pd.io.common.StringIO(content))
        if "signal" in df.columns:
            val = df["signal"].dropna().iloc[0]
            s = str(val).strip()
            if s.startswith("["):
                s = s.rstrip(", ")
                if not s.endswith("]"):
                    s += "]"
                return np.array(ast.literal_eval(s), dtype=float)
            else:
                col = df["signal"].dropna().values.astype(float)
                if len(col) >= 50:
                    return col
    except:
        pass

    lines = content.strip().split("\n")
    if len(lines) >= 1:
        first = lines[0].strip().strip('"')
        if first.startswith("["):
            try:
                first = first.rstrip(", ")
                if not first.endswith("]"):
                    first += "]"
                return np.array(ast.literal_eval(first), dtype=float)
            except:
                pass
    try:
        df = pd.read_csv(pd.io.common.StringIO(content), header=None)
        row = df.iloc[0].dropna().values.astype(float)
        if len(row) >= 50:
            return row
        col = df.iloc[:,0].dropna().values.astype(float)
        if len(col) >= 50:
            return col
    except:
        pass
    try:
        vals = [float(l.split(",")[0].strip()) for l in lines if l.strip()]
        if len(vals) >= 50:
            return np.array(vals)
    except:
        pass
    return None
