import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subcomponent_id } = body;

    if (!subcomponent_id) {
      return NextResponse.json(
        { error: 'subcomponent_id is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('subcomponents')
      .delete()
      .eq('id', subcomponent_id);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error removing subcomponent:', err);
    return NextResponse.json({ error: 'Failed to remove subcomponent' }, { status: 500 });
  }
}
