import React, { useState, useEffect, useRef } from 'react';
import { Award, Crown, Trash2, Play, Download, Plus, X, RefreshCw, FileText, ClipboardList, DollarSign, HelpCircle, AlertTriangle } from 'lucide-react';

export default function Rank() {
  // Config & Selection
  const [clauseFiles, setClauseFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  
  // Bidders List
  const [bidders, setBidders] = useState([]);

  // Bidder Form Input States
  const [bidderName, setBidderName] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  const [inputMode, setInputMode] = useState('structured'); // structured, freeform
  const [freeformText, setFreeformText] = useState('');
  
  // Form Requirements
  const [tradeType, setTradeType] = useState('Import');
  const [transactionValue, setTransactionValue] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [certifications, setCertifications] = useState([]);
  const [currentCert, setCurrentCert] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [sanctionsClean, setSanctionsClean] = useState(true);

  // Execution States
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, loading, validating, ranking, completed, failed
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [rankingResult, setRankingResult] = useState(null);
  
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

  const addBidderToList = (e) => {
    e.preventDefault();
    if (!bidderName.trim()) {
      alert('Please enter a Bidder Name.');
      return;
    }
    const priceNum = parseFloat(bidPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('Please enter a valid Bid Price.');
      return;
    }

    let requirements;
    if (inputMode === 'freeform') {
      if (!freeformText.trim()) {
        alert('Please enter requirements for this bidder.');
        return;
      }
      requirements = freeformText;
    } else {
      requirements = {
        client_name: bidderName,
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

    const newBidder = {
      id: Date.now().toString(),
      name: bidderName,
      bid_price: priceNum,
      requirements: requirements,
      inputMode: inputMode
    };

    setBidders([...bidders, newBidder]);
    
    // Reset Form
    setBidderName('');
    setBidPrice('');
    setFreeformText('');
    setTransactionValue('');
    setOriginCountry('');
    setCertifications([]);
    setPaymentMethod('');
    setLeadTimeDays('');
    setProductCategory('');
    setSanctionsClean(true);
  };

  const removeBidder = (id) => {
    setBidders(bidders.filter(b => b.id !== id));
  };

  const triggerRanking = async () => {
    if (!selectedFile) {
      alert('Please select a target Rulebook.');
      return;
    }
    if (bidders.length < 2) {
      alert('Please add at least 2 bidders to run a comparative ranking.');
      return;
    }

    setStatus('loading');
    setProgress(5);
    setMessage('Initializing comparative ranking pipeline...');
    setRankingResult(null);

    const payload = {
      clause_file: selectedFile,
      bidders: bidders.map(b => ({
        name: b.name,
        bid_price: b.bid_price,
        requirements: b.requirements
      }))
    };

    try {
      const response = await fetch('http://localhost:8000/api/rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit ranking request.');
      }

      const data = await response.json();
      setTaskId(data.task_id);
      startRankingProgressStream(data.task_id);
    } catch (err) {
      setStatus('failed');
      setProgress(100);
      setMessage(err.message || 'Error occurred during ranking submission.');
    }
  };

  const startRankingProgressStream = (id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`http://localhost:8000/api/rank/stream?task_id=${id}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('progress', (e) => {
      const eventData = JSON.parse(e.data);
      setStatus(eventData.step);
      setProgress(eventData.progress);
      setMessage(eventData.message);

      if (eventData.step === 'completed' && eventData.data) {
        setRankingResult(eventData.data);
        eventSource.close();
      }

      if (eventData.step === 'failed') {
        eventSource.close();
      }
    });

    eventSource.onerror = () => {
      setStatus('failed');
      setProgress(100);
      setMessage('Lost connection to ranking stream.');
      eventSource.close();
    };
  };

  const downloadLeaderboardReport = () => {
    if (!rankingResult || !rankingResult.raw_markdown) return;
    const blob = new Blob([rankingResult.raw_markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', rankingResult.filename || 'leaderboard.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepopulate Demo Bidders for testing
  const addDemoBidders = () => {
    const demo = [
      {
        id: 'demo-1',
        name: 'Vendor A (Eligible, Higher Price)',
        bid_price: 150000,
        requirements: {
          client_name: 'Vendor A',
          trade_type: 'Import',
          transaction_value: '150,000 USD',
          origin_country: 'Germany',
          certifications: ['ISO 9001', 'ISO 9050', 'CE Certificate'],
          payment_method: 'USD Bank Transfer',
          lead_time_days: 50,
          product_category: 'Industrial Valves',
          sanctions_clean: true
        },
        inputMode: 'structured'
      },
      {
        id: 'demo-2',
        name: 'Vendor B (Eligible, Lower Price)',
        bid_price: 120000,
        requirements: {
          client_name: 'Vendor B',
          trade_type: 'Import',
          transaction_value: '120,000 USD',
          origin_country: 'Germany',
          certifications: ['ISO 9001', 'ISO 9050', 'CE Certificate'],
          payment_method: 'USD Bank Transfer',
          lead_time_days: 45,
          product_category: 'Industrial Valves',
          sanctions_clean: true
        },
        inputMode: 'structured'
      },
      {
        id: 'demo-3',
        name: 'Vendor C (Conditionally Eligible)',
        bid_price: 95000,
        requirements: {
          client_name: 'Vendor C',
          trade_type: 'Import',
          transaction_value: '95,000 USD',
          origin_country: 'Germany',
          certifications: ['ISO 9001'],
          payment_method: 'USD Bank Transfer',
          lead_time_days: 40, // standard lead time standard is 45, this might warn
          product_category: 'Industrial Valves',
          sanctions_clean: true
        },
        inputMode: 'structured'
      },
      {
        id: 'demo-4',
        name: 'Vendor D (Not Eligible - Sanctions)',
        bid_price: 80000,
        requirements: {
          client_name: 'Vendor D',
          trade_type: 'Import',
          transaction_value: '80,000 USD',
          origin_country: 'Iran', // active sanctions
          certifications: ['ISO 9001'],
          payment_method: 'Cash',
          lead_time_days: 30,
          product_category: 'Industrial Valves',
          sanctions_clean: false
        },
        inputMode: 'structured'
      }
    ];
    setBidders(demo);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Multi-Bidder Procurement Ranking
          </h1>
          <p className="text-slate-400 mt-1.5 text-sm">
            Evaluate multiple bidders against the compliance rulebook and rank eligible bidders by final weighted scores.
          </p>
        </div>

        {rankingResult && (
          <button
            onClick={downloadLeaderboardReport}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-650 hover:from-blue-500 hover:to-purple-550 text-sm font-bold text-white shadow-lg transition shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download Leaderboard Report</span>
          </button>
        )}
      </div>

      {status === 'idle' || status === 'failed' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form & Config Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Pick Rulebook */}
            <div className="glass-panel border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-800/80">
                <FileText className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-slate-200">1. Target Rulebook</h3>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Select Clause File
                </label>
                {clauseFiles.length === 0 ? (
                  <div className="text-xs text-amber-400 bg-amber-950/20 border border-amber-900/40 p-3 rounded-xl mt-2">
                    No extracted clauses found. Please upload and extract clauses first.
                  </div>
                ) : (
                  <select
                    value={selectedFile}
                    onChange={(e) => setSelectedFile(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition mt-2"
                  >
                    {clauseFiles.map((file) => (
                      <option key={file.filename} value={file.filename}>
                        {file.doc_name} ({file.clause_count} clauses)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* 2. Add Bidder Form */}
            <form onSubmit={addBidderToList} className="glass-panel border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center space-x-2.5">
                  <ClipboardList className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-slate-200">2. Add Bidder</h3>
                </div>
                
                {/* Form Mode Toggle */}
                <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setInputMode('structured')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      inputMode === 'structured' ? 'bg-purple-600/20 border border-purple-500/20 text-purple-300 shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Form Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('freeform')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      inputMode === 'freeform' ? 'bg-purple-600/20 border border-purple-500/20 text-purple-300 shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Raw Text
                  </button>
                </div>
              </div>

              {/* Basic Bidder Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Bidder / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={bidderName}
                    onChange={(e) => setBidderName(e.target.value)}
                    placeholder="e.g. Vendor A"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Bid Price ($ USD) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="number"
                      required
                      value={bidPrice}
                      onChange={(e) => setBidPrice(e.target.value)}
                      placeholder="e.g. 150000"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Requirements Specifications */}
              {inputMode === 'freeform' ? (
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Bidder Requirements Text
                  </label>
                  <textarea
                    value={freeformText}
                    onChange={(e) => setFreeformText(e.target.value)}
                    placeholder="Describe certifications, origin country, lead times, payment terms, and sanctions clearance..."
                    rows={8}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-purple-500 focus:outline-none transition leading-relaxed"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-900 pt-4">
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
                      Transaction Value
                    </label>
                    <input
                      type="text"
                      value={transactionValue}
                      onChange={(e) => setTransactionValue(e.target.value)}
                      placeholder="e.g. 150,000 USD"
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
                      placeholder="e.g. Net 60 days"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                    />
                  </div>

                  {/* Lead Time */}
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

                  {/* Sanctions status */}
                  <div className="flex items-center space-x-3.5 bg-slate-900/60 border border-slate-850 px-4 py-3 rounded-xl">
                    <input
                      type="checkbox"
                      id="sanctions-rank"
                      checked={sanctionsClean}
                      onChange={(e) => setSanctionsClean(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800 focus:ring-purple-500"
                    />
                    <label htmlFor="sanctions-rank" className="text-xs text-slate-350 cursor-pointer select-none">
                      <span className="font-bold text-slate-200 block">Sanctions Cleared</span>
                      Verify bidder has no active sanctions or OFAC warnings.
                    </label>
                  </div>

                  {/* Certifications */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Certifications Held
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={currentCert}
                        onChange={(e) => setCurrentCert(e.target.value)}
                        placeholder="e.g. ISO 9001, CE Certificate"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCert(e))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={handleAddCert}
                        className="px-4 bg-purple-650 hover:bg-purple-550 rounded-xl flex items-center justify-center font-bold text-white transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {certifications.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 bg-slate-955 p-3 border border-slate-900/60 rounded-xl">
                        {certifications.map((cert, index) => (
                          <span
                            key={index}
                            className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-900 text-slate-200 text-xs font-semibold rounded-lg border border-slate-800 shadow"
                          >
                            <span>{cert}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCert(index)}
                              className="text-slate-500 hover:text-rose-450 transition"
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

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-purple-650 hover:bg-purple-550 text-sm font-bold text-white transition flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Bidder to Workspace</span>
                </button>
              </div>
            </form>
          </div>

          {/* Bidder Checklist Column */}
          <div className="space-y-6">
            <div className="glass-panel border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-slate-200">3. Bidders List</h3>
                </div>
                <span className="bg-slate-900 text-slate-400 border border-slate-805 text-xs font-extrabold px-2 py-0.5 rounded-md">
                  {bidders.length} Added
                </span>
              </div>

              {bidders.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
                  <span>No bidders added to evaluation list yet.</span>
                  <button
                    onClick={addDemoBidders}
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold underline"
                  >
                    Load Demo Evaluation Bidders
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {bidders.map((b) => (
                    <div key={b.id} className="flex justify-between items-center bg-slate-950/60 border border-slate-900 p-3 rounded-xl hover:border-slate-800 transition">
                      <div className="space-y-0.5 truncate mr-2">
                        <span className="font-bold text-slate-200 block text-xs truncate">
                          {b.name}
                        </span>
                        <span className="text-purple-400 text-xs font-semibold">
                          ${b.bid_price.toLocaleString()} USD
                        </span>
                      </div>
                      <button
                        onClick={() => removeBidder(b.id)}
                        className="p-1.5 rounded-lg border border-slate-900 hover:border-red-900/30 hover:bg-red-950/20 text-slate-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {bidders.length > 0 && (
                <button
                  onClick={triggerRanking}
                  disabled={bidders.length < 2}
                  className="w-full flex items-center justify-center space-x-2.5 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-650 hover:from-blue-500 hover:to-purple-550 text-sm font-extrabold text-white shadow-lg disabled:opacity-40 disabled:pointer-events-none transition duration-150 transform hover:-translate-y-0.5"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Comparative Ranking</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Progress and Results view */
        <div className="space-y-8 animate-fade-in">
          {/* Stepper logs */}
          <div className="glass-panel border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  PROCURING PIPELINE
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

          {/* Results section */}
          {status === 'completed' && rankingResult && (
            <div className="space-y-8">
              
              {/* Table 1 — Eligible Bidders */}
              <div className="glass-panel border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-800/80">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <h3 className="font-extrabold text-slate-200 text-lg">
                    :white_check_mark: Eligible Bidders (Ranked by Final Score)
                  </h3>
                </div>

                {rankingResult.ranking.ranked_eligible.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No bidders met all compliance criteria.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">Rank</th>
                          <th className="py-3 px-4">Bidder</th>
                          <th className="py-3 px-4">Compliance Score</th>
                          <th className="py-3 px-4">Price Score</th>
                          <th className="py-3 px-4 text-purple-400">Final Score</th>
                          <th className="py-3 px-4">Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankingResult.ranking.ranked_eligible.map((b, idx) => {
                          const isWinner = idx === 0;
                          return (
                            <tr 
                              key={b.name} 
                              className={`border-b border-slate-900/60 transition ${
                                isWinner 
                                  ? 'bg-amber-500/5 hover:bg-amber-500/10 border-l-2 border-l-amber-500 font-semibold' 
                                  : 'hover:bg-slate-900/40'
                              }`}
                            >
                              <td className="py-4 px-4 flex items-center space-x-1.5">
                                {isWinner && <Crown className="w-4 h-4 text-amber-400" />}
                                <span>{isWinner ? "Winner (#1)" : `#${idx + 1}`}</span>
                              </td>
                              <td className="py-4 px-4">{b.name}</td>
                              <td className="py-4 px-4">{b.compliance_score.toFixed(1)}/100</td>
                              <td className="py-4 px-4">{b.price_score.toFixed(1)}/100</td>
                              <td className="py-4 px-4 text-purple-300 font-bold">{b.final_score.toFixed(2)}</td>
                              <td className="py-4 px-4">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isWinner ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-green-500/10 border-green-500/25 text-green-400'
                                }`}>
                                  {isWinner ? 'WINNER' : 'ELIGIBLE'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Table 2 — Conditional Bidders */}
              <div className="glass-panel border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-800/80">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <h3 className="font-extrabold text-slate-200 text-lg">
                    :warning: Conditionally Eligible Bidders (Pending Clarification)
                  </h3>
                </div>

                {rankingResult.ranking.conditional.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No bidders are conditionally eligible.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">Bidder</th>
                          <th className="py-3 px-4">Price</th>
                          <th className="py-3 px-4">Warnings</th>
                          <th className="py-3 px-4">Clauses to Resolve</th>
                          <th className="py-3 px-4">Action Needed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankingResult.ranking.conditional.map((b) => (
                          <tr key={b.name} className="border-b border-slate-900/60 bg-amber-500/5 hover:bg-amber-500/10 transition">
                            <td className="py-4 px-4 font-semibold text-amber-300">{b.name}</td>
                            <td className="py-4 px-4">${b.bid_price.toLocaleString()}</td>
                            <td className="py-4 px-4 font-bold text-amber-400">{b.warned} warnings</td>
                            <td className="py-4 px-4 font-mono text-xs text-slate-300">
                              {b.blocking_clauses.join(', ')}
                            </td>
                            <td className="py-4 px-4 text-xs text-slate-300">
                              {b.warn_details?.map(d => (
                                <div key={d.clause_id} className="mb-1 last:mb-0">
                                  <strong>{d.clause_id}:</strong> {d.missing}
                                </div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl text-xs text-amber-400 leading-relaxed">
                  Note: A bidder in this conditionally eligible tier is <strong>never compared</strong> against eligible bidders for final scoring or ranking until all clarifications are resolved.
                </div>
              </div>

              {/* Table 3 — Not Eligible Bidders */}
              <div className="glass-panel border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-800/80">
                  <X className="w-5 h-5 text-rose-455" />
                  <h3 className="font-extrabold text-slate-200 text-lg">
                    :x: Not Eligible Bidders
                  </h3>
                </div>

                {rankingResult.ranking.ineligible.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No bidders were rejected.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800/60 text-slate-400 text-xs font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">Bidder</th>
                          <th className="py-3 px-4">Price</th>
                          <th className="py-3 px-4">Failed Clauses</th>
                          <th className="py-3 px-4">What is Missing / Reasons</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankingResult.ranking.ineligible.map((b) => (
                          <tr key={b.name} className="border-b border-slate-900/60 bg-red-950/5 hover:bg-red-950/10 transition text-slate-350">
                            <td className="py-4 px-4 font-semibold text-rose-400">{b.name}</td>
                            <td className="py-4 px-4">${b.bid_price.toLocaleString()}</td>
                            <td className="py-4 px-4 font-mono text-xs text-rose-350">
                              {b.blocking_clauses.join(', ')}
                            </td>
                            <td className="py-4 px-4 text-xs text-slate-400">
                              {b.failed_details?.map(d => (
                                <div key={d.clause_id} className="mb-1 last:mb-0">
                                  <strong>{d.clause_id}:</strong> {d.missing}
                                </div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="bg-red-500/5 border border-red-500/10 p-3.5 rounded-xl text-xs text-rose-400 leading-relaxed">
                  Note: Ineligible bidders failed critical compliance check gates. They are excluded from ranking and cannot be awarded the contract.
                </div>
              </div>

              {/* Reset Control */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStatus('idle')}
                  className="px-6 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm font-semibold rounded-xl text-slate-200 transition"
                >
                  Reset and Rank Another Bidder Batch
                </button>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
