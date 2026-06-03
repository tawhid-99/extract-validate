import React, { useState, useEffect, useRef } from 'react';
import { Copy, Download, FileCode, BarChart3, AlertCircle, CheckCircle2 } from 'lucide-react';
import UploadZone from '../components/UploadZone';
import ProgressStepper from '../components/ProgressStepper';
import ClauseCard from '../components/ClauseCard';

const CATEGORY_COLORS = {
  Financial: 'bg-emerald-500',
  Compliance: 'bg-indigo-500',
  Operational: 'bg-sky-500',
  Legal: 'bg-rose-500',
  Documentation: 'bg-amber-500',
  Technical: 'bg-teal-500'
};

export default function Extract() {
  const [file, setFile] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, parsing, chunking, extracting, classifying, saving, completed, failed
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [clauses, setClauses] = useState([]);
  const [markdownFilename, setMarkdownFilename] = useState('');
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [copied, setCopied] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    // Cleanup EventSource on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleFileSelected = async (selectedFile) => {
    setFile(selectedFile);
    setTaskId(null);
    setStatus('parsing');
    setProgress(5);
    setMessage('Initializing connection to backend...');
    setClauses([]);
    setRawMarkdown('');
    setMarkdownFilename('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://localhost:8000/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start extraction.');
      }

      const data = await response.json();
      setTaskId(data.task_id);
      startProgressStream(data.task_id);
    } catch (err) {
      setStatus('failed');
      setProgress(100);
      setMessage(err.message || 'An error occurred during file upload.');
    }
  };

  const startProgressStream = (id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`http://localhost:8000/api/extract/stream?task_id=${id}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('progress', async (e) => {
      const eventData = JSON.parse(e.data);
      setStatus(eventData.step);
      setProgress(eventData.progress);
      setMessage(eventData.message);

      if (eventData.data) {
        // Handle live clause stream
        if (eventData.data.clause) {
          setClauses((prev) => {
            const exists = prev.some((c) => c.clause_id === eventData.data.clause.clause_id);
            if (exists) {
              return prev.map((c) => 
                c.clause_id === eventData.data.clause.clause_id ? eventData.data.clause : c
              );
            } else {
              return [...prev, eventData.data.clause];
            }
          });
        }

        // Handle completed task
        if (eventData.step === 'completed') {
          setMarkdownFilename(eventData.data.filename);
          if (eventData.data.clauses && eventData.data.clauses.length > 0) {
            setClauses(eventData.data.clauses);
          }
          await fetchRawMarkdown(eventData.data.filename);
          eventSource.close();
        }

        // Handle failed task
        if (eventData.step === 'failed') {
          eventSource.close();
        }
      }
    });

    eventSource.onerror = () => {
      setStatus('failed');
      setProgress(100);
      setMessage('Lost connection to progress update stream.');
      eventSource.close();
    };
  };

  const fetchRawMarkdown = async (filename) => {
    try {
      const response = await fetch(`http://localhost:8000/api/clauses/${filename}`);
      if (response.ok) {
        const data = await response.json();
        setRawMarkdown(data.raw_markdown);
      }
    } catch (err) {
      console.error('Failed to fetch raw markdown file content:', err);
    }
  };

  const copyToClipboard = () => {
    if (!rawMarkdown) return;
    navigator.clipboard.writeText(rawMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdown = () => {
    if (!rawMarkdown || !markdownFilename) return;
    const blob = new Blob([rawMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', markdownFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get statistics by category
  const getCategoryStats = () => {
    const stats = {
      Financial: 0,
      Compliance: 0,
      Operational: 0,
      Legal: 0,
      Documentation: 0,
      Technical: 0
    };
    
    clauses.forEach((c) => {
      if (c.category && stats[c.category] !== undefined) {
        stats[c.category]++;
      }
    });
    
    return stats;
  };

  const categoryStats = getCategoryStats();
  const totalExtracted = clauses.length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-2">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Clause Extraction & Categorization
          </h1>
          <p className="text-slate-400 mt-1.5 text-sm">
            Upload policies or trade agreements to automatically extract and classify trade constraints.
          </p>
        </div>
        
        {/* Actions for completed markdown */}
        {status === 'completed' && rawMarkdown && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={copyToClipboard}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-sm font-semibold text-slate-200 transition"
            >
              <Copy className="w-4 h-4 text-purple-400" />
              <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
            </button>
            <button
              onClick={downloadMarkdown}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-sm font-bold text-white shadow-lg transition"
            >
              <Download className="w-4 h-4" />
              <span>Download MD</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Upload / Progress Stepper */}
      {status === 'idle' ? (
        <UploadZone onFileSelected={handleFileSelected} />
      ) : (
        <div className="space-y-6">
          <ProgressStepper currentStep={status} progressValue={progress} message={message} />
          {status !== 'completed' && status !== 'failed' && (
            <div className="flex items-center justify-center p-8 bg-slate-950/40 border border-slate-900/60 rounded-2xl">
              <div className="text-center space-y-3">
                <div className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400 font-medium">
                  Processing compliance document chunk. This may take up to a few minutes.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Dashboard & Live Streaming */}
      {clauses.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Stats Sidebar */}
          <div className="lg:col-span-1 glass-panel border border-slate-800 rounded-2xl p-5 space-y-6 lg:sticky lg:top-6">
            <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-800/80">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-slate-200">Extraction Stats</h3>
            </div>

            {/* Total Count */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                Total Clauses Found
              </span>
              <span className="text-4xl font-extrabold text-white mt-1 block">
                {totalExtracted}
              </span>
            </div>

            {/* Category Breakdown list */}
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                By Compliance Category
              </span>
              {Object.entries(categoryStats).map(([cat, count]) => {
                const percentage = totalExtracted > 0 ? (count / totalExtracted) * 100 : 0;
                const catColor = CATEGORY_COLORS[cat] || 'bg-slate-500';
                
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-450">{cat}</span>
                      <span className="text-slate-350">{count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                      <div 
                        className={`h-full rounded-full ${catColor}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* File Info */}
            {file && (
              <div className="border-t border-slate-800/60 pt-4 flex items-center space-x-3 text-xs text-slate-500">
                <FileCode className="w-4 h-4 shrink-0 text-slate-450" />
                <span className="truncate">{file.name}</span>
              </div>
            )}
          </div>

          {/* Clauses Grid */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="font-bold text-slate-200 text-lg flex items-center gap-2">
                <span>Extracted Rule Records</span>
                {status !== 'completed' && status !== 'failed' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse">
                    Streaming
                  </span>
                )}
              </h3>
              <span className="text-xs text-slate-500">
                Sorted sequentially
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {clauses.map((clause) => (
                <ClauseCard key={clause.clause_id} clause={clause} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
