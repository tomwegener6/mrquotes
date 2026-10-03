import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';

async function runPythonExtractor(pdfPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [path.join(process.cwd(), 'scripts/pdf_extractor.py'), pdfPath]);
    let output = '';
    let error = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('PDF extractor error:', error);
        reject(new Error(`PDF extraction failed: ${error}`));
      } else {
        try {
          resolve(JSON.parse(output));
        } catch (e) {
          reject(new Error(`Failed to parse extractor output: ${e}`));
        }
      }
    });
  });
}

export async function POST(request: NextRequest) {
  let tempPath: string | null = null;
  try {
    const formData = await request.formData();
    // Accept both 'file' and 'pdf' field names
    const file = (formData.get('file') || formData.get('pdf')) as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'PDF file is required' },
        { status: 400 }
      );
    }

    // Save uploaded file to temp location
    const buffer = await file.arrayBuffer();
    tempPath = path.join('/tmp', `pdf-${Date.now()}.pdf`);
    fs.writeFileSync(tempPath, Buffer.from(buffer));

    // Extract data using Python script
    const extracted = await runPythonExtractor(tempPath);

    // Map extracted data to API response format
    const quoteData = {
      lineItems: (extracted.line_items || []).map((item: any) => ({
        partNumber: item.part_number,
        description: item.description,
        qty: item.qty || 1,
        unitPrice: item.unit_price,
        extPrice: item.ext_price,
      })),
    };

    // Store in Supabase if we have data
    if (extracted.nha_pn || extracted.ro) {
      const { data: rfqData, error: rfqError } = await supabase
        .from('rfqs')
        .insert([
          {
            salesforce_id: `PDF-${Date.now()}`,
            name: extracted.ro || `PDF-${Date.now()}`,
            vendor_name: extracted.mro,
            status: 'imported_from_pdf',
            total_value: extracted.total_cost,
          },
        ])
        .select();

      if (rfqError) {
        console.error('Supabase error:', rfqError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'PDF quote imported successfully',
      mro: extracted.mro,
      ro: extracted.ro,
      nhaPN: extracted.nha_pn,
      serial: extracted.serial,
      quoteData,
      totalCost: extracted.total_cost,
      laborCost: extracted.labor_cost,
      subcomponents: extracted.subcomponents,
    });
  } catch (err) {
    console.error('Error importing PDF:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to import PDF' },
      { status: 500 }
    );
  } finally {
    // Clean up temp file
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}
