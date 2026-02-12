import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, MapPin, ArrowRight, Send } from 'lucide-react';
import { createWhatsAppLink, CONTACTS } from '../utils/whatsapp';
import { logToSheet } from '../utils/logger';

export default function VisitDetailModal({ visit, availableStores = [], onClose, user }) {
    const [view, setView] = useState('menu'); // menu, formA, formC

    // Form A State (Time Change)
    const [newCheckIn, setNewCheckIn] = useState('');
    const [newCheckOut, setNewCheckOut] = useState('');
    const [reason, setReason] = useState('');

    // Form C State (JP Change)
    const [newStore, setNewStore] = useState('');
    const [newTime, setNewTime] = useState('');
    const [newTimeEnd, setNewTimeEnd] = useState('');

    const [visitType, setVisitType] = useState('');
    const [reasonJP, setReasonJP] = useState('');

    // Check availability (visit specific)
    const visitKey = `${visit.date}-${visit.store}`;

    const [hasPendingTime, setHasPendingTime] = useState(() => {
        const saved = localStorage.getItem(`pendingTimeChange-${visitKey}`);
        return !!saved;
    });

    const [hasPendingJP, setHasPendingJP] = useState(() => {
        const saved = localStorage.getItem(`pendingJPChange-${visitKey}`);
        return !!saved;
    });

    const handleTimeChangeRequest = () => {
        if (hasPendingTime) {
            const confirmResend = window.confirm("Você já solicitou alteração de horário para esta visita. Deseja enviar novamente?");
            if (!confirmResend) return;
        }

        const requestData = {
            store: visit.store,
            date: visit.date,
            originalCheckIn: visit.checkIn,
            originalCheckOut: visit.checkOut,
            newCheckIn,
            newCheckOut,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(`pendingTimeChange-${visitKey}`, JSON.stringify(requestData));

        const message = `Olá, André. Gostaria de verificar a possibilidade de alteração de *HORÁRIO* nesta loja:

📅 *Data:* ${visit.date}
📍 *Loja:* ${visit.store}
🕒 *Horário Atual:* ${visit.checkIn} - ${visit.checkOut}
🆕 *Novo Horário:* ${newCheckIn} - ${newCheckOut}

📝 *Motivo:* ${reason}`;

        // Log to Sheet
        logToSheet({
            consultant: user,
            type: 'Horário',
            originalDate: visit.date,
            originalTime: `${visit.checkIn}-${visit.checkOut}`,
            storeFrom: visit.store,
            storeTo: visit.store,
            newDate: visit.date,
            newTime: `${newCheckIn}-${newCheckOut}`,
            reason: reason
        });

        window.open(createWhatsAppLink(CONTACTS.ANDRE, message), '_blank');
        onClose();
        setHasPendingTime(true);
    };

    const handleTimeChangeExecution = () => {
        const saved = localStorage.getItem(`pendingTimeChange-${visitKey}`);
        let data = saved ? JSON.parse(saved) : null;

        if (!data) {
            alert("Nenhuma alteração pendente encontrada.");
            return;
        }

        const message = `Pode alterar o *HORÁRIO* desta visita?

📅 *Data:* ${data.date || visit.date}
📍 *Loja:* ${data.store}
🕒 *De:* ${data.originalCheckIn} - ${data.originalCheckOut}
➡️ *Para:* ${data.newCheckIn} - ${data.newCheckOut}

✅ Já alinhado com o André.
Obrigado!`;

        window.open(createWhatsAppLink(null, message), '_blank');
    };

    const handleJPChangeRequest = () => {
        if (hasPendingJP) {
            const confirmResend = window.confirm("Você já solicitou alteração de JP para esta visita. Deseja enviar novamente?");
            if (!confirmResend) return;
        }

        const requestData = {
            originalStore: visit.store,
            newStore,
            newTime,
            newTimeEnd,
            newDate: visit.date,
            visitType,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(`pendingJPChange-${visitKey}`, JSON.stringify(requestData));

        const message = `Olá, André. Gostaria de verificar a possibilidade de alteração de *JP (Loja)*:

📍 *De:* ${visit.store}
🕒 *Horário:* ${visit.checkIn}

⬇️ *PARA* ⬇️

📍 *Nova Loja:* ${newStore}
📅 *Data:* ${visit.date}
🕒 *Novo Horário:* ${newTime} - ${newTimeEnd}
🏷️ *Tipo:* ${visitType || '(SELECIONE O TIPO)'}

📝 *Motivo:* ${reasonJP}`;

        // Log to Sheet
        logToSheet({
            consultant: user,
            type: 'JP (Loja)',
            originalDate: visit.date,
            originalTime: `${visit.checkIn}-${visit.checkOut}`,
            storeFrom: visit.store,
            storeTo: newStore,
            newDate: visit.date,
            newTime: `${newTime}-${newTimeEnd}`,
            visitType: visitType,
            reason: reasonJP
        });

        window.open(createWhatsAppLink(CONTACTS.ANDRE, message), '_blank');
        onClose();
        setHasPendingJP(true);
    };

    const handleJPExecution = () => {
        const saved = localStorage.getItem(`pendingJPChange-${visitKey}`);
        let data = saved ? JSON.parse(saved) : null;

        if (!data) {
            alert("Nenhuma alteração de JP pendente encontrada.");
            return;
        }

        const message = `Pode alterar o *JP* desta visita?

📍 *De:* ${data.originalStore}
⬇️ *Para:* ${data.newStore}
📅 *Nova Data:* ${data.newDate ? data.newDate : 'Mesmo dia'}
🕒 *Novo Horário:* ${data.newTime} - ${data.newTimeEnd}
🏷️ *Tipo:* ${data.visitType || 'N/A'}

✅ Já alinhado com o André.
Obrigado!`;

        window.open(createWhatsAppLink(null, message), '_blank');
    };

    const handleInclusionExecution = () => {
        const message = `Pode confirmar a *INCLUSÃO* desta visita?

📅 *Data:* ${visit.date}
📍 *Loja:* ${visit.store}
🕒 *Horário:* ${visit.checkIn} - ${visit.checkOut}
🏷️ *Tipo:* ${visit.visitType || 'N/A'}

📝 *Motivo:* ${visit.reason || 'N/A'}

✅ Já alinhado com o André.
Obrigado!`;

        window.open(createWhatsAppLink(null, message), '_blank');
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
                    <span className="modal-date-label">{visit.date}</span>
                    <h2>{visit.store}</h2>
                    <p className="modal-subtitle">
                        <Clock size={16} /> {visit.checkIn} - {visit.checkOut}
                    </p>
                    {visit.client && <p className="modal-client">{visit.client}</p>}
                </div>

                <div className="modal-body">
                    {view === 'menu' && (
                        <div className="action-buttons">
                            {/* Standard Alterations (JP/Time) */}
                            {!visit.isNewInclusion && (
                                <>
                                    <button
                                        className="action-btn btn-a"
                                        onClick={() => setView('formA')}
                                        style={hasPendingTime ? { background: 'linear-gradient(135deg, #4a4a4a, #2a2a2a)' } : {}}
                                    >
                                        <span>{hasPendingTime ? 'Horário (Solicitado)' : 'Altera Horário'}</span>
                                        {hasPendingTime ? '(Clique p/ reenviar)' : '(André)'}
                                    </button>

                                    {hasPendingTime && (
                                        <button className="action-btn btn-b" onClick={handleTimeChangeExecution}>
                                            <span>Executar Horário</span> (WhatsApp)
                                        </button>
                                    )}

                                    <button
                                        className="action-btn btn-c"
                                        onClick={() => setView('formC')}
                                        style={hasPendingJP ? { background: 'linear-gradient(135deg, #4a4a4a, #2a2a2a)' } : {}}
                                    >
                                        <span>{hasPendingJP ? 'JP (Solicitado)' : 'Altera JP'}</span>
                                        {hasPendingJP ? '(Clique p/ reenviar)' : '(André)'}
                                    </button>

                                    {hasPendingJP && (
                                        <button className="action-btn btn-d" onClick={handleJPExecution}>
                                            <span>Executar JP</span> (WhatsApp)
                                        </button>
                                    )}
                                </>
                            )}

                            {/* New Inclusion Actions */}
                            {visit.isNewInclusion && (
                                <button className="action-btn btn-b" onClick={handleInclusionExecution}>
                                    <span>Executar Inclusão</span> (WhatsApp)
                                </button>
                            )}
                        </div>
                    )}

                    {view === 'formA' && (
                        <div className="form-view">
                            <h3>Solicitar Alteração de Horário</h3>
                            <div className="input-group">
                                <label>Novo Check-in</label>
                                <input type="time" value={newCheckIn} onChange={e => setNewCheckIn(e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>Novo Check-out</label>
                                <input type="time" value={newCheckOut} onChange={e => setNewCheckOut(e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>Motivo</label>
                                <textarea
                                    rows="3"
                                    placeholder="Explique o motivo da alteração..."
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                />
                            </div>
                            <div className="form-actions">
                                <button className="cancel-btn" onClick={() => setView('menu')}>Voltar</button>
                                <button
                                    className="submit-btn"
                                    onClick={handleTimeChangeRequest}
                                    disabled={!newCheckIn || !newCheckOut || !reason}
                                    style={(!newCheckIn || !newCheckOut || !reason) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                    <Send size={16} /> Solicitar WhatsApp
                                </button>
                            </div>
                        </div>
                    )}

                    {view === 'formC' && (
                        <div className="form-view">
                            <h3>Solicitar Alteração de JP (Loja)</h3>
                            <div className="input-group">
                                <label>Nova Loja</label>
                                <select
                                    value={newStore}
                                    onChange={e => setNewStore(e.target.value)}
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

                            <div className="input-group">
                                <label>Nova Data</label>
                                <input
                                    type="text"
                                    value={visit.date}
                                    disabled
                                    style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                                />
                            </div>

                            <div className="input-group">
                                <label>Novo Start</label>
                                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>Novo End</label>
                                <input type="time" value={newTimeEnd} onChange={e => setNewTimeEnd(e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>Motivo</label>
                                <textarea
                                    rows="3"
                                    placeholder="Explique o motivo da alteração..."
                                    value={reasonJP}
                                    onChange={e => setReasonJP(e.target.value)}
                                />
                            </div>
                            <div className="form-actions">
                                <button className="cancel-btn" onClick={() => setView('menu')}>Voltar</button>
                                <button
                                    className="submit-btn"
                                    onClick={handleJPChangeRequest}
                                    disabled={!newStore || !visitType || !newTime || !newTimeEnd || !reasonJP}
                                    style={(!newStore || !visitType || !newTime || !newTimeEnd || !reasonJP) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                    <Send size={16} /> Solicitar WhatsApp
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
