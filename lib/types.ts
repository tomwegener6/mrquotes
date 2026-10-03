export interface Subcomponent {
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface RepairQuote {
  id: string;
  mroName: string;
  mainPartNumber: string;
  description: string;
  laborCost: number;
  subcomponents: Subcomponent[];
  totalCost: number;
  turnaroundDays?: number;
  quoteDate: string;
}

export interface MarketPrice {
  partNumber: string;
  vendorName: string;
  rfqNumber: string;
  unitPrice: number;
  condition: string; // "NE", "NS", "OH", "SV", "AR"
  date: string;
}

export interface PartRelationship {
  nha: string;           // Next Higher Assembly PN
  nhaDescription: string;
  nla: string;           // Next Lower Assembly PN
  nlaDescription: string;
}

export interface RelatedAssemblyAlert {
  subcomponentPN: string;
  subcomponentDescription: string;
  relatedNHAs: {
    partNumber: string;
    description: string;
  }[];
}

export interface MarketOption {
  vendor: string;
  rfqNumber: string;
  unitPrice: number;
  condition: string;
  date: string;
}

export interface AlternateSavingsAlert {
  originalPN: string;
  originalDescription: string;
  originalQuotedPrice: number;
  alternates: {
    alternatePN: string;
    relationship: string;
    marketOptions: MarketOption[];   // empty if no market data
    bestPrice: number | null;        // null if no market data
    bestVendor: string | null;
    savings: number | null;          // null if no data or not cheaper
    savingsPercent: number | null;
    hasCheaperOption: boolean;
  }[];
}

export interface SavingsAlert {
  partNumber: string;
  description: string;
  quotedPrice: number;
  bestPrice: number;
  bestVendor: string;
  savings: number;
  savingsPercent: number;
  marketOptions: MarketOption[]; // up to 3, sorted cheapest first
}
