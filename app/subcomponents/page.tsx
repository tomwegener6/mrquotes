'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

interface AssemblyOccurrence {
  nha_pn: string;
  occurrences: number;
  units: string[];
}

interface PartRecord {
  part_number: string;
  assemblies: AssemblyOccurrence[];
  total_occurrences: number;
  first_seen: string;
  last_seen: string;
  prices?: number[];
}

interface InventoryItem {
  uid: string;
  sn: string;
  conditionCode: string;
  location: string;
  qtyAvailable: number;
  qtyOnRepair: number;
  pn: string;
}

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v-1a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v1zm5-1v1H6V.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1z"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 16 16">
      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
    </svg>
  );
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

export default function SubcomponentsPage() {
  const [mode, setMode] = useState<'nha' | 'part' | 'add'>('nha');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [asmDropdownOpen, setAsmDropdownOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const invTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add Data form state
  const [addNha, setAddNha] = useState('');
  const [addParts, setAddParts] = useState([{ id: 1, value: '', price: '' }]);
  const [addStatus, setAddStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const addPartIdRef = useRef(2);

  const addPartRow = () => setAddParts(p => [...p, { id: addPartIdRef.current++, value: '', price: '' }]);
  const removePartRow = (id: number) => setAddParts(p => p.filter(r => r.id !== id));
  const updatePartRow = (id: number, value: string) =>
    setAddParts(p => p.map(r => r.id === id ? { ...r, value: value.toUpperCase() } : r));
  const updatePartPrice = (id: number, price: string) =>
    setAddParts(p => p.map(r => r.id === id ? { ...r, price } : r));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nhaPn = addNha.trim().toUpperCase();
    const partNumbers = addParts.map(r => r.value.trim().toUpperCase()).filter(Boolean);
    if (!nhaPn || partNumbers.length === 0) return;

    setAddStatus('saving');
    try {
      const results = await Promise.all(
        addParts
          .filter(r => r.value.trim())
          .map(row => {
            const partNumber = row.value.trim().toUpperCase();
            const price = row.price ? parseFloat(row.price) : undefined;
            return fetch('/api/parts/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ partNumber, nhaPn, serialNumbers: [], ...(price && !isNaN(price) ? { price } : {}) }),
            });
          })
      );
      if (results.every(r => r.ok)) {
        setAddStatus('saved');
        setAddNha('');
        setAddParts([{ id: 1, value: '', price: '' }]);
        setTimeout(() => setAddStatus('idle'), 3000);
      } else {
        setAddStatus('error');
        setTimeout(() => setAddStatus('idle'), 3000);
      }
    } catch {
      setAddStatus('error');
      setTimeout(() => setAddStatus('idle'), 3000);
    }
  };

  // NHA mode results
  const [nhaSubcomponents, setNhaSubcomponents] = useState<{ partNumber: string; units: string[]; avgPrice: number | null }[]>([]);

  // Part mode results
  const [partData, setPartData] = useState<PartRecord | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [nhaInventoryMap, setNhaInventoryMap] = useState<Record<string, InventoryItem[]>>({});  // Map of NHA → inventory items

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const openInv = () => { if (invTimerRef.current) clearTimeout(invTimerRef.current); setDropdownOpen(true); };
  const closeInv = () => { invTimerRef.current = setTimeout(() => setDropdownOpen(false), 150); };
  const openAsm = () => { if (asmTimerRef.current) clearTimeout(asmTimerRef.current); setAsmDropdownOpen(true); };
  const closeAsm = () => { asmTimerRef.current = setTimeout(() => setAsmDropdownOpen(false), 150); };

  const handleDelete = async (partNumber: string, nhaPn?: string) => {
    const msg = nhaPn
      ? `Remove ${partNumber} from ${nhaPn}?`
      : `Delete all records for ${partNumber}? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch('/api/parts/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumber, nhaPn }),
      });
      if (res.ok) {
        if (!nhaPn) {
          setPartData(null);
          setInventoryItems([]);
          setSearched(false);
        } else {
          setPartData(prev => prev ? {
            ...prev,
            assemblies: prev.assemblies.filter(a => a.nha_pn !== nhaPn),
            total_occurrences: prev.assemblies.filter(a => a.nha_pn !== nhaPn).reduce((s, a) => s + a.occurrences, 0),
          } : null);
        }
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleDeleteFromNha = async (partNumber: string, currentNha: string) => {
    if (!window.confirm(`Remove ${partNumber} from ${currentNha}?`)) return;
    try {
      const res = await fetch('/api/parts/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumber, nhaPn: currentNha }),
      });
      if (res.ok) {
        setNhaSubcomponents(prev => prev.filter(item => item.partNumber !== partNumber));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toUpperCase();
    if (!query) return;

    setLoading(true);
    setSearched(true);
    setNotFound(false);
    setNhaSubcomponents([]);
    setPartData(null);
    setInventoryItems([]);
    setDropdownOpen(false);
    setAsmDropdownOpen(false);

    try {
      if (mode === 'nha') {
        const res = await fetch(`/api/parts?nha=${encodeURIComponent(query)}`);
        const results: { partNumber: string; units: string[]; avgPrice: number | null }[] = await res.json();
        if (!Array.isArray(results) || results.length === 0) {
          setNotFound(true);
        } else {
          const sorted = [...results].sort(
            (a, b) => b.units.length - a.units.length || a.partNumber.localeCompare(b.partNumber)
          );
          setNhaSubcomponents(sorted);
        }
      } else {
        const [partRes, invRes] = await Promise.all([
          fetch(`/api/parts?part=${encodeURIComponent(query)}`),
          fetch(`/api/inventory?part=${encodeURIComponent(query)}`),
        ]);
        const data = await partRes.json();
        const invData = await invRes.json();
        if (data && data.part_number) {
          setPartData(data);
          setInventoryItems(Array.isArray(invData) ? invData : []);
          // Fetch NHA inventory for Assemblies dropdown
          if (data.assemblies?.length) {
            const nhaMap: Record<string, InventoryItem[]> = {};
            await Promise.all(data.assemblies.map(async (asm: { nha_pn: string }) => {
              try {
                const r = await fetch(`/api/inventory?nha=${encodeURIComponent(asm.nha_pn)}`);
                const d = await r.json();
                nhaMap[asm.nha_pn] = Array.isArray(d) ? d : [];
              } catch {
                nhaMap[asm.nha_pn] = [];
              }
            }));
            setNhaInventoryMap(nhaMap);
          } else {
            setNhaInventoryMap({});
          }
        } else {
          setNotFound(true);
          setInventoryItems([]);
          setNhaInventoryMap({});
        }
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/parts');
      const data: Record<string, PartRecord> = await res.json();
      const rows = ['Part Number,NHA PN,Units,Occurrences,First Seen,Last Seen'];
      for (const part of Object.values(data)) {
        for (const asm of part.assemblies) {
          rows.push([
            `"${part.part_number}"`,
            `"${asm.nha_pn}"`,
            `"${asm.units.join(', ')}"`,
            asm.occurrences,
            part.first_seen,
            part.last_seen,
          ].join(','));
        }
      }
      const date = new Date().toISOString().split('T')[0];
      downloadCSV(rows.join('\n'), `parts_master_${date}.csv`);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const resetMode = (m: 'nha' | 'part' | 'add') => {
    setMode(m);
    setSearched(false);
    setSearchQuery('');
    setNhaSubcomponents([]);
    setPartData(null);
    setInventoryItems([]);
  };

  return (
    <main className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-amber-500 hover:text-amber-400 transition text-sm">
              ← Home
            </Link>
            <h1 className="text-3xl font-serif font-bold text-amber-50">Subcomponent Data</h1>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-amber-400 font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-40"
            >
              {downloading ? 'Exporting...' : '↓ Export CSV'}
            </button>
          </div>
          <img
            src="https://img1.wsimg.com/isteam/ip/22a41c88-4c5a-41fe-a782-e6cf34ada0e3/blob-a3604fd.png/:/rs=w:98,h:98,cg:true,m/cr=w:98,h:98/qt=q:95"
            alt="Skytop Aero"
            className="h-20 w-20"
          />
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-lg p-6 space-y-6">
          {/* Mode tabs */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button
              onClick={() => resetMode('nha')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === 'nha' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              NHA → Subcomponents
            </button>
            <button
              onClick={() => resetMode('part')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === 'part' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              Subcomponents → NHA
            </button>
            <button
              onClick={() => resetMode('add')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === 'add' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              + Add Data
            </button>
          </div>

          {/* Add Data form */}
          {mode === 'add' && (
            <form onSubmit={handleAdd} className="space-y-4">
              <p className="text-slate-400 text-sm">Add subcomponent data directly to the research database.</p>
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">NHA Part Number</label>
                <input
                  className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. 66087"
                  value={addNha}
                  onChange={e => setAddNha(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Subcomponent Part Numbers</label>
                <div className="space-y-2">
                  {addParts.map(row => (
                    <div key={row.id} className="flex items-center gap-2">
                      <input
                        className="flex-1 border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="e.g. 5001234-01"
                        value={row.value}
                        onChange={e => updatePartRow(row.id, e.target.value)}
                      />
                      <input
                        className="w-28 border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="$ price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price}
                        onChange={e => updatePartPrice(row.id, e.target.value)}
                      />
                      {addParts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePartRow(row.id)}
                          className="text-slate-400 hover:text-red-400 transition text-lg leading-none px-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addPartRow}
                    className="text-xs text-amber-500 hover:text-amber-400 font-medium transition"
                  >
                    + Add part
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={!addNha.trim() || addParts.every(r => !r.value.trim()) || addStatus === 'saving'}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 transition text-sm"
              >
                {addStatus === 'saving' ? 'Saving...' : addStatus === 'saved' ? '✓ Saved' : addStatus === 'error' ? 'Error — try again' : 'Save to Database'}
              </button>
            </form>
          )}

          {/* Search form */}
          {mode !== 'add' && (
            <div>
              <p className="text-slate-400 text-sm mb-4">
                {mode === 'nha'
                  ? "Enter an NHA part number to see all subcomponents we've recorded for it."
                  : 'Enter a subcomponent part number to see which NHAs it belongs to.'}
              </p>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder={mode === 'nha' ? 'Enter NHA part number...' : 'Enter subcomponent...'}
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value.toUpperCase()); setSearched(false); }}
                  className="flex-1 border border-slate-600 bg-slate-800 rounded-lg px-4 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-6 py-2.5 rounded-lg disabled:opacity-40 transition text-sm"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </form>
            </div>
          )}

          {searched && loading && (
            <div className="text-center py-8 text-slate-400">⏳ Searching...</div>
          )}

          {searched && !loading && notFound && (
            <div className="text-center py-8 text-slate-400">
              No data found for <span className="font-mono text-amber-400">{searchQuery}</span>
            </div>
          )}

          {/* NHA → Subcomponents results */}
          {mode === 'nha' && nhaSubcomponents.length > 0 && !loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">
                  Subcomponents in <span className="font-mono text-amber-400">{searchQuery}</span>
                </h3>
                <span className="text-xs text-slate-500">{nhaSubcomponents.length} unique parts</span>
              </div>
              <div className="space-y-1.5">
                {nhaSubcomponents.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border border-slate-700 bg-slate-800 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-sm font-semibold text-amber-400">{item.partNumber}</span>
                      <span className={`text-xs font-mono ${item.avgPrice != null ? 'text-slate-400' : 'text-slate-600'}`}>
                        {item.avgPrice != null ? `avg $${item.avgPrice.toFixed(2)}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <button
                        onClick={() => handleCopy(item.partNumber, `nha-sub-${i}`)}
                        className="text-slate-500 hover:text-amber-400 transition"
                        title="Copy"
                      >
                        {copiedKey === `nha-sub-${i}` ? <CheckIcon /> : <CopyIcon />}
                      </button>
                      <button
                        onClick={() => handleDeleteFromNha(item.partNumber, searchQuery)}
                        className="text-slate-600 hover:text-red-400 transition"
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subcomponents → NHA results */}
          {mode === 'part' && partData && !loading && (
            <div className="space-y-4">
              <div className="border-b border-slate-700 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-mono font-semibold text-amber-400">{partData.part_number}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">
                      Seen in {partData.total_occurrences} unit{partData.total_occurrences !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => handleDelete(partData.part_number)}
                      className="text-slate-600 hover:text-red-400 transition"
                      title="Delete all records for this part"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">First Seen</span>
                    <p className="text-slate-300 font-mono">{partData.first_seen}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Last Seen</span>
                    <p className="text-slate-300 font-mono">{partData.last_seen}</p>
                  </div>
                  {/* Assemblies — shows all NHAs with inventory split by available/on-repair */}
                  <div
                    className="relative"
                    onMouseEnter={openAsm}
                    onMouseLeave={closeAsm}
                  >
                    <span className="text-slate-500">Assemblies</span>
                    <div className={`font-semibold ${partData.assemblies.length > 0 ? 'text-amber-400 cursor-pointer underline decoration-dotted' : 'text-slate-500'}`}>
                      {partData.assemblies.length}
                    </div>
                    {asmDropdownOpen && partData.assemblies.length > 0 && (
                      <div
                        className="absolute top-full left-0 z-50 w-80 bg-slate-800 border border-amber-500 rounded-lg shadow-2xl"
                        onMouseEnter={openAsm}
                        onMouseLeave={closeAsm}
                      >
                        <div className="max-h-96 overflow-y-auto space-y-3 p-3">
                          {partData.assemblies.map((asm) => {
                            const nhaInv = nhaInventoryMap[asm.nha_pn] || [];
                            const available = nhaInv.filter(i => i.qtyAvailable > 0);
                            const onRepair = nhaInv.filter(i => i.qtyOnRepair > 0);
                            return (
                              <div key={asm.nha_pn} className="border border-slate-700 rounded-lg overflow-hidden">
                                <div className="bg-slate-700/40 px-3 py-2 border-b border-slate-700 text-xs font-semibold text-amber-400 font-mono">{asm.nha_pn}</div>
                                {available.length > 0 && (
                                  <div>
                                    <div className="px-3 py-1.5 bg-slate-800 text-xs text-green-400 font-semibold border-b border-slate-700/50">Available ({available.length})</div>
                                    <div className="max-h-32 overflow-y-auto">
                                      {available.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between px-3 py-2 hover:bg-slate-700 transition group border-b border-slate-700/30 last:border-0 text-xs font-mono">
                                          <div className="min-w-0 flex-1">
                                            <span className="text-slate-300">{item.sn || '—'}</span> <span className="text-amber-400">{item.uid}</span>
                                          </div>
                                          <button
                                            onClick={e => { e.stopPropagation(); handleCopy(item.uid, `asm-avail-${asm.nha_pn}-${idx}`); }}
                                            className="ml-2 shrink-0 text-slate-500 hover:text-amber-400 transition opacity-0 group-hover:opacity-100"
                                            title="Copy UID"
                                          >
                                            {copiedKey === `asm-avail-${asm.nha_pn}-${idx}` ? <CheckIcon /> : <CopyIcon />}
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {onRepair.length > 0 && (
                                  <div>
                                    <div className="px-3 py-1.5 bg-slate-800 text-xs text-amber-400 font-semibold border-t border-slate-700/50">On Repair ({onRepair.length})</div>
                                    <div className="max-h-32 overflow-y-auto">
                                      {onRepair.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between px-3 py-2 hover:bg-slate-700 transition group border-b border-slate-700/30 last:border-0 text-xs font-mono">
                                          <div className="min-w-0 flex-1">
                                            <span className="text-slate-300">{item.sn || '—'}</span> <span className="text-amber-400">{item.uid}</span>
                                          </div>
                                          <button
                                            onClick={e => { e.stopPropagation(); handleCopy(item.uid, `asm-repair-${asm.nha_pn}-${idx}`); }}
                                            className="ml-2 shrink-0 text-slate-500 hover:text-amber-400 transition opacity-0 group-hover:opacity-100"
                                            title="Copy UID"
                                          >
                                            {copiedKey === `asm-repair-${asm.nha_pn}-${idx}` ? <CheckIcon /> : <CopyIcon />}
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {available.length === 0 && onRepair.length === 0 && (
                                  <div className="px-3 py-2 text-xs text-slate-500 italic">No inventory found</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* In Inventory — shows subcomponent PN directly in inventory, split by available/on-repair */}
                  <div
                    className="relative"
                    onMouseEnter={openInv}
                    onMouseLeave={closeInv}
                  >
                    <span className="text-slate-500">In Inventory</span>
                    <div className={`font-semibold ${(inventoryItems.filter(i => i.qtyAvailable > 0).length + inventoryItems.filter(i => i.qtyOnRepair > 0).length) > 0 ? 'text-amber-400 cursor-pointer underline decoration-dotted' : 'text-slate-500'}`}>
                      {inventoryItems.filter(i => i.qtyAvailable > 0).length}
                    </div>
                    {dropdownOpen && (inventoryItems.filter(i => i.qtyAvailable > 0).length > 0 || inventoryItems.filter(i => i.qtyOnRepair > 0).length > 0) && (
                      <div
                        className="absolute top-full left-0 z-50 w-80 bg-slate-800 border border-amber-500 rounded-lg shadow-2xl"
                        onMouseEnter={openInv}
                        onMouseLeave={closeInv}
                      >
                        {inventoryItems.filter(i => i.qtyAvailable > 0).length > 0 && (
                          <div className="border-b border-slate-600">
                            <div className="px-3 pt-2 pb-1 text-xs font-semibold text-green-400 uppercase tracking-wide">
                              In Inventory - Available ({inventoryItems.filter(i => i.qtyAvailable > 0).length})
                            </div>
                            <div className="grid grid-cols-3 gap-x-3 px-3 pb-2 text-xs text-slate-600 font-mono">
                              <span>PN</span><span>SN</span><span>INV</span>
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                              {inventoryItems.filter(i => i.qtyAvailable > 0).map((item, i) => (
                                <div key={i} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-700 transition group border-b border-slate-700/50 last:border-0">
                                  <div className="min-w-0 grid grid-cols-3 gap-x-3 flex-1 text-xs font-mono">
                                    <span className="text-slate-300 truncate" title={item.pn}>{item.pn}</span>
                                    <span className="text-slate-400 truncate" title={item.sn}>{item.sn || '—'}</span>
                                    <span className="text-amber-400 truncate" title={item.uid}>{item.uid}</span>
                                  </div>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleCopy(item.uid, `inv-avail-${i}`); }}
                                    className="ml-3 shrink-0 text-slate-500 hover:text-amber-400 transition opacity-0 group-hover:opacity-100"
                                    title="Copy Inventory UID"
                                  >
                                    {copiedKey === `inv-avail-${i}` ? <CheckIcon /> : <CopyIcon />}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {inventoryItems.filter(i => i.qtyOnRepair > 0).length > 0 && (
                          <div className={inventoryItems.filter(i => i.qtyAvailable > 0).length > 0 ? 'border-t border-slate-600' : ''}>
                            <div className="px-3 pt-2 pb-1 text-xs font-semibold text-amber-400 uppercase tracking-wide">
                              In Inventory - On Repair ({inventoryItems.filter(i => i.qtyOnRepair > 0).length})
                            </div>
                            <div className="grid grid-cols-3 gap-x-3 px-3 pb-2 text-xs text-slate-600 font-mono">
                              <span>PN</span><span>SN</span><span>INV</span>
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                              {inventoryItems.filter(i => i.qtyOnRepair > 0).map((item, i) => (
                                <div key={i} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-700 transition group border-b border-slate-700/50 last:border-0">
                                  <div className="min-w-0 grid grid-cols-3 gap-x-3 flex-1 text-xs font-mono">
                                    <span className="text-slate-300 truncate" title={item.pn}>{item.pn}</span>
                                    <span className="text-slate-400 truncate" title={item.sn}>{item.sn || '—'}</span>
                                    <span className="text-amber-400 truncate" title={item.uid}>{item.uid}</span>
                                  </div>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleCopy(item.uid, `inv-repair-${i}`); }}
                                    className="ml-3 shrink-0 text-slate-500 hover:text-amber-400 transition opacity-0 group-hover:opacity-100"
                                    title="Copy Inventory UID"
                                  >
                                    {copiedKey === `inv-repair-${i}` ? <CheckIcon /> : <CopyIcon />}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Found In — NHAs only, copy icon */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Found In:</h3>
                <div className="space-y-2">
                  {partData.assemblies.map((asm, idx) => (
                    <div key={idx} className="border border-slate-700 bg-slate-800 rounded-lg px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-amber-400">{asm.nha_pn}</span>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <button
                            onClick={() => handleCopy(asm.nha_pn, `found-in-${idx}`)}
                            className="text-slate-500 hover:text-amber-400 transition"
                            title="Copy NHA"
                          >
                            {copiedKey === `found-in-${idx}` ? <CheckIcon /> : <CopyIcon />}
                          </button>
                          <button
                            onClick={() => handleDelete(partData.part_number, asm.nha_pn)}
                            className="text-slate-600 hover:text-red-400 transition"
                            title="Remove from this NHA"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {partData.assemblies.length > 1 && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg px-4 py-3 text-sm">
                  <span className="text-green-400 font-semibold">✓ Cross-assembly part</span>
                  <p className="text-green-300 text-xs mt-1">
                    This part exists in {partData.assemblies.length} different assemblies — potential sourcing overlap.
                  </p>
                </div>
              )}
            </div>
          )}

          {!searched && mode !== 'add' && (
            <div className="text-center py-8 text-slate-500 text-sm">
              {mode === 'nha'
                ? 'Enter an NHA part number to see its recorded subcomponents.'
                : 'Enter a subcomponent to see which NHAs it belongs to.'}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
