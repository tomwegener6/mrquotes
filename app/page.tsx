import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-serif font-bold text-amber-50 mb-2">MRquOtes</h1>
          <p className="text-slate-400 text-lg">Repair quote analysis &amp; cost intelligence</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/analyze">
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-8 hover:border-amber-500 hover:shadow-lg transition cursor-pointer">
              <div className="text-3xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold text-amber-50 mb-2">Analyze Quote</h2>
              <p className="text-slate-400">
                Break down a repair quote and identify savings opportunities against market prices.
              </p>
            </div>
          </Link>

          {/* <Link href="/market">
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-8 hover:border-amber-500 hover:shadow-lg transition cursor-pointer">
              <div className="text-3xl mb-4">📊</div>
              <h2 className="text-xl font-semibold text-amber-50 mb-2">Market Data</h2>
              <p className="text-slate-400">
                Browse available market pricing data across vendors and part conditions.
              </p>
            </div>
          </Link> */}

          <Link href="/batch">
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-8 hover:border-amber-500 hover:shadow-lg transition cursor-pointer">
              <div className="text-3xl mb-4">🔧</div>
              <h2 className="text-xl font-semibold text-amber-50 mb-2">Batch Analysis</h2>
              <p className="text-slate-400">
                Compare multiple units of the same NHA to find cannibalization opportunities.
              </p>
            </div>
          </Link>
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-8 opacity-50 cursor-not-allowed pointer-events-none">
            <div className="text-3xl mb-4">🚫</div>
            <h2 className="text-xl font-semibold text-slate-500 mb-2">Data</h2>
            <p className="text-slate-500">
              Data imports disabled in beta. Use local alpha version to update data.
            </p>
          </div>

          <Link href="/subcomponents">
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-8 hover:border-amber-500 hover:shadow-lg transition cursor-pointer">
              <div className="text-3xl mb-4">🗂️</div>
              <h2 className="text-xl font-semibold text-amber-50 mb-2">Check Subcomponent Data</h2>
              <p className="text-slate-400">
                Look up a part number to see which higher assemblies it belongs to, built from your batch history.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
