import { useState, useEffect } from 'react';
import Login from './components/Login';
import Home from './components/Home';

function App() {
  const [user, setUser] = useState(localStorage.getItem('visitAppUser'));
  const [consultants, setConsultants] = useState([]);

  useEffect(() => {
    // Fetch and parse the passwords file
    fetch('/images/senhas_consultores.csv')
      .then(r => r.text())
      .then(text => {
        const lines = text.split('\n').filter(l => l.trim());
        const data = lines.slice(1).map(line => {
          const [name, pass] = line.split(';');
          return { name: name?.trim(), pass: pass?.trim() };
        });
        setConsultants(data);
      })
      .catch(err => console.error("Erro ao carregar senhas:", err));
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('visitAppUser', user);
    } else {
      localStorage.removeItem('visitAppUser');
    }
  }, [user]);

  const handleLogin = (inputPass) => {
    // Clean input
    const cleanPass = inputPass.trim();

    // Find consultant with this password
    const found = consultants.find(c => c.pass === cleanPass);

    if (found) {
      setUser(found.name);
    } else {
      alert("Senha não encontrada ou incorreta. Verifique os 4 primeiros dígitos do RG.");
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return <Home user={user} onLogout={() => setUser(null)} />;
}

export default App;
