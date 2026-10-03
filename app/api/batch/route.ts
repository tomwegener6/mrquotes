import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('batch_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Error fetching batch data:', err);
    return NextResponse.json({ error: 'Failed to fetch batch data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nha_pn, ro_number, serial_number } = body;

    if (!nha_pn || !serial_number) {
      return NextResponse.json(
        { error: 'nha_pn and serial_number are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('batch_entries')
      .insert([
        {
          nha_pn,
          ro_number: ro_number || null,
          serial_number,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data[0]);
  } catch (err) {
    console.error('Error creating batch entry:', err);
    return NextResponse.json({ error: 'Failed to create batch entry' }, { status: 500 });
  }
}
