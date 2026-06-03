import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertTriangle } from 'lucide-react';

export default function UploadZone({ onFileSelected, acceptedExtensions = ['.pdf', '.docx', '.txt'], maxSizeBytes = 50 * 1024 * 1024 }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const validateAndSelectFile = (file) => {
    setError(null);
    if (!file) return;

    // Validate size
    if (file.size > maxSizeBytes) {
      setError('File size exceeds the 50MB limit.');
      return;
    }

    // Validate extension
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!acceptedExtensions.includes(ext)) {
      setError(`Unsupported file type. Please upload: ${acceptedExtensions.join(', ')}`);
      return;
    }

    onFileSelected(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`relative w-full rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300 glass-panel ${
          isDragActive 
            ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.2)]' 
            : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={acceptedExtensions.join(',')}
          onChange={handleFileInputChange}
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`p-4 rounded-full bg-slate-900 border ${isDragActive ? 'border-purple-400 text-purple-400' : 'border-slate-700 text-slate-400'}`}>
            <Upload className="w-8 h-8 animate-bounce-slow" />
          </div>
          
          <div>
            <p className="text-lg font-semibold text-slate-200">
              Drag & Drop file to upload
            </p>
            <p className="text-sm text-slate-400 mt-1">
              or click to browse from your device
            </p>
          </div>
          
          <div className="flex items-center space-x-3 text-xs text-slate-500 border-t border-slate-800/60 pt-4 w-full justify-center">
            <span className="flex items-center"><FileText className="w-3.5 h-3.5 mr-1" /> PDF, DOCX, TXT</span>
            <span>•</span>
            <span>Up to 350 Pages</span>
            <span>•</span>
            <span>Max 50MB</span>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mt-4 flex items-center space-x-2 text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl p-3 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
