import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Trash2, 
  Sparkles, 
  Code, 
  ChevronDown, 
  ChevronUp, 
  BarChart2, 
  BrainCircuit, 
  TrendingUp
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  LineChart,
  Line,
  Cell
} from 'recharts';

export default function CopilotRoom({ chatHistory, onQuery, onClearChat, isQuerying }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const starters = [
    "Show me a high-level overview of our transaction ingestion telemetry.",
    "What are the detailed fraud statistics and vulnerability rates by payment channel?",
    "Identify all cross-border transactions originating outside of India with a risk score above 80%.",
    "Detect suspicious midnight transactions occurring via Internet Banking with high risk."
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isQuerying]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isQuerying) return;
    onQuery(input);
    setInput('');
  };

  const parseMarkdownToReact = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    let inTable = false;
    let inList = false;
    let tableHeaders = [];
    let tableRows = [];

    const reactElements = [];
    
    lines.forEach((line, lineIdx) => {
      const trimmed = line.strip ? line.strip() : line.trim();
      
      const formatInline = (str) => {
        let formatted = str;
        const boldRegex = /\*\*(.*?)\*\*/g;
        const parts = [];
        let lastIndex = 0;
        let match;
        
        while ((match = boldRegex.exec(str)) !== null) {
          if (match.index > lastIndex) {
            parts.push(str.substring(lastIndex, match.index));
          }
          parts.push(<strong key={match.index} className="text-slate-900 font-bold">{match[1]}</strong>);
          lastIndex = boldRegex.lastIndex;
        }
        if (lastIndex < str.length) {
          parts.push(str.substring(lastIndex));
        }
        return parts.length > 0 ? parts : str;
      };

      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        if (inList) {
          reactElements.push(<ul key={`list-end-${lineIdx}`} className="list-disc list-inside text-slate-500 space-y-1 mb-4" />);
          inList = false;
        }
        const cells = trimmed.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
        
        if (cells.every(c => c.includes('-'))) {
          return;
        }
        
        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        return;
      } else if (inTable) {
        reactElements.push(
          <div key={`table-wrapper-${lineIdx}`} className="overflow-x-auto my-4 border border-slate-200 rounded-xl bg-slate-50/50">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-250 font-semibold text-slate-700">
                  {tableHeaders.map((h, i) => (
                    <th key={`th-${i}`} className="p-3 font-medium uppercase font-space tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 text-slate-600">
                {tableRows.map((r, ri) => (
                  <tr key={`tr-${ri}`} className="hover:bg-slate-100/30">
                    {r.map((cell, ci) => (
                      <td key={`td-${ci}`} className="p-3 font-mono">{formatInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }

      if (trimmed.startsWith('#### ')) {
        reactElements.push(<h5 key={`h5-${lineIdx}`} className="text-sm font-bold font-space text-slate-900 mt-4 mb-2">{trimmed.slice(5)}</h5>);
      } else if (trimmed.startsWith('### ')) {
        reactElements.push(<h4 key={`h4-${lineIdx}`} className="text-base font-bold font-space text-slate-800 mt-5 mb-2.5 border-b border-slate-100 pb-1.5">{trimmed.slice(4)}</h4>);
      } else if (trimmed.startsWith('## ')) {
        reactElements.push(<h3 key={`h3-${lineIdx}`} className="text-lg font-bold font-space text-slate-800 mt-6 mb-3">{trimmed.slice(3)}</h3>);
      }
      
      else if (trimmed.startsWith('- ')) {
        if (!inList) {
          inList = true;
        }
        reactElements.push(
          <div key={`li-${lineIdx}`} className="flex items-start gap-2 text-xs text-slate-650 ml-4 mb-1">
            <span className="text-blue-600 font-bold mt-0.5">•</span>
            <span className="flex-1 leading-relaxed">{formatInline(trimmed.slice(2))}</span>
          </div>
        );
      } 
      
      else if (trimmed) {
        if (inList) inList = false;
        reactElements.push(<p key={`p-${lineIdx}`} className="text-xs text-slate-605 leading-relaxed my-2">{formatInline(trimmed)}</p>);
      } else {
        if (inList) inList = false;
        reactElements.push(<div key={`br-${lineIdx}`} className="h-2" />);
      }
    });

    return reactElements;
  };

  const RenderEmbeddedChart = ({ df, question }) => {
    if (!df || df.length === 0) return null;
    
    const columns = Object.keys(df[0]);
    const isChannelStats = columns.includes('payment_channel');
    const isTemporalStats = columns.includes('timestamp') || columns.includes('Hour') || columns.includes('timestampStr');
    
    if (isChannelStats) {
      const dataKey = columns.includes('FraudPercentage') ? 'FraudPercentage' : columns.includes('TotalTransactions') ? 'TotalTransactions' : 'amount';
      return (
        <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl mt-4 space-y-3 shadow-inner">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5 font-space">
            <BarChart2 className="w-3.5 h-3.5 text-blue-600" /> Channel Threat Exposure Distribution
          </span>
          <div className="w-full h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={df} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="payment_channel" stroke="#94a3b8" style={{ fontSize: '10px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '10px' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '10px', fontSize: '11px', color: '#1e293b' }}
                  labelClassName="text-slate-800 font-bold"
                />
                <Bar dataKey={dataKey} fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {df.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.risk_score > 70 || entry.FraudPercentage > 10 ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (isTemporalStats) {
      const sortedDf = [...df].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const dataKey = columns.includes('risk_score') ? 'risk_score' : 'amount';
      return (
        <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl mt-4 space-y-3 shadow-inner">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5 font-space">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Temporal Threat Vector Timeline
          </span>
          <div className="w-full h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sortedDf} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="timestamp" 
                  stroke="#94a3b8" 
                  style={{ fontSize: '9px', fontFamily: 'monospace' }} 
                  tickFormatter={(t) => new Date(t).toLocaleTimeString()}
                />
                <YAxis stroke="#94a3b8" style={{ fontSize: '10px' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '10px', fontSize: '11px', color: '#1e293b' }}
                  labelClassName="text-slate-800 font-bold"
                />
                <Line type="monotone" dataKey={dataKey} stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return null;
  };

  const CodeInspector = ({ query, type }) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden mt-3 shadow-sm">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 transition-colors text-[10px] font-semibold tracking-wider text-slate-500 font-space uppercase"
        >
          <span className="flex items-center gap-1.5">
            <Code className="w-4 h-4 text-blue-600" /> {type} Query execution logs
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {open && (
          <div className="bg-slate-50 border-t border-slate-200 p-4 overflow-x-auto">
            <pre className="text-[11px] font-mono text-blue-700 whitespace-pre-wrap">{query}</pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="glass-panel p-6 flex flex-col h-[calc(100vh-8rem)] justify-between relative overflow-hidden shadow-sm">
      
      {/* Background glowing effects */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-100/10 rounded-full filter blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-100/10 rounded-full filter blur-[100px] pointer-events-none -z-10" />

      {/* Header bar */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-blue-600 float-slow" />
          <div>
            <h3 className="font-space font-bold text-slate-800 text-base leading-none">SmartBank Fraud AI Copilot</h3>
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-space mt-1 block">COG-INTELLIGENCE</span>
          </div>
        </div>
        
        <button
          onClick={onClearChat}
          className="flex items-center gap-1.5 p-2 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-100 text-slate-500 hover:text-rose-600 transition-all text-xs font-semibold"
        >
          <Trash2 className="w-4 h-4" /> Clear History
        </button>
      </div>

      {/* Chat Messages scroll area */}
      <div className="flex-1 my-6 overflow-y-auto space-y-6 pr-2">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto py-12 leading-relaxed">
            <Sparkles className="w-12 h-12 text-blue-600 mb-4 animate-pulse" />
            <h4 className="font-space font-bold text-lg text-slate-850 mb-2">Welcome to SmartBank AI Copilot</h4>
            <p className="text-xs text-slate-500">
              Your advanced telemetry copilot designed to help audit transactions, map network threat profiles, and resolve high-risk cases using Microsoft Fabric datasets.
            </p>
            
            <div className="w-full border-t border-slate-100 my-6" />
            
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3 self-start font-space">
              📚 Quick Telemetry Audit Prompts
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
              {starters.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onQuery(prompt)}
                  className="p-3 text-left bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 rounded-xl text-xs text-slate-700 transition-all hover:-translate-y-0.5 shadow-sm"
                >
                  💡 {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {chatHistory.map((chat, idx) => (
              <div key={idx} className="space-y-4">
                
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="max-w-[75%] p-4 bg-blue-600 border border-blue-500 text-white rounded-2xl rounded-tr-sm shadow-md shadow-blue-500/5 text-xs leading-relaxed">
                    <span className="text-[10px] uppercase font-bold text-blue-200 block tracking-wider font-space mb-1">
                      Investigator
                    </span>
                    {chat.question}
                  </div>
                </div>

                {/* Copilot Message */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] w-full p-6 bg-white border border-slate-200/80 rounded-2xl rounded-tl-sm shadow-md shadow-slate-100/50 leading-relaxed text-xs">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider font-space mb-2">
                      🛡️ AI Security Copilot
                    </span>
                    
                    <div className="space-y-1 text-slate-650">
                      {parseMarkdownToReact(chat.answer || chat.markdown_response)}
                    </div>

                    {chat.dataframe && (
                      <RenderEmbeddedChart df={chat.dataframe} question={chat.question} />
                    )}

                    {chat.executed_query && (
                      <CodeInspector query={chat.executed_query} type={chat.query_type} />
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* Loading Spinner */}
        {isQuerying && (
          <div className="flex justify-start">
            <div className="max-w-[40%] p-4 bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-md flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold text-slate-500 font-space animate-pulse">Running cognitive telemetry...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input controls form */}
      <form onSubmit={handleSubmit} className="flex gap-3 border-t border-slate-100 pt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Query AI Copilot for threat indexes, transactions, or user audits..."
          disabled={isQuerying}
          className="flex-1 bg-white border border-slate-200/80 hover:border-slate-350 focus:border-blue-500 rounded-xl px-4 py-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all shadow-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || isQuerying}
          className="p-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all duration-300 disabled:opacity-40 disabled:hover:bg-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
}
