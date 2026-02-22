import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || "",
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
        );

        // Add consumido column to food_logs
        const { data, error } = await supabase.rpc("exec_sql", {
            query: `
                ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS consumido BOOLEAN DEFAULT FALSE;
                ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS original_cantidad NUMERIC;
                ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS original_unidad TEXT;
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS orden_comidas JSONB DEFAULT '["Desayuno", "Snack 1", "Almuerzo", "Merienda", "Snack 2", "Cena"]'::jsonb;
            `
        });

        if (error) {
            // If RPC doesn't exist, try via pg/query
            const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/pg/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
                    "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`
                },
                body: JSON.stringify({
                    query: `
                ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS consumido BOOLEAN DEFAULT FALSE;
                ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS original_cantidad NUMERIC;
                ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS original_unidad TEXT;
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS orden_comidas JSONB DEFAULT '["Desayuno", "Snack 1", "Almuerzo", "Merienda", "Snack 2", "Cena"]'::jsonb;
            `
                })
            });
            const text = await res.text();
            return NextResponse.json({ method: "pg/query", status: res.status, result: text });
        }

        return NextResponse.json({ method: "rpc", result: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
