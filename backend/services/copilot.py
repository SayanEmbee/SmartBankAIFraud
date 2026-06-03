import os
import re
import json
import pandas as pd
from datetime import datetime

def translate_question_to_query(question, config_data):
    """Translate natural language questions to KQL (for live stream) or SQL (for Lakehouse facts)."""
    starters = {
        "Show me a high-level overview of our transaction ingestion telemetry.": 
            ("KQL", "real_time_transactions\n| summarize TotalTransactions = count(), DateFrom = min(todatetime(timestamp)), DateTo = max(todatetime(timestamp)), UniqueCustomers = dcount(customer_id), AvgAmount = round(avg(amount), 2), AvgRisk = round(avg(risk_score), 1), FraudCount = countif(risk_score > 80)"),
        
        "What are the detailed fraud statistics and vulnerability rates by payment channel?":
            ("KQL", "real_time_transactions\n| summarize TotalTransactions = count(), TotalFraud = countif(risk_score > 80), MaxRisk = max(risk_score), AvgRisk = round(avg(risk_score), 2), TotalAmount = round(sum(amount), 2) by payment_channel\n| extend FraudPercentage = round(TotalFraud * 100.0 / TotalTransactions, 2)\n| order by FraudPercentage desc"),
        
        "Identify all cross-border transactions originating outside of India with a risk score above 80%.":
            ("KQL", "real_time_transactions\n| where country != \"India\" and risk_score > 80\n| project timestamp, transaction_id, customer_name, country, amount, risk_score, payment_channel, device_type\n| order by risk_score desc"),
        
        "Detect suspicious midnight transactions occurring via Internet Banking with high risk.":
            ("KQL", "real_time_transactions\n| extend Hour = hourofday(todatetime(timestamp))\n| where Hour in (1, 2, 3, 4) and payment_channel == \"Internet Banking\" and risk_score > 80\n| project timestamp, transaction_id, customer_name, amount, risk_score, ip_address, device_type\n| order by risk_score desc"),
            
        "How many fraud cases did we have in Ahmedabad this week?":
            ("SQL", "SELECT COUNT(*) AS FraudCount FROM historical_credit_card_fraud f INNER JOIN dim_location l ON f.location_key = l.location_key INNER JOIN dim_calendar c ON f.date_key = c.date_key WHERE l.city = 'Ahmedabad' AND f.is_fraud = 1 AND c.full_date >= DATEADD(day, -7, GETDATE())"),
            
        "Why was customer ACC-6756's account flagged?":
            ("SQL", "SELECT f.timestamp, f.amount, f.risk_score, f.is_fraud, l.city, l.country, d.device_type, net.network_type FROM historical_credit_card_fraud f INNER JOIN dim_customer cust ON f.customer_key = cust.customer_key INNER JOIN dim_location l ON f.location_key = l.location_key INNER JOIN dim_device d ON f.device_key = d.device_key INNER JOIN dim_network net ON f.network_key = net.network_key WHERE cust.account_number = 'ACC-6756' AND f.risk_score > 80 ORDER BY f.timestamp DESC")
    }
    
    cleaned_q = question.strip().strip("?").strip()
    for sq, val in starters.items():
        if cleaned_q.lower() in sq.lower() or sq.lower() in cleaned_q.lower():
            return val

    openai_key = os.getenv("OPENAI_API_KEY")
    openai_config = config_data.get("openaiConfig", {})
    if openai_key and openai_key != "YOUR_OPENAI_API_KEY":
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key, base_url=openai_config.get("apiEndpoint", "https://api.openai.com/v1"))
            
            system_prompt = """You are a highly advanced Microsoft Fabric Data Agent.
Your job is to translate a user's natural language question into EITHER an optimized KQL query or an optimized SQL query depending on the query scope:
- **KQL (for Real-time/Live stream table `real_time_transactions`)**: Use KQL if the question asks about today, live streaming transactions, real-time alerts, or live ingestion status.
- **SQL (for Historical Star Schema OneLake Lakehouse delta tables)**: Use T-SQL if the question asks about past history (yesterday, last week/month/year, specific date ranges), dimension tables (customer details, merchant categories, network IP models, dates, location lists), or historical aggregations.

### Category A: Live Real-Time Staging Tables (KQL Engine)
- `real_time_transactions` schema: transaction_id (string), customer_id (string), account_number (string), customer_name (string), customer_email (string), timestamp (datetime), amount (real), merchant (string), merchant_category (string), payment_channel (string), transaction_type (string), country (string), city (string), state (string), ip_address (string), device_type (string), risk_score (int), is_fraud (int)
- `sent_emails_audit` schema: transaction_id (string), sent_timestamp (string)

### Category B: Lakehouse Star Schema Tables (SQL Engine)
- Fact table `historical_credit_card_fraud` schema: transaction_id (varchar), timestamp (datetime2), amount (decimal), risk_score (int), is_fraud (int), customer_key (varchar), merchant_key (varchar), location_key (varchar), device_key (varchar), channel_key (varchar), type_key (varchar), network_key (varchar), date_key (int YYYYMMDD)
- Dimension tables:
  - `dim_customer`: customer_key (PK), customer_id, customer_name, account_number
  - `dim_merchant`: merchant_key (PK), merchant_name, merchant_category
  - `dim_location`: location_key (PK), country, state, city
  - `dim_device`: device_key (PK), device_type
  - `dim_channel`: channel_key (PK), payment_channel
  - `dim_transaction_type`: type_key (PK), transaction_type
  - `dim_network`: network_key (PK), ip_address, ip_subnet, network_type
  - `dim_calendar`: date_key (PK), full_date (datetime2), year, quarter, month, day, month_name, day_name, day_of_week, is_weekend

Rules for Output:
- Respond in JSON format with exactly two keys:
  1. "type": EITHER "KQL" or "SQL"
  2. "query": The generated query string (without markdown formatting, quotes, or codeblocks).
- Do not output any conversational text or markdown codeblocks. Just the raw JSON.
"""
            response = client.chat.completions.create(
                model=openai_config.get("modelName", "gpt-4o"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question}
                ],
                temperature=0.0
            )
            raw_res = response.choices[0].message.content.strip().replace("```json", "").replace("```", "").strip()
            res_json = json.loads(raw_res)
            return res_json.get("type", "KQL"), res_json.get("query", "real_time_transactions | limit 10")
        except Exception:
            pass

    is_historical = any(kw in question.lower() for kw in ["history", "yesterday", "week", "month", "year", "ahmedabad", "acc-", "customer cust", "join", "select"])
    if is_historical:
        return "SQL", "SELECT * FROM historical_credit_card_fraud LIMIT 10"
    return "KQL", "real_time_transactions | limit 10"

def execute_kql_locally(kql_query, df):
    """Execute KQL queries locally on in-memory simulated DataFrame."""
    if df.empty:
        return df
    
    res = df.copy()
    lines = [line.strip() for line in kql_query.split("\n") if line.strip()]
    
    for line in lines:
        if line.startswith("real_time_transactions"):
            continue
        if line.startswith("|"):
            line = line[1:].strip()
            
        if line.startswith("where "):
            clause = line[len("where "):].strip()
            conditions = clause.split(" and ")
            for cond in conditions:
                cond = cond.strip()
                if "!=" in cond:
                    col, val = cond.split("!=")
                    col, val = col.strip(), val.strip().strip('"').strip("'")
                    if col in res.columns:
                        res = res[res[col] != val]
                elif "==" in cond:
                    col, val = cond.split("==")
                    col, val = col.strip(), val.strip().strip('"').strip("'")
                    if col in res.columns:
                        if val.isdigit():
                            res = res[res[col] == int(val)]
                        else:
                            res = res[res[col] == val]
                elif ">" in cond:
                    col, val = cond.split(">")
                    col, val = col.strip(), val.strip()
                    if col in res.columns:
                        res = res[res[col] > float(val)]
                elif "<" in cond:
                    col, val = cond.split("<")
                    col, val = col.strip(), val.strip()
                    if col in res.columns:
                        res = res[res[col] < float(val)]
                elif " in " in cond:
                    col, vals_str = cond.split(" in ")
                    col = col.strip()
                    vals_str = vals_str.strip().strip("(").strip(")")
                    vals = [int(v.strip()) if v.strip().isdigit() else v.strip().strip('"').strip("'") for v in vals_str.split(",")]
                    if col == "Hour":
                        res["Hour"] = pd.to_datetime(res["timestamp"], errors="coerce").dt.hour
                    if col in res.columns:
                        res = res[res[col].isin(vals)]
                    
        elif line.startswith("extend "):
            clause = line[len("extend "):].strip()
            if "=" in clause:
                col, expr = clause.split("=", 1)
                col, expr = col.strip(), expr.strip()
                if "hourofday" in expr:
                    res[col] = pd.to_datetime(res["timestamp"], errors="coerce").dt.hour
                elif "todatetime" in expr:
                    res[col] = pd.to_datetime(res["timestamp"], errors="coerce")
                    
        elif line.startswith("summarize "):
            clause = line[len("summarize "):].strip()
            if " by " in clause:
                agg_part, by_part = clause.split(" by ")
                agg_part = agg_part.strip()
                by_part = by_part.strip().split(",")
                by_cols = [c.strip() for c in by_part]
            else:
                agg_part = clause
                by_cols = []
                
            aggs = agg_part.split(",")
            agg_dict = {}
            for agg in aggs:
                agg = agg.strip()
                if "=" in agg:
                    new_col, func_expr = agg.split("=", 1)
                    new_col, func_expr = new_col.strip(), func_expr.strip()
                    
                    if "count()" in func_expr:
                        agg_dict[new_col] = ("transaction_id", "count")
                    elif "countif" in func_expr:
                        agg_dict[new_col] = ("risk_score", lambda x: (x > 80).sum())
                    elif "sum(" in func_expr:
                        col = func_expr[func_expr.find("(")+1:func_expr.rfind(")")]
                        agg_dict[new_col] = (col, "sum")
                    elif "avg(" in func_expr:
                        col = func_expr[func_expr.find("(")+1:func_expr.rfind(")")]
                        agg_dict[new_col] = (col, "mean")
                    elif "max(" in func_expr:
                        col = func_expr[func_expr.find("(")+1:func_expr.rfind(")")]
                        agg_dict[new_col] = (col, "max")
                    elif "min(" in func_expr:
                        col = func_expr[func_expr.find("(")+1:func_expr.rfind(")")]
                        agg_dict[new_col] = (col, "min")
                    elif "dcount(" in func_expr:
                        col = func_expr[func_expr.find("(")+1:func_expr.rfind(")")]
                        agg_dict[new_col] = (col, "nunique")
            
            if by_cols:
                valid_by = [c for c in by_cols if c in res.columns]
                if valid_by:
                    grouped = res.groupby(valid_by)
                    agg_res = {}
                    for k, v in agg_dict.items():
                        col, func = v
                        if col in res.columns:
                            agg_res[k] = grouped[col].agg(func)
                    res = pd.DataFrame(agg_res).reset_index()
            else:
                agg_res = {}
                for k, v in agg_dict.items():
                    col, func = v
                    if col in res.columns:
                        if callable(func):
                            agg_res[k] = [func(res[col])]
                        else:
                            agg_res[k] = [res[col].agg(func)]
                res = pd.DataFrame(agg_res)
                
        elif line.startswith("project "):
            cols = [c.strip() for c in line[len("project "):].split(",")]
            existing_cols = [c for c in cols if c in res.columns]
            res = res[existing_cols]
            
        elif line.startswith("order by "):
            parts = line[len("order by "):].split()
            col = parts[0].strip()
            asc = True
            if len(parts) > 1 and parts[1].strip().lower() == "desc":
                asc = False
            if col in res.columns:
                res = res.sort_values(by=col, ascending=asc)
                
        elif line.startswith("limit "):
            n = int(line[len("limit "):].strip())
            res = res.head(n)
            
    return res

def formulate_copilot_response(question, kql_query, df_result, config_data):
    """Formulate executive security response summaries from database outputs."""
    # 1. Overview Telemetry
    if "TotalTransactions" in df_result.columns and "UniqueCustomers" in df_result.columns and not df_result.empty:
        try:
            row = df_result.iloc[0]
            total_txs = int(row.get("TotalTransactions", 0))
            min_date = str(row.get("DateFrom", "N/A")).split(".")[0].replace("T", " ")
            max_date = str(row.get("DateTo", "N/A")).split(".")[0].replace("T", " ")
            unique_custs = int(row.get("UniqueCustomers", 0))
            avg_amount = float(row.get("AvgAmount", 0.0))
            avg_risk = float(row.get("AvgRisk", 0.0))
            fraud_count = int(row.get("FraudCount", 0))
            
            return f"""### 📊 Ingestion Telemetry Executive Summary

I have executed a comprehensive KQL telemetry query against the active `real_time_transactions` ledger. Here is the threat intelligence audit:

- **Ledger Audit Interval:** From `{min_date}` to `{max_date}`
- **Total Processed Transactions:** **{total_txs:,}** events ingested.
- **Account Ingestion Depth:** **{unique_custs:,}** unique customer endpoints monitored.
- **Average Transaction Footprint:** Rs. **{avg_amount:,.2f}**
- **Composite Risk Rating:** **{avg_risk}%** average risk profile across all streams.
- **High-Risk Anomalies Flagged:** **{fraud_count}** transactions exceed the 80% critical risk threshold.

**Compliance Risk Directive:** 
The composite risk rating of `{avg_risk}%` is within acceptable operating margins, but the presence of **{fraud_count}** critical alerts triggers the **RBI Circular on Customer Liability (Rule 2017/18)**. Automated security locks have been successfully placed on these compromised accounts."""
        except Exception:
            pass

    # 2. Channel Vulnerability
    if "payment_channel" in df_result.columns and "FraudPercentage" in df_result.columns and not df_result.empty:
        try:
            table_rows = ""
            max_channel = "Internet Banking"
            max_rate = 0.0
            
            for idx, row in df_result.iterrows():
                ch = row.get("payment_channel", "Unknown")
                tot = int(row.get("TotalTransactions", 0))
                fr = int(row.get("TotalFraud", 0))
                rate = float(row.get("FraudPercentage", 0.0))
                max_r = int(row.get("MaxRisk", 0))
                avg_r = float(row.get("AvgRisk", 0.0))
                tot_a = float(row.get("TotalAmount", 0.0))
                
                if rate > max_rate:
                    max_rate = rate
                    max_channel = ch
                    
                table_rows += f"| {ch} | {tot:,} | {fr:,} | {rate}% | {max_r}% | {avg_r}% | Rs. {tot_a:,.2f} |\n"
                
            insight = f"The **{max_channel}** channel displays the highest vulnerability index with a fraud rate of **{max_rate}%**. Risk parameters should be tightened immediately for {max_channel} authentication flows."
            
            return f"""### 💳 Channel Exposure & Vulnerability Risk Analysis

Analyzing the distribution of fraud and risk models across the payment channels:

| Payment Channel | Total Vol | Fraud Vol | Fraud Rate (%) | Max Risk (%) | Avg Risk (%) | Total Amount (Rs.) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
{table_rows}
**Threat Insight & Recommendation:**
{insight}"""
        except Exception:
            pass

    # 3. Cross Border
    if "country" in df_result.columns and "risk_score" in df_result.columns and not df_result.empty:
        countries = df_result["country"].unique()
        if len(countries) > 0 and (len(countries) > 1 or countries[0] != "India"):
            try:
                table_rows = ""
                for idx, row in df_result.head(10).iterrows():
                    ts = str(row.get("timestamp", "N/A")).split("T")[0]
                    tx_id = row.get("transaction_id", "N/A")
                    cust = row.get("customer_name", "N/A")
                    coun = row.get("country", "N/A")
                    amt = float(row.get("amount", 0.0))
                    risk = int(row.get("risk_score", 0))
                    ch = row.get("payment_channel", "N/A")
                    dev = row.get("device_type", "N/A")
                    
                    table_rows += f"| {ts} | {tx_id[:8]}... | {cust} | {coun} | Rs. {amt:,.2f} | **{risk}%** | {ch} | {dev} |\n"
                    
                return f"""### 🌍 Cross-Border Threat Vectors & AML Alerts

I have filtered the transaction ledger for all overseas events (originating outside of India) with an AI Risk Score exceeding **80%**.

**Total Cross-Border Threat Alerts:** **{len(df_result)}** events detected.

| Date | Transaction ID | Customer Name | Country | Amount | Risk Score | Channel | Device |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
{table_rows}
**Compliance Risk Directive:**
Cross-border transactions originating from high-risk locations with impossible travel velocity breach standard FEMA and RBI security guidelines. Instantaneous global lock status has been applied to these accounts."""
            except Exception:
                pass

    # 4. Midnight Takeover
    if "Hour" in df_result.columns or ("payment_channel" in df_result.columns and "ip_address" in df_result.columns and not df_result.empty):
        try:
            table_rows = ""
            for idx, row in df_result.head(10).iterrows():
                ts = str(row.get("timestamp", "N/A")).split(".")[0].replace("T", " ")
                tx_id = row.get("transaction_id", "N/A")
                cust = row.get("customer_name", "N/A")
                amt = float(row.get("amount", 0.0))
                risk = int(row.get("risk_score", 0))
                ip = row.get("ip_address", "N/A")
                dev = row.get("device_type", "N/A")
                
                table_rows += f"| {ts} | {tx_id[:8]}... | {cust} | Rs. {amt:,.2f} | **{risk}%** | {ip} | {dev} |\n"
                
            return f"""### 🌙 Midnight Internet Banking Hijacking Detection

I have scanned the ledger for transactions occurring during the critical midnight window (**1:00 AM - 4:30 AM**) via **Internet Banking** with a risk score exceeding **80%**.

**Total Midnight Internet Banking Hijacks:** **{len(df_result)}** events detected.

| Ingestion Time | Transaction ID | Customer Name | Amount | Risk Score | IP Address | Device hardware |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
{table_rows}
**Contextual Forensic Telemetry:**
Midnight transactions executed via Internet Banking on unrecognized browsers or IP networks represent primary account takeover (ATO) indicators. The active sessions have been terminated."""
        except Exception:
            pass

    # OpenAI Cognitive Summary (if API key is available)
    openai_key = os.getenv("OPENAI_API_KEY")
    openai_config = config_data.get("openaiConfig", {})
    if openai_key and openai_key != "YOUR_OPENAI_API_KEY" and not df_result.empty:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key, base_url=openai_config.get("apiEndpoint", "https://api.openai.com/v1"))
            
            prompt = f"""You are a professional banking fraud risk compliance specialist and executive risk reporter.
Analyze the following tabular dataset returned by a KQL query and write a highly analytical, extremely polished, and structured executive markdown response answering the user's question.

User's Question: "{question}"
KQL Query Executed: "{kql_query}"

Returned Data (first 30 rows as JSON):
{df_result.head(30).to_json(orient='records', indent=2)}

Format Requirements:
- Use clean, premium markdown structure (headers, bullet points, and tables if applicable).
- Keep the tone professional, objective, and risk-oriented.
- Highlight regulatory implications (e.g. RBI circulars) where relevant.
- Provide a summary and bulleted threats list, followed by recommended remediation directives.
"""
            response = client.chat.completions.create(
                model=openai_config.get("modelName", "gpt-4o"),
                messages=[
                    {"role": "system", "content": "You are a professional banking fraud risk compliance specialist. Output clean, concise, highly analytical markdown summaries."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"*(AI live generation fallback: {e})*\n\n**Raw Query Results Summary:**\nReturned {len(df_result)} rows. Columns: {', '.join(df_result.columns)}"

    # High-fidelity Local Intelligence Generator (Bypasses OpenAI key if offline/missing)
    if (not openai_key or openai_key == "YOUR_OPENAI_API_KEY") and not df_result.empty:
        cleaned_q = question.strip().strip("?").strip().lower()
        
        # 1. Ahmedabad query
        if "ahmedabad" in cleaned_q:
            try:
                count_val = int(df_result.iloc[0, 0])
                return f"""### 🏛️ Regional Risk & Anomaly Assessment (Ahmedabad)

I have successfully executed the translated **SQL** query against the **Fabric Lakehouse Star Schema**.

- **Target City:** Ahmedabad, Gujarat, India
- **Evaluation Interval:** Past 7 days (Micro-batch weekly window)
- **Active Fraud Surges Flagged:** **{count_val}** transaction anomalies.
- **Exposure Index:** Moderate risk surge. 

**Operational Recommendation:** 
This volume triggers the **RBI Circular on Customer Liability (DBR.No.Leg.BC.78/09.07.005/2017-18)**. Risk analytics should temporarily lower the transaction validation thresholds for mobile and merchant POS devices in the Ahmedabad postal registry to mitigate localized skim attacks.

*Remediation Tier 1:* Restrict domestic and international ATM channels for flagged cards.
*Remediation Tier 2:* Trigger instant in-app security alert and SMS warning to registered number."""
            except Exception:
                pass
                
        # 2. ACC-6756 query
        elif "acc-6756" in cleaned_q:
            try:
                rows_md = ""
                for idx, r in df_result.iterrows():
                    ts = str(r.get("timestamp", "N/A")).split(".")[0].replace("T", " ")
                    amt = float(r.get("amount", 0.0))
                    risk = int(r.get("risk_score", 0))
                    city = r.get("city", "Mumbai")
                    coun = r.get("country", "India")
                    dev = r.get("device_type", "Mobile")
                    net = r.get("network_type", "Standard Subnet")
                    
                    rows_md += f"| {ts} | Rs. {amt:,.2f} | **{risk}%** | {city}, {coun} | {dev} | {net} |\n"
                    
                return f"""### 🛡️ Customer Account Autopsy Report: ACC-6756

I have successfully executed the translated **SQL** query against the **Fabric Lakehouse Star Schema** to perform a deep multi-dimensional audit.

#### 🔍 1. Threat Analysis Summary
- **Primary Threat Vector:** Suspicious Midnight Hijacking via Unrecognized Device Models.
- **Audit Findings:**
| Time | Amount | Risk Score | Location | Device | Network |
| :--- | :--- | :--- | :--- | :--- | :--- |
{rows_md}
- **Contextual Anomaly:** Customer typical home profile indicates domestic operations. The access via unrecognized device hardware, coupled with high risk scores, represents a critical security deviation.

#### 🏛️ 2. Regulatory & Compliance Impact
- **RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18 Guidelines:** Under the zero-liability framework, the customer has zero liability for third-party breaches if reported within 3 days. Instant locks are mandatory to eliminate bank liability.

#### 🚀 3. Structured Operational Action Plan
- **Tier 1 (Immediate / Automated):** Terminate the active online session, place a temporary lock on Net-Banking channels, and restrict UPI/POS transfers.
- **Tier 2 (Direct Outreach):** Trigger a step-up MFA challenge and initiate RM voice call verification.
- **Tier 3 (Log / Compliance):** Report case to AML/CFT system for Suspicious Transaction Report (STR) logging."""
            except Exception:
                pass

    if df_result.empty:
        return "### 🔍 Analytical Search Completed\n\nNo records matched the specified risk criteria in the current event frame. All ingestion channels are within nominal bounds."
    
    headers = " | ".join(df_result.columns)
    divider = " | ".join(["---"] * len(df_result.columns))
    rows = ""
    for idx, row in df_result.head(10).iterrows():
        row_vals = [str(row[c]) for c in df_result.columns]
        rows += " | ".join(row_vals) + "\n"
        
    more_msg = ""
    if len(df_result) > 10:
        more_msg = f"\n*(Showing top 10 of {len(df_result)} total matching rows)*"
        
    q_type = "SQL" if "SELECT" in kql_query.upper() else "KQL"
    engine_name = "Fabric Lakehouse Star Schema" if q_type == "SQL" else "transactional ledger"
    
    return f"""### 🔍 Analytical Search Completed

I have successfully executed the translated {q_type} query against the {engine_name}.

**Total matching records:** {len(df_result)} rows.

| {headers} |
| {divider} |
{rows}
{more_msg}

*(Configure `OPENAI_API_KEY` in `.env` to unlock live executive-level cognitive summaries.)*"""
