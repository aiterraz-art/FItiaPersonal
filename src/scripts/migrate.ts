import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
    console.log('🚀 Starting migration...');

    const { error } = await supabase.rpc('execute_sql', {
        sql_query: `
            CREATE TABLE IF NOT EXISTS public.weight_logs (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                user_id UUID REFERENCES public.profiles(id) NOT NULL,
                peso_kg DECIMAL NOT NULL,
                fecha DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Enable Realtime
            ALTER PUBLICATION supabase_realtime ADD TABLE weight_logs;
        `
    });

    if (error) {
        // If RPC isn't available, we'll try a different approach or inform the user.
        console.error('❌ Migration failed:', error.message);
        console.log('💡 Tip: If RPC "execute_sql" is not found, you may need to run this SQL in the Supabase Dashboard SQL Editor.');
    } else {
        console.log('✅ Migration successful!');
    }
}

migrate();
