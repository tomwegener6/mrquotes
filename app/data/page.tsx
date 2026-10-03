'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

type UploadState = 'idle' | 'validating' | 'uploading' | 'success' | 'error';

interface UploadStatus {
  state: UploadState;
  message?: string;
  rows?: number;
  columns?: number;
}

const inventoryFields = [
  { csv: 'Inventory: Inventory UID', display: 'Inventory Line' },
  { csv: 'Part Number', display: 'Part Number' },
  { csv: 'Serial Number', display: 'Serial Number' },
  { csv: 'Keyword', display: 'Keyword' },
  { csv: 'Condition Code', display: 'Condition' },
  { csv: 'Quantity', display: 'Quantity Available' },
];

const queries = [
  {
    file: 'RFQ.csv',
    query: `SELECT
  Id,
  Name,
  inscor__Status__c,
  inscor__Vendor__c,
  inscor__Vendor__r.Name,
  inscor__Contact__c,
  inscor__Contact__r.Email,
  inscor__Contact__r.FirstName,
  inscor__Contact__r.LastName,
  inscor__RFQ_Total_Value__c,
  inscor__RFQ_Total_Company_Value__c,
  inscor__Urgency__c,
  inscor__Number_of_Lines__c,
  inscor__Due_Date__c,
  inscor__Terms__c,
  inscor__Ship_Method__c,
  inscor__Ship_Terms__c
FROM inscor__RFQ__c`,
  },
  {
    file: 'RFQLines.csv',
    query: `SELECT
  Id,
  Name,
  inscor__RFQ_Number__c,
  inscor__RFQ_Number__r.Name,
  inscor__Product__c,
  inscor__Product__r.Name,
  inscor__Condition_Code__c,
  inscor__Condition_Code__r.Name,
  inscor__Condition_Code_Quoted__c,
  inscor__Price__c,
  inscor__Outright_Price__c,
  inscor__Line_Total__c,
  inscor__Quantity_Requested__c,
  inscor__Quantity_Quoted__c,
  inscor__Type_Requested__c,
  inscor__Type_Quoted__c,
  inscor__Status__c,
  inscor__Quoted_Date__c,
  inscor__Create_Date__c,
  inscor__Need_by_date__c,
  inscor__Business_Category__c,
  NHA_Part_Number__c
FROM inscor__RFQ_Line__c`,
  },
  {
    file: 'Alternates.csv',
    query: `SELECT
  Id,
  Name,
  inscor__Primary_Product__c,
  inscor__Primary_Product__r.Name,
  inscor__Alternate_Product__c,
  inscor__Alternate_Product__r.Name,
  inscor__Relationship_New__c,
  inscor__Authority__c,
  inscor__Company__c
FROM inscor__Alternate__c
WHERE inscor__Relationship_New__c = 'Alt is NHA'
OR inscor__Relationship_New__c = 'Alt is NLA'`,
  },
];

function DropZone({ filename }: { filename: string }) {
  const [status, setStatus] = useState<UploadStatus>({ state: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const [clearing, setClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = async () => {
    const confirmed = window.confirm(`Are you sure? This will delete all data in ${filename}.`);
    if (!confirmed) return;
    setClearing(true);
    try {
      await fetch('/api/clear-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename }) });
      setStatus({ state: 'idle' });
    } catch {
      // silently fail
    } finally {
      setClearing(false);
    }
  };

  const handleFile = async (file: File) => {
    if (file.name !== filename) {
      setStatus({ state: 'error', message: `Wrong file — expected "${filename}", got "${file.name}".` });
      return;
    }

    setStatus({ state: 'uploading' });

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/upload-data', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ state: 'error', message: data.error ?? 'Upload failed.' });
      } else {
        setStatus({
          state: 'success',
          message: `Saved successfully`,
          rows: data.rows,
          columns: data.columns,
        });
      }
    } catch {
      setStatus({ state: 'error', message: 'Network error — could not reach server.' });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const borderColor =
    status.state === 'success' ? 'border-green-600' :
    status.state === 'error' ? 'border-red-600' :
    isDragging ? 'border-amber-500' :
    'border-slate-600';

  const bgColor =
    status.state === 'success' ? 'bg-green-900/10' :
    status.state === 'error' ? 'bg-red-900/10' :
    isDragging ? 'bg-amber-900/10' :
    'bg-slate-800/30';

  return (
    <div className="px-6 pb-6">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <div className="flex items-center gap-3">
      <div
        className={`flex-1 rounded-lg border-2 border-dashed ${borderColor} ${bgColor} px-6 py-5 text-center cursor-pointer transition-colors`}
        onClick={() => { setStatus({ state: 'idle' }); inputRef.current?.click(); }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        {status.state === 'idle' && (
          <>
            <div className="text-2xl mb-1">📂</div>
            <p className="text-sm font-medium text-slate-400">
              Drop <span className="font-mono text-amber-400">{filename}</span> here
            </p>
            <p className="text-xs text-slate-600 mt-1">or click to browse</p>
          </>
        )}
        {status.state === 'uploading' && (
          <p className="text-sm text-slate-400 animate-pulse">⏳ Validating &amp; saving...</p>
        )}
        {status.state === 'success' && (
          <>
            <div className="text-2xl mb-1">✅</div>
            <p className="text-sm font-medium text-green-400">{status.message}</p>
            <p className="text-xs text-slate-500 mt-1">
              {status.rows} rows · {status.columns} columns
            </p>
            <p className="text-xs text-slate-600 mt-2">Click to replace</p>
          </>
        )}
        {status.state === 'error' && (
          <>
            <div className="text-2xl mb-1">❌</div>
            <p className="text-sm font-medium text-red-400">{status.message}</p>
            <p className="text-xs text-slate-600 mt-2">Click to try again</p>
          </>
        )}
      </div>
      <button
        onClick={handleClear}
        disabled={clearing}
        title={`Clear ${filename}`}
        className="shrink-0 text-xs px-3 py-2 rounded-lg border border-red-900 text-red-500 hover:bg-red-900/20 hover:border-red-700 transition disabled:opacity-40"
      >
        {clearing ? '...' : '🗑 Clear'}
      </button>
      </div>
    </div>
  );
}

export default function DataPage() {
  return (
    <main className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/" className="text-amber-500 hover:text-amber-400 transition text-sm">← Home</Link>
          <h1 className="text-2xl font-serif font-bold text-amber-50">Data</h1>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-8">
          <p className="text-slate-400 mb-2">
            Salesforce SOQL queries for exporting data files. Run each in the SF Data Export tool, save as the exact filename shown, then drop it below to update.
          </p>
          <a href="/UPDATE_DATA.md" target="_blank" rel="noopener noreferrer" className="text-sm text-amber-400 hover:text-amber-300 transition">
            📖 Step-by-step update guide →
          </a>
        </div>

        <div className="space-y-6">
          {queries.map(({ file, query }) => (
            <div key={file} className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3">
                <span className="font-mono font-semibold text-amber-400">{file}</span>
                <span className="text-xs text-slate-500">→ <span className="font-mono text-slate-400">data/{file}</span></span>
              </div>
              <pre className="px-6 py-5 text-sm text-slate-300 font-mono overflow-x-auto whitespace-pre leading-relaxed border-b border-slate-800">
                {query}
              </pre>
              <DropZone filename={file} />
            </div>
          ))}

          {/* Inventory.csv — manual export, no SOQL */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3">
              <span className="font-mono font-semibold text-amber-400">Inventory.csv</span>
              <span className="text-xs text-slate-500">→ <span className="font-mono text-slate-400">data/Inventory.csv</span></span>
            </div>
            <div className="px-6 py-5 border-b border-slate-800">
              <p className="text-sm text-slate-400 mb-4">Export from your inventory system. File must be named exactly <span className="font-mono text-amber-400">Inventory.csv</span> and contain these columns:</p>
              <table className="text-sm w-full">
                <thead>
                  <tr className="text-xs uppercase text-slate-500 border-b border-slate-800">
                    <th className="text-left pb-2 pr-8">CSV Column Name</th>
                    <th className="text-left pb-2">Displayed As</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {inventoryFields.map(f => (
                    <tr key={f.csv}>
                      <td className="py-2 pr-8 font-mono text-amber-300">{f.csv}</td>
                      <td className="py-2 text-slate-300">{f.display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DropZone filename="Inventory.csv" />
          </div>
        </div>
      </div>
    </main>
  );
}
