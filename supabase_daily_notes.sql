-- ==============================================
-- daily_notes: Script Completo (Creación + Soft Delete + Realtime Seguro)
-- ==============================================

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS daily_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    done BOOLEAN DEFAULT FALSE,
    created_by TEXT NOT NULL,
    created_at DATE DEFAULT CURRENT_DATE
);

-- 2. Asegurar columna habilita (Soft Delete)
ALTER TABLE daily_notes 
ADD COLUMN IF NOT EXISTS habilita INTEGER DEFAULT 1;

-- 3. Habilitar RLS
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;

-- 4. Limpiar políticas viejas
DROP POLICY IF EXISTS "Authenticated users can view today notes" ON daily_notes;
DROP POLICY IF EXISTS "Authenticated users can insert notes" ON daily_notes;
DROP POLICY IF EXISTS "Authenticated users can update today notes" ON daily_notes;
DROP POLICY IF EXISTS "Authenticated users can delete today notes" ON daily_notes;

-- 5. Nuevas Políticas

-- Ver: Solo hoy y habilitadas
CREATE POLICY "Authenticated users can view today notes"
    ON daily_notes FOR SELECT TO authenticated
    USING (created_at = CURRENT_DATE AND habilita = 1);

-- Insertar
CREATE POLICY "Authenticated users can insert notes"
    ON daily_notes FOR INSERT TO authenticated
    WITH CHECK (created_at = CURRENT_DATE);

-- Actualizar (soft delete)
CREATE POLICY "Authenticated users can update today notes"
    ON daily_notes FOR UPDATE TO authenticated
    USING (created_at = CURRENT_DATE);

-- Borrar
CREATE POLICY "Authenticated users can delete today notes"
    ON daily_notes FOR DELETE TO authenticated
    USING (created_at = CURRENT_DATE);

-- 6. Realtime (Seguro: verifica si ya existe)
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class pc ON pr.prrelid = pc.oid
      JOIN pg_publication pp ON pr.prpubid = pp.oid
      WHERE pp.pubname = 'supabase_realtime' AND pc.relname = 'daily_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE daily_notes;
  END IF;
END $$;
