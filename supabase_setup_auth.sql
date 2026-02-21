-- SCRIPT PARA CREACIÓN AUTOMÁTICA DE PERFILES
-- Copia y pega esto en el SQL Editor de Supabase
-- 1. Crear la función que manejará la inserción
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$ BEGIN
INSERT INTO public.profiles (id, nombre, meta_kcal, fase)
VALUES (
        new.id,
        COALESCE(
            new.raw_user_meta_data->>'full_name',
            'Nuevo Usuario'
        ),
        2000,
        -- Meta por defecto
        'Mantenimiento' -- Fase por defecto
    );
RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 2. Crear el trigger que se dispara al insertar en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();