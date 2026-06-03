import os
import json
import time
import re
import random
import requests
import sqlite3
import hashlib
import pandas as pd
from datetime import datetime

# In-memory token cache mimicking Streamlit session state caching
token_cache = {}

def load_env_file():
    """Recursively search and load environment variables from .env files."""
    env_paths = [
        ".env",
        os.path.join("..", ".env"),
        os.path.join("..", "..", ".env")
    ]
    for path in env_paths:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ[k.strip()] = v.strip().strip('"').strip("'")
            except Exception:
                pass

load_env_file()

def load_accelerator_config():
    """Retrieve system configuration from accelerator-config.json."""
    config_paths = [
        os.path.join("config", "accelerator-config.json"),
        os.path.join("..", "config", "accelerator-config.json"),
        os.path.join("..", "..", "config", "accelerator-config.json"),
        os.path.join("SmartBankAppWebsite", "config", "accelerator-config.json")
    ]
    for path in config_paths:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    return json.load(f)
            except Exception:
                pass
    return {}

config_data = load_accelerator_config()
openai_config = config_data.get("openaiConfig", {})
kql_db_name = config_data.get("kqlDatabaseName", "BankingRiskDB")
kql_query_uri = os.environ.get("KQL_QUERY_URI", "https://trd-d2106gp5ufbuq1042c.z1.kusto.fabric.microsoft.com")

def get_kql_client_credentials(tenant_id, client_id, client_secret):
    """Retrieve and cache access token for KQL connection using client credentials."""
    global token_cache
    now = time.time()

    if token_cache.get("token") and now < token_cache.get("expires_at", 0):
        return token_cache["token"]

    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://kusto.kusto.windows.net/.default"
    }
    resp = requests.post(token_url, data=payload, timeout=10.0)
    if resp.status_code != 200:
        raise Exception(f"Auth HTTP {resp.status_code}: {resp.text[:200]}")
    
    data = resp.json()
    token = data.get("access_token") or data.get("accessToken")
    if not token:
        raise Exception(f"No access_token returned. Response: {list(data.keys())}")

    token_cache = {"token": token, "expires_at": now + 3000}
    return token

def query_fabric_kql(query_uri, db_name, kql_query, access_token):
    """Query Microsoft Fabric KQL database via REST API."""
    url = f"{query_uri.rstrip('/')}/v2/rest/query"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "db": db_name,
        "csl": kql_query
    }
    response = requests.post(url, json=payload, headers=headers, timeout=12.0)
    if response.status_code != 200:
        raise Exception(f"KQL HTTP {response.status_code}: {response.text[:300]}")
    
    data = response.json()

    # Fabric v2 format (List of frames)
    if isinstance(data, list):
        for frame in data:
            if not isinstance(frame, dict):
                continue
            if frame.get("FrameType") == "DataTable" and frame.get("TableKind") == "PrimaryResult":
                cols = [c["ColumnName"] for c in frame.get("Columns", [])]
                rows = frame.get("Rows", [])
                return pd.DataFrame(rows, columns=cols)
        
        # Fallback to any DataTable frame
        for frame in data:
            if isinstance(frame, dict) and frame.get("FrameType") == "DataTable":
                cols = [c["ColumnName"] for c in frame.get("Columns", [])]
                rows = frame.get("Rows", [])
                if cols and rows:
                    return pd.DataFrame(rows, columns=cols)
        return pd.DataFrame()

    # Classic v1 format
    if isinstance(data, dict):
        tables = data.get("Tables", [])
        primary = [t for t in tables if isinstance(t, dict) and t.get("TableKind") == "PrimaryResult"]
        if not primary:
            primary = [t for t in tables if isinstance(t, dict) and t.get("Rows")]
        if not primary:
            return pd.DataFrame()
        cols = [c["ColumnName"] for c in primary[0].get("Columns", [])]
        rows = primary[0].get("Rows", [])
        return pd.DataFrame(rows, columns=cols)

    return pd.DataFrame()

def query_fabric_lakehouse_sql(sql_query, tenant_id, client_id, client_secret):
    """Query Microsoft Fabric Lakehouse SQL Endpoint via pyodbc."""
    workspace_id = "769a23ca-8962-43fe-965d-ac1537ab0028"
    lakehouse_name = "BankingFraudLakehouse"
    server = f"{workspace_id}.datawarehouse.fabric.microsoft.com,1433"
    
    conn_str = (
        f"Driver={{ODBC Driver 17 for SQL Server}};"
        f"Server={server};"
        f"Database={lakehouse_name};"
        f"UID={client_id};"
        f"PWD={client_secret};"
        f"Authentication=ActiveDirectoryServicePrincipal;"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
    )
    
    import pyodbc
    conn = pyodbc.connect(conn_str, timeout=8)
    try:
        df = pd.read_sql(sql_query, conn)
    finally:
        conn.close()
    return df

# Global cached SQLite connection references
sqlite_connection = None

def get_local_lakehouse_sqlite_db():
    """Build and cache an in-memory SQLite database matching Fabric Lakehouse Star Schema."""
    global sqlite_connection
    if sqlite_connection is not None:
        return sqlite_connection

    csv_path = "data/historical_credit_card_fraud.csv"
    candidate_paths = [
        csv_path,
        os.path.join("data", "historical_credit_card_fraud.csv"),
        os.path.join("..", "data", "historical_credit_card_fraud.csv"),
        os.path.join("SmartBankAppWebsite", "data", "historical_credit_card_fraud.csv"),
        os.path.join("..", "..", "data", "historical_credit_card_fraud.csv")
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            csv_path = p
            break

    if not os.path.exists(csv_path):
        return None

    try:
        df = pd.read_csv(csv_path)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Helper to generate surrogate keys matching Fabric schema
        def sha256_hash(val):
            return hashlib.sha256(str(val).encode('utf-8')).hexdigest()
            
        df['customer_key'] = df['customer_id'].apply(sha256_hash)
        df['merchant_key'] = (df['merchant'] + "||" + df['merchant_category']).apply(sha256_hash)
        df['location_key'] = (df['country'] + "||" + df['state'] + "||" + df['city']).apply(sha256_hash)
        df['device_key'] = df['device_type'].apply(sha256_hash)
        df['channel_key'] = df['payment_channel'].apply(sha256_hash)
        df['type_key'] = df['transaction_type'].apply(sha256_hash)
        df['network_key'] = df['ip_address'].apply(sha256_hash)
        df['date_key'] = (df['timestamp'].dt.year * 10000 + df['timestamp'].dt.month * 100 + df['timestamp'].dt.day).astype(int)
        
        conn = sqlite3.connect(":memory:", check_same_thread=False)
        
        # Central Fact Table
        fact_cols = ['transaction_id', 'customer_key', 'merchant_key', 'location_key', 'device_key',
                     'channel_key', 'type_key', 'network_key', 'date_key', 'timestamp', 'amount',
                     'payment_channel', 'transaction_type', 'ip_address', 'risk_score', 'is_fraud']
        df[fact_cols].to_sql("historical_credit_card_fraud", conn, index=False)
        
        # Dimension Tables
        df[['customer_key', 'customer_id', 'customer_name', 'account_number']].drop_duplicates().to_sql("dim_customer", conn, index=False)
        df[['merchant_key', 'merchant', 'merchant_category']].rename(columns={'merchant': 'merchant_name'}).drop_duplicates().to_sql("dim_merchant", conn, index=False)
        df[['location_key', 'country', 'state', 'city']].drop_duplicates().to_sql("dim_location", conn, index=False)
        df[['device_key', 'device_type']].drop_duplicates().to_sql("dim_device", conn, index=False)
        df[['channel_key', 'payment_channel']].drop_duplicates().to_sql("dim_channel", conn, index=False)
        df[['type_key', 'transaction_type']].drop_duplicates().to_sql("dim_transaction_type", conn, index=False)
        
        # Network Dimension
        dim_net = df[['network_key', 'ip_address']].drop_duplicates().copy()
        dim_net['ip_subnet'] = dim_net['ip_address'].apply(lambda ip: ".".join(str(ip).split(".")[:3]) + ".*" if pd.notna(ip) else "")
        dim_net['network_type'] = dim_net['ip_address'].apply(lambda ip: "Suspicious Tor Exit Node" if ip == "185.220.101.44" else "Standard Subnet")
        dim_net.to_sql("dim_network", conn, index=False)
        
        # Calendar Dimension
        dates = pd.DataFrame({'full_date': pd.to_datetime(df['timestamp'].dt.date.unique())})
        dates['date_key'] = (dates['full_date'].dt.year * 10000 + dates['full_date'].dt.month * 100 + dates['full_date'].dt.day).astype(int)
        dates['year'] = dates['full_date'].dt.year
        dates['quarter'] = dates['full_date'].dt.quarter
        dates['month'] = dates['full_date'].dt.month
        dates['day'] = dates['full_date'].dt.day
        dates['month_name'] = dates['full_date'].dt.strftime('%B')
        dates['day_name'] = dates['full_date'].dt.strftime('%A')
        dates['day_of_week'] = dates['full_date'].dt.dayofweek + 1
        dates['is_weekend'] = dates['day_of_week'].apply(lambda x: 1 if x in [6, 7] else 0)
        dates['full_date'] = dates['full_date'].dt.strftime('%Y-%m-%d %H:%M:%S')
        dates.to_sql("dim_calendar", conn, index=False)
        
        sqlite_connection = conn
        return conn
    except Exception as e:
        print(f"Failed to load in-memory SQLite schema: {e}")
        return None

def execute_sql_locally(sql_query, conn):
    """Execute SQL query locally on in-memory SQLite database, translating T-SQL to SQLite standard."""
    import re
    sql_trans = sql_query
    
    # 1. Translate SELECT TOP N ... to ... LIMIT N
    if "SELECT TOP" in sql_trans.upper():
        match = re.search(r"SELECT\s+TOP\s+(\d+)\s+(.*)", sql_trans, re.IGNORECASE)
        if match:
            limit_val = match.group(1)
            rest_of_query = match.group(2)
            sql_trans = f"SELECT {rest_of_query} LIMIT {limit_val}"
            
    # 2. Translate DATEADD(day, -7, GETDATE()) to date('now', '-7 days')
    sql_trans = re.sub(
        r"DATEADD\s*\(\s*day\s*,\s*-\s*(\d+)\s*,\s*GETDATE\s*\(\s*\)\s*\)",
        r"date('now', '-\1 days')",
        sql_trans,
        flags=re.IGNORECASE
    )
    sql_trans = re.sub(
        r"DATEADD\s*\(\s*day\s*,\s*-\s*(\d+)\s*,\s*GETUTCDATE\s*\(\s*\)\s*\)",
        r"date('now', '-\1 days')",
        sql_trans,
        flags=re.IGNORECASE
    )
    sql_trans = sql_trans.replace("GETDATE()", "date('now')")
    sql_trans = sql_trans.replace("GETUTCDATE()", "date('now')")
    sql_trans = sql_trans.replace("DATETIME2", "TEXT")
    sql_trans = sql_trans.replace("VARCHAR", "TEXT")
    
    return pd.read_sql(sql_trans, conn)
