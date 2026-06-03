# Smart Banking AI-Powered Fraud Console

A modern, full-stack real-time web console and dashboard designed to monitor, analyze, and mitigate fraudulent transactions in banking operations. This project showcases integration with **Microsoft Fabric** (KQL Eventhouse & SQL Lakehouse) for live streaming telemetry, fallback SQLite simulation capabilities, and an **AI Security Copilot** for natural language querying.

---

## 🚀 Key Features

- **Real-Time Stream Console:** Simulated or live Fabric transaction feeds showing instant risk metrics, categories, and AI-generated risk explanations.
- **AI Security Copilot:** Natural language interface translating plain English questions (e.g., *"Show me UPI transactions with high risk"*) into KQL/SQL queries, returning formatted markdown answers and interactive tables.
- **Rich Telemetry & Charting:** Interactive exposure rates, peak threat tracking, weekly risk trends, channel performance, and city-based threat heatmaps.
- **Analyst Sign-off & Audit Trail:** Interactive triage drawer featuring compliance checklists and cryptographic analyst signature capture for audit logs.
- **Automated Alerts:** Integration with Microsoft Teams Webhooks to instantly broadcast alerts when transaction risk scores cross critical thresholds (>80).
- **Dual Integration Mode:** Automatic detection of Fabric credentials, falling back to local SQLite databases when offline.

---

## 🛠️ Technology Stack

- **Frontend:** React, Vite, Tailwind CSS, Lucide Icons, Responsive CSS
- **Backend:** FastAPI (Python), Uvicorn, Pandas, SQLite, Scikit-Learn
- **Integrations:** OpenAI API (GPT-4o), Microsoft Fabric (Lakehouse SQL, Eventhouse KQL), Microsoft Teams Webhooks

---

## 📂 Project Structure

```text
SmartBankAppWebsite/
├── backend/
│   ├── main.py               # FastAPI gateway with all endpoints & simulated feed
│   └── services/
│       ├── auth.py           # Azure Entra ID / token verification service
│       ├── database.py       # SQL, KQL and local SQLite connectors
│       ├── risk.py           # Risk calculation engine and Teams notifications
│       └── copilot.py        # Natural language to KQL/SQL parser and AI helper
├── config/
│   └── accelerator-config.json  # Microsoft Fabric / OpenAI workspace configurations
├── data/
│   └── historical_credit_card_fraud.csv  # Pre-loaded baseline datasets
├── frontend/
│   ├── src/                  # React dashboard, component trees, and assets
│   ├── package.json          # Frontend build scripts and packages
│   └── index.html            # Main site frame
├── package.json              # Fullstack concurrently orchestration script
└── requirements.txt          # Python API dependencies
```

---

## ⚙️ Configuration Setup

Configure your environment by setting up the config profiles in the `config/` directory or exporting environment variables.

### 1. Web Application Config (`config/accelerator-config.json`)
Update the workspace configurations to link with your Azure Fabric capacity:
```json
{
    "workspaceName": "SmartAIBankingRisk",
    "lakehouseName": "BankingFraudLakehouse",
    "eventhouseName": "BankingRiskEventhouse",
    "kqlDatabaseName": "BankingRiskDB",
    "openaiConfig": {
        "apiKey": "YOUR_OPENAI_API_KEY",
        "apiEndpoint": "https://api.openai.com/v1",
        "modelName": "gpt-4o"
    }
}
```

### 2. Environment Variables (`.env`)
Create a `.env` file in the root or backend directory to configure authentication, API keys, and notification webhooks:
```env
# Authentication Options
REQUIRE_AUTH=false

# OpenAI API credentials (if not configured in JSON)
OPENAI_API_KEY=YOUR_OPENAI_API_KEY

# Microsoft Teams Alerts
TEAMS_WEBHOOK_URL=YOUR_TEAMS_WEBHOOK_URL

# Microsoft Fabric Live Access (Optional)
AZURE_TENANT_ID=YOUR_TENANT_ID
AZURE_CLIENT_ID=YOUR_CLIENT_ID
AZURE_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

---

## 🏃 Running the Application

### Prerequisites
- Node.js (v18+)
- Python (3.9+)

### Installation
You can install both backend and frontend dependencies automatically from the root folder:
```bash
npm run install-all
```

Alternatively, install them manually:
* **Backend:** `pip install -r requirements.txt`
* **Frontend:** `cd frontend && npm install`

### Start Development Server
Launch both the FastAPI backend and Vite frontend concurrently:
```bash
npm run dev
```

The services will start at:
- **Frontend Dashboard:** [http://localhost:5173](http://localhost:5173)
- **FastAPI Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛡️ License

This project is licensed under the MIT License.
