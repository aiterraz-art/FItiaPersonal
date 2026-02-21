-- SCRIPT CORREGIDO PARA REGISTRO INMEDIATO Y AUTO-CONFIRMACIÓN
-- Objetivo: Que los usuarios queden activos sin necesidad de confirmar correo.
-- Se eliminó la columna 'confirmed_at' por ser una columna generada en nuevas versiones de Supabase.
-- 1. Crear o actualizar la función de manejo de nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$ BEGIN -- A. Crear el perfil en la tabla pública
INSERT INTO public.profiles (id, nombre, meta_kcal, fase)
VALUES (
        new.id,
        COALESCE(
            new.raw_user_meta_data->>'full_name',
            'Nuevo Usuario'
        ),
        2000,
        'Mantenimiento'
    );
-- B. AUTO-CONFIRMAR el usuario inmediatamente
-- Solo actualizamos email_confirmed_at, las columnas generadas se encargan del resto.
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE id = NEW.id;
RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 2. Asegurar que el trigger esté activo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();