import React, { useState, useEffect } from 'react';
import { 
  FileCheck, 
  User, 
  MapPin, 
  Smartphone, 
  Globe, 
  ShieldAlert, 
  Lock, 
  AlertTriangle,
  UserCheck
} from 'lucide-react';

export default function CaseTriage({ transactions, onSignOff }) {
  const cases = transactions.filter(t => t.risk_score > 80);
  const [selectedTxId, setSelectedTxId] = useState('');
  
  const [rmCall, setRmCall] = useState(false);
  const [geoVerify, setGeoVerify] = useState(false);
  const [historyCheck, setHistoryCheck] = useState(false);
  const [freezeCard, setFreezeCard] = useState(false);
  const [submitStr, setSubmitStr] = useState(false);
  
  const [signature, setSignature] = useState('');
  const [signOffStatus, setSignOffStatus] = useState('');

  const currentCase = cases.find(c => c.transaction_id === selectedTxId) || cases[0];

  useEffect(() => {
    if (cases.length > 0 && !selectedTxId) {
      setSelectedTxId(cases[0].transaction_id);
    }
  }, [cases, selectedTxId]);

  useEffect(() => {
    setRmCall(false);
    setGeoVerify(false);
    setHistoryCheck(false);
    setFreezeCard(false);
    setSubmitStr(false);
    setSignature('');
    setSignOffStatus('');
  }, [selectedTxId]);

  if (cases.length === 0) {
    return (
      <div className="glass-panel p-8 text-center max-w-lg mx-auto flex flex-col items-center justify-center min-h-[300px] shadow-sm">
        <FileCheck className="w-12 h-12 text-emerald-600 mb-4 animate-pulse" />
        <h4 className="font-space font-bold text-slate-800 text-lg">Case Registry Secure</h4>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          No transactions currently exceed the 80% critical risk threshold. All ingestion vectors are operating within safe bounds.
        </p>
      </div>
    );
  }

  const handleSignOffSubmit = (e) => {
    e.preventDefault();
    if (!signature.trim()) return;

    const checklistState = {
      confirm_identity_call: rmCall,
      verify_geo_ip: geoVerify,
      review_history: historyCheck,
      channel_lock: freezeCard,
      submit_str: submitStr
    };

    onSignOff(currentCase.transaction_id, checklistState, signature);
    setSignOffStatus('LOCK_COMPLETE');
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-100 pb-6">
        <h2 className="font-space font-bold text-3xl text-slate-900 tracking-tight flex items-center gap-3">
          🔍 Live Case Triage & Verification
        </h2>
        <p className="text-sm text-slate-500 mt-1.5">
          Step-up analyst checklist and regulatory audit logs for active high-risk incidents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 space-y-4 shadow-sm">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest font-space block">
              Select Active Threat File
            </label>
            <select
              value={selectedTxId}
              onChange={(e) => setSelectedTxId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-space outline-none focus:border-blue-500 transition-colors shadow-sm cursor-pointer"
            >
              {cases.map(c => (
                <option key={c.transaction_id} value={c.transaction_id}>
                  {c.customer_name} ({c.transaction_id.slice(0, 10)}...) - {c.risk_score}% Risk
                </option>
              ))}
            </select>

            {/* Selected Metadata Display */}
            {currentCase && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div className="space-y-4 text-xs">
                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider font-space">Customer Target</span>
                      <strong className="text-sm text-slate-850 font-bold">{currentCase.customer_name}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <CreditCardIcon className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider font-space">Total Amount Spiked</span>
                      <strong className="text-sm text-slate-850 font-bold">Rs. {currentCase.amount.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider font-space">Origin Geolocation</span>
                      <strong className="text-sm text-slate-850 font-bold">{currentCase.city || 'Unknown'}, {currentCase.country}</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider font-space">IP Gateway Subnet</span>
                      <strong className="text-sm text-slate-850 font-mono">{currentCase.ip_address}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider font-space">Client Hardware Type</span>
                      <strong className="text-sm text-slate-850 font-bold">{currentCase.device_type}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider font-space">Payment Gateway</span>
                      <strong className="text-sm text-slate-850 uppercase font-bold">{currentCase.payment_channel} ({currentCase.transaction_type})</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Compliance & RBI Section */}
          {currentCase && (
            <div className="glass-panel p-6 bg-rose-50/50 border border-red-100/80 shadow-sm">
              <h4 className="font-space font-bold text-base text-rose-600 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> RBI Compliance and Regulatory Guideline Impact
              </h4>
              <p className="text-xs text-slate-650 leading-relaxed">
                Under <strong>RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18</strong>, customer liability is limited to zero for third-party breaches if reported within 3 working days. The presence of risk parameters here necessitates immediate preventive card/channel freezing to mitigate banking financial and compliance exposure.
              </p>
            </div>
          )}
        </div>

        {/* Right Column */}
        {currentCase && (
          <div className="glass-panel p-6 flex flex-col justify-between h-full space-y-6 shadow-sm">
            <div className="space-y-4">
              <h4 className="font-space font-bold text-base text-slate-850 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" /> SOC Analyst Checklist
              </h4>
              <p className="text-xs text-slate-500">
                Complete all active verifications before executing a signature lock.
              </p>

              <div className="space-y-3 pt-3">
                {/* Checkbox 1 */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-350 cursor-pointer select-none transition-all">
                  <input
                    type="checkbox"
                    checked={rmCall}
                    onChange={(e) => setRmCall(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-0 bg-white"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Identity RM Call Check</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Initiated verbal RM validation loop.</span>
                  </div>
                </label>

                {/* Checkbox 2 */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-350 cursor-pointer select-none transition-all">
                  <input
                    type="checkbox"
                    checked={geoVerify}
                    onChange={(e) => setGeoVerify(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-0 bg-white"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">IP & Geolocation Match</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Confirm ISP credentials match routing parameters.</span>
                  </div>
                </label>

                {/* Checkbox 3 */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-350 cursor-pointer select-none transition-all">
                  <input
                    type="checkbox"
                    checked={historyCheck}
                    onChange={(e) => setHistoryCheck(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-0 bg-white"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Review Historical Telemetry</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Audit 6-month consumer profiling models.</span>
                  </div>
                </label>

                {/* Checkbox 4 */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-350 cursor-pointer select-none transition-all">
                  <input
                    type="checkbox"
                    checked={freezeCard}
                    onChange={(e) => setFreezeCard(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-0 bg-white"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">UPI / Card Gateway Freeze</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Place temporary lock on payment channels.</span>
                  </div>
                </label>

                {/* Checkbox 5 */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-350 cursor-pointer select-none transition-all">
                  <input
                    type="checkbox"
                    checked={submitStr}
                    onChange={(e) => setSubmitStr(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-0 bg-white"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Submit STR Filing</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Log STR document inside compliance registry.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Signature form */}
            <form onSubmit={handleSignOffSubmit} className="space-y-4 pt-4 border-t border-slate-100">
              {signOffStatus === 'LOCK_COMPLETE' ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-center font-medium text-xs flex items-center justify-center gap-2 shadow-sm">
                  <UserCheck className="w-5 h-5 animate-bounce" /> Signature Lock Registered
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-space block">
                    Digital Analyst Signature
                  </label>
                  <input
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Enter analyst name..."
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors shadow-sm"
                  />
                  <button
                    type="submit"
                    disabled={!signature.trim() || !freezeCard}
                    className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-wide uppercase transition-all duration-300 disabled:opacity-40 disabled:hover:bg-blue-600 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 animate-pulse"
                  >
                    <Lock className="w-4 h-4" /> Execute Complete Sign-off
                  </button>
                  {!freezeCard && (
                    <span className="text-[9px] text-rose-500 block text-center mt-1 font-space font-medium">
                      *UPI/Card freeze checkbox is mandatory for sign-off.
                    </span>
                  )}
                </div>
              )}
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

function CreditCardIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
