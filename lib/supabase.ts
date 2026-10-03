import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Database = {
  public: {
    Tables: {
      rfqs: {
        Row: {
          id: number;
          salesforce_id: string | null;
          name: string;
          vendor_name: string | null;
          status: string | null;
          total_value: number | null;
          urgency: string | null;
          due_date: string | null;
          terms: string | null;
          ship_method: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rfqs']['Row'], 'id' | 'created_at' | 'updated_at'>;
      };
      rfq_lines: {
        Row: {
          id: number;
          salesforce_id: string | null;
          rfq_name: string;
          product_name: string;
          price: number | null;
          condition_code: string | null;
          quoted_date: string | null;
          quantity_quoted: number | null;
          nha_part_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rfq_lines']['Row'], 'id' | 'created_at' | 'updated_at'>;
      };
      alternates: {
        Row: {
          id: number;
          salesforce_id: string | null;
          primary_product: string;
          alternate_product: string;
          relationship: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['alternates']['Row'], 'id' | 'created_at'>;
      };
      inventory: {
        Row: {
          id: number;
          inventory_uid: string | null;
          part_number: string;
          serial_number: string | null;
          keyword: string | null;
          condition_code: string | null;
          quantity: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'id' | 'created_at' | 'updated_at'>;
      };
      batch_entries: {
        Row: {
          id: number;
          nha_pn: string;
          ro_number: string | null;
          serial_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['batch_entries']['Row'], 'id' | 'created_at' | 'updated_at'>;
      };
      subcomponents: {
        Row: {
          id: number;
          higher_assembly: string;
          subcomponent_part: string;
          batch_entry_id: number | null;
          discovered_at: string;
        };
        Insert: Omit<Database['public']['Tables']['subcomponents']['Row'], 'id' | 'discovered_at'>;
      };
    };
  };
};
