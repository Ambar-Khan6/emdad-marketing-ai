// ============================================================
// EMDAD — MARKETING GAP ANALYSIS AGENT
// ============================================================

let uploadedFiles = [];
let currentAnalysis = null;
let chartInstances = {};

function handleFiles(files) {
  for (let file of files) {
    if (!uploadedFiles.find(f => f.name === file.name)) uploadedFiles.push(file);
  }
  renderFileChips();
}

function renderFileChips() {
  const container = document.getElementById("uploadedFiles");
  container.innerHTML = "";
  uploadedFiles.forEach((file, i) => {
    const chip = document.createElement("div");
    chip.className = "file-chip";
    chip.innerHTML = `&#128196; ${file.name} <span style="cursor:pointer;opacity:0.7;" onclick="removeFile(${i})">&#215;</span>`;
    container.appendChild(chip);
  });
}

function removeFile(i) {
  uploadedFiles.splice(i, 1);
  renderFileChips();
}

async function runAnalysis() {
  const currentActivities = document.getElementById("currentActivities").value.trim();
  const goals             = document.getElementById("goals").value.trim();

  if (!currentActivities) {
    showAlert("Please describe your current marketing activities.", "error");
    return;
  }

  showLoading(true);

  const formData = new FormData();
  formData.append("current_activities", currentActivities);
  formData.append("goals",             goals);
  formData.append("budget",            document.getElementById("budget").value);
  formData.append("channels",          document.getElementById("channels").value);
  formData.append("target_audience",   document.getElementById("targetAudience").value);
  formData.append("timeframe",         document.getElementById("timeframe").value);
  uploadedFiles.forEach(f => formData.append("data_files", f));

  try {
    const res  = await fetch("/api/gaps/analyze", { method: "POST", body: formData });
    const json = await res.json();

    if (!json.success) throw new Error(json.error || "Analysis failed");

    currentAnalysis = json.analysis;
    renderResults(json.analysis);
  } catch (err) {
    showLoading(false);
    showAlert("Error: " + err.message, "error");
  }
}

function renderResults(data) {
  showLoading(false);

  document.getElementById("analysisTimestamp").textContent =
    "Generated: " + new Date().toLocaleString("en-AE");
  document.getElementById("gapScoreValue").textContent = data.overall_gap_score || "--";
  document.getElementById("gapScoreLabel").textContent = data.gap_score_label || "";
  document.getElementById("gapSummaryText").textContent = data.summary || "";

  drawGaugeChart(data.overall_gap_score || 0);
  renderGaps(data.critical_gaps || []);
  renderChannels(data.channel_performance || []);
  renderQuickWins(data.quick_wins || []);
  renderStrategy(data.strategic_recommendations || []);
  renderRoadmap(data.roadmap || []);

  document.getElementById("inputSection").classList.add("hidden");
  document.getElementById("resultsSection").classList.remove("hidden");
  showTab("gaps");
}

function drawGaugeChart(score) {
  if (chartInstances.gauge) chartInstances.gauge.destroy();
  const ctx = document.getElementById("gapScoreGauge")?.getContext("2d");
  if (!ctx) return;

  const color = score > 70 ? "#C8102E" : score > 40 ? "#B8960C" : "#006633";

  chartInstances.gauge = new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [score, 100 - score],
        backgroundColor: [color, "#F0EBE1"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: false,
      cutout: "75%",
      rotation: -90,
      circumference: 180,
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

function renderGaps(gaps) {
  const el = document.getElementById("gapsList");
  el.innerHTML = gaps.map(g => {
    const impact = (g.impact || "medium").toLowerCase();
    return `<div class="gap-item ${impact}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:1rem;font-weight:700;color:var(--charcoal);">${g.gap_title}</div>
          <span class="badge badge-silver" style="margin-top:4px;">${g.category}</span>
        </div>
        <span class="badge badge-${impact === 'high' ? 'red' : impact === 'medium' ? 'gold' : 'green'}">${g.impact} Impact</span>
      </div>
      <p style="margin-bottom:0.8rem;">${g.description}</p>
      <div class="gap-scores">
        <div class="gap-score-item">
          <div class="gap-score-value" style="color:var(--red);">${g.current_score}</div>
          <div class="gap-score-label">Current</div>
        </div>
        <div style="font-size:1.5rem;color:var(--text-muted);align-self:center;">&#8594;</div>
        <div class="gap-score-item">
          <div class="gap-score-value" style="color:var(--green);">${g.target_score}</div>
          <div class="gap-score-label">Target</div>
        </div>
        <div style="flex:1;align-self:center;padding-left:1rem;">
          <div class="progress-bar-bg"><div class="progress-bar-fill ${impact === 'high' ? 'red' : 'gold'}" style="width:${g.current_score}%"></div></div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px;">${g.current_state}</div>
        </div>
      </div>
    </div>`;
  }).join("");
}

function renderChannels(channels) {
  if (chartInstances.channel) chartInstances.channel.destroy();
  const ctx = document.getElementById("channelChart")?.getContext("2d");
  if (ctx) {
    chartInstances.channel = new Chart(ctx, {
      type: "bar",
      data: {
        labels: channels.map(c => c.channel),
        datasets: [
          { label: "Current Usage %",     data: channels.map(c => c.current_usage),     backgroundColor: "rgba(200,16,46,0.8)",  borderRadius: 4 },
          { label: "Recommended Usage %", data: channels.map(c => c.recommended_usage), backgroundColor: "rgba(0,102,51,0.75)",  borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { font: { family: "Inter", size: 11 }, padding: 12 } } },
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: "rgba(0,0,0,0.05)" } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  const det = document.getElementById("channelDetails");
  det.innerHTML = channels.map(c => {
    const gap = c.recommended_usage - c.current_usage;
    const roi = c.roi_potential.toLowerCase();
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="min-width:130px;font-weight:600;font-size:0.85rem;">${c.channel}</div>
      <div style="flex:1;">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill red" style="width:${c.current_usage}%;"></div>
        </div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);min-width:80px;">${c.current_usage}% now</div>
      <div style="font-size:0.8rem;font-weight:700;color:${gap > 0 ? 'var(--red)' : 'var(--green)'};min-width:70px;">
        ${gap > 0 ? '+' + gap + '% gap' : 'On target'}
      </div>
      <span class="badge badge-${roi === 'high' ? 'green' : 'gold'}">${c.roi_potential} ROI</span>
    </div>`;
  }).join("");
}

function renderQuickWins(wins) {
  const el = document.getElementById("quickWinsList");
  el.innerHTML = wins.map((w, i) => `
    <div class="quick-win">
      <div class="quick-win-title">&#9733; ${w.title}</div>
      <p style="font-size:0.875rem;margin:4px 0;">${w.description}</p>
      <div class="quick-win-meta">
        <span class="badge badge-green">&#8987; ${w.timeframe}</span>
        <span class="badge badge-gold">Effort: ${w.effort}</span>
        <span class="badge badge-red">Impact: ${w.impact}</span>
      </div>
    </div>
  `).join("");
}

function renderStrategy(recs) {
  const el = document.getElementById("strategyList");
  el.innerHTML = recs.map((r, i) => `
    <div class="card" style="margin-bottom:1.2rem;">
      <div class="card-header">
        <div class="card-icon ${i % 3 === 0 ? 'red' : i % 3 === 1 ? 'green' : 'gold'}">${i + 1}</div>
        <div>
          <div class="card-title">${r.title}</div>
          <div style="display:flex;gap:6px;margin-top:4px;">
            <span class="badge badge-silver">${r.timeline}</span>
            <span class="badge badge-${r.budget_required === 'High' ? 'red' : r.budget_required === 'Medium' ? 'gold' : 'green'}">Budget: ${r.budget_required}</span>
          </div>
        </div>
      </div>
      <p style="margin-bottom:0.8rem;">${r.description}</p>
      <div style="background:var(--cream);border-radius:var(--radius);padding:0.8rem;margin-bottom:0.8rem;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Why This Matters for EMDAD</div>
        <p style="margin:0;font-size:0.85rem;">${r.why}</p>
      </div>
      <div style="margin-bottom:0.8rem;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--charcoal);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">How to Implement</div>
        <p style="margin:0;font-size:0.85rem;">${r.how}</p>
      </div>
      <div>
        <div style="font-size:0.75rem;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">KPIs to Track</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${(r.kpis || []).map(k => `<span class="badge badge-green">${k}</span>`).join("")}
        </div>
      </div>
    </div>
  `).join("");
}

function renderRoadmap(phases) {
  const el = document.getElementById("roadmapContainer");
  el.innerHTML = phases.map((p, i) => `
    <div class="roadmap-phase">
      <div class="roadmap-node phase-${i + 1}">${i + 1}</div>
      <div class="roadmap-content">
        <div class="roadmap-phase-label">${p.phase}</div>
        <div class="roadmap-months">${p.months}</div>
        <ul class="roadmap-actions">
          ${(p.actions || []).map(a => `<li>${a}</li>`).join("")}
        </ul>
        <div style="font-size:0.8rem;color:var(--green);margin-top:6px;font-weight:600;">Expected: ${p.expected_outcome}</div>
      </div>
    </div>
  `).join("");
}

// --- TABS ---
function showTab(name) {
  const tabs = ["gaps", "channels", "quickwins", "strategy", "roadmap"];
  const btns = document.querySelectorAll(".tab-btn");
  tabs.forEach(t => {
    const el = document.getElementById("tab-" + t);
    if (el) el.classList.toggle("hidden", t !== name);
  });
  btns.forEach((btn, i) => btn.classList.toggle("active", tabs[i] === name));
}

// --- CHAT ---
async function sendChat() {
  const input = document.getElementById("chatInput");
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = "";
  addChatMessage("user", msg);

  const contextStr = currentAnalysis ? JSON.stringify(currentAnalysis).substring(0, 2000) : "";

  try {
    const res  = await fetch("/api/gaps/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: msg, context: contextStr })
    });
    const json = await res.json();
    addChatMessage("ai", json.success ? json.answer : "Error: " + json.error);
  } catch (err) {
    addChatMessage("ai", "Connection error. Please try again.");
  }
}

function addChatMessage(role, text) {
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = `chat-message ${role}`;
  div.innerHTML = `
    <div class="chat-avatar ${role}">${role === "ai" ? "AI" : "You"}</div>
    <div class="chat-bubble ${role}">${text.replace(/\n/g, "<br>")}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// --- PDF EXPORT ---
async function exportPDF() {
  if (!currentAnalysis) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const RED = [200,16,46], GREEN = [0,102,51], GOLD = [184,150,12], DARK = [28,28,28];

  doc.setFillColor(...GREEN);
  doc.rect(0, 0, 210, 28, "F");
  doc.setFillColor(...RED);
  doc.rect(0, 25, 210, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255,255,255);
  doc.text("EMDAD LLC", 15, 15);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("MARKETING GAP ANALYSIS REPORT  |  CONFIDENTIAL", 15, 22);
  doc.text(new Date().toLocaleDateString("en-AE", { year:"numeric", month:"long", day:"numeric" }), 145, 22);

  let y = 38;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(`Gap Score: ${currentAnalysis.overall_gap_score}/100  —  ${currentAnalysis.gap_score_label}`, 15, y);
  y += 8;

  doc.setFillColor(245,242,237);
  doc.roundedRect(10, y, 190, 22, 3, 3, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  const lines = doc.splitTextToSize(currentAnalysis.summary || "", 178);
  doc.text(lines, 15, y + 7);
  y += 30;

  doc.autoTable({
    startY: y,
    head: [["Critical Gap", "Category", "Impact", "Current", "Target"]],
    body: (currentAnalysis.critical_gaps || []).map(g => [
      g.gap_title, g.category, g.impact, g.current_score + "/100", g.target_score + "/100"
    ]),
    headStyles: { fillColor: RED, textColor: [255,255,255], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: DARK },
    margin: { left: 10, right: 10 }
  });

  y = doc.lastAutoTable.finalY + 8;

  doc.autoTable({
    startY: y,
    head: [["Strategic Recommendation", "Timeline", "Budget", "Key KPIs"]],
    body: (currentAnalysis.strategic_recommendations || []).map(r => [
      r.title, r.timeline, r.budget_required, (r.kpis || []).join(", ")
    ]),
    headStyles: { fillColor: GREEN, textColor: [255,255,255], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: DARK },
    margin: { left: 10, right: 10 }
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...GREEN);
    doc.rect(0, 287, 210, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(255,255,255);
    doc.text("EMDAD LLC  |  Abu Dhabi, UAE  |  CONFIDENTIAL", 10, 293);
    doc.text(`Page ${i} of ${pageCount}`, 185, 293);
  }

  doc.save("EMDAD_Gap_Analysis.pdf");
}

function showLoading(show) {
  document.getElementById("loadingOverlay").classList.toggle("active", show);
}

function showInput() {
  document.getElementById("resultsSection").classList.add("hidden");
  document.getElementById("inputSection").classList.remove("hidden");
}

function clearForm() {
  ["currentActivities","goals","channels","targetAudience"].forEach(id => {
    document.getElementById(id).value = "";
  });
  uploadedFiles = [];
  renderFileChips();
}

function showAlert(msg, type) {
  const existing = document.querySelector(".alert");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  document.querySelector(".main-content").prepend(el);
  setTimeout(() => el.remove(), 5000);
}