'use client';

import { useState, useRef, DragEvent } from 'react';
import Link from 'next/link';

interface SubRow {
  id: number;
  partNumber: string;
  price?: string;
}

interface LineItem {
  partNumber: string;
  description: string;
  qty: number;
  unitPrice: number | null;
  extPrice: number | null;
}

interface QuoteData {
  totalCost: number | null;
  laborCost: number | null;
  lineItems: LineItem[];
}

function generateCSV(meta: { mro: string; nhaPN: string; roNumber: string; serialNumber: string }, quoteData: QuoteData): string {
  const fmt = (v: number | null) => v !== null ? v.toFixed(2) : '';
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;

  const headers = ['Part Number', 'Description', 'Qty', 'Unit Price', 'Ext Price'];
  const rows = quoteData.lineItems.map(item => [
    esc(item.partNumber),
    esc(item.description),
    String(item.qty),
    fmt(item.unitPrice),
    fmt(item.extPrice),
  ]);

  const blank = ',,,,';
  const summary = [
    `"MRO",${esc(meta.mro)},,,`,
    `"NHA PN",${esc(meta.nhaPN)},,,`,
    `"RO#",${esc(meta.roNumber)},,,`,
    `"Serial Number",${esc(meta.serialNumber)},,,`,
    `"Labor",,,,${fmt(quoteData.laborCost)}`,
    `"RO Total",,,,${fmt(quoteData.totalCost)}`,
  ];

  return [
    headers.join(','),
    ...rows.map(r => r.join(',')),
    blank,
    blank,
    ...summary,
  ].join('\n');
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


interface Unit {
  id: number;
  nhaPN: string;
  roNumber: string;
  serialNumber: string;
  subcomponents: SubRow[];
  savedAt?: string;
}


let unitCounter = 100;
let rowCounter = 1000;

const newSubRows = (): SubRow[] => [
  { id: rowCounter++, partNumber: '', price: '' },
  { id: rowCounter++, partNumber: '', price: '' },
  { id: rowCounter++, partNumber: '', price: '' },
];

interface StoredUnit {
  id: number;
  nhaPN: string;
  roNumber: string;
  serialNumber: string;
  subcomponents: SubRow[];
  savedAt?: string;
}

export default function BatchPage() {
  const [activeTab, setActiveTab] = useState<'input' | 'check' | 'manage'>('input');

  // --- Input tab state ---
  const [inputNha, setInputNha] = useState('');
  const [inputRo, setInputRo] = useState('');
  const [inputSn, setInputSn] = useState('');
  const [inputParts, setInputParts] = useState<SubRow[]>(newSubRows());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'updated' | 'error'>('idle');

  // --- Check tab state ---
  const [checkNha, setCheckNha] = useState('');
  const [checkParts, setCheckParts] = useState<SubRow[]>(newSubRows());
  const [analyzed, setAnalyzed] = useState(false);
  const [donorResults, setDonorResults] = useState<{ partNumber: string; donors: { sn: string; ro: string }[] }[]>([]);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [donorAssignments, setDonorAssignments] = useState<Record<string, { unitSn: string; sn: string }>>({});
  const [assignModal, setAssignModal] = useState<{ partNumber: string; unitSn: string; assigned: { unitSn: string; sn: string } | null } | null>(null);
  const [assignSnInput, setAssignSnInput] = useState('');

  // --- Manage tab state ---
  const [manageNha, setManageNha] = useState('');
  const [manageUnits, setManageUnits] = useState<StoredUnit[]>([]);
  const [manageStatus, setManageStatus] = useState<'idle' | 'loading' | 'empty' | 'loaded' | 'error'>('idle');

  const handleManageLoad = async () => {
    const nha = manageNha.trim().toUpperCase();
    setManageStatus('loading');
    try {
      if (nha) {
        // Load single NHA
        const res = await fetch(`/api/batch?nha=${encodeURIComponent(nha)}`);
        const units: StoredUnit[] = await res.json();
        if (!Array.isArray(units) || units.length === 0) {
          setManageUnits([]);
          setManageStatus('empty');
        } else {
          setManageUnits(units);
          setManageStatus('loaded');
        }
      } else {
        // Load all NHAs
        const res = await fetch('/api/batch');
        const all: Record<string, StoredUnit[]> = await res.json();
        const allUnits = Object.values(all).flat();
        if (allUnits.length === 0) {
          setManageUnits([]);
          setManageStatus('empty');
        } else {
          setManageUnits(allUnits);
          setManageStatus('loaded');
        }
      }
    } catch {
      setManageStatus('error');
    }
  };

  const handleRemoveSubcomponent = async (unitSn: string, partNumber: string) => {
    const nha = manageNha.trim().toUpperCase() || manageUnits.find(u => u.serialNumber === unitSn)?.nhaPN || '';
    const updated = manageUnits.map(u =>
      u.serialNumber === unitSn
        ? { ...u, subcomponents: u.subcomponents.filter(s => s.partNumber !== partNumber) }
        : u
    );
    setManageUnits(updated);
    await fetch('/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nha, units: updated }),
    });
  };

  const handleRemoveUnit = async (unitSn: string) => {
    const nha = manageNha.trim().toUpperCase() || manageUnits.find(u => u.serialNumber === unitSn)?.nhaPN || '';
    const updated = manageUnits.filter(u => u.serialNumber !== unitSn);
    setManageUnits(updated);
    setManageStatus(updated.length === 0 ? 'empty' : 'loaded');
    await fetch('/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nha, units: updated }),
    });
  };

  // PDF import state
  const [importStatus, setImportStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [lastImportMeta, setLastImportMeta] = useState<{ mro: string; nhaPN: string; roNumber: string; serialNumber: string } | null>(null);
  const [lastQuoteData, setLastQuoteData] = useState<QuoteData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfImport = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      setImportError('Please drop a PDF file.');
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
      return;
    }
    setImportStatus('uploading');
    setImportError('');
    try {
      const form = new FormData();
      form.append('pdf', file);
      const res = await fetch('/api/pdf-import', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || 'Import failed');
        setImportStatus('error');
        setTimeout(() => setImportStatus('idle'), 4000);
        return;
      }
      // Pre-fill the Input Data form
      setActiveTab('input');
      if (data.nhaPN) setInputNha(data.nhaPN);
      if (data.roNumber) setInputRo(data.roNumber);
      if (data.serialNumber) setInputSn(data.serialNumber);
      if (data.subcomponents && data.subcomponents.length > 0) {
        setInputParts(data.subcomponents.map((s: { partNumber: string }) => ({
          id: rowCounter++,
          partNumber: s.partNumber,
        })));
      }
      // Store full quote data for CSV export
      setLastImportMeta({ mro: data.mro, nhaPN: data.nhaPN, roNumber: data.roNumber, serialNumber: data.serialNumber });
      setLastQuoteData(data.quoteData ?? null);
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 3000);
    } catch {
      setImportError('Network error during import.');
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 4000);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePdfImport(file);
  };

  // Input tab handlers
  const addInputRow = () => setInputParts(p => [...p, { id: rowCounter++, partNumber: '', price: '' }]);
  const updateInputPrice = (id: number, price: string) =>
    setInputParts(p => p.map(r => r.id === id ? { ...r, price } : r));

  const removeInputRow = (id: number) => {
    if (inputParts.length <= 1) return;
    setInputParts(p => p.filter(r => r.id !== id));
  };

  const updateInputPart = (id: number, value: string) => {
    setInputParts(p => p.map(r => r.id === id ? { ...r, partNumber: value.toUpperCase() } : r));
  };

  const handleSave = async () => {
    const nha = inputNha.trim().toUpperCase();
    const sn = inputSn.trim();
    if (!nha || !sn) return;

    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/batch?nha=${encodeURIComponent(nha)}`);
      const existing: Unit[] = await res.json();
      const parts = inputParts.filter(r => r.partNumber.trim());
      const snExists = Array.isArray(existing) && existing.some(u => u.serialNumber === sn);

      let updatedUnits: Unit[];
      if (snExists) {
        updatedUnits = existing.map(u => u.serialNumber === sn ? {
          ...u,
          roNumber: inputRo.trim(),
          subcomponents: parts,
          savedAt: new Date().toISOString(),
        } : u);
      } else {
        const newUnit: Unit = {
          id: unitCounter++,
          nhaPN: nha,
          roNumber: inputRo.trim(),
          serialNumber: sn,
          subcomponents: parts,
          savedAt: new Date().toISOString(),
        };
        updatedUnits = [...(Array.isArray(existing) ? existing : []), newUnit];
      }

      await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nha, units: updatedUnits }),
      });

      // Forward prices to parts_master (non-blocking, silent fail)
      const priceRows = parts.filter(r => r.price && !isNaN(parseFloat(r.price!)));
      if (priceRows.length > 0) {
        Promise.all(priceRows.map(r =>
          fetch('/api/parts/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partNumber: r.partNumber, nhaPn: nha, serialNumbers: [], price: parseFloat(r.price!) }),
          })
        )).catch(() => {});
      }

      setSaveStatus(snExists ? 'updated' : 'saved');
      if (!snExists) {
        setInputSn('');
        setInputRo('');
        setInputParts(newSubRows());
      }
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Check tab handlers
  const addCheckRow = () => setCheckParts(p => [...p, { id: rowCounter++, partNumber: '' }]);
  const removeCheckRow = (id: number) => {
    if (checkParts.length <= 1) return;
    setCheckParts(p => p.filter(r => r.id !== id));
  };
  const updateCheckPart = (id: number, value: string) => {
    setCheckParts(p => p.map(r => r.id === id ? { ...r, partNumber: value.toUpperCase() } : r));
  };

  const handleAssignDonor = async (donorPn: string, unitSn: string, sn: string) => {
    const nha = checkNha.trim().toUpperCase();
    await fetch('/api/batch/donors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nhaPn: nha, donorPn, unitSn, sn }),
    });
    if (unitSn) {
      setDonorAssignments(prev => ({ ...prev, [donorPn]: { unitSn, sn: sn.trim().toUpperCase() } }));
    } else {
      setDonorAssignments(prev => { const n = { ...prev }; delete n[donorPn]; return n; });
    }
    setAssignModal(null);
    setAssignSnInput('');
  };

  const handleAnalyze = async () => {
    const nha = checkNha.trim().toUpperCase();
    const pnsToCheck = checkParts.map(r => r.partNumber.trim().toUpperCase()).filter(Boolean);
    if (!nha) return;

    setLoadStatus('loading');
    try {
      const res = await fetch(`/api/batch?nha=${encodeURIComponent(nha)}`);
      const units: Unit[] = await res.json();

      if (!Array.isArray(units) || units.length === 0) {
        setDonorResults([]);
        setAnalyzed(true);
        setLoadStatus('idle');
        return;
      }

      const pnList = pnsToCheck.length > 0
        ? pnsToCheck
        : Array.from(new Set(units.flatMap(u => u.subcomponents.map(r => r.partNumber.trim().toUpperCase()).filter(Boolean)))).sort();

      const results = pnList.map(pn => {
        const donors = units
          .filter(u => !u.subcomponents.some(r => r.partNumber.trim().toUpperCase() === pn))
          .map(u => ({ sn: u.serialNumber, ro: u.roNumber || '' }));
        return { partNumber: pn, donors };
      }).filter(r => r.donors.length > 0);

      setDonorResults(results);

      // Fetch any saved donor assignments for this NHA
      try {
        const assignRes = await fetch(`/api/batch/donors?nha=${encodeURIComponent(nha)}`);
        const assignData = await assignRes.json();
        setDonorAssignments(assignData || {});
      } catch {
        setDonorAssignments({});
      }

      setAnalyzed(true);
      setLoadStatus('idle');
    } catch {
      setLoadStatus('error');
    }
  };

  const saveLabel = {
    idle: 'Save',
    saving: 'Saving...',
    saved: '✓ Added',
    updated: '✓ Updated',
    error: 'Error',
  }[saveStatus];

  const hasInputData = inputNha.trim() && inputSn.trim();

  return (
    <main className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-amber-500 hover:text-amber-400 transition text-sm">← Home</Link>
            <h1 className="text-3xl font-serif font-bold text-amber-50">Batch Analysis</h1>
          </div>
          <img src="https://img1.wsimg.com/isteam/ip/22a41c88-4c5a-41fe-a782-e6cf34ada0e3/blob-a3604fd.png/:/rs=w:98,h:98,cg:true,m/cr=w:98,h:98/qt=q:95" alt="Skytop Aero" className="h-20 w-20" />
        </div>

        {/* PDF Import Drop Zone */}
        <div
          className={`mb-6 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
            dragOver ? 'border-amber-500 bg-amber-950/20' : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfImport(f); e.target.value = ''; }}
          />
          <div className="py-6 px-4 text-center">
            {importStatus === 'uploading' && (
              <p className="text-amber-400 text-sm font-medium">⏳ Extracting from PDF...</p>
            )}
            {importStatus === 'success' && (
              <div className="flex items-center justify-center gap-4">
                <p className="text-green-400 text-sm font-medium">✓ Fields pre-filled from PDF</p>
                {lastQuoteData && lastImportMeta && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      const csv = generateCSV(lastImportMeta, lastQuoteData);
                      const filename = `${lastImportMeta.roNumber || 'quote'}_${lastImportMeta.nhaPN || 'export'}.csv`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
                      downloadCSV(csv, filename);
                    }}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-amber-400 font-medium px-3 py-1.5 rounded-lg transition"
                  >
                    ↓ Export CSV
                  </button>
                )}
              </div>
            )}
            {importStatus === 'error' && (
              <p className="text-red-400 text-sm font-medium">✗ {importError}</p>
            )}
            {importStatus === 'idle' && (
              <>
                <p className="text-slate-400 text-sm">📄 Drop a repair quote PDF here, or click to browse</p>
                <p className="text-slate-600 text-xs mt-1">Supports: MTI · Heico · Summit</p>
              </>
            )}
          </div>
        </div>

        {/* Persistent CSV export — visible after any successful import */}
        {lastQuoteData && lastImportMeta && importStatus !== 'uploading' && (
          <div className="mb-4 flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-2.5">
            <span className="text-xs text-slate-400 font-mono">
              {lastImportMeta.mro} · {lastImportMeta.nhaPN} · {lastImportMeta.roNumber}
              {lastQuoteData.laborCost !== null ? ` · Labor: $${lastQuoteData.laborCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
              {lastQuoteData.totalCost !== null ? ` · Total: $${lastQuoteData.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
            </span>
            <button
              onClick={() => {
                const csv = generateCSV(lastImportMeta!, lastQuoteData!);
                const filename = `${lastImportMeta!.roNumber || 'quote'}_${lastImportMeta!.nhaPN || 'export'}.csv`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
                downloadCSV(csv, filename);
              }}
              className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold px-3 py-1.5 rounded-lg transition"
            >
              ↓ Export CSV
            </button>
          </div>
        )}

        {/* Main card with tabs */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-lg overflow-hidden">

          {/* Tab headers */}
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setActiveTab('input')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'input'
                  ? 'text-amber-500 border-b-2 border-amber-500 bg-slate-800'
                  : 'text-slate-400 hover:text-slate-300 bg-slate-900'
              }`}
            >
              Input Data
            </button>
            <button
              onClick={() => setActiveTab('check')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'check'
                  ? 'text-amber-500 border-b-2 border-amber-500 bg-slate-800'
                  : 'text-slate-400 hover:text-slate-300 bg-slate-900'
              }`}
            >
              Check Options
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'manage'
                  ? 'text-amber-500 border-b-2 border-amber-500 bg-slate-800'
                  : 'text-slate-400 hover:text-slate-300 bg-slate-900'
              }`}
            >
              Manage Data
            </button>
          </div>

          {/* Input tab */}
          {activeTab === 'input' && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">NHA Part Number</label>
                  <input
                    className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. 724400-2"
                    value={inputNha}
                    onChange={e => setInputNha(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">RO#</label>
                  <input
                    className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. RO-12345"
                    value={inputRo}
                    onChange={e => setInputRo(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Serial Number</label>
                <input
                  className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. EM599064-P"
                  value={inputSn}
                  onChange={e => setInputSn(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Subcomponents</label>
                <div className="space-y-2">
                  {inputParts.map(row => (
                    <div key={row.id} className="flex items-center gap-2">
                      <input
                        className="flex-1 border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="Part number..."
                        value={row.partNumber}
                        onChange={e => updateInputPart(row.id, e.target.value)}
                      />
                      <input
                        className="w-28 border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="$ price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price || ''}
                        onChange={e => updateInputPrice(row.id, e.target.value)}
                      />
                      {inputParts.length > 1 && (
                        <button onClick={() => removeInputRow(row.id)} className="text-slate-400 hover:text-red-400 transition text-lg leading-none px-1">×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={addInputRow} className="text-xs text-amber-500 hover:text-amber-400 font-medium transition">
                    + Add row
                  </button>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={!hasInputData || saveStatus === 'saving'}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 transition text-sm"
              >
                {saveLabel}
              </button>
            </div>
          )}

          {/* Check tab */}
          {activeTab === 'check' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">NHA Part Number</label>
                <input
                  className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. 724400-2"
                  value={checkNha}
                  onChange={e => { setCheckNha(e.target.value); setAnalyzed(false); }}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Subcomponents to check</label>
                <div className="space-y-2">
                  {checkParts.map(row => (
                    <div key={row.id} className="flex items-center gap-2">
                      <input
                        className="flex-1 border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="Part number..."
                        value={row.partNumber}
                        onChange={e => { updateCheckPart(row.id, e.target.value); setAnalyzed(false); }}
                      />
                      {checkParts.length > 1 && (
                        <button onClick={() => removeCheckRow(row.id)} className="text-slate-400 hover:text-red-400 transition text-lg leading-none px-1">×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={addCheckRow} className="text-xs text-amber-500 hover:text-amber-400 font-medium transition">
                    + Add row
                  </button>
                </div>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!checkNha.trim() || loadStatus === 'loading'}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 transition text-sm"
              >
                {loadStatus === 'loading' ? 'Checking...' : 'Find Donors'}
              </button>

              {analyzed && (
                <div className="space-y-2 pt-2">
                  {donorResults.length > 0 && (
                    donorResults.every(r => r.donors.length === 0) ? (
                      <div className="text-center text-slate-400 py-6 text-sm">No potential donors found.</div>
                    ) : (
                      donorResults.map((result, i) => (
                        result.donors.length > 0 && (
                          <div key={i} className="border border-slate-700 bg-slate-800 rounded-lg px-4 py-3 text-sm">
                            <span className="font-mono font-semibold text-amber-400">{result.partNumber}</span>
                            <span className="text-slate-300">: </span>
                            <span className="font-mono">
                              {result.donors.map((d, di) => {
                                const assignment = donorAssignments[result.partNumber];
                                const isAssigned = assignment?.unitSn === d.sn;
                                return (
                                  <span key={di}>
                                    {di > 0 && <span className="text-slate-500">, </span>}
                                    <span
                                      className={`cursor-pointer hover:opacity-80 transition ${isAssigned ? 'text-red-400' : 'text-slate-100'}`}
                                      onClick={() => {
                                        setAssignModal({ partNumber: result.partNumber, unitSn: d.sn, assigned: isAssigned ? assignment! : null });
                                        setAssignSnInput('');
                                      }}
                                    >
                                      {d.ro ? `${d.sn} (${d.ro})` : d.sn}
                                    </span>
                                  </span>
                                );
                              })}
                            </span>
                          </div>
                        )
                      ))
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manage tab */}
          {activeTab === 'manage' && (
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="NHA Part Number (leave blank for all)"
                  value={manageNha}
                  onChange={e => { setManageNha(e.target.value); setManageStatus('idle'); }}
                  onKeyDown={e => e.key === 'Enter' && handleManageLoad()}
                />
                <button
                  onClick={handleManageLoad}
                  disabled={manageStatus === 'loading'}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-40 transition text-sm"
                >
                  {manageStatus === 'loading' ? 'Loading...' : 'Load'}
                </button>
              </div>

              {manageStatus === 'error' && (
                <p className="text-red-400 text-sm">Failed to load data.</p>
              )}
              {manageStatus === 'empty' && (
                <p className="text-slate-400 text-sm text-center py-4">No units found for this NHA.</p>
              )}
              {manageStatus === 'loaded' && (
                <div className="space-y-3">
                  {manageUnits.map(unit => (
                    <div key={unit.serialNumber} className="border border-slate-700 rounded-lg overflow-hidden">
                      {/* Unit header */}
                      <div className="flex items-center justify-between bg-slate-800 px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-semibold text-slate-100">{unit.serialNumber}</span>
                          {unit.roNumber && <span className="text-xs text-slate-400">{unit.roNumber}</span>}
                          <span className="text-xs text-slate-500">{unit.subcomponents.length} parts</span>
                        </div>
                        <button
                          onClick={() => handleRemoveUnit(unit.serialNumber)}
                          className="text-xs text-red-400 hover:text-red-300 transition px-2 py-1 rounded hover:bg-red-900/20"
                        >
                          Remove unit
                        </button>
                      </div>
                      {/* Subcomponents */}
                      <div className="px-4 py-3 flex flex-wrap gap-2">
                        {unit.subcomponents.length === 0 ? (
                          <span className="text-xs text-slate-500 italic">No subcomponents</span>
                        ) : (
                          unit.subcomponents.map(s => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1.5 font-mono text-xs bg-slate-800 border border-slate-600 text-slate-300 px-2.5 py-1 rounded-full"
                            >
                              {s.partNumber}
                              <button
                                onClick={() => handleRemoveSubcomponent(unit.serialNumber, s.partNumber)}
                                className="text-slate-500 hover:text-red-400 transition leading-none"
                                title={`Remove ${s.partNumber}`}
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Donor assignment modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => { setAssignModal(null); setAssignSnInput(''); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
            {assignModal.assigned ? (
              <>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">Donor Assigned</h3>
                <p className="text-xs text-slate-400 mb-1">Part: <span className="font-mono text-amber-400">{assignModal.partNumber}</span></p>
                <p className="text-xs text-slate-400 mb-1">Unit: <span className="font-mono text-slate-300">{assignModal.unitSn}</span></p>
                {assignModal.assigned?.sn && (
                  <p className="text-xs text-slate-400 mb-4">SN: <span className="font-mono text-red-400">{assignModal.assigned.sn}</span></p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAssignModal(null); setAssignSnInput(''); }}
                    className="flex-1 py-2 text-sm rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAssignDonor(assignModal.partNumber, '', '')}
                    className="flex-1 py-2 text-sm rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold transition"
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">Assign Donor SN</h3>
                <p className="text-xs text-slate-400 mb-1">Part: <span className="font-mono text-amber-400">{assignModal.partNumber}</span></p>
                <p className="text-xs text-slate-400 mb-3">Unit: <span className="font-mono text-slate-300">{assignModal.unitSn}</span></p>
                <input
                  type="text"
                  autoFocus
                  placeholder="Enter serial number..."
                  value={assignSnInput}
                  onChange={e => setAssignSnInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && assignSnInput.trim() && handleAssignDonor(assignModal.partNumber, assignModal.unitSn, assignSnInput)}
                  className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAssignModal(null); setAssignSnInput(''); }}
                    className="flex-1 py-2 text-sm rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAssignDonor(assignModal.partNumber, assignModal.unitSn, assignSnInput)}
                    disabled={!assignSnInput.trim()}
                    className="flex-1 py-2 text-sm rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    OK
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
