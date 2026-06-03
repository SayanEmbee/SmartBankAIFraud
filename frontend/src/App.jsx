import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardHome from './components/DashboardHome';
import CopilotRoom from './components/CopilotRoom';
import CaseTriage from './components/CaseTriage';
import LedgerLogs from './components/LedgerLogs';
import AuthDrawer from './components/AuthDrawer';
import { ShieldAlert } from 'lucide-react';

// Import Microsoft MSAL for Entra ID logins
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './utils/authConfig';

const pcInstance = new PublicClientApplication(msalConfig);

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  // If we are inside the MSAL popup window, render a clean loading spinner and let MSAL finalize
  if (window.opener && window.opener !== window) {
    return (
      <div className="min-h-screen bg-slate-50/70 backdrop-blur-md flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-[0_10px_50px_rgba(15,23,42,0.06)] max-w-sm w-full text-center space-y-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="font-space font-bold text-lg text-slate-800">Completing Sign-In</h2>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Authenticating your corporate credentials. This secure window will close automatically.
          </p>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [historicalCharts, setHistoricalCharts] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [msalInstance, setMsalInstance] = useState(null);
  
  // Initialize MSAL and parse redirect hashes instantly on page mount
  useEffect(() => {
    const initMsal = async () => {
      try {
        await pcInstance.initialize();
        await pcInstance.handleRedirectPromise();
        setMsalInstance(pcInstance);
      } catch (e) {
        console.error("Failed to initialize Microsoft Entra ID MSAL:", e);
      }
    };
    initMsal();
  }, []);
  
  // Authentication states
  const [user, setUser] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem('smartbank_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => {
    return sessionStorage.getItem('smartbank_token') || '';
  });

  // Self-healing: Discard stale sandbox mock tokens when production auth is active
  useEffect(() => {
    if (status && status.require_auth) {
      if (token && token.startsWith("MOCK_TOKEN_")) {
        console.warn("Discarding stale sandbox mock token in production mode.");
        setUser(null);
        setToken('');
        try {
          sessionStorage.removeItem('smartbank_user');
          sessionStorage.removeItem('smartbank_token');
        } catch {}
      }
    }
  }, [status, token]);
  
  const [selectedTxId, setSelectedTxId] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [alertToast, setAlertToast] = useState(null);

  // 1. Fetch system status (online AAD requirement check) on boot
  useEffect(() => {
    const fetchSystemStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/status`);
        const data = await res.json();
        setStatus(data);
      } catch (e) {
        console.warn("Backend server not reachable.", e);
      }
    };
    fetchSystemStatus();
  }, []);

  // 2. Fetch telemetry, transactions, and historical visual charts when logged in
  const fetchTelemetryAndFeeds = async () => {
    if (!token) return;
    
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [telemetryRes, txnRes, chartsRes] = await Promise.all([
        fetch(`${API_BASE}/telemetry`, { headers }),
        fetch(`${API_BASE}/transactions`, { headers }),
        fetch(`${API_BASE}/charts/historical`, { headers })
      ]);
      
      const telemetryData = await telemetryRes.json();
      const txnData = await txnRes.json();
      const chartsData = await chartsRes.json();

      // Defensive checking: If any API response is unauthorized or failed, logout user and show error
      if (!telemetryRes.ok || !txnRes.ok || !chartsRes.ok) {
        const errorDetail = (telemetryData && telemetryData.detail) || 
                            (txnData && txnData.detail) || 
                            (chartsData && chartsData.detail) || 
                            "API gateway request failed.";
        console.error("Dashboard Ingestion Error:", errorDetail);
        
        if (telemetryRes.status === 401 || txnRes.status === 401 || chartsRes.status === 401) {
          sessionStorage.setItem("smartbank_login_error", `Verification Failed: ${errorDetail}`);
          handleUserLogout();
        }
        return;
      }

      setMetrics(telemetryData);
      setTransactions(Array.isArray(txnData) ? txnData : []);
      setHistoricalCharts(chartsData);

      // Check for live fraud anomaly events
      if (Array.isArray(txnData) && txnData.length > 0 && Array.isArray(transactions) && transactions.length > 0) {
        const newTx = txnData[0];
        const isNew = !transactions.some(t => t.transaction_id === newTx.transaction_id);
        if (isNew && newTx.risk_score > 80) {
          triggerToastAlert(newTx);
        }
      }
    } catch (e) {
      console.warn("Failed to retrieve dashboard telemetry stream.", e);
    }
  };

  // 3. Short Polling loop (every 5 seconds)
  useEffect(() => {
    if (token) {
      fetchTelemetryAndFeeds();
      const interval = setInterval(fetchTelemetryAndFeeds, 5000);
      return () => clearInterval(interval);
    }
  }, [token, transactions]);

  const triggerToastAlert = (txn) => {
    setAlertToast(txn);
    setTimeout(() => {
      setAlertToast(null);
    }, 6000);
  };

  // 4. Inflow simulation triggers
  const handleSimulateInflow = async () => {
    if (isSimulating || !token) return;
    setIsSimulating(true);
    try {
      const res = await fetch(`${API_BASE}/simulate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        await fetchTelemetryAndFeeds();
        if (data.transaction.risk_score > 80) {
          triggerToastAlert(data.transaction);
        }
      }
    } catch (e) {
      console.error("Simulation failed", e);
    } finally {
      setIsSimulating(false);
    }
  };

  // 5. Copilot workspace query dispatcher
  const handleCopilotQuery = async (question) => {
    if (isQuerying || !token) return;
    setIsQuerying(true);
    try {
      const res = await fetch(`${API_BASE}/copilot`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ question })
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, data]);
    } catch (e) {
      console.error("Copilot query failed", e);
      setChatHistory(prev => [...prev, {
        question,
        query_type: 'ERROR',
        executed_query: 'API_ERROR_CONNECTION_REFUSED',
        markdown_response: '### 🔴 Connection Error\n\nUnable to connect to the cognitive backend server. Please verify that FastAPI is running on port 8000.'
      }]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleClearChatHistory = async () => {
    if (!token) return;
    try {
      await fetch(`${API_BASE}/chat/clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setChatHistory([]);
    } catch (e) {
      console.error("Failed to clear chat", e);
    }
  };

  const handleCaseSignOff = async (txId, checklist, signature) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/sign-off`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transaction_id: txId,
          checklist_state: checklist,
          signature: signature
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchTelemetryAndFeeds();
      }
    } catch (e) {
      console.error("Sign-off failed", e);
    }
  };

  const handleExportLedger = () => {
    if (!token) return;
    window.open(`${API_BASE}/export?token=${token}`, '_blank');
  };

  // User login handler
  const handleUserLogin = (authData) => {
    const userData = { email: authData.email, name: authData.name };
    setUser(userData);
    setToken(authData.token);
    try {
      sessionStorage.setItem('smartbank_user', JSON.stringify(userData));
      sessionStorage.setItem('smartbank_token', authData.token);
    } catch (e) {
      console.warn("Could not save session to sessionStorage:", e);
    }
  };

  // User logout handler
  const handleUserLogout = () => {
    setUser(null);
    setToken('');
    try {
      sessionStorage.removeItem('smartbank_user');
      sessionStorage.removeItem('smartbank_token');
      if (msalInstance) {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          msalInstance.logoutRedirect({
            postLogoutRedirectUri: window.location.origin,
          });
        }
      }
    } catch (e) {
      console.warn("Logout cleanup failed:", e);
    }
  };

  // If user is not logged in, render the Auth Drawer sign-in overlay
  if (!user || !token) {
    return (
      <AuthDrawer 
        onLogin={handleUserLogin}
        isLiveAuth={status?.require_auth}
        msalInstance={msalInstance}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      
      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        status={status} 
        onLogout={handleUserLogout}
      />

      {/* Primary Main Content Panel */}
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto space-y-6">
        
        {/* Active Tab Router */}
        {activeTab === 'dashboard' && (
          <DashboardHome
            metrics={metrics}
            transactions={transactions}
            historicalCharts={historicalCharts}
            onSimulate={handleSimulateInflow}
            isSimulating={isSimulating}
            setActiveTab={setActiveTab}
            setSelectedTxId={setSelectedTxId}
          />
        )}

        {activeTab === 'copilot' && (
          <CopilotRoom
            chatHistory={chatHistory}
            onQuery={handleCopilotQuery}
            onClearChat={handleClearChatHistory}
            isQuerying={isQuerying}
          />
        )}

        {activeTab === 'triage' && (
          <CaseTriage
            transactions={transactions}
            onSignOff={handleCaseSignOff}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerLogs
            transactions={transactions}
            onExport={handleExportLedger}
          />
        )}

      </main>

      {/* Floating global alert toast */}
      {alertToast && (
        <div 
          onClick={() => {
            setSelectedTxId(alertToast.transaction_id);
            setActiveTab('triage');
            setAlertToast(null);
          }}
          className="fixed bottom-6 right-6 p-4 rounded-xl bg-rose-50 border border-red-200 text-slate-800 shadow-[0_4px_25px_rgba(239,68,68,0.1)] flex gap-3 items-center cursor-pointer select-none max-w-sm z-50 float-slow border-l-4 border-l-rose-500 hover:scale-102 transition-transform duration-300"
        >
          <div className="p-2 bg-rose-100/50 rounded-lg">
            <ShieldAlert className="w-6 h-6 text-rose-500 animate-pulse" />
          </div>
          <div className="text-xs">
            <strong className="text-rose-600 font-bold uppercase tracking-wide font-space flex items-center gap-1.5">
              ⚠️ CRITICAL THREAT INGESTED
            </strong>
            <span className="block font-medium mt-1 leading-relaxed text-slate-600">
              Anomaly flagged for {alertToast.customer_name} (Rs. {alertToast.amount.toLocaleString('en-IN')}). Click to triage.
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
