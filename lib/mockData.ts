import { RepairQuote, MarketPrice, PartRelationship } from './types';

export const mockQuotes: RepairQuote[] = [
  {
    id: 'Q-2025-001',
    mroName: 'Aero Engineers Inc.',
    mainPartNumber: '5860016-139',
    description: 'HPT/LPT VALVE ASSEMBLY - Overhaul',
    laborCost: 2750.00,
    quoteDate: '2026-03-20',
    turnaroundDays: 45,
    subcomponents: [
      {
        partNumber: '5863144-101',
        description: 'HPT Stage 1 Valve',
        quantity: 1,
        unitPrice: 1800.00,
        totalPrice: 1800.00,
      },
      {
        partNumber: '5863144-102',
        description: 'LPT Control Valve',
        quantity: 1,
        unitPrice: 450.00,
        totalPrice: 450.00,
      },
      {
        partNumber: '5863144-103',
        description: 'Valve Seal Kit',
        quantity: 2,
        unitPrice: 160.00,
        totalPrice: 320.00,
      },
      {
        partNumber: '5860016-001',
        description: 'Actuator Assembly',
        quantity: 1,
        unitPrice: 2100.00,
        totalPrice: 2100.00,
      },
      {
        partNumber: '5860016-002',
        description: 'Pressure Regulator',
        quantity: 1,
        unitPrice: 890.00,
        totalPrice: 890.00,
      },
      {
        partNumber: '5860016-003',
        description: 'Flow Control Module',
        quantity: 1,
        unitPrice: 1200.00,
        totalPrice: 1200.00,
      },
    ],
    totalCost: 25821.86,
  },
];

// Part master — NHA to NLA relationships
export const partMaster: PartRelationship[] = [
  // 5860016-139 and its NLAs (the quote we're analyzing)
  { nha: '5860016-139', nhaDescription: 'HPT/LPT Valve Assembly', nla: '5863144-101', nlaDescription: 'HPT Stage 1 Valve' },
  { nha: '5860016-139', nhaDescription: 'HPT/LPT Valve Assembly', nla: '5863144-102', nlaDescription: 'LPT Control Valve' },
  { nha: '5860016-139', nhaDescription: 'HPT/LPT Valve Assembly', nla: '5863144-103', nlaDescription: 'Valve Seal Kit' },
  { nha: '5860016-139', nhaDescription: 'HPT/LPT Valve Assembly', nla: '5860016-001', nlaDescription: 'Actuator Assembly' },
  { nha: '5860016-139', nhaDescription: 'HPT/LPT Valve Assembly', nla: '5860016-002', nlaDescription: 'Pressure Regulator' },
  { nha: '5860016-139', nhaDescription: 'HPT/LPT Valve Assembly', nla: '5860016-003', nlaDescription: 'Flow Control Module' },

  // Sample part 12345 — shares 5863144-101 as an NLA (donor candidate)
  { nha: '12345', nhaDescription: 'Sample Bleed Air Valve Assembly', nla: '5863144-101', nlaDescription: 'HPT Stage 1 Valve' },
  { nha: '12345', nhaDescription: 'Sample Bleed Air Valve Assembly', nla: 'A-001', nlaDescription: 'Bleed Air Actuator' },
  { nha: '12345', nhaDescription: 'Sample Bleed Air Valve Assembly', nla: 'B-002', nlaDescription: 'Pressure Transducer' },
  { nha: '12345', nhaDescription: 'Sample Bleed Air Valve Assembly', nla: 'C-003', nlaDescription: 'Control Solenoid' },
];

// Real market data from Salesforce for 5863144-101
export const mockMarketPrices: MarketPrice[] = [
  { partNumber: '5863144-101', vendorName: 'AvAir', rfqNumber: 'RFQ-28581', unitPrice: 400.00, condition: 'NS', date: '2025-09-12' },
  { partNumber: '5863144-101', vendorName: 'VSE Aviation Services', rfqNumber: 'RFQ-27924', unitPrice: 420.00, condition: 'NE', date: '2025-08-27' },
  { partNumber: '5863144-101', vendorName: 'DASI', rfqNumber: 'RFQ-27947', unitPrice: 3074.00, condition: 'NE', date: '2025-08-28' },
  { partNumber: '5863144-101', vendorName: 'Aeroengineers International s.r.o.', rfqNumber: 'RFQ-28701', unitPrice: 3333.00, condition: 'NE', date: '2025-09-16' },
  { partNumber: '5863144-101', vendorName: 'YGAero', rfqNumber: 'RFQ-28574', unitPrice: 4282.03, condition: 'NE', date: '2025-09-12' },
  { partNumber: '5863144-101', vendorName: 'Brooks & Maldini Corp.', rfqNumber: 'RFQ-28695', unitPrice: 5025.00, condition: 'NE', date: '2025-09-16' },
];
