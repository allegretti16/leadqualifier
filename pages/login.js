import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Verifica se l'utente è già autenticato
  useEffect(() => {
    async function checkAuth() {
      try {
        // Verifica lo stato di autenticazione facendo una richiesta all'API
        const response = await fetch('/api/check-auth');
        if (response.ok) {
          // Se la risposta è OK, l'utente è autenticato
          router.push('/messages');
        }
      } catch (err) {
        // In caso di errore, non fare nulla e mostra il form di login
        console.error('Errore nel controllo dell\'autenticazione:', err);
      }
    }
    
    checkAuth();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
        // Importante per consentire l'invio/ricezione di cookie
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Autenticazione riuscita, reindirizzamento a /messages');
        // Non abbiamo più bisogno di localStorage perché ora usiamo solo cookie
        router.push('/messages');
      } else {
        setError(data.error || 'Errore durante l\'autenticazione');
      }
    } catch (err) {
      console.error('Errore durante l\'autenticazione:', err);
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Login Amministratore</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Caricamento...' : 'Accedi'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background-color: #f3f4f6;
        }
        .login-box {
          background: white;
          padding: 2rem;
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          width: 100%;
          max-width: 400px;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
          color: #374151;
        }
        input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
        }
        button {
          width: 100%;
          padding: 0.75rem;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.25rem;
          cursor: pointer;
        }
        button:disabled {
          background-color: #9ca3af;
          cursor: not-allowed;
        }
        .error {
          color: #ef4444;
          margin-bottom: 1rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
} 