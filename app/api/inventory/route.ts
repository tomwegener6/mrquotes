import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const part = searchParams.get('part');
    const sn = searchParams.get('sn');

    if (!part && !sn) {
      return NextResponse.json([]);
    }

    let query = supabase.from('inventory').select('*');

    if (part) {
      query = query.ilike('part_number', `%${part}%`);
    }

    if (sn) {
      query = query.eq('serial_number', sn);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Error fetching inventory:', err);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}
