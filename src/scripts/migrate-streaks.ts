import { createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log("--- INICIANDO MIGRACIÓN PARA RACHAS ---");

    const query = `
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS racha_actual INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ultima_fecha_registro DATE;
    `;

    // Intentar vía rpc exec_sql si existe
    const { data: rpcData, error: rpcError } = await supabase.rpc("exec_sql", { query });

    if (rpcError) {
        console.warn("RPC exec_sql falló o no existe. Intentando vía API REST...");
        // Fallback or manual instruction for the user
        console.error("Error:", rpcError.message);
        console.log("\nPor favor, ejecuta este SQL manualmente en el Dashboard de Supabase:");
        console.log(query);
    } else {
        console.log("Migración completada con éxito.");
    }
}

migrate();
