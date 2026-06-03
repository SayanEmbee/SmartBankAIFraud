import React, { useState } from 'react';
import { Search, Download, CreditCard, Layers } from 'lucide-react';

export default function LedgerLogs({ transactions, onExport }) {
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('All Channels');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const channels = ['All Channels', ...new Set(transactions.map(t => t.payment_channel))];

  const filtered = transactions.filter(t => {
    const matchesSearch = 
      t.customer_name.toLowerCase().includes(search.toLowerCase()) || 
      t.transaction_id.toLowerCase().includes(search.toLowerCase());
    
    const matchesChannel = 
      channelFilter === 'All Channels' || 
      t.payment_channel === channelFilter;

    return matchesSearch && matchesChannel;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getRiskBadge = (score) => {
    if (score > 80) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 border border-rose-100 text-rose-600 font-bold font-space text-[10px] uppercase shadow-sm">
          🚨 Flagged ({score}%)
        </span>
      );
    }
    if (score > 50) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 border border-amber-100 text-amber-600 font-bold font-space text-[10px] uppercase shadow-sm">
          ⚠️ Elevated ({score}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold font-space text-[10px] uppercase shadow-sm">
        🟢 Safe ({score}%)
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-slate-100 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-space font-bold text-3xl text-slate-900 tracking-tight flex items-center gap-3">
            📋 Telemetry Logs & Ledger Audits
          </h2>
          <p className="text-sm text-slate-500 mt-1.5">
            Full transactional audits spanning active ingestions and Star Schema databases.
          </p>
        </div>

        <button
          onClick={onExport}
          className="flex items-center gap-2 p-3 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all font-medium text-xs text-slate-600 hover:text-slate-800 shadow-sm"
        >
          <Download className="w-4 h-4" /> Export Ledger to CSV
        </button>
      </div>

      {/* Search & Filter bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Search */}
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search by customer name or transaction ID..."
            className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-blue-500 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all shadow-sm"
          />
        </div>

        {/* Filter dropdown */}
        <div className="relative">
          <Layers className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <select
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-blue-500 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-800 outline-none focus:ring-0 appearance-none font-space cursor-pointer transition-all shadow-sm"
          >
            {channels.map((chan, i) => (
              <option key={i} value={chan} className="bg-white text-slate-700">{chan}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Ledger Table Panel */}
      <div className="glass-panel overflow-hidden border border-slate-200/80 shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase font-space tracking-wider">
                <th className="p-4 pl-6">Timestamp</th>
                <th className="p-4">Transaction ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Channel</th>
                <th className="p-4">IP Address</th>
                <th className="p-4 pr-6 text-center">Risk Evaluation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                    No transactions match current filters.
                  </td>
                </tr>
              ) : (
                currentItems.map((tx) => {
                  const localTime = new Date(tx.timestamp).toLocaleTimeString();
                  const localDate = new Date(tx.timestamp).toLocaleDateString();
                  return (
                    <tr 
                      key={tx.transaction_id}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="p-4 pl-6 text-slate-400 leading-tight">
                        <span className="block font-medium text-slate-550">{localDate}</span>
                        <span className="font-mono text-[10px] mt-0.5 block text-slate-400">{localTime}</span>
                      </td>
                      <td className="p-4 font-mono text-[11px] font-semibold text-slate-500">
                        {tx.transaction_id}
                      </td>
                      <td className="p-4 font-semibold text-slate-900 font-space">
                        {tx.customer_name}
                      </td>
                      <td className="p-4 font-bold text-slate-850 font-mono">
                        Rs. {parseFloat(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-slate-500 font-medium uppercase font-space">
                        {tx.payment_channel}
                      </td>
                      <td className="p-4 font-mono text-slate-450">
                        {tx.ip_address}
                      </td>
                      <td className="p-4 pr-6 text-center">
                        {getRiskBadge(tx.risk_score)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {filtered.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-450 font-medium font-space">
              Showing {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filtered.length)} of {filtered.length} logs
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1 px-3.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 hover:border-slate-350 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-all shadow-sm"
              >
                Previous
              </button>
              
              <span className="text-[11px] font-semibold text-slate-500 px-3 font-mono">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1 px-3.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 hover:border-slate-350 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-all shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
