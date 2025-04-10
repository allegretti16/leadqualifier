import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getMessages } from '../utils/supabase';

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // Controllo autenticazione
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    async function fetchMessages() {
      try {
        const data = await getMessages();
        setMessages(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMessages();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    router.push('/login');
  };

  if (loading) return <div className="loading">Caricamento...</div>;
  if (error) return <div className="error">Errore: {error}</div>;

  return (
    <div className="container">
      <div className="header">
        <h1>Gestione Messaggi</h1>
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </div>
      <div className="messages-grid">
        {messages.map((message) => (
          <div key={message.id} className="message-card">
            <div className="message-header">
              <h3>Messaggio #{message.id}</h3>
              <span className={`status ${message.status}`}>
                {message.status}
              </span>
            </div>
            <div className="message-content">
              <p><strong>Email:</strong> {message.email}</p>
              <p><strong>Messaggio Originale:</strong></p>
              <div className="message-text">{message.original_message}</div>
              <p><strong>Risposta Generata:</strong></p>
              <div className="message-text">{message.message_text}</div>
              <p><strong>Dettagli Form:</strong></p>
              <pre>{JSON.stringify(message.form_details, null, 2)}</pre>
            </div>
            <div className="message-actions">
              <a 
                href={`/api/approve?id=${message.message_id}&email=${encodeURIComponent(message.email)}&skipHubspot=true`}
                className="button edit"
                target="_blank"
                rel="noopener noreferrer"
              >
                Modifica e Invia
              </a>
              <a 
                href={`/api/approve?id=${message.message_id}&email=${encodeURIComponent(message.email)}`}
                className="button send"
                target="_blank"
                rel="noopener noreferrer"
              >
                Invia e Salva su HubSpot
              </a>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .logout-button {
          padding: 8px 16px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .logout-button:hover {
          background: #c82333;
        }
        h1 {
          color: #333;
          margin: 0;
        }
        .messages-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .message-card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          padding: 20px;
        }
        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }
        .status.pending {
          background: #fff3cd;
          color: #856404;
        }
        .status.approved {
          background: #d4edda;
          color: #155724;
        }
        .message-content {
          margin-bottom: 15px;
        }
        .message-text {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          margin: 5px 0;
          white-space: pre-wrap;
        }
        .message-actions {
          display: flex;
          gap: 10px;
        }
        .button {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 4px;
          text-decoration: none;
          color: white;
          font-weight: bold;
          text-align: center;
          flex: 1;
        }
        .button.edit {
          background: #007bff;
        }
        .button.send {
          background: #28a745;
        }
        .button:hover {
          opacity: 0.9;
        }
        .loading {
          text-align: center;
          padding: 20px;
          font-size: 18px;
        }
        .error {
          color: #dc3545;
          text-align: center;
          padding: 20px;
        }
        pre {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
} 