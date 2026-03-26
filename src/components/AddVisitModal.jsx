import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { createWhatsAppLink, CONTACTS } from '../utils/whatsapp';
import { logToSheet } from '../utils/logger';

export default function AddVisitModal({ date, availableStores = [], onClose, user, onSave }) {
    const [selectedStore, setSelectedStore] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [visitType, setVisitType] = useState('');
    const [reason, setReason] = useState('');

    // Estado da aprovação (Manuela)
    const [isSent, setIsSent] = useState(false);

    const handleSubmit = () => {
        const message = `Olá, Manuela. Gostaria de incluir uma *NOVA VISITA* nesta data:

📅 *Data:* ${date}
📍 *Loja:* ${selectedStore}
🕒 *Horário:* ${startTime} - ${endTime}
🏷️ *Tipo:* ${visitType || 'N/A'}

📝 *Motivo:* ${reason}`;

        // Prepare data object
        const newInclusion = {
            id: Date.now().toString(), // unique id
            date,
            store: selectedStore,
            checkIn: startTime,
            checkOut: endTime,
            visitType,
            reason,
            consultant: user,
            timestamp: new Date().toISOString()
        };

        // Log to Sheet
        logToSheet({
            consultant: user,
            type: 'Nova Inclusão',
            originalDate: date, // No original, but we use the target date
            originalTime: '',
            storeFrom: '', // No original store
            storeTo: selectedStore,
            newDate: date,
            newTime: `${startTime}-${endTime}`,
            visitType: visitType,
            reason: reason
        });

        // Save to local storage
        const existing = JSON.parse(localStorage.getItem('newInclusions') || '[]');
        existing.push(newInclusion);
        localStorage.setItem('newInclusions', JSON.stringify(existing));

        // Open WhatsApp para Manuela e avança tela
        window.open(createWhatsAppLink(CONTACTS.MANUELA, message), '_blank');
        setIsSent(true);
    };

    const handleConfirmClose = () => {
        onSave();
        onClose();
    };

    return (
        <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="modal-content"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <button className="close-btn" onClick={onClose}><X size={24} /></button>

                <div className="modal-header">
                    <h2>Nova Inclusão</h2>
                    <p className="modal-subtitle">Adicionar visita para {date}</p>
                </div>

                <div className="modal-body">
                    {isSent ? (
                        <div className="form-view">
                            <h3 style={{ color: '#00C49F' }}>Solicitação enviada!</h3>
                            <p style={{ margin: '16px 0', fontSize: '15px' }}>✅ A mensagem foi gerada para a <strong>Manuela</strong>.</p>
                            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#aaa' }}>Lembre-se de encaminhar a mensagem no WhatsApp para finalizar.</p>
                            <button
                                className="submit-btn"
                                onClick={handleConfirmClose}
                                style={{ width: '100%', background: 'var(--color-primary-purple)' }}
                            >
                                Ok, entendi
                            </button>
                        </div>
                    ) : (
                        <div className="form-view">
                            <div className="input-group">
                            <label>Loja</label>
                            <select
                                value={selectedStore}
                                onChange={e => setSelectedStore(e.target.value)}
                                className="store-select"
                            >
                                <option value="">Selecione uma loja...</option>
                                {availableStores.map((store, idx) => (
                                    <option key={idx} value={store}>{store}</option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label>Tipo de Visita</label>
                            <select
                                value={visitType}
                                onChange={e => setVisitType(e.target.value)}
                            >
                                <option value="" disabled>Selecione...</option>
                                <option value="Simples">Simples</option>
                                <option value="Completa">Completa</option>
                            </select>
                        </div>

                        <div className="input-group-row">
                            <div className="input-group">
                                <label>Início</label>
                                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>Fim</label>
                                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Motivo</label>
                            <textarea
                                rows="3"
                                placeholder="Explique o motivo da inclusão..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                            />
                        </div>

                        <div className="form-actions">
                            <button className="cancel-btn" onClick={onClose}>Cancelar</button>
                            <button
                                className="submit-btn"
                                onClick={handleSubmit}
                                disabled={!selectedStore || !visitType || !startTime || !endTime || !reason}
                                style={(!selectedStore || !visitType || !startTime || !endTime || !reason) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                                <Send size={16} /> Incluir (WhatsApp)
                            </button>
                        </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
