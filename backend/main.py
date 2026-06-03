import os
from backend.services.database import load_env_file
load_env_file()

import random
import pandas as pd
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

# Import auth and database services
from backend.services.auth import verify_token, REQUIRE_AUTH
from backend.services.database import (
    load_accelerator_config,
    get_kql_client_credentials,
    query_fabric_kql,
    query_fabric_lakehouse_sql,
    get_local_lakehouse_sqlite_db,
    execute_sql_locally,
    kql_db_name,
    kql_query_uri
)
from backend.services.risk import (
    local_calculate_ensemble_risk,
    local_explain_risk_with_ai,
    explain_risk_with_openai,
    send_teams_fraud_alert
)
from backend.services.copilot import (
    translate_question_to_query,
    execute_kql_locally,
    formulate_copilot_response
)

app = FastAPI(title="Smart Banking AI-Powered API Gateway", version="1.0.0")

# Enable CORS for React Frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory states
transactions_feed = []
alerted_tx_ids = set()
sign_off_logs = {}

# Constants for mock simulations
INDIAN_NAMES = ["Aarav Sharma", "Vihaan Rao", "Sai Krishna", "Reyansh Gupta", "Aanya Iyer", "Diya Sen", "Ananya Reddy", "Ishaan Joshi", "Kabir Bhat", "Priya Verma"]
CITIES = [("Mumbai", "Maharashtra"), ("Pune", "Maharashtra"), ("Bengaluru", "Karnataka"), ("Kolkata", "West Bengal"), ("Chennai", "Tamil Nadu")]
MERCHANTS = [
    {"name": "Amazon India", "category": "Shopping"},
    {"name": "Reliance Digital", "category": "Electronics"},
    {"name": "Flipkart Retail", "category": "Shopping"},
    {"name": "Zomato Food", "category": "Food & Dining"},
    {"name": "Swiggy Delivery", "category": "Food & Dining"},
    {"name": "Uber India", "category": "Travel"},
    {"name": "Taj Hotels", "category": "Hospitality"},
    {"name": "Airtel Pay", "category": "Utilities"},
    {"name": "HDFC Home Loan", "category": "Financial Services"},
    {"name": "Apollo Pharmacy", "category": "Healthcare"}
]
SUSPICIOUS_MERCHANTS = [
    {"name": "Unknown Forex Broker", "category": "Investment"},
    {"name": "Suspicious Shell Co", "category": "Miscellaneous"},
    {"name": "Cryptocurrency Exchange Malta", "category": "Crypto"},
    {"name": "Luxury Watches Dubai", "category": "Luxury Shopping"},
    {"name": "Midnight Cash Outlet", "category": "ATM Cash Out"}
]

def initialize_base_transactions():
    """Seed the console with 25 standard baseline transactions on startup."""
    global transactions_feed
    baseline = []
    for _ in range(25):
        name = random.choice(INDIAN_NAMES)
        city_info = random.choice(CITIES)
        score = random.randint(5, 20)
        merchant = random.choice(MERCHANTS)
        baseline.append({
            "transaction_id": f"TXN-{random.randint(100000, 999999)}",
            "customer_id": f"CUST-{random.randint(100000, 999999)}",
            "account_number": f"ACT-{random.randint(100000, 999999)}",
            "customer_name": name,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "amount": round(random.uniform(500, 12000), 2),
            "merchant": merchant["name"],
            "merchant_category": merchant["category"],
            "payment_channel": random.choice(["UPI", "POS", "Internet Banking", "ATM"]),
            "transaction_type": "Debit",
            "country": "India",
            "city": city_info[0],
            "state": city_info[1],
            "device_type": random.choice(["Mobile", "Tablet", "Desktop", "iPhone 15"]),
            "ip_address": f"192.168.1.{random.randint(2,254)}",
            "risk_score": score,
            "is_fraud": 0,
            "ai_explanation": ""
        })
    transactions_feed = baseline

initialize_base_transactions()

class CopilotQuery(BaseModel):
    question: str

class CaseSignOff(BaseModel):
    transaction_id: str
    checklist_state: dict
    signature: str

@app.get("/api/status")
def get_system_status():
    """Retrieve integration modes (Fabric Live connection vs SQLite simulation) and authentication requirements."""
    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    
    is_live = False
    details = "Simulation Mode Active"
    
    if tenant_id and client_id and client_secret:
        try:
            get_kql_client_credentials(tenant_id, client_id, client_secret)
            is_live = True
            details = f"Fabric Connected: {kql_db_name}"
        except Exception as e:
            details = f"Auth failed: {str(e)[:80]}. Simulation Active."
            
    return {
        "is_live": is_live,
        "details": details,
        "kql_db": kql_db_name if is_live else "LocalSQLiteModel",
        "require_auth": os.getenv("REQUIRE_AUTH", "false").lower() == "true",
        "client_id": client_id or "",
        "tenant_id": tenant_id or "common"
    }

@app.get("/api/telemetry")
def get_telemetry_metrics(user: dict = Depends(verify_token)):
    """Fetch total aggregated metrics across full stream."""
    global transactions_feed
    
    status_info = get_system_status()
    is_live = status_info["is_live"]
    
    total_txs = len(transactions_feed)
    fraud_txs = len([t for t in transactions_feed if t["risk_score"] > 80])
    peak_risk = max([t["risk_score"] for t in transactions_feed]) if transactions_feed else 0
    
    if is_live:
        try:
            tenant_id = os.getenv("AZURE_TENANT_ID")
            client_id = os.getenv("AZURE_CLIENT_ID")
            client_secret = os.getenv("AZURE_CLIENT_SECRET")
            access_token = get_kql_client_credentials(tenant_id, client_id, client_secret)
            
            agg_query = (
                "real_time_transactions "
                "| where risk_score > 0 "
                "| summarize "
                "total_scored = count(), "
                "total_fraud = countif(risk_score > 80), "
                "highest_risk = max(risk_score)"
            )
            df_agg = query_fabric_kql(kql_query_uri, kql_db_name, agg_query, access_token)
            if not df_agg.empty:
                total_txs = int(df_agg["total_scored"].iloc[0])
                fraud_txs = int(df_agg["total_fraud"].iloc[0])
                peak_risk = int(df_agg["highest_risk"].iloc[0])
        except Exception:
            pass
            
    exposure_rate = (fraud_txs * 100.0 / total_txs) if total_txs > 0 else 0.0
    
    return {
        "total_transactions": total_txs,
        "fraud_detected": fraud_txs,
        "exposure_rate": round(exposure_rate, 2),
        "peak_threat_risk": peak_risk,
        "ingestion_gateway": "Live Microsoft Fabric" if is_live else "SQLite Star Schema"
    }

@app.get("/api/transactions")
def get_transactions(
    search: Optional[str] = Query(None, description="Search by customer name or ID"),
    channel: Optional[str] = Query("All Channels", description="Filter by payment channel"),
    limit: int = 150,
    user: dict = Depends(verify_token)
):
    """Retrieve list of active transaction feeds."""
    global transactions_feed
    
    status_info = get_system_status()
    is_live = status_info["is_live"]
    
    df_data = pd.DataFrame()
    
    if is_live:
        try:
            tenant_id = os.getenv("AZURE_TENANT_ID")
            client_id = os.getenv("AZURE_CLIENT_ID")
            client_secret = os.getenv("AZURE_CLIENT_SECRET")
            access_token = get_kql_client_credentials(tenant_id, client_id, client_secret)
            
            txn_query = (
                "real_time_transactions "
                "| where risk_score > 0 "
                "| extend ts = todatetime(timestamp) "
                "| summarize arg_max(ts, *) by transaction_id "
                "| order by ts desc "
                "| limit 150"
            )
            df_data = query_fabric_kql(kql_query_uri, kql_db_name, txn_query, access_token)
            
            if df_data.empty:
                txn_query_raw = (
                    "real_time_transactions "
                    "| extend ts = todatetime(timestamp) "
                    "| where ts >= ago(24h) "
                    "| summarize arg_max(ts, *) by transaction_id "
                    "| order by ts desc "
                    "| limit 150"
                )
                df_data = query_fabric_kql(kql_query_uri, kql_db_name, txn_query_raw, access_token)
        except Exception:
            pass
            
    if df_data.empty:
        df_data = pd.DataFrame(transactions_feed)
        
    if df_data.empty:
        return []
        
    if "risk_score" in df_data.columns:
        df_data["risk_score"] = pd.to_numeric(df_data["risk_score"], errors="coerce").fillna(0).astype(int)
    if "amount" in df_data.columns:
        df_data["amount"] = pd.to_numeric(df_data["amount"], errors="coerce").fillna(0.0).astype(float)
        
    if search:
        df_data = df_data[
            df_data["customer_name"].str.contains(search, case=False, na=False) |
            df_data["transaction_id"].str.contains(search, case=False, na=False)
        ]
    if channel and channel != "All Channels":
        df_data = df_data[df_data["payment_channel"] == channel]
        
    return df_data.head(limit).to_dict(orient="records")

@app.get("/api/charts/historical")
def get_historical_charts_data(user: dict = Depends(verify_token)):
    """Fetch multi-dimensional visual datasets from historical and live databases."""
    status_info = get_system_status()
    is_live = status_info["is_live"]
    
    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    
    df_channel = pd.DataFrame()
    df_weekly = pd.DataFrame()
    df_cities = pd.DataFrame()
    
    # Check if we query from live Fabric SQL endpoints or local SQLite schemas
    try:
        if is_live and tenant_id and client_id and client_secret:
            q_channel = """
                SELECT payment_channel, 
                       SUM(CASE WHEN is_fraud = 0 THEN 1 ELSE 0 END) AS safe_count,
                       SUM(CASE WHEN is_fraud = 1 THEN 1 ELSE 0 END) AS fraud_count
                FROM historical_credit_card_fraud
                GROUP BY payment_channel
            """
            q_weekly = """
                SELECT TOP 10 c.full_date AS date, AVG(f.risk_score) AS avg_risk
                FROM historical_credit_card_fraud f
                INNER JOIN dim_calendar c ON f.date_key = c.date_key
                GROUP BY c.full_date
                ORDER BY c.full_date ASC
            """
            q_cities = """
                SELECT TOP 5 l.city, COUNT(*) as total_count, SUM(f.is_fraud) as fraud_count
                FROM historical_credit_card_fraud f
                INNER JOIN dim_location l ON f.location_key = l.location_key
                GROUP BY l.city
                ORDER BY total_count DESC
            """
            df_channel = query_fabric_lakehouse_sql(q_channel, tenant_id, client_id, client_secret)
            df_weekly = query_fabric_lakehouse_sql(q_weekly, tenant_id, client_id, client_secret)
            df_cities = query_fabric_lakehouse_sql(q_cities, tenant_id, client_id, client_secret)
    except Exception:
        pass
        
    # Local SQLite Fallback Seeder
    if df_channel.empty or df_weekly.empty or df_cities.empty:
        sqlite_conn = get_local_lakehouse_sqlite_db()
        if sqlite_conn:
            try:
                # Local SQL parsing queries
                q_channel = """
                    SELECT payment_channel, 
                           SUM(CASE WHEN is_fraud = 0 THEN 1 ELSE 0 END) AS safe_count,
                           SUM(CASE WHEN is_fraud = 1 THEN 1 ELSE 0 END) AS fraud_count
                    FROM historical_credit_card_fraud
                    GROUP BY payment_channel
                """
                q_weekly = """
                    SELECT c.full_date AS date, AVG(f.risk_score) AS avg_risk
                    FROM historical_credit_card_fraud f
                    INNER JOIN dim_calendar c ON f.date_key = c.date_key
                    GROUP BY c.full_date
                    ORDER BY c.full_date ASC
                    LIMIT 10
                """
                q_cities = """
                    SELECT l.city, COUNT(*) as total_count, SUM(f.is_fraud) as fraud_count
                    FROM historical_credit_card_fraud f
                    INNER JOIN dim_location l ON f.location_key = l.location_key
                    GROUP BY l.city
                    ORDER BY total_count DESC
                    LIMIT 5
                """
                df_channel = execute_sql_locally(q_channel, sqlite_conn)
                df_weekly = execute_sql_locally(q_weekly, sqlite_conn)
                df_cities = execute_sql_locally(q_cities, sqlite_conn)
            except Exception as e:
                print(f"SQLite charts querying failed: {e}")
                
    return {
        "channel_data": df_channel.to_dict(orient="records") if not df_channel.empty else [],
        "weekly_risk": df_weekly.to_dict(orient="records") if not df_weekly.empty else [],
        "city_data": df_cities.to_dict(orient="records") if not df_cities.empty else []
    }

@app.post("/api/simulate")
def trigger_transaction_simulation(user: dict = Depends(verify_token)):
    """Generate a periodic transaction event, compute risk, trigger Teams, and store in feed."""
    global transactions_feed, alerted_tx_ids
    
    is_anomaly = (random.random() < 0.22)
    name = random.choice(INDIAN_NAMES)
    city_info = random.choice(CITIES)
    tx_id = f"TXN-{random.randint(100000, 999999)}"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    
    if is_anomaly:
        pattern = random.randint(1, 4)
        if pattern == 1:
            merchant = random.choice(SUSPICIOUS_MERCHANTS)
            txn = {
                "transaction_id": tx_id,
                "customer_id": f"CUST-{random.randint(100000, 999999)}",
                "account_number": f"ACT-{random.randint(100000, 999999)}",
                "customer_name": name,
                "timestamp": timestamp,
                "amount": round(random.uniform(210000, 275000), 2),
                "merchant": merchant["name"],
                "merchant_category": merchant["category"],
                "payment_channel": "Internet Banking",
                "transaction_type": "Debit",
                "country": "India",
                "city": city_info[0],
                "state": city_info[1],
                "device_type": "Desktop",
                "ip_address": f"103.45.21.{random.randint(2,254)}",
                "risk_score": 0,
                "is_fraud": 0
            }
        elif pattern == 2:
            txn = {
                "transaction_id": tx_id,
                "customer_id": f"CUST-{random.randint(100000, 999999)}",
                "account_number": f"ACT-{random.randint(100000, 999999)}",
                "customer_name": name,
                "timestamp": timestamp,
                "amount": round(random.uniform(15000, 38000), 2),
                "merchant": "Offshore Retailer",
                "merchant_category": "Travel & Leisure",
                "payment_channel": "UPI",
                "transaction_type": "Debit",
                "country": random.choice(["Russia", "Ukraine", "Nigeria", "United Arab Emirates"]),
                "city": "Moscow",
                "state": "Overseas",
                "device_type": "Unknown Linux Terminal",
                "ip_address": f"85.201.12.{random.randint(2,254)}",
                "risk_score": 0,
                "is_fraud": 0
            }
        elif pattern == 3:
            txn = {
                "transaction_id": tx_id,
                "customer_id": f"CUST-{random.randint(100000, 999999)}",
                "account_number": f"ACT-{random.randint(100000, 999999)}",
                "customer_name": name,
                "timestamp": timestamp,
                "amount": round(random.uniform(42000, 58000), 2),
                "merchant": "Midnight Cash Outlet",
                "merchant_category": "ATM Cash Out",
                "payment_channel": "ATM",
                "transaction_type": "Debit",
                "country": "India",
                "city": city_info[0],
                "state": city_info[1],
                "device_type": "Tablet",
                "ip_address": f"223.189.43.{random.randint(2,254)}",
                "risk_score": 0,
                "is_fraud": 0
            }
        else:
            merchant = random.choice(SUSPICIOUS_MERCHANTS)
            txn = {
                "transaction_id": tx_id,
                "customer_id": f"CUST-{random.randint(100000, 999999)}",
                "account_number": f"ACT-{random.randint(100000, 999999)}",
                "customer_name": name,
                "timestamp": timestamp,
                "amount": round(random.uniform(35000, 70000), 2),
                "merchant": merchant["name"],
                "merchant_category": merchant["category"],
                "payment_channel": "Internet Banking",
                "transaction_type": "Debit",
                "country": "India",
                "city": city_info[0],
                "state": city_info[1],
                "device_type": "Suspicious Mobile Device Model",
                "ip_address": "185.220.101.44",
                "risk_score": 0,
                "is_fraud": 0
            }
    else:
        merchant = random.choice(MERCHANTS)
        txn = {
            "transaction_id": tx_id,
            "customer_id": f"CUST-{random.randint(100000, 999999)}",
            "account_number": f"ACT-{random.randint(100000, 999999)}",
            "customer_name": name,
            "timestamp": timestamp,
            "amount": round(random.uniform(500, 15000), 2),
            "merchant": merchant["name"],
            "merchant_category": merchant["category"],
            "payment_channel": random.choice(["UPI", "POS", "Internet Banking", "ATM"]),
            "transaction_type": "Debit",
            "country": "India",
            "city": city_info[0],
            "state": city_info[1],
            "device_type": "Mobile",
            "ip_address": f"192.168.1.{random.randint(2,254)}",
            "risk_score": 0,
            "is_fraud": 0
        }
        
    score, reasons = local_calculate_ensemble_risk(txn)
    txn["risk_score"] = score
    txn["is_fraud"] = 1 if score > 80 else 0
    txn["customer_email"] = "sayanbanerjee024@gmail.com"
    
    openai_key = os.getenv("OPENAI_API_KEY")
    config_profiles = load_accelerator_config()
    openai_config = config_profiles.get("openaiConfig", {})
    
    if openai_key and openai_key != "YOUR_OPENAI_API_KEY":
        openai_endpoint = openai_config.get("apiEndpoint", "https://api.openai.com/v1")
        openai_model = openai_config.get("modelName", "gpt-4o")
        txn["ai_explanation"] = explain_risk_with_openai(txn, score, reasons, openai_key, openai_endpoint, openai_model)
    else:
        txn["ai_explanation"] = local_explain_risk_with_ai(txn, score, reasons)
        
    teams_webhook = os.getenv("TEAMS_WEBHOOK_URL")
    sent_alert = False
    if score > 80 and teams_webhook and tx_id not in alerted_tx_ids:
        sent_alert = send_teams_fraud_alert(teams_webhook, txn, score, txn["ai_explanation"])
        if sent_alert:
            alerted_tx_ids.add(tx_id)
            
    transactions_feed.insert(0, txn)
    if len(transactions_feed) > 100:
        transactions_feed.pop()
        
    return {
        "status": "success",
        "transaction": txn,
        "teams_alert_sent": sent_alert
    }

@app.post("/api/sign-off")
def submit_case_sign_off(signoff: CaseSignOff, user: dict = Depends(verify_token)):
    """Register analyst checklist sign-off in audit trails."""
    global sign_off_logs
    
    tx_id = signoff.transaction_id
    sign_off_logs[tx_id] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checklist": signoff.checklist_state,
        "analyst_signature": signoff.signature
    }
    
    return {"status": "success", "message": f"Case sign-off recorded for {tx_id}"}

@app.post("/api/copilot")
def query_ai_security_copilot(query: CopilotQuery, user: dict = Depends(verify_token)):
    """Translate and run natural language business query returning clean markdown responses and interactive raw records."""
    global transactions_feed
    
    question = query.question
    config_profiles = load_accelerator_config()
    
    status_info = get_system_status()
    is_live = status_info["is_live"]
    
    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    
    access_token = None
    if is_live:
        try:
            access_token = get_kql_client_credentials(tenant_id, client_id, client_secret)
        except Exception:
            is_live = False

    query_type, executed_query = translate_question_to_query(question, config_profiles)
    
    df_result = pd.DataFrame()
    try:
        if query_type == "KQL":
            if is_live:
                df_result = query_fabric_kql(kql_query_uri, kql_db_name, executed_query, access_token)
            else:
                df_base = get_transactions(limit=150, user=user)
                df_result = execute_kql_locally(executed_query, pd.DataFrame(df_base))
        else:
            try:
                if tenant_id and client_id and client_secret:
                    df_result = query_fabric_lakehouse_sql(executed_query, tenant_id, client_id, client_secret)
                else:
                    raise Exception("Fallback to SQLite")
            except Exception:
                sqlite_conn = get_local_lakehouse_sqlite_db()
                if sqlite_conn:
                    df_result = execute_sql_locally(executed_query, sqlite_conn)
                else:
                    df_result = pd.DataFrame()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database execution failed: {e}")

    answer = formulate_copilot_response(question, executed_query, df_result, config_profiles)
    
    return {
        "question": question,
        "query_type": query_type,
        "executed_query": executed_query,
        "markdown_response": answer,
        "dataframe": df_result.to_dict(orient="records") if not df_result.empty else []
    }

@app.post("/api/chat/clear")
def clear_chat_history(user: dict = Depends(verify_token)):
    """Clear chat workspace session profiles."""
    return {"status": "success", "message": "Chat history cleared"}

@app.get("/api/export")
def export_ledger_csv(user: dict = Depends(verify_token)):
    """Generate transactional log csv stream download."""
    df_ledger = pd.DataFrame(get_transactions(limit=1000, user=user))
    if df_ledger.empty:
        csv_content = "timestamp,transaction_id,customer_name,amount,payment_channel,device_type,ip_address,risk_score,is_fraud\n"
    else:
        cols = ['timestamp', 'transaction_id', 'customer_name', 'amount', 'payment_channel', 'device_type', 'ip_address', 'risk_score', 'is_fraud']
        existing = [c for c in cols if c in df_ledger.columns]
        csv_content = df_ledger[existing].to_csv(index=False)
        
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=fraud_ledger_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )
