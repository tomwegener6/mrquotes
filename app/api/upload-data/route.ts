import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const REQUIRED_COLUMNS: Record<string, string[]> = {
  'RFQ.csv': ['Name', 'inscor__Vendor__r.Name'],
  'RFQLines.csv': [
    'inscor__RFQ_Number__r.Name',
    'inscor__Product__r.Name',
    'inscor__Price__c',
    'inscor__Type_Quoted__c',
    'inscor__Condition_Code__r.Name',
    'inscor__Quoted_Date__c',
  ],
  'Alternates.csv': [
    'inscor__Primary_Product__r.Name',
    'inscor__Alternate_Product__r.Name',
    'inscor__Relationship_New__c',
  ],
  'Inventory.csv': [
    'Inventory: Inventory UID',
    'Part Number',
    'Serial Number',
    'Keyword',
    'Condition Code',
    'Quantity',
  ],
};

function parseFirstLine(content: string): string[] {
  const firstLine = content.split('\n')[0].trim();
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    if (firstLine[i] === '"') {
      if (inQuotes && firstLine[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (firstLine[i] === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += firstLine[i];
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSVLine(line: string, headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  let current = '';
  let inQuotes = false;
  let colIndex = 0;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (line[i] === ',' && !inQuotes) {
      result[headers[colIndex]] = current.trim();
      current = '';
      colIndex++;
    } else {
      current += line[i];
    }
  }
  result[headers[colIndex]] = current.trim();
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const filename = file.name;

    if (!REQUIRED_COLUMNS[filename]) {
      return NextResponse.json(
        {
          error: `Unexpected filename "${filename}". Must be one of: ${Object.keys(REQUIRED_COLUMNS).join(', ')}.`,
        },
        { status: 400 }
      );
    }

    const content = await file.text();

    if (!content.trim()) {
      return NextResponse.json({ error: 'File is empty.' }, { status: 400 });
    }

    const headers = parseFirstLine(content);
    const required = REQUIRED_COLUMNS[filename];
    const missing = required.filter(col => !headers.includes(col));

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missing.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const lines = content.trim().split('\n').slice(1).filter(l => l.trim());
    let rowsInserted = 0;

    // Delete existing data for this table
    if (filename === 'RFQ.csv') {
      await supabase.from('rfqs').delete().neq('id', 0);
    } else if (filename === 'RFQLines.csv') {
      await supabase.from('rfq_lines').delete().neq('id', 0);
    } else if (filename === 'Alternates.csv') {
      await supabase.from('alternates').delete().neq('id', 0);
    } else if (filename === 'Inventory.csv') {
      await supabase.from('inventory').delete().neq('id', 0);
    }

    // Insert new data
    for (const line of lines) {
      const row = parseCSVLine(line, headers);

      if (filename === 'RFQ.csv') {
        const { error } = await supabase.from('rfqs').insert([
          {
            name: row['Name'],
            vendor_name: row['inscor__Vendor__r.Name'],
          },
        ]);
        if (!error) rowsInserted++;
      } else if (filename === 'RFQLines.csv') {
        const { error } = await supabase.from('rfq_lines').insert([
          {
            rfq_name: row['inscor__RFQ_Number__r.Name'],
            product_name: row['inscor__Product__r.Name'],
            price: parseFloat(row['inscor__Price__c']) || null,
            condition_code: row['inscor__Condition_Code__r.Name'],
            quoted_date: row['inscor__Quoted_Date__c'] || null,
            nha_part_number: row['NHA_Part_Number__c'] || null,
          },
        ]);
        if (!error) rowsInserted++;
      } else if (filename === 'Alternates.csv') {
        const { error } = await supabase.from('alternates').insert([
          {
            primary_product: row['inscor__Primary_Product__r.Name'],
            alternate_product: row['inscor__Alternate_Product__r.Name'],
            relationship: row['inscor__Relationship_New__c'],
          },
        ]);
        if (!error) rowsInserted++;
      } else if (filename === 'Inventory.csv') {
        const { error } = await supabase.from('inventory').insert([
          {
            inventory_uid: row['Inventory: Inventory UID'],
            part_number: row['Part Number'],
            serial_number: row['Serial Number'],
            keyword: row['Keyword'],
            condition_code: row['Condition Code'],
            quantity: parseInt(row['Quantity']) || null,
          },
        ]);
        if (!error) rowsInserted++;
      }
    }

    return NextResponse.json({
      success: true,
      filename,
      rows: rowsInserted,
      columns: headers.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file.' }, { status: 500 });
  }
}
