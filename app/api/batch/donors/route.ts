import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nha_pn = searchParams.get('nha_pn');

    if (!nha_pn) {
      return NextResponse.json({ error: 'nha_pn is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('batch_entries')
      .select('*')
      .eq('nha_pn', nha_pn)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Error fetching donor units:', err);
    return NextResponse.json({ error: 'Failed to fetch donor units' }, { status: 500 });
  }
}
