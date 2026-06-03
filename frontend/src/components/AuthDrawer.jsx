import React, { useState } from 'react';
import { Shield, Lock, Eye, Mail, Server } from 'lucide-react';

export default function AuthDrawer({ onLogin, isLiveAuth, msalInstance }) {
  const [selectedMockEmail, setSelectedMockEmail] = useState('sayan@bankcorp.com');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState(() => {
    try {
      const savedErr = sessionStorage.getItem('smartbank_login_error');
      if (savedErr) {
        sessionStorage.removeItem('smartbank_login_error');
        return savedErr;
      }
    } catch {}
    return '';
  });

  const mockUsers = [
    { email: 'sayan@bankcorp.com', name: 'Sayan Banerjee', role: 'Lead SOC Auditor (Approved)' },
    { email: 'auditor@yourorganization.com', name: 'Entra Auditor', role: 'Staff Risk Manager (Approved)' },
    { email: 'hacker@unauthorized.com', name: 'Guest User', role: 'External Contractor (Restricted Domain)' }
  ];

  const handleMockLoginSubmit = (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setErrorMsg('');
    
    // Simulate API validation
    setTimeout(() => {
      const email = selectedMockEmail;
      const domain = email.split('@')[-1] || email.split('@')[1];
      
      const allowedDomains = ['bankcorp.com', 'yourorganization.com', 'gmail.com'];
      if (!allowedDomains.includes(domain)) {
        setErrorMsg(`Access Denied: Domain @${domain} is block-listed by organizational firewalls.`);
        setIsLoggingIn(false);
      } else {
        const name = mockUsers.find(u => u.email === email)?.name || 'Analyst';
        onLogin({
          email,
          name,
          token: `MOCK_TOKEN_${email}`,
          is_mock: true
        });
      }
    }, 800);
  };

  const handleLiveMicrosoftLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
      // Clear any previous stuck MSAL interaction states before attempting login
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.includes("interaction.status")) {
            sessionStorage.removeItem(key);
          }
        }
        sessionStorage.removeItem("msal.interaction.status");
      } catch (err) {
        console.warn("Could not reset MSAL locks:", err);
      }

      // Trigger standard Microsoft login popup
      const loginResponse = await msalInstance.loginPopup({
        scopes: ["User.Read"],
        prompt: "select_account"
      });
      
      onLogin({
        email: loginResponse.account.username,
        name: loginResponse.account.name || 'Microsoft Analyst',
        token: loginResponse.idToken,
        is_mock: false
      });
    } catch (e) {
      const errMsg = e.message || String(e);
      if (errMsg.includes("interaction_in_progress") || errMsg.includes("block_nested_popups")) {
        try {
          // Robust cleanup of all interaction status keys
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.includes("interaction.status")) {
              sessionStorage.setItem(key, "None");
            }
          }
          sessionStorage.setItem("msal.interaction.status", "None");
        } catch (err) {}
        setErrorMsg("The sign-in window was blocked or closed. Locks have been successfully reset. Please click 'Sign In' again.");
      } else {
        setErrorMsg(`Microsoft Authentication Failed: ${errMsg}`);
      }
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-8 shadow-[0_10px_50px_rgba(15,23,42,0.08)] space-y-8 relative overflow-hidden float-slow">
        
        {/* Glowing visual indicators */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-100/30 rounded-full filter blur-[60px] pointer-events-none -z-10" />

        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center shadow-sm">
            <Shield className="w-6 h-6 text-blue-600 animate-pulse" />
          </div>
          <div>
            <h2 className="font-space font-bold text-2xl text-slate-900 tracking-tight">SmartBank Secure SOC Portal</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest font-space mt-1">Enterprise Authentication</p>
          </div>
        </div>

        {/* System messages */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold leading-relaxed">
            ⚠️ {errorMsg}
          </div>
        )}

        {isLiveAuth ? (
          /* Production Mode Microsoft Authentication Button */
          <div className="space-y-4">
            <p className="text-xs text-slate-500 text-center leading-relaxed">
              This environment has active <strong>Microsoft Entra ID</strong> security policies. Sign in using your organizational email address.
            </p>
            <button
              onClick={handleLiveMicrosoftLogin}
              disabled={isLoggingIn || !msalInstance}
              className="w-full flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide uppercase transition-all duration-300 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-98 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>
                {!msalInstance 
                  ? 'Initializing Microsoft Auth...' 
                  : isLoggingIn 
                    ? 'Redirecting to Entra ID...' 
                    : 'Sign In with Microsoft Entra ID'}
              </span>
            </button>
          </div>
        ) : (
          /* Offline Simulated Testing Mode Form */
          <form onSubmit={handleMockLoginSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-xl flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                <Server className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <span>
                  <strong>Sandbox Mode Active:</strong> You can select a mock analyst profile to test the application's verification and restriction mechanics locally.
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-space block">
                  Select Analyst Profile
                </label>
                
                <div className="space-y-2">
                  {mockUsers.map((user) => (
                    <label 
                      key={user.email}
                      onClick={() => setSelectedMockEmail(user.email)}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all select-none ${
                        selectedMockEmail === user.email 
                          ? 'bg-blue-50/40 border-blue-200/80 shadow-sm' 
                          : 'bg-white border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mock_analyst"
                        checked={selectedMockEmail === user.email}
                        readOnly
                        className="w-4 h-4 mt-0.5 text-blue-600 border-slate-300 focus:ring-0 bg-white"
                      />
                      <div className="text-xs leading-tight">
                        <span className="font-semibold text-slate-800 block">{user.name}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">{user.email}</span>
                        <span className="text-[9px] font-medium text-slate-500 mt-1 block uppercase font-space tracking-wide">
                          {user.role}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide uppercase transition-all duration-300 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-98 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoggingIn ? 'Signing in...' : 'Sign In to Security SOC'}</span>
            </button>
          </form>
        )}

        <div className="text-[10px] text-center text-slate-400 font-medium uppercase font-space tracking-widest pt-2">
          🛡️ Secure Gateway Protocol
        </div>

      </div>
    </div>
  );
}
