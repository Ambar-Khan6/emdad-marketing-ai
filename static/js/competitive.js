// ============================================================
// EMDAD — COMPETITIVE INTELLIGENCE AGENT
// ============================================================

let uploadedFiles = [];
let currentAnalysis = null;
let chartInstances = {};

// --- FILE HANDLING ---
function handleFiles(files) {
  for (let file of files) {
    if (!uploadedFiles.find(f => f.name === file.name)) {
      uploadedFiles.push(file);
    }
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

function removeFile(index) {
  uploadedFiles.splice(index, 1);
  renderFileChips();
}

// --- DRAG AND DROP ---
const uploadZone = document.getElementById("uploadZone");
if (uploadZone) {
  uploadZone.addEventListener("dragover", e => { e.preventDefault(); uploadZone.classList.add("dragover"); });
  uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
  uploadZone.addEventListener("drop", e => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });
}

// --- RUN ANALYSIS ---
async function runAnalysis() {
  const companyName = document.getElementById("companyName").value.trim();
  const competitors  = document.getElementById("competitors").value.trim();
  const marketData   = document.getElementById("marketData").value.trim();
  const analysisType = document.getElementById("analysisType").value;

  if (!companyName) {
    showAlert("Please enter your company name.", "error");
    return;
  }

  showLoading(true);

  const formData = new FormData();
  formData.append("company_name", companyName);
  formData.append("competitors", competitors);
  formData.append("data", marketData);
  formData.append("analysis_type", analysisType);
  uploadedFiles.forEach(file => formData.append("images", file));

  try {
    const res  = await fetch("/api/competitive/analyze", { method: "POST", body: formData });
    const json = await res.json();

    if (!json.success) throw new Error(json.error || "Analysis failed");

    currentAnalysis = json.analysis;
    renderResults(json.analysis);
  } catch (err) {
    showLoading(false);
    showAlert("Error: " + err.message, "error");
  }
}

// --- RENDER RESULTS ---
function renderResults(data) {
  showLoading(false);

  // Executive summary
  document.getElementById("execSummaryText").textContent = data.executive_summary || "";
  document.getElementById("analysisTimestamp").textContent =
    "Generated: " + new Date().toLocaleString("en-AE");

  // Stats
  document.getElementById("statCompetitors").textContent  = (data.competitor_analysis || []).length;
  document.getElementById("statStrengths").textContent    = (data.company_strengths || []).length;
  document.getElementById("statOpportunities").textContent= (data.market_opportunities || []).length;
  document.getElementById("statActions").textContent      = (data.priority_actions || []).length;

  // Strengths / weaknesses / opportunities
  renderBulletList("strengthsList",    data.company_strengths,     "green");
  renderBulletList("weaknessesList",   data.company_weaknesses,    "red");
  renderBulletList("opportunitiesList",data.market_opportunities,  "gold");

  // Competitors
  renderCompetitors(data.competitor_analysis || []);

  // Charts
  setTimeout(() => {
    renderMarketShareChart(data.chart_data?.market_share || []);
    renderPerformanceChart(data.chart_data?.performance_comparison || []);
  }, 100);

  // Statistical insights
  renderStatInsights(data.statistical_insights || []);

  // Marketing
  renderBulletList("workingList",    data.marketing_what_works,       "green");
  renderBulletList("notWorkingList", data.marketing_what_doesnt_work, "red");

  // Actions
  renderActions(data.priority_actions || []);

  // Show results
  document.getElementById("inputSection").classList.add("hidden");
  document.getElementById("resultsSection").classList.remove("hidden");
  showTab("overview");
}

function renderBulletList(containerId, items, color) {
  const el = document.getElementById(containerId);
  if (!el || !items) return;
  el.innerHTML = (items).map(item =>
    `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;">
      <span style="color:var(--${color});font-size:0.7rem;margin-top:4px;flex-shrink:0;">&#9632;</span>
      <span style="font-size:0.875rem;color:var(--text-main);">${item}</span>
    </div>`
  ).join("");
}

function renderCompetitors(competitors) {
  const el = document.getElementById("competitorCards");
  el.innerHTML = competitors.map(c => {
    const threat = (c.threat_level || "medium").toLowerCase();
    return `<div class="competitor-card ${threat}" style="margin-bottom:1rem;">
      <div class="threat-badge">
        <span class="badge badge-${threat === 'high' ? 'red' : threat === 'medium' ? 'gold' : 'green'}">
          ${c.threat_level} Threat
        </span>
      </div>
      <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:0.8rem;">
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:700;color:var(--charcoal);">${c.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;">${c.type} competitor</div>
        </div>
      </div>
      <p style="margin-bottom:0.8rem;">${c.market_position}</p>
      <div class="grid-2">
        <div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--green);text-transform:uppercase;margin-bottom:4px;">Strengths</div>
          ${(c.strengths || []).map(s => `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:3px;">+ ${s}</div>`).join("")}
        </div>
        <div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--red);text-transform:uppercase;margin-bottom:4px;">Weaknesses</div>
          ${(c.weaknesses || []).map(w => `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:3px;">- ${w}</div>`).join("")}
        </div>
      </div>
    </div>`;
  }).join("");
}

function renderMarketShareChart(data) {
  if (chartInstances.marketShare) chartInstances.marketShare.destroy();
  const ctx = document.getElementById("marketShareChart")?.getContext("2d");
  if (!ctx) return;

  const colors = ["#C8102E", "#006633", "#B8960C", "#C0C0C0", "#9B0B22", "#008844"];

  chartInstances.marketShare = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        data: data.map(d => d.value),
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 2,
        borderColor: "#fff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { family: "Inter", size: 11 }, padding: 12 } }
      }
    }
  });
}

function renderPerformanceChart(data) {
  if (chartInstances.performance) chartInstances.performance.destroy();
  const ctx = document.getElementById("performanceChart")?.getContext("2d");
  if (!ctx) return;

  chartInstances.performance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => d.metric),
      datasets: [
        { label: "EMDAD",        data: data.map(d => d.emdad),     backgroundColor: "rgba(200,16,46,0.85)",  borderRadius: 4 },
        { label: "Local Avg",    data: data.map(d => d.local_avg),  backgroundColor: "rgba(184,150,12,0.75)", borderRadius: 4 },
        { label: "Intl Avg",     data: data.map(d => d.intl_avg),   backgroundColor: "rgba(0,102,51,0.75)",   borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { font: { family: "Inter", size: 11 }, padding: 12 } } },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: "rgba(0,0,0,0.05)" } },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

function renderStatInsights(insights) {
  const el = document.getElementById("statisticalInsights");
  el.innerHTML = insights.map(ins => {
    const pct = Math.min(ins.our_value, 100);
    return `<div class="progress-wrap">
      <div class="progress-label">
        <span>${ins.metric}</span>
        <span style="color:var(--red);font-weight:700;">${ins.our_value}${ins.unit}</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill red" style="width:${pct}%"></div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Industry avg: ${ins.industry_average}${ins.unit}</div>
    </div>`;
  }).join("");
}

function renderActions(actions) {
  const el = document.getElementById("actionsList");
  el.innerHTML = actions.map(a => {
    const p = (a.priority || "medium").toLowerCase();
    return `<div class="action-card">
      <div class="action-priority ${p}"></div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;">
          <div style="font-weight:700;font-size:0.9rem;color:var(--charcoal);">${a.action}</div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <span class="badge badge-${p === 'high' ? 'red' : p === 'medium' ? 'gold' : 'green'}">${a.priority}</span>
            <span class="badge badge-silver">${a.timeline}</span>
          </div>
        </div>
        <div style="font-size:0.82rem;color:var(--text-muted);">${a.expected_impact}</div>
      </div>
    </div>`;
  }).join("");
}

// --- TABS ---
function showTab(name) {
  const tabs  = ["overview", "competitors", "charts", "marketing", "actions"];
  const btns  = document.querySelectorAll(".tab-btn");
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
    const res  = await fetch("/api/competitive/chat", {
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

  const RED = [200, 16, 46];
  const GREEN = [0, 102, 51];
  const GOLD = [184, 150, 12];
  const DARK = [28, 28, 28];
  const GRAY = [107, 107, 107];

  let y = 0;

  // Cover header bar
  doc.setFillColor(...RED);
  doc.rect(0, 0, 210, 28, "F");
  doc.setFillColor(...GREEN);
  doc.rect(0, 25, 210, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("EMDAD LLC", 15, 15);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("COMPETITIVE INTELLIGENCE REPORT  |  CONFIDENTIAL", 15, 22);
  doc.text(new Date().toLocaleDateString("en-AE", { year:"numeric", month:"long", day:"numeric" }), 155, 22);

  y = 40;

  // Executive Summary
  doc.setFillColor(245, 242, 237);
  doc.roundedRect(10, y, 190, 28, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.text("EXECUTIVE SUMMARY", 15, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  const summaryLines = doc.splitTextToSize(currentAnalysis.executive_summary || "", 178);
  doc.text(summaryLines, 15, y + 12);
  y += 36;

  // Strengths & Weaknesses table
  doc.autoTable({
    startY: y,
    head: [["EMDAD Strengths", "Areas for Improvement"]],
    body: Array.from({ length: Math.max(
      (currentAnalysis.company_strengths || []).length,
      (currentAnalysis.company_weaknesses || []).length
    )}).map((_, i) => [
      (currentAnalysis.company_strengths || [])[i] || "",
      (currentAnalysis.company_weaknesses || [])[i] || ""
    ]),
    headStyles: { fillColor: RED, textColor: [255,255,255], fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: DARK },
    columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 95 } },
    margin: { left: 10, right: 10 }
  });

  y = doc.lastAutoTable.finalY + 8;

  // Competitors
  if ((currentAnalysis.competitor_analysis || []).length > 0) {
    doc.autoTable({
      startY: y,
      head: [["Competitor", "Type", "Threat", "Market Position"]],
      body: (currentAnalysis.competitor_analysis || []).map(c => [
        c.name, c.type, c.threat_level, c.market_position
      ]),
      headStyles: { fillColor: DARK, textColor: [255,255,255], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8, textColor: DARK },
      margin: { left: 10, right: 10 }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Priority Actions
  if ((currentAnalysis.priority_actions || []).length > 0) {
    doc.autoTable({
      startY: y,
      head: [["Priority Action", "Priority", "Timeline", "Expected Impact"]],
      body: (currentAnalysis.priority_actions || []).map(a => [
        a.action, a.priority, a.timeline, a.expected_impact
      ]),
      headStyles: { fillColor: GREEN, textColor: [255,255,255], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8, textColor: DARK },
      margin: { left: 10, right: 10 }
    });
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...RED);
    doc.rect(0, 287, 210, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(255,255,255);
    doc.text("EMDAD LLC  |  Abu Dhabi, UAE  |  CONFIDENTIAL", 10, 293);
    doc.text(`Page ${i} of ${pageCount}`, 185, 293);
  }

  doc.save("EMDAD_Competitive_Analysis.pdf");
}

// --- UTILS ---
function showLoading(show) {
  document.getElementById("loadingOverlay").classList.toggle("active", show);
}

function showInput() {
  document.getElementById("resultsSection").classList.add("hidden");
  document.getElementById("inputSection").classList.remove("hidden");
}

function clearForm() {
  document.getElementById("companyName").value = "EMDAD LLC";
  document.getElementById("competitors").value = "";
  document.getElementById("marketData").value = "";
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