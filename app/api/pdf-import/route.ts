import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const quote_data = formData.get('quote_data') as string | null;

    if (!file || !quote_data) {
      return NextResponse.json(
        { error: 'File and quote_data are required' },
        { status: 400 }
      );
    }

    // Parse quote_data JSON
    let quoteInfo;
    try {
      quoteInfo = JSON.parse(quote_data);
    } catch {
      return NextResponse.json(
        { error: 'Invalid quote_data JSON' },
        { status: 400 }
      );
    }

    // For now, we'll just store the quote metadata in rfqs/rfq_lines
    // PDF parsing would happen here if you wanted to extract line items
    // For this beta, we're just creating a record of the PDF upload

    const { data, error } = await supabase
      .from('rfqs')
      .insert([
        {
          name: quoteInfo.rfq_number || `PDF-${Date.now()}`,
          vendor_name: quoteInfo.vendor_name,
          status: 'imported_from_pdf',
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'PDF quote imported successfully',
      id: data[0].id,
    });
  } catch (err) {
    console.error('Error importing PDF:', err);
    return NextResponse.json({ error: 'Failed to import PDF' }, { status: 500 });
  }
}
