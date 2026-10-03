import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const part = searchParams.get('part');

    if (!part) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from('rfq_lines')
      .select('*')
      .eq('product_name', part)
      .order('quoted_date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Error fetching quotes:', err);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}
