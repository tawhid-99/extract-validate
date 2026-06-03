import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, FileText, ClipboardList, Play, Download, Settings, RefreshCw, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import ValidationResult from '../components/ValidationResult';
import VerdictBanner from '../components/VerdictBanner';

export default function Validate() {
  // Input Selection States
  const [clauseFiles, setClauseFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [inputMode, setInputMode] = useState('structured'); // structured, freeform

  // Freeform Requirements
  const [freeformText, setFreeformText] = useState('');

  // Structured Requirements
  const [clientName, setClientName] = useState('');
  const [tradeType, setTradeType] = useState('Import');
  const [transactionValue, setTransactionValue] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [certifications, setCertifications] = useState([]);
  const [currentCert, setCurrentCert] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [sanctionsClean, setSanctionsClean] = useState(true);

  // Validation execution states
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, loading, validating, saving, completed, failed
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [reportFilename, setReportFilename] = useState('');
  const [reportMarkdown, setReportMarkdown] = useState('');
  
  // Section Expansion States
  const [showFailed, setShowFailed] = useState(true);
  const [showWarnings, setShowWarnings] = useState(false);
  const [showPassed, setShowPassed] = useState(false);
  
  const eventSourceRef = useRef(null);

  useEffect(() => {
    fetchClauseFiles();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const fetchClauseFiles = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/clauses');
      if (response.ok) {
        const data = await response.json();
        setClauseFiles(data);
        if (data.length > 0) {
          setSelectedFile(data[0].filename);
        }
      }
    } catch (err) {
      console.error('Failed to fetch clause files:', err);
    }
  };

  const handleAddCert = (e) => {
    e.preventDefault();
    if (currentCert.trim() && !certifications.includes(currentCert.trim())) {
      setCertifications([...certifications, currentCert.trim()]);
      setCurrentCert('');
    }
  };

  const handleRemoveCert = (indexToRemove) => {
    setCertifications(certifications.filter((_, idx) => idx !== indexToRemove));
  };

  const triggerValidation = async () => {
    if (!selectedFile) {
      alert('Please select an extracted clause file first.');
      return;
    }

    // Assemble client requirements payload
    let reqPayload;
    if (inputMode === 'freeform') {
      if (!freeformText.trim()) {
        alert('Please enter client requirements.');
        return;
      }
      reqPayload = freeformText;
    } else {
      if (!clientName.trim()) {
        alert('Please enter a Client Name.');
        return;
      }
      reqPayload = {
        client_name: clientName,
        trade_type: tradeType,
        transaction_value: transactionValue,
        origin_country: originCountry,
        certifications: certifications,
        payment_method: paymentMethod,
        lead_time_days: leadTimeDays ? parseInt(leadTimeDays) : null,
        product_category: productCategory,
        sanctions_clean: sanctionsClean
      };
    }

    setTaskId(null);
    setStatus('loading');
    setProgress(5);
    setMessage('Initializing compliance validation...');
    setResults([]);
    setSummary(null);
    setReportMarkdown('');
    setReportFilename('');

    try {
      const response = await fetch('http://localhost:8000/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clause_file: selectedFile,
          client_requirements: reqPayload
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to trigger validation.');
      }

      const data = await response.json();
      setTaskId(data.task_id);
      startValidationProgressStream(data.task_id);
    } catch (err) {
      setStatus('failed');
      setProgress(100);
      setMessage(err.message || 'An error occurred during submission.');
    }
  };

  const startValidationProgressStream = (id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`http://localhost:8000/api/validate/stream?task_id=${id}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('progress', async (e) => {
      const eventData = JSON.parse(e.data);
      setStatus(eventData.step);
      setProgress(eventData.progress);
      setMessage(eventData.message);

      if (eventData.data) {
        // Stream live results
        if (eventData.data.result) {
          setResults((prev) => {
            const exists = prev.some((r) => r.clause_id === eventData.data.result.clause_id);
            if (exists) {
              return prev.map((r) => 
                r.clause_id === eventData.data.result.clause_id ? eventData.data.result : r
              );
            } else {
              return [...prev, eventData.data.result];
            }
          });
        }

        // Completed validation task
        if (eventData.step === 'completed') {
          setReportFilename(eventData.data.filename);
          setSummary(eventData.data.summary);
          if (eventData.data.results && eventData.data.results.length > 0) {
            setResults(eventData.data.results);
          }
          await fetchRawReport(eventData.data.filename);
          eventSource.close();
        }

        // Failed validation task
        if (eventData.step === 'failed') {
          eventSource.close();
        }
      }
    });

    eventSource.onerror = () => {
      setStatus('failed');
      setProgress(100);
      setMessage('Lost connection to validation update stream.');
      eventSource.close();
    };
  };

  const fetchRawReport = async (filename) => {
    try {
      const response = await fetch(`http://localhost:8000/api/reports/${filename}`);
      if (response.ok) {
        const data = await response.json();
        setReportMarkdown(data.raw_markdown);
      }
    } catch (err) {
      console.error('Failed to fetch raw report file content:', err);
    }
  };

  const downloadReport = () => {
    if (!reportMarkdown || !reportFilename) return;
    const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', reportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-2">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Trade Eligibility Validation
          </h1>
          <p className="text-slate-400 mt-1.5 text-sm">
            Evaluate a client requirement spec against compliance policies using sequential AI audits.
          </p>
        </div>
        
        {/* Actions for completed reports */}
        {status === 'completed' && reportMarkdown && (
          <button
            onClick={downloadReport}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-sm font-bold text-white shadow-lg transition shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download Report MD</span>
          </button>
        )}
      </div>

      {status === 'idle' || status === 'failed' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Clause File Picker */}
            <div className="glass-panel border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-800/80">
                <FileText className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-slate-200">1. Target Rulebook</h3>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Select Clause File
                </label>
                {clauseFiles.length === 0 ? (
                  <div className="text-xs text-amber-400 bg-amber-950/20 border border-amber-900/40 p-3 rounded-xl mt-2 leading-relaxed">
                    No extracted clauses found. Please go to the <strong>Extract Clauses</strong> page first to parse a document.
                  </div>
                ) : (
                  <select
                    value={selectedFile}
                    onChange={(e) => setSelectedFile(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-250 focus:border-purple-500 focus:outline-none transition mt-2"
                  >
                    {clauseFiles.map((file) => (
                      <option key={file.filename} value={file.filename}>
                        {file.doc_name} ({file.clause_count} clauses)
                      </option>
                    ))}
                  </select>
                )}
                {clauseFiles.length > 0 && (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    File selected: {selectedFile}
                  </span>
                )}
              </div>
            </div>

            {/* Run Button */}
            {clauseFiles.length > 0 && (
              <button
                onClick={triggerValidation}
                className="w-full flex items-center justify-center space-x-2.5 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-base font-extrabold text-white shadow-xl shadow-purple-950/20 transform hover:-translate-y-0.5 transition duration-200"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Run Validation Audit</span>
              </button>
            )}

            {/* If validation previously failed */}
            {status === 'failed' && (
              <div className="p-4 bg-red-950/25 border border-red-900/50 rounded-2xl text-xs text-red-400 space-y-1">
                <span className="font-bold uppercase tracking-wider block">Error executing audit:</span>
                <p className="font-mono leading-relaxed">{message}</p>
              </div>
            )}
          </div>

          {/* Requirements Input Form Right Column */}
          <div className="lg:col-span-2 glass-panel border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2.5">
                <ClipboardList className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-slate-200">2. Client Specifications</h3>
              </div>
              
              {/* Input Mode Toggle */}
              <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                <button
                  onClick={() => setInputMode('structured')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    inputMode === 'structured' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Form Mode
                </button>
                <button
                  onClick={() => setInputMode('freeform')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    inputMode === 'freeform' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Raw Text
                </button>
              </div>
            </div>

            {/* Input Selection Content */}
            {inputMode === 'freeform' ? (
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Pasted Requirements Text
                </label>
                <textarea
                  value={freeformText}
                  onChange={(e) => setFreeformText(e.target.value)}
                  placeholder="Paste client compliance data e.g.&#10;Client Name: Global Logistics Inc.&#10;Transaction Value: 50,000 USD&#10;Origin Country: Vietnam&#10;Certifications Held: ISO 9001, CE Certificate&#10;Payment Method: Bank Wire Transfer&#10;Lead Time Available: 30 days&#10;No active trade sanctions flags."
                  rows={14}
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm font-normal text-slate-200 placeholder-slate-600 focus:border-purple-500 focus:outline-none transition leading-relaxed"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Client Name */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                  />
                </div>

                {/* Trade Type */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Trade Type
                  </label>
                  <select
                    value={tradeType}
                    onChange={(e) => setTradeType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                  >
                    <option value="Import">Import</option>
                    <option value="Export">Export</option>
                    <option value="Transit">Transit</option>
                  </select>
                </div>

                {/* Transaction Value */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Transaction Value ($)
                  </label>
                  <input
                    type="text"
                    value={transactionValue}
                    onChange={(e) => setTransactionValue(e.target.value)}
                    placeholder="e.g. 250,000 USD"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                  />
                </div>

                {/* Origin Country */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Origin Country
                  </label>
                  <input
                    type="text"
                    value={originCountry}
                    onChange={(e) => setOriginCountry(e.target.value)}
                    placeholder="e.g. Germany"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                  />
                </div>

                {/* Payment Method */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Payment Method
                  </label>
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="e.g. Letter of Credit"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                  />
                </div>

                {/* Lead Time Days */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Lead Time Available (Days)
                  </label>
                  <input
                    type="number"
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value)}
                    placeholder="e.g. 45"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                  />
                </div>

                {/* Product Category */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Product Category
                  </label>
                  <input
                    type="text"
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    placeholder="e.g. Medical Devices"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                  />
                </div>

                {/* Sanctions Checked */}
                <div className="flex items-center space-x-3.5 bg-slate-900/60 border border-slate-850 px-4 py-3 rounded-xl mt-3.5">
                  <input
                    type="checkbox"
                    id="sanctions"
                    checked={sanctionsClean}
                    onChange={(e) => setSanctionsClean(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800 focus:ring-purple-500"
                  />
                  <label htmlFor="sanctions" className="text-xs text-slate-350 cursor-pointer select-none">
                    <span className="font-bold text-slate-200 block">Sanctions Cleared</span>
                    Verify that client has no active regulatory restrictions or OFAC violations.
                  </label>
                </div>

                {/* Certifications - Full Width Grid */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Certifications Held
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentCert}
                      onChange={(e) => setCurrentCert(e.target.value)}
                      placeholder="e.g. ISO 9001"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCert(e)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                    />
                    <button
                      onClick={handleAddCert}
                      className="px-4 bg-purple-600 hover:bg-purple-500 rounded-xl flex items-center justify-center font-bold text-white transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Tag List */}
                  {certifications.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 bg-slate-955 p-3 border border-slate-900/60 rounded-xl">
                      {certifications.map((cert, index) => (
                        <span
                          key={index}
                          className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-900 text-slate-200 text-xs font-semibold rounded-lg border border-slate-800 shadow"
                        >
                          <span>{cert}</span>
                          <button
                            onClick={() => handleRemoveCert(index)}
                            className="text-slate-500 hover:text-rose-400 transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Validation Running / Completed Stream Page */
        <div className="space-y-6">
          {/* Stepper logs */}
          <div className="glass-panel border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  AUDIT PIPELINE
                </span>
                <span className="font-semibold text-slate-250 text-sm">
                  {message}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Progress:</span>
              <div className="w-40 h-2 bg-slate-900 rounded-full border border-slate-850 overflow-hidden shrink-0">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-200">{progress}%</span>
            </div>
          </div>

          {/* Verdict and Score Gauge (When Completed) */}
          {status === 'completed' && summary && (
            <VerdictBanner 
              verdict={summary.verdict} 
              score={summary.score} 
              passed={summary.passed} 
              warnings={summary.warnings} 
              failed={summary.failed} 
              total={summary.total}
              results={results}
              onDownload={downloadReport} 
            />
          )}

          {/* Validation Result list */}
          {results.length > 0 && (() => {
            const failedClauses = results.filter(r => r.status === 'FAIL');
            const warnClauses = results.filter(r => r.status === 'WARN');
            const passClauses = results.filter(r => r.status === 'PASS');

            return (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-850 pb-3 mt-4">
                  <h3 className="font-bold text-slate-200 text-lg flex items-center gap-2">
                    <span>Clause Audit Records</span>
                    {status !== 'completed' && status !== 'failed' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse">
                        Processing
                      </span>
                    )}
                  </h3>
                  
                  {status === 'completed' && summary && (
                    <div className="flex items-center space-x-4 text-xs font-semibold text-slate-400">
                      <span className="text-green-400">{summary.passed} Passed</span>
                      <span className="text-amber-400">{summary.warnings} Warnings</span>
                      <span className="text-rose-400">{summary.failed} Failed</span>
                    </div>
                  )}
                </div>

                {/* Section 1 — Failed Clauses */}
                {failedClauses.length > 0 && (
                  <div className="glass-panel border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
                    <button
                      onClick={() => setShowFailed(!showFailed)}
                      className="w-full flex items-center justify-between px-5 py-4 bg-rose-950/10 hover:bg-rose-950/20 transition-colors text-left"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-rose-450 font-extrabold text-sm uppercase tracking-wider">
                          Failed Clauses
                        </span>
                        <span className="bg-rose-500/15 border border-rose-500/25 text-rose-450 text-xs px-2 py-0.5 rounded-full font-bold">
                          {failedClauses.length}
                        </span>
                      </div>
                      {showFailed ? <ChevronUp className="w-5 h-5 text-rose-450" /> : <ChevronDown className="w-5 h-5 text-rose-450" />}
                    </button>
                    {showFailed && (
                      <div className="p-5 border-t border-slate-900 grid grid-cols-1 gap-4">
                        {failedClauses.map((res) => (
                          <ValidationResult key={res.clause_id} result={res} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Section 2 — Warning Clauses */}
                {warnClauses.length > 0 && (
                  <div className="glass-panel border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
                    <button
                      onClick={() => setShowWarnings(!showWarnings)}
                      className="w-full flex items-center justify-between px-5 py-4 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-amber-400 font-extrabold text-sm uppercase tracking-wider">
                          Warning Clauses
                        </span>
                        <span className="bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs px-2 py-0.5 rounded-full font-bold">
                          {warnClauses.length}
                        </span>
                      </div>
                      {showWarnings ? <ChevronUp className="w-5 h-5 text-amber-400" /> : <ChevronDown className="w-5 h-5 text-amber-400" />}
                    </button>
                    {showWarnings && (
                      <div className="p-5 border-t border-slate-900 grid grid-cols-1 gap-4">
                        {warnClauses.map((res) => (
                          <ValidationResult key={res.clause_id} result={res} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Section 3 — Passed Clauses */}
                {passClauses.length > 0 && (
                  <div className="glass-panel border border-slate-850 rounded-2xl overflow-hidden shadow-lg">
                    <button
                      onClick={() => setShowPassed(!showPassed)}
                      className="w-full flex items-center justify-between px-5 py-4 bg-green-500/5 hover:bg-green-500/10 transition-colors text-left"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-green-400 font-extrabold text-sm uppercase tracking-wider">
                          Passed Clauses
                        </span>
                        <span className="bg-green-500/15 border border-green-500/25 text-green-400 text-xs px-2 py-0.5 rounded-full font-bold">
                          {passClauses.length}
                        </span>
                      </div>
                      {showPassed ? <ChevronUp className="w-5 h-5 text-green-400" /> : <ChevronDown className="w-5 h-5 text-green-400" />}
                    </button>
                    {showPassed && (
                      <div className="p-5 border-t border-slate-900 grid grid-cols-1 gap-4">
                        {passClauses.map((res) => (
                          <ValidationResult key={res.clause_id} result={res} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Controls to reset and run again */}
          {status === 'completed' && (
            <div className="flex justify-end pt-4">
              <button
                onClick={() => setStatus('idle')}
                className="px-6 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm font-semibold rounded-xl text-slate-200 transition"
              >
                Reset and Audit Another Client
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
