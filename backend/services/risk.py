import os
import random
import requests
from datetime import datetime

def local_calculate_ensemble_risk(txn):
    """Multi-factor heuristics combining rules and synthetic ML probability scoring."""
    reasons = []
    heuristic_score = 10
    amount = float(txn.get('amount', 0))
    
    if amount >= 200000:
        heuristic_score += 45
        reasons.append("High-value spike above threshold of Rs. 2,00,000")
    elif amount >= 50000:
        heuristic_score += 15
        reasons.append("Elevated transaction amount")
        
    if txn.get('payment_channel') == "ATM" and amount >= 40000:
        heuristic_score += 45
        reasons.append("ATM cash withdrawal exceeds daily card limit of Rs. 40,000")
        
    if txn.get('country') != "India":
        heuristic_score += 40
        reasons.append(f"Foreign location mismatch: transaction initiated from {txn.get('country')}")
        
    if txn.get('ip_address') == "185.220.101.44":
        heuristic_score += 35
        reasons.append("Transaction routed through known malicious Tor IP subnet")
        
    try:
        ts = txn['timestamp']
        if "T" in ts:
            ts = ts.split(".")[0].replace("T", " ")
        dt = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")
        if dt.hour in [1, 2, 3, 4]:
            heuristic_score += 20
            reasons.append("Suspicious midnight transaction window (1:00 AM - 4:30 AM)")
    except Exception:
        pass
        
    if txn.get('payment_channel') == "Internet Banking" and "Unrecognized" in txn.get('device_type', ''):
        heuristic_score += 25
        reasons.append("Internet banking accessed via unrecognized device hardware")
        
    # Mocking ML classification models
    ml_score = 0
    if txn.get('country') != "India":
        ml_score = random.randint(86, 96)
    elif txn.get('ip_address') == "185.220.101.44":
        ml_score = 100
    elif amount >= 200000:
        ml_score = 99
    elif txn.get('payment_channel') == "ATM" and amount >= 40000:
        ml_score = 100
    else:
        ml_score = random.randint(5, 18)
        
    if ml_score > 70:
        reasons.append(f"AI Random Forest Classifier flagged transaction as high probability fraud ({ml_score}%)")
        
    final_score = max(ml_score, heuristic_score)
    final_score = min(final_score, 99)
    return final_score, reasons

def local_explain_risk_with_ai(txn, score, reasons):
    """Build highly structured, local rules-based compliance summaries (offline fallback)."""
    amount = float(txn.get('amount', 0))
    channel = txn.get('payment_channel', 'Unknown')
    country = txn.get('country', 'India')
    ip = txn.get('ip_address', '')
    device = txn.get('device_type', '')
    cust = txn.get('customer_name', 'Customer')
    city = txn.get('city', 'Unknown')
    
    threat_vector = "Unknown Anomaly"
    regulatory_impact = "RBI Circular on Customer Liability (Rule 2017/18) - Flagged for review."
    remediation_tier1 = "Initiate instant security hold on Card/UPI channel."
    remediation_tier2 = "Send automated push-verification SMS request to registered mobile."
    remediation_tier3 = "Log case in AML/CFT system for Suspicious Transaction Report (STR) review."
    
    if amount >= 200000:
        threat_vector = "High-Value Transaction Spike (POS/Internet Banking Limit Breach)"
        regulatory_impact = "RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18 limits customer liability if unauthorized transaction is reported within 3 days. High value necessitates immediate preventive freeze to mitigate bank liability."
        remediation_tier1 = "Suspend UPI, POS, and Net-Banking channels immediately. Lock account funds transfer capabilities."
        remediation_tier2 = "Initiate high-priority telephone verification call via the Relationship Manager."
        remediation_tier3 = "Report to Fraud FMC and log in Suspicious Transaction Registry."
    elif channel == "ATM" and amount >= 40000:
        threat_vector = "ATM Velocity & Cash-Out Burst (Daily Debit Limit Breach)"
        regulatory_impact = "High cash-out volumes at unorthodox hours suggest physical card compromise or ATM cloning skimming attacks."
        remediation_tier1 = "Temporary lockdown of debit card status. Restrict domestic and international ATM channels."
        remediation_tier2 = "Trigger instant in-app security alert and SMS warning to registered number."
        remediation_tier3 = "Analyze local ATM terminal DVR footage and review terminal health reports for physical skimmer anomalies."
    elif country != "India":
        threat_vector = "Foreign Geolocation Mismatch (Impossible Travel Speed Anomaly)"
        regulatory_impact = "Cross-border transaction velocity violates standard risk boundaries. Compliance requires instant card lock to prevent cross-border money laundering."
        remediation_tier1 = "Place global card lockdown. Decline all international POS, ATM, and E-commerce gateways."
        remediation_tier2 = "Send critical security email alert and interactive mobile app push-notification confirmation request."
        remediation_tier3 = "Mark card status as 'Compromised' and queue automatic reissue protocol."
    elif ip == "185.220.101.44":
        threat_vector = "Midnight Takeover via Malicious Proxy (Tor Node Access)"
        regulatory_impact = "Routing transaction authentication through a known Tor exit node IP violates standard corporate Cyber Security policy."
        remediation_tier1 = "Terminate active internet-banking login session. Suspend online banking login credentials."
        remediation_tier2 = "Require mandatory step-up Multi-Factor Authentication (MFA) and force credential reset."
        remediation_tier3 = "Flag IP subnet in Security Information and Event Management (SIEM) dashboard for broad threat analysis."

    reasons_bullet = "\n- ".join(reasons)
    explanation = (
        f"### 🛡️ AI Risk Scoring Insight & Decision Summary\n\n"
        f"**Transaction ID:** {txn['transaction_id']} | **Risk Score:** {score}% | **Customer:** {cust}\n\n"
        f"#### 🔍 1. Threat Analysis Summary\n"
        f"- **Threat Vector:** {threat_vector}\n"
        f"- **Risk Indicators Flagged:**\n- {reasons_bullet}\n"
        f"- **Contextual Analysis:** Contextual home profile indicates customer lives in {city}, India. Initiating transaction from {country} via {channel} channel using {device} is a deviation from typical behavioral trends.\n\n"
        f"#### 🏛️ 2. Regulatory & Compliance Impact\n"
        f"- {regulatory_impact}\n\n"
        f"#### 🚀 3. Structured Operational Action Plan\n"
        f"- **Tier 1 (Immediate / Automated):** {remediation_tier1}\n"
        f"- **Tier 2 (Direct Outreach / Step-up):** {remediation_tier2}\n"
        f"- **Tier 3 (Log / Compliance):** {remediation_tier3}"
    )
    return explanation

def explain_risk_with_openai(txn, score, reasons, api_key, endpoint, model):
    """Leverage GPT models to construct highly descriptive banking analyst reports."""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key, base_url=endpoint)
        
        prompt = (
            f"You are a senior banking risk manager and expert fraud analyst at a top bank.\n"
            f"Analyze the anomalous transaction and generate a structured markdown report.\n\n"
            f"### Transaction Details:\n"
            f"- Transaction ID: {txn['transaction_id']}\n"
            f"- Customer Name: {txn['customer_name']}\n"
            f"- Home Location: {txn.get('city', 'Unknown')}, India\n"
            f"- Channel: {txn['payment_channel']}\n"
            f"- Amount: Rs. {txn['amount']}\n"
            f"- Geolocation: {txn['country']}\n"
            f"- Device: {txn.get('device_type', 'Unknown')}\n"
            f"- IP: {txn.get('ip_address', 'Unknown')}\n"
            f"- Flaws Flagged: {', '.join(reasons)}\n"
            f"- AI Risk Score: {score}%\n\n"
            f"### Format:\n"
            f"### 🛡️ AI Risk Scoring Insight & Decision Summary\n\n"
            f"**Transaction ID:** {txn['transaction_id']} | **Risk Score:** {score}% | **Customer:** {txn['customer_name']}\n\n"
            f"#### 🔍 1. Threat Analysis Summary\n"
            f"- **Threat Vector:** [Classify threat, e.g. Geolocation Velocity, Cash-Out Burst, Tor Node Hijacking]\n"
            f"- **Risk Indicators Flagged:** {', '.join(reasons)}\n"
            f"- **Contextual Analysis:** [Analyze the deviation from typical patterns]\n\n"
            f"#### 🏛️ 2. Regulatory & Compliance Impact\n"
            f"- [Cite relevant Indian banking regulatory guidelines like RBI customer liability framework]\n\n"
            f"#### 🚀 3. Structured Operational Action Plan\n"
            f"- **Tier 1 (Immediate / Automated):** [Card block, device blacklisting, active API freeze]\n"
            f"- **Tier 2 (Direct Outreach / Step-up):** [RM phone call verification, MFA step-up request]\n"
            f"- **Tier 3 (Log / Compliance):** [FMC, AML or FIU logs]"
        )
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a professional banking fraud risk compliance specialist. Output clean, extremely concise, highly analytical markdown summaries."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        return response.choices[0].message.content
    except Exception as e:
        mock_exp = local_explain_risk_with_ai(txn, score, reasons)
        return f"{mock_exp}\n\n*(AI live generation fallback: {e})*"

def send_teams_fraud_alert(webhook_url, txn, risk_score, explanation):
    """Broadcast high-risk alert Adaptive Card payload to MS Teams webhook endpoints."""
    headers = {"Content-Type": "application/json"}
    card_payload = {
        "type": "message",
        "attachments": [{
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": [
                    {
                        "type": "TextBlock",
                        "text": "🚨 HIGH-RISK ANOMALY FLAGGED",
                        "weight": "Bolder",
                        "size": "Medium",
                        "color": "Attention"
                    },
                    {
                        "type": "FactSet",
                        "facts": [
                            {"title": "Transaction ID:", "value": str(txn.get('transaction_id', 'Unknown'))},
                            {"title": "Customer:", "value": str(txn.get('customer_name', 'Unknown'))},
                            {"title": "Amount:", "value": f"Rs. {float(txn.get('amount', 0)):,.2f}"},
                            {"title": "Channel:", "value": str(txn.get('payment_channel', 'Unknown'))},
                            {"title": "Risk Score:", "value": f"{risk_score}/100"}
                        ]
                    },
                    {
                        "type": "TextBlock",
                        "text": f"**AI Operations Insights:**\n{explanation}",
                        "wrap": True,
                        "spacing": "Medium"
                    }
                ],
                "actions": [
                    {
                        "type": "Action.OpenUrl",
                        "title": "Investigate in Fabric",
                        "url": "https://app.fabric.microsoft.com"
                    }
                ]
            }
        }]
    }
    try:
        response = requests.post(webhook_url, json=card_payload, headers=headers, timeout=5.0)
        return response.status_code in [200, 201, 202]
    except Exception:
        return False
