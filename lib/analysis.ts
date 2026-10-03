import { RepairQuote, MarketPrice, SavingsAlert, AlternateSavingsAlert, PartRelationship, RelatedAssemblyAlert, Subcomponent } from './types';

export function analyzeQuote(quote: RepairQuote, marketData: MarketPrice[]): SavingsAlert[] {
  const alerts: SavingsAlert[] = [];

  for (const sub of quote.subcomponents) {
    const available = marketData.filter(m => m.partNumber === sub.partNumber);
    if (available.length === 0) continue;

    // Sort cheapest first, take top 3
    const sorted = [...available].sort((a, b) => a.unitPrice - b.unitPrice);
    const top3 = sorted.slice(0, 3);
    const best = top3[0];

    // Only flag if best market price is cheaper than quoted
    if (best.unitPrice >= sub.unitPrice) continue;

    const savings = sub.unitPrice - best.unitPrice;
    const savingsPercent = (savings / sub.unitPrice) * 100;

    alerts.push({
      partNumber: sub.partNumber,
      description: sub.description,
      quotedPrice: sub.unitPrice,
      bestPrice: best.unitPrice,
      bestVendor: best.vendorName,
      savings,
      savingsPercent,
      marketOptions: top3.map(m => ({
        vendor: m.vendorName,
        rfqNumber: m.rfqNumber,
        unitPrice: m.unitPrice,
        condition: m.condition,
        date: m.date,
      })),
    });
  }

  return alerts;
}

export function findRelatedAssemblies(
  quote: RepairQuote,
  partMaster: PartRelationship[]
): RelatedAssemblyAlert[] {
  const alerts: RelatedAssemblyAlert[] = [];

  for (const sub of quote.subcomponents) {
    // Find all NHAs that contain this NLA, excluding the current NHA
    const relatedNHAs = partMaster
      .filter(r => r.nla === sub.partNumber && r.nha !== quote.mainPartNumber)
      .map(r => ({ partNumber: r.nha, description: r.nhaDescription }));

    if (relatedNHAs.length > 0) {
      alerts.push({
        subcomponentPN: sub.partNumber,
        subcomponentDescription: sub.description,
        relatedNHAs,
      });
    }
  }

  return alerts;
}

export function findAlternateSavings(
  subcomponents: Subcomponent[],
  alternatesMap: Record<string, { partNumber: string; relationship: string }[]>,
  marketData: MarketPrice[]
): AlternateSavingsAlert[] {
  const alerts: AlternateSavingsAlert[] = [];

  for (const sub of subcomponents) {
    const subAlternates = alternatesMap[sub.partNumber] ?? [];
    if (subAlternates.length === 0) continue;

    const altResults: AlternateSavingsAlert['alternates'] = [];

    for (const alt of subAlternates) {
      const altMarket = marketData.filter(m => m.partNumber === alt.partNumber);

      if (altMarket.length === 0) {
        // No market data — still surface the alternate so the user knows it exists
        altResults.push({
          alternatePN: alt.partNumber,
          relationship: alt.relationship,
          marketOptions: [],
          bestPrice: null,
          bestVendor: null,
          savings: null,
          savingsPercent: null,
          hasCheaperOption: false,
        });
        continue;
      }

      const sorted = [...altMarket].sort((a, b) => a.unitPrice - b.unitPrice);
      const top3 = sorted.slice(0, 3);
      const best = top3[0];
      const isCheaper = sub.unitPrice > 0 && best.unitPrice < sub.unitPrice;
      const savings = isCheaper ? sub.unitPrice - best.unitPrice : null;

      altResults.push({
        alternatePN: alt.partNumber,
        relationship: alt.relationship,
        marketOptions: top3.map(m => ({
          vendor: m.vendorName,
          rfqNumber: m.rfqNumber,
          unitPrice: m.unitPrice,
          condition: m.condition,
          date: m.date,
        })),
        bestPrice: best.unitPrice,
        bestVendor: best.vendorName,
        savings,
        savingsPercent: savings != null ? (savings / sub.unitPrice) * 100 : null,
        hasCheaperOption: isCheaper,
      });
    }

    if (altResults.length > 0) {
      alerts.push({
        originalPN: sub.partNumber,
        originalDescription: sub.description,
        originalQuotedPrice: sub.unitPrice,
        alternates: altResults,
      });
    }
  }

  return alerts;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
