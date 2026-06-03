import React from 'react';
import { 
  Shield, 
  LayoutDashboard, 
  Cpu, 
  AlertOctagon, 
  FileText, 
  Database,
  LogOut
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, status, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'copilot', label: 'AI Copilot', icon: Cpu },
    { id: 'triage', label: 'Case Triage', icon: AlertOctagon },
    { id: 'ledger', label: 'Audit Ledger', icon: FileText },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col h-screen sticky top-0 shrink-0 z-20 shadow-[1px_0_10px_rgba(15,23,42,0.015)]">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg shadow-[0_1px_3px_rgba(59,130,246,0.08)]">
          <Shield className="w-6 h-6 text-blue-600 float-slow" />
        </div>
        <div>
          <h1 className="font-space font-bold text-lg leading-none tracking-wide text-slate-900">SmartBank</h1>
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-widest font-space">SOC CONSOLE</span>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-300 group ${
                isActive 
                  ? 'bg-blue-50/70 border border-blue-100/50 text-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.03)]' 
                  : 'text-slate-500 border border-transparent hover:text-slate-950 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-105 ${
                isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
              }`} />
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
              )}
            </button>
          );
        })}
        
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 mt-2 rounded-xl text-sm font-medium transition-all duration-300 text-rose-500 hover:bg-rose-50/50 hover:text-rose-600 border border-transparent group"
        >
          <LogOut className="w-5 h-5 text-rose-400 group-hover:text-rose-500 transition-colors" />
          <span>Sign Out</span>
        </button>
      </nav>

      {/* Integration Status footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/30">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-400" />
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase font-space">Gateway Mode</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shadow-[0_0_6px] ${
              status?.is_live 
                ? 'bg-emerald-500 shadow-emerald-500/50' 
                : status?.kql_db === 'LocalSQLiteModel' 
                  ? 'bg-amber-500 shadow-amber-500/50' 
                  : 'bg-rose-500 shadow-rose-500/50'
            }`} />
            <span className="text-xs font-semibold text-slate-800 truncate" title={status?.details}>
              {status?.is_live ? 'Fabric Live Stream' : 'Simulation Mode'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono truncate select-all block px-1.5 py-1 bg-white border border-slate-200 rounded">
            {status?.is_live ? 'Connected (Fabric)' : 'Local SQLite Schema'}
          </span>
        </div>
      </div>
    </aside>
  );
}
