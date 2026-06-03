import React, { useState, useEffect } from 'react';
import { FileText, ClipboardList, Eye, Download, Trash2, Calendar, FileCode, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

export default function History() {
  const [activeTab, setActiveTab] = useState('clauses'); // clauses, reports
  const [clausesList, setClausesList] = useState([]);
  const [reportsList, setReportsList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal viewer state
  const [selectedItem, setSelectedItem] = useState(null); // { type: 'clause'|'report', data: obj }
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchHistoryData();
  }, [activeTab]);

  const fetchHistoryData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'clauses') {
        const res = await fetch('http://localhost:8000/api/clauses');
        if (res.ok) {
          const data = await res.json();
          setClausesList(data);
        }
      } else {
        const res = await fetch('http://localhost:8000/api/reports');
        if (res.ok) {
          const data = await res.json();
          setReportsList(data);
        }
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) {
      return;
    }

    try {
      const endpoint = activeTab === 'clauses' ? `/api/clauses/${filename}` : `/api/reports/${filename}`;
      const res = await fetch(`http://localhost:8000${endpoint}`, { method: 'DELETE' });
      if (res.ok) {
        fetchHistoryData();
        if (selectedItem && selectedItem.filename === filename) {
          setSelectedItem(null);
        }
      } else {
        alert('Failed to delete file.');
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  };

  const handleViewDetails = async (filename) => {
    setModalLoading(true);
    try {
      const endpoint = activeTab === 'clauses' ? `/api/clauses/${filename}` : `/api/reports/${filename}`;
      const res = await fetch(`http://localhost:8000${endpoint}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedItem({
          type: activeTab === 'clauses' ? 'clause' : 'report',
          filename,
          data
        });
      } else {
        alert('Failed to load details.');
      }
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDownload = (filename, rawContent) => {
    const blob = new Blob([rawContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getVerdictStyle = (verdict) => {
    switch (verdict?.toUpperCase()) {
      case 'ELIGIBLE':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'CONDITIONALLY ELIGIBLE':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      default:
        return 'bg-red-500/10 border-red-500/30 text-red-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'PASS':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'WARN':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <XCircle className="w-4 h-4 text-rose-450" />;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-2">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            System History logs
          </h1>
          <p className="text-slate-400 mt-1.5 text-sm">
            View, download, or clear past extracted trade clause files and validation results.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex rounded-xl bg-slate-900 p-0.5 border border-slate-800 self-start md:self-center">
          <button
            onClick={() => setActiveTab('clauses')}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
              activeTab === 'clauses' ? 'bg-purple-650 text-white shadow-md' : 'text-slate-450 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Extracted Clauses</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
              activeTab === 'reports' ? 'bg-purple-650 text-white shadow-md' : 'text-slate-450 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Validation Reports</span>
          </button>
        </div>
      </div>

      {/* Main Content Table */}
      <div className="glass-panel border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-500 font-medium">Loading historical records...</span>
          </div>
        ) : activeTab === 'clauses' ? (
          /* Clauses Table */
          clausesList.length === 0 ? (
            <div className="p-20 text-center text-slate-500">
              <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-base font-semibold">No clause extractions registered yet</p>
              <p className="text-xs text-slate-650 mt-1">Extractions will appear here after parsing compliance documents.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-900/50 text-xs font-bold text-slate-450 uppercase tracking-wider">
                    <th className="px-6 py-4">Document Name</th>
                    <th className="px-6 py-4">Total Clauses</th>
                    <th className="px-6 py-4">Date Extracted</th>
                    <th className="px-6 py-4">File Size</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-sm text-slate-300">
                  {clausesList.map((item) => (
                    <tr key={item.filename} className="hover:bg-slate-900/35 transition duration-150">
                      <td className="px-6 py-4 font-semibold text-slate-200 truncate max-w-[280px]" title={item.doc_name}>
                        {item.doc_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-900 border border-slate-800 text-slate-350 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                          {item.clause_count} clauses
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-500" /> {formatDate(item.created_at)}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {formatSize(item.size)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewDetails(item.filename)}
                            className="p-2 text-slate-450 hover:text-purple-400 bg-slate-900 border border-slate-800 rounded-lg hover:border-purple-900/40 transition"
                            title="View extracted clauses"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(item.filename, item.filename)}
                            className="p-2 text-slate-450 hover:text-blue-400 bg-slate-900 border border-slate-800 rounded-lg hover:border-blue-900/40 transition"
                            title="Download markdown file"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(item.filename, e)}
                            className="p-2 text-slate-500 hover:text-rose-400 bg-slate-900 border border-slate-850 rounded-lg hover:border-rose-900/40 transition"
                            title="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Reports Table */
          reportsList.length === 0 ? (
            <div className="p-20 text-center text-slate-500">
              <ClipboardList className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-base font-semibold">No validation reports registered yet</p>
              <p className="text-xs text-slate-650 mt-1">Audit reports will appear here after checking client specifications.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-900/50 text-xs font-bold text-slate-450 uppercase tracking-wider">
                    <th className="px-6 py-4">Client Name</th>
                    <th className="px-6 py-4">Score</th>
                    <th className="px-6 py-4">Verdict</th>
                    <th className="px-6 py-4">Date Audited</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-sm text-slate-300">
                  {reportsList.map((item) => (
                    <tr key={item.filename} className="hover:bg-slate-900/35 transition duration-150">
                      <td className="px-6 py-4 font-semibold text-slate-200 truncate max-w-[280px]" title={item.client_name}>
                        {item.client_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-slate-200">
                          {item.score}/100
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getVerdictStyle(item.verdict)}`}>
                          {item.verdict}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-500" /> {formatDate(item.created_at)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewDetails(item.filename)}
                            className="p-2 text-slate-450 hover:text-purple-400 bg-slate-900 border border-slate-800 rounded-lg hover:border-purple-900/40 transition"
                            title="View validation report details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(item.filename, item.filename)}
                            className="p-2 text-slate-450 hover:text-blue-400 bg-slate-900 border border-slate-800 rounded-lg hover:border-blue-900/40 transition"
                            title="Download markdown report"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(item.filename, e)}
                            className="p-2 text-slate-500 hover:text-rose-400 bg-slate-900 border border-slate-850 rounded-lg hover:border-rose-900/40 transition"
                            title="Delete report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Details Viewer Overlay Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300">
          <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-[#0b0f17] border border-slate-800 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-850 bg-slate-900/30">
              <div>
                <span className="text-[10px] text-purple-450 font-bold uppercase tracking-widest block">
                  {selectedItem.type === 'clause' ? 'Extracted Rule Clauses' : 'Validation Audit Logs'}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5 truncate max-w-[600px]">
                  {selectedItem.type === 'clause' 
                    ? selectedItem.data.doc_name 
                    : `Report: ${selectedItem.data.client_name}`}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDownload(selectedItem.filename, selectedItem.data.raw_markdown)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-750 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-350 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MD</span>
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable content) */}
            <div className="p-6 overflow-y-auto space-y-6 max-h-[60vh]">
              {selectedItem.type === 'clause' ? (
                /* Clauses list view */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedItem.data.clauses.map((c) => (
                    <div key={c.clause_id} className="p-4 rounded-xl bg-slate-900/40 border border-slate-850 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-purple-400">{c.clause_id}</span>
                          <span className="text-[10px] font-bold bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800 uppercase tracking-wider">{c.category}</span>
                        </div>
                        <p className="text-slate-200 text-xs mt-3 leading-relaxed font-normal">{c.raw_text}</p>
                      </div>
                      {c.source_hint && (
                        <div className="mt-4 pt-2 border-t border-slate-900/50 flex justify-between text-[10px] text-slate-500 font-medium">
                          <span>Source hint:</span>
                          <span>{c.source_hint}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Validation reports detailed view */
                <div className="space-y-6">
                  {/* Summary row cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 text-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Verdict</span>
                      <span className={`text-base font-extrabold block mt-1 tracking-tight ${
                        selectedItem.data.verdict === 'ELIGIBLE' ? 'text-green-400' : selectedItem.data.verdict === 'CONDITIONALLY ELIGIBLE' ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {selectedItem.data.verdict}
                      </span>
                    </div>
                    <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 text-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Score</span>
                      <span className="text-xl font-extrabold text-white block mt-1">{selectedItem.data.score}/100</span>
                    </div>
                    <td className="hidden"></td> {/* Alignment placeholder */}
                    <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 text-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Clauses Checked</span>
                      <span className="text-xl font-extrabold text-slate-350 block mt-1">{selectedItem.data.summary.total}</span>
                    </div>
                    <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 text-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Passed / Warnings / Failed</span>
                      <span className="text-sm font-bold block mt-2 tracking-wide">
                        <span className="text-green-400">{selectedItem.data.summary.passed}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-amber-400">{selectedItem.data.summary.warnings}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-rose-400">{selectedItem.data.summary.failed}</span>
                      </span>
                    </div>
                  </div>

                  {/* Clause by clause check details */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2">Individual Audit Ledger</h4>
                    <div className="space-y-3">
                      {selectedItem.data.results.map((res) => (
                        <div key={res.clause_id} className="p-4 rounded-2xl bg-slate-900/30 border border-slate-850/60 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                          <div className="space-y-1 max-w-[80%]">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(res.status)}
                              <span className="font-mono text-xs font-bold text-slate-300">{res.clause_id}</span>
                              <span className="text-[9px] font-bold uppercase bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded border border-slate-800">{res.category}</span>
                            </div>
                            <p className="text-xs text-slate-400 italic">" {res.raw_text} "</p>
                            <p className="text-slate-200 text-xs font-semibold mt-1">Result: {res.reason}</p>
                            {res.status !== 'PASS' && res.missing && (
                              <p className="text-xs text-rose-400 bg-red-950/20 p-2 rounded-lg border border-red-900/10 mt-2"><span className="font-bold">Missing:</span> {res.missing}</p>
                            )}
                          </div>
                          <span className={`text-xs font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${getVerdictStyle(res.status)}`}>
                            {res.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-900/30 border-t border-slate-850 text-right">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
