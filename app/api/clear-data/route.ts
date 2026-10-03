import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;

    const tableMap: Record<string, string> = {
      'RFQ.csv': 'rfqs',
      'RFQLines.csv': 'rfq_lines',
      'Alternates.csv': 'alternates',
      'Inventory.csv': 'inventory',
    };

    const tableName = tableMap[filename];
    if (!tableName) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const { error } = await supabase
      .from(tableName)
      .delete()
      .neq('id', 0);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error clearing data:', err);
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 });
  }
}
