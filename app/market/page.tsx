import Link from 'next/link';
import { mockMarketPrices } from '@/lib/mockData';
import { formatCurrency } from '@/lib/analysis';

export default function MarketPage() {
  return (
    <main className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/" className="text-amber-500 hover:text-amber-400 transition text-sm">← Home</Link>
          <h1 className="text-2xl font-serif font-bold text-amber-50">Market Data</h1>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <p className="text-sm text-slate-400">{mockMarketPrices.length} price records available</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left">Part Number</th>
                <th className="px-6 py-3 text-left">Vendor</th>
                <th className="px-6 py-3 text-left">RFQ #</th>
                <th className="px-6 py-3 text-left">Condition</th>
                <th className="px-6 py-3 text-right">Unit Price</th>
                <th className="px-6 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {mockMarketPrices.map((price, i) => (
                <tr key={i} className="hover:bg-slate-800/50 transition">
                  <td className="px-6 py-4 font-mono font-medium text-slate-100">{price.partNumber}</td>
                  <td className="px-6 py-4 text-slate-300">{price.vendorName}</td>
                  <td className="px-6 py-4 font-mono text-amber-400 text-sm">{price.rfqNumber}</td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-300">
                      {price.condition}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-100">{formatCurrency(price.unitPrice)}</td>
                  <td className="px-6 py-4 text-slate-400">{price.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
