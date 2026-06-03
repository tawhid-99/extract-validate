import React, { useState } from 'react';
import { ShieldCheck, FileCode, ClipboardCheck, History as HistoryIcon, Activity, Award } from 'lucide-react';
import Extract from './pages/Extract';
import Validate from './pages/Validate';
import History from './pages/History';
import Rank from './pages/Rank';

export default function App() {
  const [currentPage, setCurrentPage] = useState('extract'); // extract, validate, rank, history

  const renderPage = () => {
    switch (currentPage) {
      case 'extract':
        return <Extract />;
      case 'validate':
        return <Validate />;
      case 'rank':
        return <Rank />;
      case 'history':
        return <History />;
      default:
        return <Extract />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full bg-[#0b0f17]/70 backdrop-blur-md border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo / Header Title */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-purple-650 rounded-xl shadow-[0_0_15px_rgba(147,51,234,0.35)]">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white text-base font-sans flex items-center">
                TradeGuard <span className="text-purple-400 ml-1 text-xs px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-550/15">AI</span>
              </span>
              <span className="text-[10px] text-slate-500 font-semibold block leading-none">Compliance processing</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex space-x-1 bg-slate-950 p-1 border border-slate-900 rounded-xl">
            <button
              onClick={() => setCurrentPage('extract')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                currentPage === 'extract' 
                  ? 'bg-purple-600/10 border border-purple-500/25 text-purple-300 shadow' 
                  : 'text-slate-450 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Extract Clauses</span>
            </button>
            <button
              onClick={() => setCurrentPage('validate')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                currentPage === 'validate' 
                  ? 'bg-purple-600/10 border border-purple-500/25 text-purple-300 shadow' 
                  : 'text-slate-450 hover:text-slate-200'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Validate Trade</span>
            </button>
            <button
              onClick={() => setCurrentPage('rank')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                currentPage === 'rank' 
                  ? 'bg-purple-650/10 border border-purple-500/25 text-purple-300 shadow' 
                  : 'text-slate-450 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Rank Bidders</span>
            </button>
            <button
              onClick={() => setCurrentPage('history')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                currentPage === 'history' 
                  ? 'bg-purple-600/10 border border-purple-500/25 text-purple-300 shadow' 
                  : 'text-slate-450 hover:text-slate-200'
              }`}
            >
              <HistoryIcon className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          </nav>
          
          {/* Status Indicator */}
          <div className="hidden md:flex items-center space-x-2 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-xl shadow-inner">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>Ollama Active</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow py-8 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        {renderPage()}
      </main>

      {/* Footer Info */}
      <footer className="w-full bg-slate-950/20 border-t border-slate-950/60 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 font-medium">
          <p>© {new Date().getFullYear()} TradeGuard AI. Local LLM Document Compliance System.</p>
          <p className="flex items-center space-x-1 mt-2 md:mt-0">
            <span>Server:</span>
            <span className="text-purple-400">FastAPI</span>
            <span>|</span>
            <span>Model:</span>
            <span className="text-purple-400">Ollama Llama 3.2</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
