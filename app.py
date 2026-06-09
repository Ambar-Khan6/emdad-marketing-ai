import os
import base64
import json
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

app = Flask(__name__)
CORS(app)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ------------------------------------------------------------
# ROUTES
# ------------------------------------------------------------

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/competitive")
def competitive():
    return render_template("competitive.html")

@app.route("/gaps")
def gaps():
    return render_template("gaps.html")


# ------------------------------------------------------------
# AGENT 1 — COMPETITIVE INTELLIGENCE
# ------------------------------------------------------------

@app.route("/api/competitive/analyze", methods=["POST"])
def competitive_analyze():
    try:
        data = request.form.get("data", "")
        company_name = request.form.get("company_name", "Unknown")
        competitors = request.form.get("competitors", "")
        analysis_type = request.form.get("analysis_type", "full")

        prompt = f"""You are an expert marketing intelligence analyst for the energy services industry in the UAE and MENA region.

Company being analyzed: {company_name}
Known competitors: {competitors}
Additional data provided: {data}

Please provide a comprehensive competitive analysis in the following exact JSON format:

{{
  "executive_summary": "2-3 sentence overview of the competitive landscape",
  "company_strengths": ["strength 1", "strength 2", "strength 3"],
  "company_weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "competitor_analysis": [
    {{
      "name": "Competitor Name",
      "type": "local or international",
      "market_position": "description",
      "strengths": ["s1", "s2"],
      "weaknesses": ["w1", "w2"],
      "threat_level": "High/Medium/Low"
    }}
  ],
  "market_opportunities": ["opportunity 1", "opportunity 2"],
  "marketing_what_works": ["tactic 1", "tactic 2", "tactic 3"],
  "marketing_what_doesnt_work": ["tactic 1", "tactic 2"],
  "statistical_insights": [
    {{
      "metric": "metric name",
      "our_value": 75,
      "industry_average": 60,
      "unit": "%"
    }}
  ],
  "chart_data": {{
    "market_share": [
      {{"name": "{company_name}", "value": 25}},
      {{"name": "Competitor A", "value": 30}},
      {{"name": "Competitor B", "value": 20}},
      {{"name": "Others", "value": 25}}
    ],
    "performance_comparison": [
      {{"metric": "Brand Awareness", "emdad": 70, "local_avg": 55, "intl_avg": 80}},
      {{"metric": "Digital Presence", "emdad": 60, "local_avg": 50, "intl_avg": 85}},
      {{"metric": "Client Retention", "emdad": 85, "local_avg": 70, "intl_avg": 78}},
      {{"metric": "Content Quality", "emdad": 65, "local_avg": 48, "intl_avg": 82}},
      {{"metric": "Response Time", "emdad": 80, "local_avg": 65, "intl_avg": 75}}
    ]
  }},
  "priority_actions": [
    {{
      "action": "action description",
      "priority": "High/Medium/Low",
      "timeline": "1 month / 3 months / 6 months",
      "expected_impact": "description"
    }}
  ],
  "improvement_areas": ["area 1", "area 2", "area 3"]
}}

Return ONLY the JSON, no extra text."""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
            temperature=0.7
        )

        response_text = response.choices[0].message.content.strip()

        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        analysis = json.loads(response_text)
        return jsonify({"success": True, "analysis": analysis})

    except json.JSONDecodeError as e:
        return jsonify({"success": False, "error": f"Could not parse AI response: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/competitive/chat", methods=["POST"])
def competitive_chat():
    try:
        data = request.json
        question = data.get("question", "")
        context = data.get("context", "")

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an expert marketing analyst for EMDAD, a UAE energy services company. Answer questions about competitive intelligence clearly and concisely. Be specific, data-driven, and actionable."},
                {"role": "user", "content": f"Previous analysis context:\n{context}\n\nQuestion: {question}"}
            ],
            max_tokens=1000
        )

        return jsonify({"success": True, "answer": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ------------------------------------------------------------
# AGENT 2 — GAP ANALYSIS
# ------------------------------------------------------------

@app.route("/api/gaps/analyze", methods=["POST"])
def gaps_analyze():
    try:
        current_activities = request.form.get("current_activities", "")
        goals = request.form.get("goals", "")
        budget = request.form.get("budget", "")
        channels = request.form.get("channels", "")
        target_audience = request.form.get("target_audience", "")
        timeframe = request.form.get("timeframe", "12 months")

        files = request.files.getlist("data_files")
        file_content = ""
        for file in files:
            if file and file.filename and file.filename.endswith(".csv"):
                content = file.read().decode("utf-8", errors="ignore")
                file_content += f"\nData from {file.filename}:\n{content[:3000]}\n"

        prompt = f"""You are a senior marketing strategist specializing in B2B energy services companies in the UAE and MENA region.

EMDAD Marketing Data:
- Current Marketing Activities: {current_activities}
- Business Goals: {goals}
- Budget Range: {budget}
- Current Channels Used: {channels}
- Target Audience: {target_audience}
- Timeframe: {timeframe}
{f"- Uploaded Data: {file_content}" if file_content else ""}

Perform a thorough marketing gap analysis. Return ONLY this JSON:

{{
  "overall_gap_score": 72,
  "gap_score_label": "Moderate Gaps Detected",
  "summary": "2-3 sentence executive summary of the gap situation",
  "critical_gaps": [
    {{
      "gap_title": "Gap name",
      "description": "What is missing and why it matters",
      "current_state": "What they have now",
      "desired_state": "What they should have",
      "current_score": 40,
      "target_score": 85,
      "impact": "High/Medium/Low",
      "category": "Digital/Content/Analytics/Brand/Budget/People/Process"
    }}
  ],
  "channel_performance": [
    {{"channel": "LinkedIn", "current_usage": 60, "recommended_usage": 90, "roi_potential": "High"}},
    {{"channel": "Website SEO", "current_usage": 30, "recommended_usage": 85, "roi_potential": "High"}},
    {{"channel": "Email Marketing", "current_usage": 45, "recommended_usage": 80, "roi_potential": "Medium"}},
    {{"channel": "Events/Trade Shows", "current_usage": 70, "recommended_usage": 75, "roi_potential": "High"}},
    {{"channel": "Content Marketing", "current_usage": 25, "recommended_usage": 80, "roi_potential": "High"}}
  ],
  "quick_wins": [
    {{
      "title": "Quick win title",
      "description": "What to do",
      "effort": "Low/Medium",
      "impact": "High/Medium",
      "timeframe": "2 weeks / 1 month"
    }}
  ],
  "strategic_recommendations": [
    {{
      "title": "Recommendation title",
      "description": "Detailed description",
      "why": "Why this matters for EMDAD specifically",
      "how": "Step-by-step how to implement",
      "kpis": ["KPI 1", "KPI 2"],
      "budget_required": "Low/Medium/High",
      "timeline": "Q1/Q2/Q3/Q4"
    }}
  ],
  "gap_matrix": [
    {{"area": "Marketing Area", "importance": 85, "current_performance": 40}}
  ],
  "roadmap": [
    {{
      "phase": "Phase 1 - Foundation",
      "months": "Month 1-3",
      "actions": ["action 1", "action 2", "action 3"],
      "expected_outcome": "outcome description"
    }},
    {{
      "phase": "Phase 2 - Growth",
      "months": "Month 4-6",
      "actions": ["action 1", "action 2"],
      "expected_outcome": "outcome description"
    }},
    {{
      "phase": "Phase 3 - Optimize",
      "months": "Month 7-12",
      "actions": ["action 1", "action 2"],
      "expected_outcome": "outcome description"
    }}
  ]
}}

Make all insights specific to a UAE B2B energy services company. Return ONLY the JSON."""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
            temperature=0.7
        )

        response_text = response.choices[0].message.content.strip()

        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        analysis = json.loads(response_text)
        return jsonify({"success": True, "analysis": analysis})

    except json.JSONDecodeError as e:
        return jsonify({"success": False, "error": f"Could not parse AI response: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/gaps/chat", methods=["POST"])
def gaps_chat():
    try:
        data = request.json
        question = data.get("question", "")
        context = data.get("context", "")

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a senior B2B marketing strategist for EMDAD, a UAE energy services company. Answer questions about marketing gaps, strategy, and recommendations clearly. Be specific, practical, and tailored to the UAE market."},
                {"role": "user", "content": f"Gap analysis context:\n{context}\n\nQuestion: {question}"}
            ],
            max_tokens=1000
        )

        return jsonify({"success": True, "answer": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ------------------------------------------------------------
# RUN THE SERVER
# ------------------------------------------------------------

if __name__ == "__main__":
    os.makedirs("static/images", exist_ok=True)
    print("EMDAD Marketing AI Platform is running...")
    print("Open your browser and go to: http://localhost:5000")
    app.run(debug=True, port=5000)