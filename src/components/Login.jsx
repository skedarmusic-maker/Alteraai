import { useState } from 'react';
import { motion } from 'framer-motion';
import './Login.css';

export default function Login({ onLogin }) {
    const [name, setName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim()) {
            onLogin(name.trim());
        }
    };

    return (
        <div className="login-container">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="login-card"
            >
                <img src="/images/logoprotradenovo.png" alt="ProTrade Logo" className="login-logo" />
                <h1>Bem-vindo</h1>
                <p>Identifique-se para acessar seu roteiro</p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="4 primeiros digitos RG"
                        className="login-input"
                        autoFocus
                    />
                    <button type="submit" className="login-button">
                        Acessar Roteiro
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
