-- Agregar la columna 'habilita' a daily_notes
ALTER TABLE daily_notes 
ADD COLUMN IF NOT EXISTS habilita INTEGER DEFAULT 1;

-- Actualizar la política de lectura para filtrar también por habilita
DROP POLICY IF EXISTS "Authenticated users can view today notes" ON daily_notes;
CREATE POLICY "Authenticated users can view today notes"
    ON daily_notes FOR SELECT
    TO authenticated
    USING (created_at = CURRENT_DATE AND habilita = 1);

-- Actualizar la política de borrado para permitir soft-delete (update)
DROP POLICY IF EXISTS "Authenticated users can update today notes" ON daily_notes;
CREATE POLICY "Authenticated users can update today notes"
    ON daily_notes FOR UPDATE
    TO authenticated
    USING (created_at = CURRENT_DATE);
