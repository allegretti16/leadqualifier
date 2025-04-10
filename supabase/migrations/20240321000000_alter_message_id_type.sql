-- Prima verifichiamo i valori non numerici
SELECT message_id 
FROM messages 
WHERE message_id !~ '^[0-9]+$';

-- Se non ci sono valori non numerici, procediamo con la conversione
ALTER TABLE messages ALTER COLUMN message_id TYPE bigint USING message_id::bigint;

-- Aggiungiamo eventuali vincoli se necessario
ALTER TABLE messages ALTER COLUMN message_id SET NOT NULL; 