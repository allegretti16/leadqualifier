// Archivio temporaneo per tenere traccia dei token
// Nota: su Vercel questo sarà resettato ad ogni deploy a meno che non usi un database persistente
const approvedTokens = new Set();
const pendingMessages = new Map();

// Esporta le strutture dati
module.exports = {
  approvedTokens,
  pendingMessages
}; 