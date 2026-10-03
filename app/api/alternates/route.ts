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
      .from('alternates')
      .select('*')
      .eq('primary_product', part);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Error fetching alternates:', err);
    return NextResponse.json({ error: 'Failed to fetch alternates' }, { status: 500 });
  }
}
