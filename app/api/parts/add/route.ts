import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batch_entry_id, subcomponent_part } = body;

    if (!batch_entry_id || !subcomponent_part) {
      return NextResponse.json(
        { error: 'batch_entry_id and subcomponent_part are required' },
        { status: 400 }
      );
    }

    // Get the batch entry to get higher_assembly (nha_pn)
    const { data: batchData, error: batchError } = await supabase
      .from('batch_entries')
      .select('nha_pn')
      .eq('id', batch_entry_id)
      .single();

    if (batchError || !batchData) {
      return NextResponse.json({ error: 'Batch entry not found' }, { status: 404 });
    }

    // Insert subcomponent relationship
    const { data, error } = await supabase
      .from('subcomponents')
      .insert([
        {
          higher_assembly: batchData.nha_pn,
          subcomponent_part,
          batch_entry_id,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data[0]);
  } catch (err) {
    console.error('Error adding subcomponent:', err);
    return NextResponse.json({ error: 'Failed to add subcomponent' }, { status: 500 });
  }
}
