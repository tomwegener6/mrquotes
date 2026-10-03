'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { mockQuotes, partMaster } from '@/lib/mockData';
import { analyzeQuote, findRelatedAssemblies, findAlternateSavings, formatCurrency, formatPercent } from '@/lib/analysis';
import { SavingsAlert, RelatedAssemblyAlert, AlternateSavingsAlert, Subcomponent, MarketPrice } from '@/lib/types';

interface QuoteForm {
  mroName: string;
  mainPartNumber: string;
  serialNumber: string;
  description: string;
  laborCost: string;
  miscCost: string;
  quoteDate: string;
  subcomponents: SubcomponentRow[];
}

interface SubcomponentRow {
  id: number;
  partNumber: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface AlternateMatch {
  partNumber: string;
  relationship: string;
  matchType: 'primary' | 'alternate';
}

const HISTORY_KEY = 'mrquotes-quote-history';

let rowCounter = 2;

function emptyRow(id?: number): SubcomponentRow {
  return { id: id ?? rowCounter++, partNumber: '', description: '', quantity: '1', unitPrice: '' };
}

function emptyForm(): QuoteForm {
  return {
    mroName: '',
    mainPartNumber: '',
    serialNumber: '',
    description: '',
    laborCost: '',
    miscCost: '',
    quoteDate: new Date().toISOString().split('T')[0],
    subcomponents: [emptyRow(1)],
  };
}

function loadQuoteHistory(): QuoteForm[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QuoteForm[];
  } catch {
    return [];
  }
}

function isFormMeaningful(form: QuoteForm): boolean {
  const hasSN = form.serialNumber.trim().length > 0;
  const hasIdentifier = form.mroName.trim().length > 0 || form.mainPartNumber.trim().length > 0;
  const hasSubcomponents = form.subcomponents.some(r => r.partNumber.trim().length > 0);
  return hasSN && hasIdentifier && hasSubcomponents;
}

function saveQuoteToHistory(form: QuoteForm): void {
  if (!isFormMeaningful(form)) return; // Don't save partial/empty forms
  try {
    const history = loadQuoteHistory();
    // Remove old entry with same SN if it exists, then add new one
    const filtered = history.filter(q => q.serialNumber !== form.serialNumber);
    filtered.push(form);
    // Keep last 50 quotes
    const trimmed = filtered.slice(Math.max(0, filtered.length - 50));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* storage full */ }
}

function getSNSuggestions(input: string): QuoteForm[] {
  if (!input.trim()) return [];
  const history = loadQuoteHistory();
  const query = input.trim().toUpperCase();
  return history
    .filter(q => q.serialNumber.toUpperCase().startsWith(query))
    .sort((a, b) => b.serialNumber.localeCompare(a.serialNumber)) // Most recent first
    .slice(0, 5); // Limit to 5 suggestions
}

function formFromMock(): QuoteForm {
  const q = mockQuotes[0];
  return {
    mroName: q.mroName,
    mainPartNumber: q.mainPartNumber,
    serialNumber: "",
    description: q.description,
    laborCost: String(q.laborCost),
    miscCost: "",
    quoteDate: q.quoteDate,
    subcomponents: q.subcomponents.map((s, i) => ({
      id: i + 1,
      partNumber: s.partNumber,
      description: s.description,
      quantity: String(s.quantity),
      unitPrice: String(s.unitPrice),
    })),
  };
}

function MarketDataBadge({ pn, marketPrices }: { pn: string; marketPrices: MarketPrice[] }) {
  if (!pn.trim()) return null;
  const matches = marketPrices.filter(m => m.partNumber === pn.trim().toUpperCase());
  if (matches.length > 0) {
    const latestDate = matches.map(m => m.date).sort().reverse()[0];
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 bg-green-900/30 px-2 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
        {matches.length} quote{matches.length !== 1 ? 's' : ''} · {latestDate}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" />
      No quotes available
    </span>
  );
}

interface BatchDonorResult {
  partNumber: string;
  donors: { sn: string; ro: string }[];
}

export default function AnalyzePage() {
  const [form, setForm] = useState<QuoteForm>(emptyForm);
  const [snSuggestions, setSnSuggestions] = useState<QuoteForm[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const [analyzed, setAnalyzed] = useState(false);
  const [alerts, setAlerts] = useState<SavingsAlert[]>([]);
  const [relatedAlerts, setRelatedAlerts] = useState<RelatedAssemblyAlert[]>([]);
  const [batchDonors, setBatchDonors] = useState<BatchDonorResult[] | null>(null);
  const [batchStatus, setBatchStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<MarketPrice[]>([]);
  const [marketStatus, setMarketStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [alternates, setAlternates] = useState<AlternateMatch[]>([]);
  const [alternatesStatus, setAlternatesStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [alternateAlerts, setAlternateAlerts] = useState<AlternateSavingsAlert[]>([]);
  const [savingsCollapsed, setSavingsCollapsed] = useState(false);
  const [altSavingsCollapsed, setAltSavingsCollapsed] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<{ inventoryLine: string; partNumber: string; serialNumber: string; keyword: string; condition: string; quantityAvailable: string }[]>([]);
  const [inventoryStatus, setInventoryStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Auto-save form to history with debounce (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveQuoteToHistory(form);
    }, 500);
    return () => clearTimeout(timer);
  }, [form]);

  // Load market data from quotes.json on mount
  useEffect(() => {
    const loadMarketData = async () => {
      try {
        const res = await fetch('/api/quotes');
        if (!res.ok) throw new Error('Failed to load quotes');
        const data = await res.json();
        setMarketData(data);
        setMarketStatus('done');
      } catch (err) {
        console.error('Error loading market data:', err);
        setMarketStatus('error');
      }
    };
    loadMarketData();
  }, []);

  const updateHeader = (field: keyof Omit<QuoteForm, 'subcomponents'>, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setAnalyzed(false);
    
    // Handle SN field: show suggestions as user types
    if (field === 'serialNumber') {
      const suggestions = getSNSuggestions(value);
      setSnSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    }
    
    // Check for alternates when Main Part # changes
    if (field === 'mainPartNumber' && value.trim()) {
      checkAlternates(value.trim());
    } else if (field === 'mainPartNumber') {
      setAlternates([]);
      setAlternatesStatus('idle');
    }
  };

  const selectSnSuggestion = (quote: QuoteForm) => {
    setForm(quote);
    setShowSuggestions(false);
    setSnSuggestions([]);
    setAnalyzed(false);
    // Restore rowCounter
    const maxId = quote.subcomponents.reduce((m, r) => Math.max(m, r.id), 0);
    if (maxId >= rowCounter) rowCounter = maxId + 1;
  };

  const checkAlternates = async (pn: string) => {
    if (!pn) return;
    setAlternatesStatus('loading');
    try {
      const res = await fetch(`/api/alternates?pn=${encodeURIComponent(pn.toUpperCase().trim())}`);
      if (!res.ok) throw new Error('Failed to load alternates');
      const data: AlternateMatch[] = await res.json();
      setAlternates(data);
      setAlternatesStatus('done');
    } catch (err) {
      console.error('Error checking alternates:', err);
      setAlternatesStatus('done');
      setAlternates([]);
    }
  };

  const updateRow = (id: number, field: keyof SubcomponentRow, value: string) => {
    setForm(f => ({
      ...f,
      subcomponents: f.subcomponents.map(r => r.id === id ? { ...r, [field]: value } : r),
    }));
    setAnalyzed(false);
  };

  const addRow = () => {
    setForm(f => ({ ...f, subcomponents: [...f.subcomponents, emptyRow()] }));
  };

  const handlePdfImport = async (file: File) => {
    setPdfStatus('loading');
    setPdfError(null);
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      const res = await fetch('/api/pdf-import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setPdfError(data.error ?? 'Import failed');
        setPdfStatus('error');
        return;
      }
      // Map API response → form
      const items = (data.quoteData?.lineItems ?? []).map((item: {
        partNumber: string; description: string; qty: number; unitPrice: number | null;
      }) => ({
        id: rowCounter++,
        partNumber: item.partNumber ?? '',
        description: item.description ?? '',
        quantity: String(item.qty ?? 1),
        unitPrice: item.unitPrice != null ? String(item.unitPrice) : '',
      }));
      setForm({
        mroName: data.mro ?? '',
        mainPartNumber: data.nhaPN ?? '',
        serialNumber: '',
        description: '',
        laborCost: data.quoteData?.laborCost != null ? String(data.quoteData.laborCost) : '',
        miscCost: '',
        quoteDate: new Date().toISOString().split('T')[0],
        subcomponents: items.length > 0 ? items : [emptyRow()],
      });
      setAnalyzed(false);
      setAlerts([]);
      setRelatedAlerts([]);
      setPdfStatus('done');
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Unknown error');
      setPdfStatus('error');
    }
  };

  const handleCheckBatch = async () => {
    const nha = form.mainPartNumber.trim().toUpperCase();
    if (!nha) return;
    setBatchStatus('loading');
    setBatchDonors(null);
    try {
      const res = await fetch(`/api/batch?nha=${encodeURIComponent(nha)}`);
      const units = await res.json();
      if (!Array.isArray(units) || units.length === 0) {
        setBatchDonors([]);
        setBatchStatus('done');
        return;
      }
      const pnsToCheck = form.subcomponents
        .map(r => r.partNumber.trim().toUpperCase())
        .filter(Boolean);
      if (pnsToCheck.length === 0) {
        setBatchDonors([]);
        setBatchStatus('done');
        return;
      }
      const results: BatchDonorResult[] = pnsToCheck.map(pn => ({
        partNumber: pn,
        donors: units
          .filter((u: { subcomponents: { partNumber: string }[]; serialNumber: string; roNumber: string }) =>
            !u.subcomponents.some((s: { partNumber: string }) =>
              s.partNumber.trim().toUpperCase() === pn
            )
          )
          .map((u: { serialNumber: string; roNumber: string }) => ({ sn: u.serialNumber, ro: u.roNumber || '' })),
      })).filter(r => r.donors.length > 0);
      setBatchDonors(results);
      setBatchStatus('done');
    } catch {
      setBatchStatus('error');
    }
  };

  const removeRow = (id: number) => {
    setForm(f => ({ ...f, subcomponents: f.subcomponents.filter(r => r.id !== id) }));
    setAnalyzed(false);
  };

  const handleAnalyze = async () => {
    const subs: Subcomponent[] = form.subcomponents
      .filter(r => r.partNumber.trim() && r.unitPrice.trim())
      .map(r => ({
        partNumber: r.partNumber.trim().toUpperCase(),
        description: r.description.trim(),
        quantity: parseInt(r.quantity) || 1,
        unitPrice: parseFloat(r.unitPrice) || 0,
        totalPrice: (parseInt(r.quantity) || 1) * (parseFloat(r.unitPrice) || 0),
      }));

    const quote = {
      id: 'manual',
      mroName: form.mroName,
      mainPartNumber: form.mainPartNumber.trim().toUpperCase(),
      description: form.description,
      laborCost: parseFloat(form.laborCost) || 0,
      quoteDate: form.quoteDate,
      subcomponents: subs,
      totalCost: subs.reduce((s, r) => s + r.totalPrice, 0) + (parseFloat(form.laborCost) || 0),
    };

    setAlerts(analyzeQuote(quote, marketData));
    setRelatedAlerts(findRelatedAssemblies(quote, partMaster));

    // Check alternates for each subcomponent against market data
    const subPNs = subs.map(s => s.partNumber).filter(Boolean);
    if (subPNs.length > 0) {
      try {
        const results = await Promise.all(
          subPNs.map(pn =>
            fetch(`/api/alternates?pn=${encodeURIComponent(pn)}`)
              .then(r => r.ok ? r.json() : [])
              .catch(() => [] as AlternateMatch[])
          )
        );
        const alternatesMap: Record<string, { partNumber: string; relationship: string }[]> = {};
        subPNs.forEach((pn, i) => {
          const matches = results[i] as AlternateMatch[];
          if (matches && matches.length > 0) {
            alternatesMap[pn] = matches.map(m => ({ partNumber: m.partNumber, relationship: m.relationship }));
          }
        });
        setAlternateAlerts(findAlternateSavings(subs, alternatesMap, marketData));
      } catch (err) {
        console.error('Error checking alternates during analysis:', err);
        setAlternateAlerts([]);
      }
    } else {
      setAlternateAlerts([]);
    }

    setSelectedOptions({});
    setAnalyzed(true);

    // Inventory check — match subcomponent PNs + main PN, exclude current SN
    const allPNs = [
      ...subs.map(s => s.partNumber),
      form.mainPartNumber.trim().toUpperCase(),
    ].filter(Boolean);
    const excludeSN = form.serialNumber.trim();
    if (allPNs.length > 0) {
      setInventoryStatus('loading');
      try {
        const params = new URLSearchParams({ pns: allPNs.join(',') });
        if (excludeSN) params.set('excludeSN', excludeSN);
        const res = await fetch(`/api/inventory?${params}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setInventoryItems(data);
        setInventoryStatus('done');
      } catch {
        setInventoryStatus('error');
      }
    }
  };

  const handleExportCSV = () => {
    const subs = form.subcomponents.filter(r => r.partNumber.trim());
    const rows: string[][] = [
      ['MRO Name', 'Serial Number', 'Main Part #', 'Description', 'Quote Date', 'Labor Cost', 'Misc Cost'],
      [form.mroName, form.serialNumber, form.mainPartNumber, form.description, form.quoteDate, form.laborCost, form.miscCost],
      [],
      ['Part #', 'Description', 'Quantity', 'Unit Price', 'Total'],
      ...subs.map(r => [
        r.partNumber,
        r.description,
        r.quantity,
        r.unitPrice,
        String((parseInt(r.quantity) || 1) * (parseFloat(r.unitPrice) || 0)),
      ]),
    ];
    if (analyzed && alerts.length > 0) {
      rows.push([], ['--- Savings Opportunities ---'], ['Part #', 'Quoted Price', 'Best Price', 'Best Vendor', 'Savings', 'Savings %']);
      alerts.forEach(a => rows.push([a.partNumber, String(a.quotedPrice), String(a.bestPrice), a.bestVendor, String(a.savings), String(Math.round(a.savingsPercent)) + '%']));
    }
    if (analyzed && alternateAlerts.length > 0) {
      rows.push([], ['--- Alternate Part Savings ---'], ['Original PN', 'Alternate PN', 'Relationship', 'Best Price', 'Savings']);
      alternateAlerts.forEach(a => a.alternates.forEach(alt => rows.push([a.originalPN, alt.alternatePN, alt.relationship ?? '', alt.bestPrice != null ? String(alt.bestPrice) : 'N/A', alt.savings != null ? String(alt.savings) : 'N/A'])));
    }
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mrquotes-${form.serialNumber || 'export'}-${form.quoteDate || new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const subs = form.subcomponents.filter(r => r.partNumber.trim());
    const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const row = (cells: string[], header = false) => {
      const tag = header ? 'th' : 'td';
      return `<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
    };

    const subTable = `
      <table>
        <thead>${row(['Part #', 'Description', 'Qty', 'Unit Price', 'Total'], true)}</thead>
        <tbody>
          ${subs.map(s => row([
            `<span class="mono">${s.partNumber.toUpperCase() || '—'}</span>`,
            s.description || '—',
            s.quantity,
            s.unitPrice ? `$${parseFloat(s.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
            s.unitPrice ? `$${((parseInt(s.quantity) || 1) * parseFloat(s.unitPrice)).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
          ])).join('')}
          ${form.laborCost ? `<tr class="labor-row"><td colspan="4">Labor</td><td>$${parseFloat(form.laborCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>` : ''}
          ${form.miscCost ? `<tr class="labor-row"><td colspan="4">Misc</td><td>$${parseFloat(form.miscCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>` : ''}
          <tr class="total-row"><td colspan="4"><strong>Total</strong></td><td><strong>$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td></tr>
        </tbody>
      </table>`;

    const savingsSection = analyzed && alerts.length > 0 ? `
      <h2>💰 Savings Opportunities</h2>
      <table>
        <thead>${row(['Part #', 'Description', 'Quoted', 'Best Market Price', 'Vendor', 'Savings'], true)}</thead>
        <tbody>
          ${alerts.map(a => row([
            `<span class="mono">${a.partNumber}</span>`,
            a.description || '—',
            `$${a.quotedPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            `<span class="green">$${a.bestPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>`,
            a.bestVendor,
            `<span class="green">$${a.savings.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${a.savingsPercent.toFixed(1)}%)</span>`,
          ])).join('')}
        </tbody>
      </table>
      <p class="savings-total">Total potential savings: <strong class="green">$${totalSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></p>` : '';

    const alternatesSection = analyzed && alternateAlerts.length > 0 ? `
      <h2>🔄 Alternate Part Savings</h2>
      ${alternateAlerts.map(a => `
        <div class="alt-block">
          <p><span class="mono">${a.originalPN}</span>${a.originalDescription ? ` — ${a.originalDescription}` : ''} <span class="muted">(quoted $${a.originalQuotedPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })})</span></p>
          ${a.alternates.map(alt => `
            <div class="alt-item">
              <p><span class="badge">ALTERNATE</span> <span class="mono blue">${alt.alternatePN}</span> <span class="muted">${alt.relationship}</span>
              ${alt.hasCheaperOption && alt.savings != null
                ? ` — <span class="green">$${alt.savings.toLocaleString('en-US', { minimumFractionDigits: 2 })} savings (${alt.savingsPercent!.toFixed(1)}%)</span>`
                : alt.bestPrice != null ? ` — market: $${alt.bestPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : ' — <span class="muted">no market data</span>'}
              </p>
              ${alt.marketOptions.length > 0 ? `
                <table>
                  <thead>${row(['Vendor', 'RFQ #', 'Condition', 'Price'], true)}</thead>
                  <tbody>${alt.marketOptions.map(o => row([
                    o.vendor,
                    `<span class="mono">${o.rfqNumber}</span>`,
                    `<span class="badge-cond">${o.condition}</span>`,
                    `<span class="${alt.hasCheaperOption ? 'blue' : ''}">$${o.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>`,
                  ])).join('')}</tbody>
                </table>` : '<p class="muted-sm">No quotes on file — worth sourcing independently.</p>'}
            </div>`).join('')}
        </div>`).join('')}` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>MRquOtes — ${form.mainPartNumber || 'Quote'} ${form.serialNumber ? `SN ${form.serialNumber}` : ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; padding: 32px; }
    h1 { font-size: 22px; color: #fef3c7; margin-bottom: 4px; font-family: Georgia, serif; }
    h2 { font-size: 15px; color: #fef3c7; margin: 28px 0 12px; border-bottom: 1px solid #334155; padding-bottom: 6px; }
    .subtitle { color: #64748b; font-size: 12px; margin-bottom: 24px; }
    .meta { display: flex; gap: 32px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .meta-item label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; }
    .meta-item span { font-size: 13px; color: #f1f5f9; font-weight: 500; }
    .meta-item .mono { font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; background: #1e293b; border-radius: 8px; overflow: hidden; }
    th { background: #0f172a; color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 12px; text-align: left; }
    td { padding: 8px 12px; border-top: 1px solid #334155; color: #cbd5e1; vertical-align: top; }
    .total-row td { border-top: 2px solid #475569; background: #0f172a; color: #f1f5f9; }
    .labor-row td { color: #94a3b8; font-style: italic; }
    .mono { font-family: monospace; color: #f1f5f9; }
    .green { color: #4ade80; }
    .blue { color: #60a5fa; }
    .muted { color: #64748b; font-size: 11px; }
    .muted-sm { color: #64748b; font-size: 11px; padding: 6px 0; font-style: italic; }
    .savings-total { margin-top: 8px; color: #94a3b8; font-size: 12px; }
    .alt-block { background: #1e293b; border: 1px solid #1e40af; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .alt-block > p { margin-bottom: 10px; }
    .alt-item { padding-left: 12px; border-left: 2px solid #1d4ed8; margin-top: 10px; }
    .alt-item > p { margin-bottom: 8px; }
    .badge { background: #1e3a8a; color: #93c5fd; font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
    .badge-cond { background: #451a03; color: #fbbf24; font-size: 10px; padding: 1px 6px; border-radius: 4px; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #1e293b; color: #334155; font-size: 11px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>MRquOtes</h1>
  <p class="subtitle">Quote Analysis — exported ${exportDate}</p>
  <div class="meta">
    ${form.mroName ? `<div class="meta-item"><label>MRO</label><span>${form.mroName}</span></div>` : ''}
    ${form.mainPartNumber ? `<div class="meta-item"><label>Part #</label><span class="mono">${form.mainPartNumber.toUpperCase()}</span></div>` : ''}
    ${form.serialNumber ? `<div class="meta-item"><label>Serial #</label><span class="mono">${form.serialNumber}</span></div>` : ''}
    ${form.quoteDate ? `<div class="meta-item"><label>Quote Date</label><span>${form.quoteDate}</span></div>` : ''}
    <div class="meta-item"><label>Total Cost</label><span>$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
    ${analyzed && totalSavings > 0 ? `<div class="meta-item"><label>Potential Savings</label><span class="green">$${totalSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>` : ''}
  </div>
  <h2>📋 Subcomponents</h2>
  ${subTable}
  ${savingsSection}
  ${alternatesSection}
  <div class="footer">Generated by MRquOtes</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const totalParts = form.subcomponents.reduce((sum, r) =>
    sum + (parseInt(r.quantity) || 1) * (parseFloat(r.unitPrice) || 0), 0);
  const totalCost = totalParts + (parseFloat(form.laborCost) || 0) + (parseFloat(form.miscCost) || 0);

  const getEffective = (alert: SavingsAlert, alertIdx: number) => {
    const optIdx = selectedOptions[alertIdx] ?? 0;
    const opt = alert.marketOptions[optIdx];
    if (!opt) return { savings: alert.savings, savingsPercent: alert.savingsPercent, price: alert.bestPrice, vendor: alert.bestVendor, optIdx: 0 };
    const savings = alert.quotedPrice - opt.unitPrice;
    const savingsPercent = (savings / alert.quotedPrice) * 100;
    return { savings, savingsPercent, price: opt.unitPrice, vendor: opt.vendor, optIdx };
  };

  const totalSavings = alerts.reduce((sum, a, i) => sum + Math.max(0, getEffective(a, i).savings), 0);

  return (
    <main className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/" className="text-amber-500 hover:text-amber-400 transition text-sm">← Home</Link>
          <h1 className="text-2xl font-serif font-bold text-amber-50">Analyze Quote</h1>
          <div className="ml-auto flex gap-2 items-center">
            {/* PDF Import */}
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handlePdfImport(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={pdfStatus === 'loading'}
              className="text-sm px-4 py-2 rounded-lg border border-amber-700 text-amber-400 hover:bg-amber-900/30 hover:border-amber-500 transition disabled:opacity-50 flex items-center gap-2"
            >
              {pdfStatus === 'loading' ? (
                <><span className="animate-spin text-xs">⏳</span> Importing…</>
              ) : (
                <>📄 Import PDF</>
              )}
            </button>
            {pdfStatus === 'error' && pdfError && (
              <span className="text-xs text-red-400">{pdfError}</span>
            )}
            {pdfStatus === 'done' && (
              <span className="text-xs text-green-400">✓ Imported</span>
            )}
            <button
              onClick={handleExportPDF}
              className="text-sm px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:border-amber-500 hover:text-amber-400 transition flex items-center gap-2"
            >
              📥 Export PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="text-sm px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:border-green-500 hover:text-green-400 transition flex items-center gap-2"
            >
              📊 Export CSV
            </button>
            <button
              onClick={() => { setForm(formFromMock()); setAnalyzed(false); }}
              className="text-sm px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:border-amber-500 hover:text-amber-400 transition"
            >
              Load Sample Quote
            </button>
            <button
              onClick={() => { setForm(emptyForm()); setAnalyzed(false); setAlerts([]); setRelatedAlerts([]); setAlternateAlerts([]); setPdfStatus('idle'); setPdfError(null); setShowSuggestions(false); }}
              className="text-sm px-4 py-2 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-800 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Quote Header */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 mb-6">
          <h2 className="font-semibold text-amber-50 mb-4">Quote Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">MRO Name</label>
              <input
                className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Aero Engineers Inc."
                value={form.mroName}
                onChange={e => updateHeader('mroName', e.target.value)}
              />
            </div>
            <div className="relative">
              <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Serial Number</label>
              <input
                className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. SN-12345"
                value={form.serialNumber}
                onChange={e => updateHeader('serialNumber', e.target.value)}
                onFocus={() => form.serialNumber && setShowSuggestions(snSuggestions.length > 0)}
              />
              {showSuggestions && snSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {snSuggestions.map((quote, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectSnSuggestion(quote)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700 transition border-b border-slate-700 last:border-b-0"
                    >
                      <div className="font-mono font-semibold text-amber-400">{quote.serialNumber}</div>
                      <div className="text-xs text-slate-400">
                        {quote.mroName} • {quote.mainPartNumber} • {new Date(quote.quoteDate).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Main Part #</label>
              <div>
                <input
                  className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. 5860016-139"
                  value={form.mainPartNumber}
                  onChange={e => updateHeader('mainPartNumber', e.target.value)}
                />

              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Quote Date</label>
              <input
                type="date"
                className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={form.quoteDate}
                onChange={e => updateHeader('quoteDate', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Description</label>
              <input
                className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. HPT/LPT Valve Overhaul"
                value={form.description}
                onChange={e => updateHeader('description', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Labor Cost ($)</label>
              <input
                type="number"
                className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="0.00"
                value={form.laborCost}
                onChange={e => updateHeader('laborCost', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Misc Cost ($)</label>
              <input
                type="number"
                className="w-full border border-slate-600 bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="0.00"
                value={form.miscCost}
                onChange={e => updateHeader('miscCost', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Subcomponents */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-amber-50">Subcomponents</h2>
            <span className="text-sm text-slate-400">{form.subcomponents.length} parts</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Part Number</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right w-20">Qty</th>
                <th className="px-4 py-3 text-right w-32">Unit Price ($)</th>
                <th className="px-4 py-3 text-right w-32">Total</th>
                <th className="px-4 py-3 text-left w-44">Market Data</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {form.subcomponents.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2">
                    <input
                      className="w-full border border-slate-600 bg-slate-800 rounded px-2 py-1.5 font-mono text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="PN-12345"
                      value={row.partNumber}
                      onChange={e => updateRow(row.id, 'partNumber', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-full border border-slate-600 bg-slate-800 rounded px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Description"
                      value={row.description}
                      onChange={e => updateRow(row.id, 'description', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-full border border-slate-600 bg-slate-800 rounded px-2 py-1.5 text-sm text-right text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={row.quantity}
                      min="1"
                      onChange={e => updateRow(row.id, 'quantity', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-full border border-slate-600 bg-slate-800 rounded px-2 py-1.5 text-sm text-right text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="0.00"
                      value={row.unitPrice}
                      onChange={e => updateRow(row.id, 'unitPrice', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300 font-medium">
                    {row.unitPrice ? formatCurrency((parseInt(row.quantity) || 1) * parseFloat(row.unitPrice)) : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <MarketDataBadge pn={row.partNumber} marketPrices={marketData} />
                  </td>
                  <td className="px-4 py-2 text-center">
                    {form.subcomponents.length > 1 && (
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-slate-500 hover:text-red-400 transition text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="px-4 py-3">
                  <button onClick={addRow} className="text-xs text-amber-500 hover:text-amber-400 font-medium transition">
                    + Add part
                  </button>
                </td>
              </tr>
              <tr className="bg-slate-800 border-t border-slate-700 font-semibold text-sm">
                <td colSpan={4} className="px-4 py-3 text-right text-slate-400">Labor</td>
                <td className="px-4 py-3 text-right text-slate-100">{formatCurrency(parseFloat(form.laborCost) || 0)}</td>
                <td colSpan={2} />
              </tr>
              <tr className="bg-slate-800 font-bold text-sm">
                <td colSpan={4} className="px-4 py-3 text-right text-slate-300">Total</td>
                <td className="px-4 py-3 text-right text-amber-400">{formatCurrency(totalCost)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Quote Cost Summary */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-5 mb-6 flex items-center justify-between">
          <div className="flex gap-8 text-sm">
            <div>
              <span className="text-slate-400">Parts Total</span>
              <span className="ml-2 font-semibold text-slate-100">{formatCurrency(totalParts)}</span>
            </div>
            <div>
              <span className="text-slate-400">Labor</span>
              <span className="ml-2 font-semibold text-slate-100">{formatCurrency(parseFloat(form.laborCost) || 0)}</span>
            </div>
            <div>
              <span className="text-slate-400">Total Quote Cost</span>
              <span className="ml-2 font-bold text-amber-400 text-base">{formatCurrency(totalCost)}</span>
            </div>
          </div>
          {analyzed && alerts.length > 0 && (
            <div className="text-right">
              <div className="text-sm text-slate-400">After savings</div>
              <div className="font-bold text-green-400 text-base">{formatCurrency(totalCost - totalSavings)}</div>
              <div className="text-xs text-green-500">saving {formatCurrency(totalSavings)} ({formatPercent((totalSavings / totalCost) * 100)})</div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => { handleAnalyze(); }}
            className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-8 py-3 rounded-lg transition"
          >
            Analyze for Savings
          </button>
          <button
            onClick={handleCheckBatch}
            disabled={!form.mainPartNumber.trim() || batchStatus === 'loading'}
            className="border border-slate-600 hover:border-amber-500 text-slate-300 hover:text-amber-400 font-semibold px-6 py-3 rounded-lg transition disabled:opacity-40"
          >
            {batchStatus === 'loading' ? 'Checking...' : '🔧 Check Batch Data'}
          </button>
        </div>

        {/* Savings Results */}
        {analyzed && (
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <button onClick={() => setSavingsCollapsed(c => !c)} className="flex items-center gap-2 text-left">
                <span className="text-slate-400 text-sm">{savingsCollapsed ? '▶' : '▼'}</span>
                <h2 className="font-semibold text-amber-50">Savings Opportunities</h2>
              </button>
              {alerts.length > 0 && (
                <span className="text-green-400 font-semibold">
                  Total potential savings: {formatCurrency(totalSavings)}
                </span>
              )}
            </div>
            {!savingsCollapsed && (alerts.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400">
                No savings opportunities found for available market data.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {alerts.map((alert, i) => {
                  const eff = getEffective(alert, i);
                  return (
                  <div key={i} className="px-6 py-5 bg-green-950/30">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono font-semibold text-slate-100">{alert.partNumber}</span>
                        <span className="ml-3 text-slate-400">{alert.description}</span>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold text-lg ${eff.savingsPercent > 50 ? 'text-orange-400' : 'text-green-400'}`}>{formatCurrency(eff.savings)} savings</span>
                        <span className={`ml-2 text-sm ${eff.savingsPercent > 50 ? 'text-orange-500' : 'text-green-500'}`}>({formatPercent(eff.savingsPercent)})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mb-4 text-sm">
                      <span className="text-slate-400">Quoted: <span className="text-slate-200 font-medium">{formatCurrency(alert.quotedPrice)}</span></span>
                      <span className="text-slate-600">→</span>
                      <span className="text-slate-400">Selected: <span className={eff.savings > 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>{formatCurrency(eff.price)}</span> via {eff.vendor}</span>
                    </div>
                    <table className="w-full text-sm bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                      <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
                        <tr>
                          <th className="px-4 py-2 text-left">Vendor</th>
                          <th className="px-4 py-2 text-left">RFQ #</th>
                          <th className="px-4 py-2 text-left">Condition</th>
                          <th className="px-4 py-2 text-right">Price</th>
                          <th className="px-4 py-2 text-right">Savings vs Quoted</th>
                          <th className="px-4 py-2 text-left">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {alert.marketOptions.map((opt, j) => {
                          const isSelected = eff.optIdx === j;
                          const rowSavings = alert.quotedPrice - opt.unitPrice;
                          return (
                          <tr
                            key={j}
                            onClick={() => setSelectedOptions(prev => ({ ...prev, [i]: j }))}
                            className={`cursor-pointer transition ${
                              isSelected
                                ? j === 0 ? 'bg-green-900/50 ring-1 ring-inset ring-green-600' : 'bg-blue-900/30 ring-1 ring-inset ring-blue-600'
                                : 'hover:bg-slate-800/60'
                            }`}
                          >
                            <td className="px-4 py-2 font-medium text-slate-100">
                              {isSelected && <span className={`mr-1 ${j === 0 ? 'text-green-400' : 'text-blue-400'}`}>★</span>}
                              {!isSelected && j === 0 && <span className="mr-1 text-slate-600">★</span>}
                              {opt.vendor}
                            </td>
                            <td className="px-4 py-2 font-mono text-amber-400 text-sm">{opt.rfqNumber}</td>
                            <td className="px-4 py-2">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-300">
                                {opt.condition}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-green-400">{formatCurrency(opt.unitPrice)}</td>
                            <td className={`px-4 py-2 text-right ${rowSavings >= 0 ? 'text-green-500' : 'text-red-400'}`}>{formatCurrency(rowSavings)}</td>
                            <td className="px-4 py-2 text-slate-400">{opt.date}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Related Assemblies (alternate parts with market pricing) */}
        {analyzed && alternateAlerts.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-blue-800 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-blue-800 flex items-center justify-between">
              <button onClick={() => setAltSavingsCollapsed(c => !c)} className="flex items-center gap-2 text-left">
                <span className="text-slate-400 text-sm">{altSavingsCollapsed ? '▶' : '▼'}</span>
                <h2 className="font-semibold text-amber-50">🔗 Related Assemblies</h2>
              </button>
              <span className="text-sm text-blue-400">Cheaper approved alternates found in market data</span>
            </div>
            {!altSavingsCollapsed && <div className="divide-y divide-slate-800">
              {alternateAlerts.map((alert, i) => (
                <div key={i} className="px-6 py-5 bg-blue-950/20">
                  <div className="mb-3">
                    <span className="font-mono font-semibold text-slate-100">{alert.originalPN}</span>
                    {alert.originalDescription && <span className="ml-3 text-slate-400">{alert.originalDescription}</span>}
                    <div className="text-xs text-slate-500 mt-1">Quoted at {formatCurrency(alert.originalQuotedPrice)}</div>
                  </div>
                  {alert.alternates.map((alt, j) => (
                    <div key={j} className={j > 0 ? 'mt-4 pt-4 border-t border-slate-800' : ''}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">ALTERNATE</span>
                          <span className="font-mono font-semibold text-blue-300">{alt.alternatePN}</span>
                          {alt.relationship && <span className="text-xs text-slate-500">{alt.relationship}</span>}
                        </div>
                        <div className="text-right">
                          {alt.hasCheaperOption && alt.savings != null && alt.savingsPercent != null ? (
                            <>
                              <span className={`font-bold ${alt.savingsPercent! > 50 ? 'text-orange-400' : 'text-green-400'}`}>{formatCurrency(alt.savings)} savings</span>
                              <span className={`ml-2 text-sm ${alt.savingsPercent! > 50 ? 'text-orange-500' : 'text-green-500'}`}>({formatPercent(alt.savingsPercent)})</span>
                            </>
                          ) : alt.bestPrice != null ? (
                            <span className="text-xs text-slate-400">Market price: {formatCurrency(alt.bestPrice)} (not cheaper)</span>
                          ) : (
                            <span className="text-xs text-slate-500 italic">No market data — check pricing</span>
                          )}
                        </div>
                      </div>
                      {alt.marketOptions.length > 0 ? (
                        <table className="w-full text-sm bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                          <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
                            <tr>
                              <th className="px-4 py-2 text-left">Vendor</th>
                              <th className="px-4 py-2 text-left">RFQ #</th>
                              <th className="px-4 py-2 text-left">Condition</th>
                              <th className="px-4 py-2 text-right">Price</th>
                              {alt.hasCheaperOption && <th className="px-4 py-2 text-right">Savings vs Quoted</th>}
                              <th className="px-4 py-2 text-left">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {alt.marketOptions.map((opt, k) => (
                              <tr key={k} className={k === 0 && alt.hasCheaperOption ? 'bg-blue-950/40' : ''}>
                                <td className="px-4 py-2 font-medium text-slate-100">
                                  {k === 0 && alt.hasCheaperOption && <span className="mr-1 text-blue-400">★</span>}
                                  {opt.vendor}
                                </td>
                                <td className="px-4 py-2 font-mono text-amber-400 text-sm">{opt.rfqNumber}</td>
                                <td className="px-4 py-2">
                                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-300">
                                    {opt.condition}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-blue-400">{formatCurrency(opt.unitPrice)}</td>
                                {alt.hasCheaperOption && (
                                  <td className="px-4 py-2 text-right text-green-500">{formatCurrency(alert.originalQuotedPrice - opt.unitPrice)}</td>
                                )}
                                <td className="px-4 py-2 text-slate-400">{opt.date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="text-xs text-slate-500 bg-slate-800/50 rounded px-4 py-3 italic">
                          No quotes on file for {alt.alternatePN} — worth sourcing independently.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>}
          </div>
        )}

        {/* Shared Assemblies (subcomponents found in other NHAs) */}
        {analyzed && relatedAlerts.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-amber-50">🧩 Shared Assemblies</h2>
              <span className="text-sm text-slate-400">Subcomponents found in other NHAs</span>
            </div>
            <div className="divide-y divide-slate-800">
              {relatedAlerts.map((alert, i) => (
                <div key={i} className="px-6 py-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono font-semibold text-slate-100">{alert.subcomponentPN}</span>
                    <span className="text-slate-400">{alert.subcomponentDescription}</span>
                    <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full font-medium">
                      NLA in {alert.relatedNHAs.length} other {alert.relatedNHAs.length === 1 ? 'assembly' : 'assemblies'}
                    </span>
                  </div>
                  <table className="w-full text-sm bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                    <thead className="bg-slate-700 text-slate-400 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left">NHA Part Number</th>
                        <th className="px-4 py-2 text-left">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {alert.relatedNHAs.map((nha, j) => (
                        <tr key={j} className="hover:bg-slate-700/50 transition">
                          <td className="px-4 py-2 font-mono font-medium text-slate-100">{nha.partNumber}</td>
                          <td className="px-4 py-2 text-slate-300">{nha.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PMA Alternates — coming soon */}
        {analyzed && (
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden mb-6 opacity-50">
            <div className="px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-amber-50">🔄 PMA Alternates</h2>
              <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">Coming soon — awaiting PMA data</span>
            </div>
          </div>
        )}

        {/* Inventory */}
        {analyzed && inventoryStatus !== 'idle' && (
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-amber-50">📦 Inventory</h2>
              {inventoryStatus === 'done' && (
                <span className="text-sm text-slate-400">
                  {inventoryItems.length > 0
                    ? `${inventoryItems.length} matching unit${inventoryItems.length !== 1 ? 's' : ''} available`
                    : 'No matching inventory'}
                </span>
              )}
            </div>
            {inventoryStatus === 'loading' && (
              <div className="px-6 py-8 text-center text-slate-400">Checking inventory...</div>
            )}
            {inventoryStatus === 'error' && (
              <div className="px-6 py-8 text-center text-red-400">Failed to load inventory data.</div>
            )}
            {inventoryStatus === 'done' && inventoryItems.length === 0 && (
              <div className="px-6 py-8 text-center text-slate-400">No matching parts found in inventory.</div>
            )}
            {inventoryStatus === 'done' && inventoryItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left">Inventory Line</th>
                      <th className="px-4 py-3 text-left">Part Number</th>
                      <th className="px-4 py-3 text-left">Serial Number</th>
                      <th className="px-4 py-3 text-left">Keyword</th>
                      <th className="px-4 py-3 text-left">Condition</th>
                      <th className="px-4 py-3 text-right">Qty Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {inventoryItems.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-800/50 transition">
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.inventoryLine}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-amber-400">{item.partNumber}</td>
                        <td className="px-4 py-3 font-mono text-slate-300">{item.serialNumber || '—'}</td>
                        <td className="px-4 py-3 text-slate-300">{item.keyword || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-300">
                            {item.condition || 'UNK'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-green-400">{item.quantityAvailable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Batch Data Results */}
        {batchStatus !== 'idle' && (
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-amber-50">🔧 Batch Cannibalization Check</h2>
              <span className="text-sm text-slate-400">NHA: <span className="font-mono text-slate-300">{form.mainPartNumber.trim().toUpperCase()}</span></span>
            </div>

            {batchStatus === 'loading' && (
              <div className="px-6 py-8 text-center text-slate-400">Checking batch data...</div>
            )}
            {batchStatus === 'error' && (
              <div className="px-6 py-8 text-center text-red-400">Failed to load batch data.</div>
            )}
            {batchStatus === 'done' && batchDonors !== null && batchDonors.length === 0 && (
              <div className="px-6 py-8 text-center text-slate-400">
                No donor candidates found in batch data for this NHA.
              </div>
            )}
            {batchStatus === 'done' && batchDonors !== null && batchDonors.length > 0 && (
              <div className="divide-y divide-slate-800">
                {batchDonors.map((result, i) => (
                  <div key={i} className="px-6 py-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono font-semibold text-amber-400">{result.partNumber}</span>
                      <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full font-medium">
                        {result.donors.length} potential donor{result.donors.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.donors.map((d, j) => (
                        <span key={j} className="text-xs font-mono bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded">
                          {d.sn}{d.ro ? ` (${d.ro})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
