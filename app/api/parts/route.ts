import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from('rfq_lines')
      .select('*')
      .ilike('product_name', `%${query}%`)
      .limit(50);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Error fetching parts:', err);
    return NextResponse.json({ error: 'Failed to fetch parts' }, { status: 500 });
  }
}
