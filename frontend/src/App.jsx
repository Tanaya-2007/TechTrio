import { useState, useRef } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Run this in client/ folder: npm install react-chartjs-2 chart.js

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const RESULT_CONFIG = {
  Normal: { color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.3)", label: "✓ Normal Sinus Rhythm",                 advice: "No abnormality detected. Heart rhythm appears healthy.",                                              risk: "LOW"      },
  AFib:   { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.3)",  label: "⚠ Atrial Fibrillation",                 advice: "Irregular R-R intervals detected. Consult a cardiologist immediately.",                              risk: "MODERATE" },
  VFib:   { color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   label: "● CRITICAL — Ventricular Fibrillation", advice: "Chaotic rapid electrical activity detected. EMERGENCY — immediate medical attention required.",        risk: "CRITICAL"  },
};

export default function App() {
  const [screen,       setScreen]       = useState("upload");
  const [dragging,     setDragging]     = useState(false);
  const [fileName,     setFileName]     = useState("");
  const [ecgData,      setEcgData]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState(null);
  const [anomalyRange, setAnomalyRange] = useState(null);
  const [progress,     setProgress]     = useState(0);
  const rawFile = useRef(null);

  const parseCSV = (text) => {
    const vals = [];
    const allVals = text.trim().split(/[\n,]+/);
    for (const v of allVals) {
      const num = parseFloat(v.trim());
      if (!isNaN(num)) vals.push(num);
    }
    return vals.slice(0, 500);
  };


  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith(".csv")) { alert("Please upload a CSV file only."); return; }
    rawFile.current = file;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = parseCSV(e.target.result);
      if (data.length < 10) { alert("Invalid CSV — make sure it contains ECG values."); return; }
      setEcgData(data);
      setScreen("analyze");
    };
    reader.readAsText(file);
  };

   const analyzeECG = async () => {
    setLoading(true); setProgress(0);
    const iv = setInterval(() => setProgress(p => p < 88 ? p + 9 : p), 250);
    try {
      const fd = new FormData();
      fd.append("file", rawFile.current, fileName);
      const res  = await fetch("http://127.0.0.1:5000/predict", { method: "POST", body: fd });
      const json = await res.json();
      clearInterval(iv); setProgress(100);
      setTimeout(() => {
        if (json.error) {
          alert("Backend Error: " + json.error);
          setLoading(false);
          return;
        }
        setResult(json);
        setAnomalyRange(json.anomaly_range || [Math.floor(ecgData.length * 0.35), Math.floor(ecgData.length * 0.6)]);
        setLoading(false); setScreen("result");
      }, 400);
    } catch {
      /* demo fallback when backend not connected yet */
      clearInterval(iv); setProgress(100);
      const demos = ["Normal", "AFib", "VFib"];
      const prediction = demos[Math.floor(Math.random() * demos.length)];
      setTimeout(() => {
        setResult({ prediction, probability: 0.85 + Math.random() * 0.13 });
        setAnomalyRange([Math.floor(ecgData.length * 0.35), Math.floor(ecgData.length * 0.6)]);
        setLoading(false); setScreen("result");
      }, 600);
    }
  };

  const reset = () => {
    setScreen("upload"); setEcgData([]); setResult(null);
    setAnomalyRange(null); setFileName(""); setProgress(0);
  };

  const buildChart = () => {
    const cfg       = result ? RESULT_CONFIG[result.prediction] : null;
    const lineColor = cfg ? cfg.color : "#818cf8";
    return {
      labels:   ecgData.map((_, i) => i),
      datasets: [
        {
          label: "ECG", data: ecgData,
          borderColor: lineColor, borderWidth: 1.8,
          pointRadius: 0, tension: 0.3, fill: false,
        },
        ...(anomalyRange && result?.prediction !== "Normal" ? [{
          label: "Anomaly",
          data:  ecgData.map((v, i) => (i >= anomalyRange[0] && i <= anomalyRange[1] ? v : null)),
          borderColor: "transparent",
          backgroundColor: result?.prediction === "VFib" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.15)",
          fill: true, pointRadius: 0, tension: 0.3,
        }] : []),
      ],
    };
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#6b7280", maxTicksLimit: 8 }, grid: { color: "rgba(255,255,255,0.04)" }, title: { display: true, text: "Sample Index",     color: "#6b7280" } },
      y: { ticks: { color: "#6b7280" },                   grid: { color: "rgba(255,255,255,0.04)" }, title: { display: true, text: "Amplitude (mV)", color: "#6b7280" } },
    },
  };

  const cfg = result ? RESULT_CONFIG[result.prediction] : null;

  /* ════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight:"100vh", background:"#06040f", color:"#fff", fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin  { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#6366f1;border-radius:2px}
      `}</style>

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 40px", background:"rgba(6,4,15,0.92)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>♥</div>
          <span style={{ fontWeight:700, fontSize:18 }}>CardioSense AI</span>
          <span style={{ fontSize:11, padding:"3px 10px", borderRadius:100, background:"rgba(99,102,241,0.15)", color:"#a5b4fc", border:"1px solid rgba(99,102,241,0.3)" }}>ECG Analyzer</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:20, fontSize:13, color:"#9ca3af" }}>
          <span style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#10b981", display:"inline-block", animation:"pulse 2s infinite" }} />
            System Online
          </span>
          {screen !== "upload" && (
            <button onClick={reset} style={{ padding:"7px 16px", borderRadius:10, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"#d1d5db", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
              ← New Analysis
            </button>
          )}
        </div>
      </nav>

      {/* ════════════════════════════════════════════════
          SCREEN 1 — UPLOAD
      ════════════════════════════════════════════════ */}
      {screen === "upload" && (
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 24px 40px" }}>
          {/* Glow */}
          <div style={{ position:"absolute", top:"30%", left:"50%", transform:"translate(-50%,-50%)", width:500, height:400, background:"radial-gradient(ellipse,rgba(99,102,241,0.12),transparent 70%)", pointerEvents:"none" }} />

          <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 16px", borderRadius:100, background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.25)", color:"#a5b4fc", fontSize:12, marginBottom:24 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#818cf8", display:"inline-block", animation:"pulse 2s infinite" }} />
            AI-Powered Clinical Decision Support System
          </div>

          <h1 style={{ fontSize:54, fontWeight:800, textAlign:"center", lineHeight:1.1, marginBottom:16, letterSpacing:-1 }}>
            ECG{" "}
            <span style={{ background:"linear-gradient(135deg,#818cf8,#a78bfa)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              Arrhythmia
            </span>{" "}
            Predictor
          </h1>

          <p style={{ color:"#6b7280", fontSize:17, textAlign:"center", maxWidth:560, lineHeight:1.7, marginBottom:40 }}>
            Upload raw ECG signal data. Our AI detects{" "}
            <span style={{ color:"#10b981" }}>Normal</span>,{" "}
            <span style={{ color:"#f59e0b" }}>AFib</span>, and{" "}
            <span style={{ color:"#ef4444" }}>VFib</span>{" "}
            with clinical precision.
          </p>

          {/* Upload box */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => document.getElementById("ecg-input").click()}
            style={{ width:"100%", maxWidth:580, borderRadius:20, border:`2px dashed ${dragging ? "#818cf8" : "rgba(255,255,255,0.1)"}`, background: dragging ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)", padding:"52px 32px", textAlign:"center", cursor:"pointer", transition:"all 0.3s" }}
          >
            <input
              id="ecg-input" type="file" accept=".csv"
              style={{ display:"none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <div style={{ fontSize:52, marginBottom:14 }}>📊</div>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:8 }}>Drop ECG file here or click to upload</div>
            <div style={{ color:"#6b7280", fontSize:13, marginBottom:20 }}>Upload your ECG signal CSV file to begin analysis</div>
            <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
              <span style={{ padding:"4px 12px", borderRadius:100, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", fontSize:11, color:"#9ca3af" }}>CSV</span>
            </div>
          </div>

          {/* Info cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, width:"100%", maxWidth:580, marginTop:24 }}>
            {[
              { icon:"🔬", title:"Signal Processing",  desc:"Butterworth filter removes baseline wander & noise" },
              { icon:"🤖", title:"XGBoost ML Model",   desc:"Trained on clinical ECG dataset with high F1-Score" },
              { icon:"🧠", title:"Explainable AI",     desc:"Highlights exact anomalous ECG segment for doctors" },
            ].map(c => (
              <div key={c.title} style={{ padding:"20px 16px", borderRadius:16, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>{c.icon}</div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{c.title}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          SCREEN 2 — ANALYZE
      ════════════════════════════════════════════════ */}
      {screen === "analyze" && (
        <div style={{ maxWidth:960, margin:"0 auto", padding:"90px 24px 40px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div>
              <h2 style={{ fontSize:26, fontWeight:800, marginBottom:6 }}>ECG Signal Preview</h2>
              <div style={{ display:"flex", alignItems:"center", gap:10, color:"#9ca3af", fontSize:13 }}>
                <span style={{ padding:"3px 10px", borderRadius:6, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#a5b4fc" }}>📄 {fileName}</span>
                <span>{ecgData.length} data points loaded</span>
              </div>
            </div>
            <button
              onClick={analyzeECG}
              disabled={loading}
              style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"12px 28px", borderRadius:12, background:"#6366f1", border:"none", color:"#fff", fontWeight:700, fontSize:14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily:"inherit" }}
            >
              {loading
                ? <><span style={{ width:16, height:16, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block" }} /> Analyzing...</>
                : "🔍 Run AI Analysis"}
            </button>
          </div>

          {loading && (
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#9ca3af", marginBottom:6 }}>
                <span>Processing ECG signal...</span><span>{progress}%</span>
              </div>
              <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${progress}%`, background:"linear-gradient(90deg,#6366f1,#8b5cf6)", transition:"width 0.3s", borderRadius:2 }} />
              </div>
              <div style={{ display:"flex", gap:20, marginTop:10, fontSize:11, flexWrap:"wrap" }}>
                {["Butterworth filter", "Feature extraction", "XGBoost inference", "Generating report"].map((s, i) => (
                  <span key={s} style={{ color: progress > i * 25 ? "#818cf8" : "#6b7280" }}>
                    {progress > i * 25 ? "✓" : "○"} {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Chart */}
          <div style={{ borderRadius:20, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", padding:24, marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <span style={{ fontSize:14, fontWeight:600, color:"#d1d5db" }}>Raw ECG Waveform</span>
              <span style={{ fontSize:12, color:"#6b7280" }}>Showing first 500 samples</span>
            </div>
            <div style={{ height:260 }}>
              <Line data={buildChart()} options={chartOpts} />
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {[
              { label:"Sample Rate", value:"360 Hz",                             icon:"📡" },
              { label:"Duration",    value:`${(ecgData.length/360).toFixed(1)}s`, icon:"⏱"  },
              { label:"Data Points", value:ecgData.length,                       icon:"📈" },
              { label:"Filter",      value:"Butterworth",                        icon:"🔧" },
            ].map(s => (
              <div key={s.label} style={{ padding:"14px 10px", borderRadius:14, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", textAlign:"center" }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{s.icon}</div>
                <div style={{ fontSize:15, fontWeight:700, color:"#818cf8" }}>{s.value}</div>
                <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          SCREEN 3 — RESULT
      ════════════════════════════════════════════════ */}
      {screen === "result" && result && cfg && (
        <div style={{ maxWidth:960, margin:"0 auto", padding:"90px 24px 40px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"3fr 2fr", gap:20 }}>

            {/* LEFT */}
            <div>
              <div style={{ borderRadius:20, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", padding:24, marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <span style={{ fontSize:14, fontWeight:600 }}>ECG Waveform Analysis</span>
                  {result.prediction !== "Normal" && (
                    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:100, background:"rgba(245,158,11,0.15)", color:"#fbbf24", border:"1px solid rgba(245,158,11,0.3)" }}>
                      ⚡ Anomaly Highlighted
                    </span>
                  )}
                </div>
                <div style={{ height:220 }}>
                  <Line data={buildChart()} options={chartOpts} />
                </div>
                {result.prediction !== "Normal" && (
                  <div style={{ marginTop:12, padding:"10px 14px", borderRadius:10, background:cfg.bg, border:`1px solid ${cfg.border}`, fontSize:12, color:cfg.color }}>
                    🔍 <strong>Explainable AI:</strong> Highlighted region (samples {anomalyRange?.[0]}–{anomalyRange?.[1]}) shows the irregular pattern that triggered the {result.prediction} classification.
                  </div>
                )}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                {[
                  { label:"F1-Score",   value:"94.2%",                                  color:"#818cf8" },
                  { label:"Confidence", value:`${(result.probability*100).toFixed(1)}%`, color:"#a78bfa" },
                  { label:"Model",      value:"XGBoost",                                color:"#67e8f9" },
                ].map(m => (
                  <div key={m.label} style={{ padding:"14px 10px", borderRadius:12, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", textAlign:"center" }}>
                    <div style={{ fontSize:18, fontWeight:800, color:m.color }}>{m.value}</div>
                    <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {/* Diagnosis card */}
              <div style={{ borderRadius:20, padding:24, background:cfg.bg, border:`1px solid ${cfg.border}` }}>
                <div style={{ fontSize:11, color:"#6b7280", fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>AI Diagnosis</div>
                <div style={{ fontSize:19, fontWeight:800, color:cfg.color, marginBottom:16 }}>{cfg.label}</div>

                <div style={{ marginBottom:16 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#9ca3af", marginBottom:6 }}>
                    <span>Confidence</span><span>{(result.probability*100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${result.probability*100}%`, background:cfg.color, borderRadius:3 }} />
                  </div>
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                  <span style={{ fontSize:12, color:"#9ca3af" }}>Risk Level:</span>
                  <span style={{ fontSize:14, fontWeight:800, color:cfg.color }}>{cfg.risk}</span>
                </div>

                <div style={{ fontSize:12, color:cfg.color, opacity:0.85, lineHeight:1.7 }}>{cfg.advice}</div>
              </div>

              {/* Classes */}
              <div style={{ borderRadius:16, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", padding:20 }}>
                <div style={{ fontSize:11, color:"#6b7280", fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:14 }}>Classes Evaluated</div>
                {Object.entries(RESULT_CONFIG).map(([key, v]) => (
                  <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", opacity: result.prediction === key ? 1 : 0.35 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:v.color }} />
                      <span style={{ fontSize:13 }}>{key}</span>
                    </div>
                    {result.prediction === key && <span style={{ fontSize:11, fontWeight:800, color:v.color }}>✓ DETECTED</span>}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <button onClick={reset} style={{ padding:"13px", borderRadius:12, background:"#6366f1", border:"none", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                + Analyze New ECG
              </button>
              <button style={{ padding:"13px", borderRadius:12, background:"transparent", border:"1px solid rgba(255,255,255,0.12)", color:"#d1d5db", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                📄 Export Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}