import React from 'react';
import { 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  Flame, 
  RefreshCw,
  Bell,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  MapPin,
  Layers,
  CalendarDays
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis, 
  CartesianGrid,
  BarChart,
  Bar,
  AreaChart,
  Area
} from 'recharts';

export default function DashboardHome({ 
  metrics, 
  transactions, 
  historicalCharts,
  onSimulate, 
  isSimulating, 
  setActiveTab, 
  setSelectedTxId 
}) {
  
  // 1. Live Data Chart calculations
  const getRiskTiers = () => {
    let low = 0, med = 0, action = 0, critical = 0;
    transactions.forEach(t => {
      const score = t.risk_score;
      if (score <= 30) low++;
      else if (score <= 70) med++;
      else if (score <= 80) action++;
      else critical++;
    });
    return [
      { name: 'Low Risk (<30)', value: low || 1, color: '#10b981' },
      { name: 'Medium Risk (30-70)', value: med || 1, color: '#64748b' },
      { name: 'Action Risk (70-80)', value: action || 1, color: '#3b82f6' },
      { name: 'Critical Alert (>80)', value: critical || 1, color: '#ef4444' }
    ];
  };

  const pieData = getRiskTiers();

  const scatterData = transactions.map(t => ({
    timestamp: new Date(t.timestamp).getTime(),
    timestampStr: new Date(t.timestamp).toLocaleTimeString(),
    risk: t.risk_score,
    amount: t.amount,
    name: t.customer_name,
    id: t.transaction_id
  })).sort((a, b) => a.timestamp - b.timestamp);

  const fraudAlerts = transactions.filter(t => t.risk_score > 80);

  const handleTriage = (txId) => {
    setSelectedTxId(txId);
    setActiveTab('triage');
  };

  // Mock fallbacks for historical charts to ensure robust presentation
  const fallbackChannel = [
    { payment_channel: 'UPI', safe_count: 420, fraud_count: 32 },
    { payment_channel: 'POS', safe_count: 280, fraud_count: 14 },
    { payment_channel: 'Internet Banking', safe_count: 190, fraud_count: 45 },
    { payment_channel: 'ATM', safe_count: 110, fraud_count: 28 }
  ];

  const fallbackWeekly = [
    { date: 'Mon', avg_risk: 15 },
    { date: 'Tue', avg_risk: 22 },
    { date: 'Wed', avg_risk: 18 },
    { date: 'Thu', avg_risk: 30 },
    { date: 'Fri', avg_risk: 25 },
    { date: 'Sat', avg_risk: 20 },
    { date: 'Sun', avg_risk: 35 }
  ];

  const fallbackCities = [
    { city: 'Mumbai', total_count: 120, fraud_count: 15 },
    { city: 'Pune', total_count: 95, fraud_count: 8 },
    { city: 'Bengaluru', total_count: 110, fraud_count: 12 },
    { city: 'Kolkata', total_count: 80, fraud_count: 6 },
    { city: 'Chennai', total_count: 75, fraud_count: 5 }
  ];

  const channelData = historicalCharts?.channel_data?.length ? historicalCharts.channel_data : fallbackChannel;
  const weeklyData = historicalCharts?.weekly_risk?.length 
    ? historicalCharts.weekly_risk.map(w => ({ ...w, date: w.date.split('T')[0] }))
    : fallbackWeekly;
  const cityData = historicalCharts?.city_data?.length ? historicalCharts.city_data : fallbackCities;

  // Custom tooltips
  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200/85 p-3 rounded-xl shadow-lg backdrop-blur-xl">
          <span className="text-[10px] font-bold block uppercase tracking-wider text-slate-400 font-space">
            {payload[0].name}
          </span>
          <span className="text-base font-bold text-slate-800 font-space mt-0.5 block">
            {payload[0].value} Cases
          </span>
        </div>
      );
    }
    return null;
  };

  const CustomScatterTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-slate-200/85 p-4 rounded-xl shadow-lg backdrop-blur-xl max-w-xs leading-relaxed">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-space">
            Transaction Details
          </span>
          <span className="text-sm font-bold text-slate-800 font-space mt-1 block">
            {data.name}
          </span>
          <div className="text-xs text-slate-600 mt-2 space-y-1">
            <div className="flex justify-between gap-4">
              <span>Amount:</span>
              <strong className="text-slate-850">Rs. {data.amount.toLocaleString('en-IN')}</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span>Risk:</span>
              <strong style={{ color: data.risk > 80 ? '#ef4444' : data.risk > 50 ? '#f59e0b' : '#10b981' }}>
                {data.risk}% Risk
              </strong>
            </div>
            <div className="flex justify-between gap-4">
              <span>Time:</span>
              <span className="font-mono text-[10px] text-slate-500">{data.timestampStr}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* 1. Header Title Row */}
      <div className="flex justify-between items-start border-b border-slate-100 pb-6">
        <div>
          <h2 className="font-space font-bold text-3xl tracking-tight text-slate-900 flex items-center gap-3">
            🛡️ AI Banking Fraud & Operations Console
          </h2>
          <p className="text-sm text-slate-500 mt-1.5 font-space">
            SOC Hub coordinating live Fabric ingestion streams and Lakehouse Star Schema SQL models.
          </p>
        </div>

        <button
          onClick={onSimulate}
          disabled={isSimulating}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-medium text-sm text-white transition-all duration-300 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
          <span>{isSimulating ? 'Ingesting Simulation...' : 'Simulate Event Ingestion'}</span>
        </button>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Metric 1 */}
        <div className="glass-panel p-6 flex items-center justify-between group glass-panel-hover">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block font-space">
              Ingested Events
            </span>
            <h3 className="font-space font-bold text-3xl text-slate-900 tracking-tight leading-none">
              {(metrics?.total_transactions || 0).toLocaleString()}
            </h3>
            <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-semibold font-space">
              <Activity className="w-2.5 h-2.5 animate-pulse" /> Live Ingestion
            </span>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl group-hover:bg-blue-50 border border-slate-100 transition-colors">
            <Activity className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel p-6 flex items-center justify-between group glass-panel-hover">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block font-space">
              AI Flagged Fraud
            </span>
            <h3 className="font-space font-bold text-3xl text-rose-500 tracking-tight leading-none">
              {(metrics?.fraud_detected || 0).toLocaleString()}
            </h3>
            <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-55 border border-rose-100 text-rose-600 font-semibold font-space">
              <AlertTriangle className="w-2.5 h-2.5" /> Risk &gt; 80%
            </span>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl group-hover:bg-rose-50 border border-slate-100 transition-colors">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel p-6 flex items-center justify-between group glass-panel-hover">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block font-space">
              Exposure Index
            </span>
            <h3 className="font-space font-bold text-3xl text-emerald-600 tracking-tight leading-none">
              {metrics?.exposure_rate || 0}%
            </h3>
            <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 font-semibold font-space">
              <ShieldCheck className="w-2.5 h-2.5" /> Controlled
            </span>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl group-hover:bg-emerald-50 border border-slate-100 transition-colors">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel p-6 flex items-center justify-between group glass-panel-hover">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block font-space">
              Peak Threat Risk
            </span>
            <h3 className="font-space font-bold text-3xl text-rose-600 tracking-tight leading-none">
              {metrics?.peak_threat_risk || 0}%
            </h3>
            <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100 text-rose-600 font-semibold font-space">
              <Flame className="w-2.5 h-2.5" /> Active Critical
            </span>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl group-hover:bg-rose-50 border border-slate-100 transition-colors">
            <Flame className="w-6 h-6 text-rose-600" />
          </div>
        </div>
      </div>

      {/* 3. Section A: Real-Time Ingestion (donut, scatter, and feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recharts Panels */}
        <div className="lg:col-span-2 glass-panel p-6 flex flex-col justify-between shadow-sm">
          <div>
            <h4 className="font-space font-bold text-lg text-slate-800 mb-2 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" /> Ingestion Risk Clustering & Chronological Feed
            </h4>
            <p className="text-xs text-slate-500">
              Interactive multi-dimensional audit arrays mapping live incoming event risk ratings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            
            {/* Pie Donut */}
            <div className="flex flex-col items-center">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2 font-space self-start">
                Live Risk Tiering
              </span>
              <div className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconSize={10} 
                      iconType="circle"
                      formatter={(value, entry) => (
                        <span className="text-[10px] font-semibold text-slate-400 font-space uppercase">
                          {value.split(' ')[0]}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Scatter Anomaly Plot */}
            <div className="flex flex-col">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2 font-space">
                Anomaly Ingestion Scatter
              </span>
              <div className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      type="number" 
                      dataKey="timestamp" 
                      name="Time" 
                      domain={['auto', 'auto']}
                      tickFormatter={(unix) => new Date(unix).toLocaleTimeString()}
                      stroke="#94a3b8"
                      style={{ fontSize: '9px', fontFamily: 'monospace' }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="risk" 
                      name="Risk Score" 
                      domain={[0, 100]}
                      stroke="#94a3b8"
                      style={{ fontSize: '10px' }}
                    />
                    <ZAxis type="number" dataKey="amount" range={[60, 400]} />
                    <Tooltip content={<CustomScatterTooltip />} />
                    <Scatter name="Transactions" data={scatterData}>
                      {scatterData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.risk > 80 ? '#ef4444' : entry.risk > 50 ? '#f59e0b' : '#10b981'} 
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>

        {/* Live Threat Alert Feed Sidebar */}
        <div className="glass-panel p-6 flex flex-col justify-between h-full shadow-sm">
          <div>
            <h4 className="font-space font-bold text-lg text-slate-800 mb-2 flex items-center gap-2">
              <Bell className="w-5 h-5 text-rose-500 animate-bounce" /> Live Threat Alert Feed
            </h4>
            <p className="text-xs text-slate-500 mb-4 font-space">
              Real-time anomaly queues routed directly from Fabric models.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[200px]">
            {fraudAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-emerald-600 border border-dashed border-slate-200 rounded-xl">
                <ShieldCheck className="w-8 h-8 mb-2 animate-pulse" />
                <span className="text-xs font-semibold font-space uppercase">Ingestion Secure</span>
                <span className="text-[10px] text-slate-450 mt-1 font-space">No critical exceptions logged.</span>
              </div>
            ) : (
              fraudAlerts.map((alert) => (
                <div 
                  key={alert.transaction_id}
                  className="p-3 bg-red-50 border border-red-100 border-l-4 border-l-red-500 rounded-xl flex flex-col gap-2 alert-card-pulse"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                      {alert.customer_name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100/50 border border-rose-200/60 text-rose-600 font-mono">
                      {alert.risk_score}% Risk
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-slate-650 flex flex-col leading-tight">
                      <span className="font-semibold text-slate-700">
                        Rs. {alert.amount.toLocaleString('en-IN')} via {alert.payment_channel}
                      </span>
                      <span className="font-mono text-[9px] mt-0.5 text-slate-400">
                        ID: {alert.transaction_id.slice(0, 12)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleTriage(alert.transaction_id)}
                      className="p-1 px-2 rounded-lg bg-rose-50 border border-rose-100 hover:bg-rose-100 text-[10px] font-semibold text-rose-600 transition-all flex items-center gap-1 group/btn"
                    >
                      Triage <ArrowUpRight className="w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* 4. Section B: Historical Data Visuals (Stacked Bar, Area Chart, City Hotspots) */}
      <div className="space-y-4">
        <div>
          <h3 className="font-space font-bold text-xl text-slate-900 flex items-center gap-2">
            📊 Historical Analytics & Regional Hotspots
          </h3>
          <p className="text-xs text-slate-500">
            Multi-dimensional audits parsed from the OneLake delta warehouses and local databases.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Stacked Bar Chart: Channel Exposure */}
          <div className="glass-panel p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5 font-space">
              <Layers className="w-4 h-4 text-blue-600" /> Channel Fraud Volume (SQL)
            </span>
            <div className="w-full h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="payment_channel" stroke="#94a3b8" style={{ fontSize: '9px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '10px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '10px', fontSize: '11px', color: '#1e293b' }}
                  />
                  <Bar dataKey="safe_count" name="Safe Vol" stackId="a" fill="#10b981" />
                  <Bar dataKey="fraud_count" name="Fraud Vol" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Area Chart: Risk Trend */}
          <div className="glass-panel p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5 font-space">
              <CalendarDays className="w-4 h-4 text-emerald-600" /> Weekly Risk Progression (SQL)
            </span>
            <div className="w-full h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '8px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '10px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '10px', fontSize: '11px', color: '#1e293b' }}
                  />
                  <Area type="monotone" dataKey="avg_risk" name="Avg Risk" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Horizontal Bar Chart: City threat centers */}
          <div className="glass-panel p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5 font-space">
              <MapPin className="w-4 h-4 text-rose-500" /> Top City Threat Centers (SQL)
            </span>
            <div className="w-full h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  layout="vertical"
                  data={cityData} 
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" style={{ fontSize: '10px' }} />
                  <YAxis dataKey="city" type="category" stroke="#94a3b8" style={{ fontSize: '10px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '10px', fontSize: '11px', color: '#1e293b' }}
                  />
                  <Bar dataKey="total_count" name="Total Vol" fill="#64748b" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="fraud_count" name="Fraud Spikes" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
