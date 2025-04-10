-- Abilita Row Level Security sulla tabella messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Crea le policy per le operazioni CRUD

-- Policy per la lettura (SELECT)
CREATE POLICY "Enable read access for authenticated users" 
ON messages FOR SELECT 
TO authenticated 
USING (true);

-- Policy per l'inserimento (INSERT)
CREATE POLICY "Enable insert for authenticated users" 
ON messages FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy per l'aggiornamento (UPDATE)
CREATE POLICY "Enable update for authenticated users" 
ON messages FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Policy per l'eliminazione (DELETE)
CREATE POLICY "Enable delete for authenticated users" 
ON messages FOR DELETE 
TO authenticated 
USING (true);

-- Crea un ruolo di servizio per le operazioni di sistema
CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; 