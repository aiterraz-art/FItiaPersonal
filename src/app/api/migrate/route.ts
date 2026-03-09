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
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_day_type TEXT DEFAULT 'standard';
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS macro_strategy JSONB DEFAULT '{}'::jsonb;
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS week_starts_on TEXT DEFAULT 'monday';

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

        -- Favorites
                CREATE TABLE IF NOT EXISTS public.favorite_foods(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            food_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
            recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
            last_used_at TIMESTAMPTZ DEFAULT now(),
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT favorite_foods_target_check CHECK (
                ((food_id IS NOT NULL)::int + (recipe_id IS NOT NULL)::int) = 1
            )
        );
                CREATE UNIQUE INDEX IF NOT EXISTS favorite_foods_user_food_idx ON public.favorite_foods(user_id, food_id);
                CREATE UNIQUE INDEX IF NOT EXISTS favorite_foods_user_recipe_idx ON public.favorite_foods(user_id, recipe_id);

        -- Templates
                CREATE TABLE IF NOT EXISTS public.meal_templates(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            name TEXT NOT NULL,
            meal_type TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
                CREATE TABLE IF NOT EXISTS public.meal_template_items(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            meal_template_id UUID REFERENCES public.meal_templates(id) ON DELETE CASCADE NOT NULL,
            food_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
            recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
            gramos NUMERIC NOT NULL,
            original_cantidad NUMERIC,
            original_unidad TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT meal_template_items_target_check CHECK (
                ((food_id IS NOT NULL)::int + (recipe_id IS NOT NULL)::int) = 1
            )
        );
                CREATE TABLE IF NOT EXISTS public.day_templates(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            name TEXT NOT NULL,
            day_type TEXT NOT NULL DEFAULT 'standard',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
                CREATE TABLE IF NOT EXISTS public.day_template_items(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            day_template_id UUID REFERENCES public.day_templates(id) ON DELETE CASCADE NOT NULL,
            meal_type TEXT NOT NULL,
            food_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
            recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
            gramos NUMERIC NOT NULL,
            original_cantidad NUMERIC,
            original_unidad TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT day_template_items_target_check CHECK (
                ((food_id IS NOT NULL)::int + (recipe_id IS NOT NULL)::int) = 1
            )
        );

        -- Weekly Planning
                CREATE TABLE IF NOT EXISTS public.weekly_plans(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            week_start DATE NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            source_template_id UUID REFERENCES public.day_templates(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
                CREATE UNIQUE INDEX IF NOT EXISTS weekly_plans_user_week_idx ON public.weekly_plans(user_id, week_start);
                CREATE TABLE IF NOT EXISTS public.weekly_plan_entries(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            weekly_plan_id UUID REFERENCES public.weekly_plans(id) ON DELETE CASCADE NOT NULL,
            plan_date DATE NOT NULL,
            meal_type TEXT NOT NULL,
            food_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
            recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
            gramos NUMERIC NOT NULL,
            original_cantidad NUMERIC,
            original_unidad TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            is_completed BOOLEAN NOT NULL DEFAULT FALSE,
            day_type TEXT DEFAULT 'standard',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT weekly_plan_entries_target_check CHECK (
                ((food_id IS NOT NULL)::int + (recipe_id IS NOT NULL)::int) = 1
            )
        );
                CREATE INDEX IF NOT EXISTS weekly_plan_entries_plan_date_idx ON public.weekly_plan_entries(weekly_plan_id, plan_date);

        -- Shopping
                CREATE TABLE IF NOT EXISTS public.shopping_lists(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            week_start DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
                CREATE UNIQUE INDEX IF NOT EXISTS shopping_lists_user_week_idx ON public.shopping_lists(user_id, week_start);
                CREATE TABLE IF NOT EXISTS public.shopping_list_items(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            shopping_list_id UUID REFERENCES public.shopping_lists(id) ON DELETE CASCADE NOT NULL,
            ingredient_name TEXT NOT NULL,
            quantity_grams NUMERIC NOT NULL,
            is_checked BOOLEAN NOT NULL DEFAULT FALSE,
            source_count INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
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
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_day_type TEXT DEFAULT 'standard';
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS macro_strategy JSONB DEFAULT '{}'::jsonb;
                ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS week_starts_on TEXT DEFAULT 'monday';
                
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

                CREATE TABLE IF NOT EXISTS public.favorite_foods(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            food_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
            recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
            last_used_at TIMESTAMPTZ DEFAULT now(),
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT favorite_foods_target_check CHECK (
                ((food_id IS NOT NULL)::int + (recipe_id IS NOT NULL)::int) = 1
            )
        );
                CREATE UNIQUE INDEX IF NOT EXISTS favorite_foods_user_food_idx ON public.favorite_foods(user_id, food_id);
                CREATE UNIQUE INDEX IF NOT EXISTS favorite_foods_user_recipe_idx ON public.favorite_foods(user_id, recipe_id);

                CREATE TABLE IF NOT EXISTS public.meal_templates(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            name TEXT NOT NULL,
            meal_type TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
                CREATE TABLE IF NOT EXISTS public.meal_template_items(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            meal_template_id UUID REFERENCES public.meal_templates(id) ON DELETE CASCADE NOT NULL,
            food_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
            recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
            gramos NUMERIC NOT NULL,
            original_cantidad NUMERIC,
            original_unidad TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT meal_template_items_target_check CHECK (
                ((food_id IS NOT NULL)::int + (recipe_id IS NOT NULL)::int) = 1
            )
        );
                CREATE TABLE IF NOT EXISTS public.day_templates(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            name TEXT NOT NULL,
            day_type TEXT NOT NULL DEFAULT 'standard',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
                CREATE TABLE IF NOT EXISTS public.day_template_items(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            day_template_id UUID REFERENCES public.day_templates(id) ON DELETE CASCADE NOT NULL,
            meal_type TEXT NOT NULL,
            food_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
            recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
            gramos NUMERIC NOT NULL,
            original_cantidad NUMERIC,
            original_unidad TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT day_template_items_target_check CHECK (
                ((food_id IS NOT NULL)::int + (recipe_id IS NOT NULL)::int) = 1
            )
        );

                CREATE TABLE IF NOT EXISTS public.weekly_plans(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            week_start DATE NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            source_template_id UUID REFERENCES public.day_templates(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
                CREATE UNIQUE INDEX IF NOT EXISTS weekly_plans_user_week_idx ON public.weekly_plans(user_id, week_start);
                CREATE TABLE IF NOT EXISTS public.weekly_plan_entries(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            weekly_plan_id UUID REFERENCES public.weekly_plans(id) ON DELETE CASCADE NOT NULL,
            plan_date DATE NOT NULL,
            meal_type TEXT NOT NULL,
            food_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
            recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
            gramos NUMERIC NOT NULL,
            original_cantidad NUMERIC,
            original_unidad TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            is_completed BOOLEAN NOT NULL DEFAULT FALSE,
            day_type TEXT DEFAULT 'standard',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT weekly_plan_entries_target_check CHECK (
                ((food_id IS NOT NULL)::int + (recipe_id IS NOT NULL)::int) = 1
            )
        );
                CREATE INDEX IF NOT EXISTS weekly_plan_entries_plan_date_idx ON public.weekly_plan_entries(weekly_plan_id, plan_date);

                CREATE TABLE IF NOT EXISTS public.shopping_lists(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            week_start DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
                CREATE UNIQUE INDEX IF NOT EXISTS shopping_lists_user_week_idx ON public.shopping_lists(user_id, week_start);
                CREATE TABLE IF NOT EXISTS public.shopping_list_items(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            shopping_list_id UUID REFERENCES public.shopping_lists(id) ON DELETE CASCADE NOT NULL,
            ingredient_name TEXT NOT NULL,
            quantity_grams NUMERIC NOT NULL,
            is_checked BOOLEAN NOT NULL DEFAULT FALSE,
            source_count INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
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
