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
                -- Food Logs & Profiles
                ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS consumido BOOLEAN DEFAULT FALSE;
                ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS original_cantidad NUMERIC;
                ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS original_unidad TEXT;
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS orden_comidas JSONB DEFAULT '["Desayuno", "Snack 1", "Almuerzo", "Merienda", "Snack 2", "Cena"]':: jsonb;
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS meta_p NUMERIC DEFAULT 150;
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS meta_c NUMERIC DEFAULT 200;
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS meta_g NUMERIC DEFAULT 60;

        --Weight Logs
                CREATE TABLE IF NOT EXISTS public.weight_logs(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            peso_kg NUMERIC NOT NULL,
            fecha DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        );

        --Recipes & Ingredients
                CREATE TABLE IF NOT EXISTS public.recipes(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            nombre TEXT NOT NULL,
            porciones INTEGER DEFAULT 1,
            instrucciones TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        );

                CREATE TABLE IF NOT EXISTS public.recipe_ingredients(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
            food_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
            gramos NUMERIC NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        );

        --Vault Progress
                CREATE TABLE IF NOT EXISTS public.progress_photos(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            photo_url TEXT NOT NULL,
            tipo TEXT DEFAULT 'frente',
            fecha DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        );

                CREATE TABLE IF NOT EXISTS public.body_measurements(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            fecha DATE NOT NULL,
            peso_kg NUMERIC,
            cintura_cm NUMERIC,
            brazo_cm NUMERIC,
            pecho_cm NUMERIC,
            pierna_cm NUMERIC,
            cuello_cm NUMERIC,
            created_at TIMESTAMPTZ DEFAULT now()
        );
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
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS meta_p NUMERIC DEFAULT 150;
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS meta_c NUMERIC DEFAULT 200;
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS meta_g NUMERIC DEFAULT 60;
                
                CREATE TABLE IF NOT EXISTS public.weight_logs(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            peso_kg NUMERIC NOT NULL,
            fecha DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        );

                CREATE TABLE IF NOT EXISTS public.recipes(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            nombre TEXT NOT NULL,
            porciones INTEGER DEFAULT 1,
            instrucciones TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        );

                CREATE TABLE IF NOT EXISTS public.recipe_ingredients(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
            food_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
            gramos NUMERIC NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        );

                CREATE TABLE IF NOT EXISTS public.progress_photos(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            photo_url TEXT NOT NULL,
            tipo TEXT DEFAULT 'frente',
            fecha DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        );

                CREATE TABLE IF NOT EXISTS public.body_measurements(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            fecha DATE NOT NULL,
            peso_kg NUMERIC,
            cintura_cm NUMERIC,
            brazo_cm NUMERIC,
            pecho_cm NUMERIC,
            pierna_cm NUMERIC,
            cuello_cm NUMERIC,
            created_at TIMESTAMPTZ DEFAULT now()
        );
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
