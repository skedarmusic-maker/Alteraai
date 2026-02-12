import { useState, useEffect } from 'react';
import { ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { createWhatsAppLink, CONTACTS } from '../utils/whatsapp';
import { logToSheet } from '../utils/logger';
import './MassEdit.css';

export default function MassEdit({ visits, availableStores, onBack, user, mode = 'jp' }) {
    const [step, setStep] = useState('selection'); // selection, editing
    const [selectedVisits, setSelectedVisits] = useState([]);
    const [edits, setEdits] = useState({}); // { uniqueId: { newStore: '', visitType: '', reason: '', newStartTime: '', newEndTime: '' } }

    const [hasRequestSent, setHasRequestSent] = useState(() => {
        return !!localStorage.getItem(mode === 'time' ? 'hasPendingMassTimeRequest' : 'hasPendingMassRequest');
    });

    const [hasExecutionSent, setHasExecutionSent] = useState(() => {
        return !!localStorage.getItem(mode === 'time' ? 'hasPendingMassTimeExecution' : 'hasPendingMassExecution');
    });

    const handleSelect = (visit, uniqueId) => {
        const isSelected = selectedVisits.includes(uniqueId);
        if (isSelected) {
            setSelectedVisits(selectedVisits.filter(i => i !== uniqueId));
            const newEdits = { ...edits };
            delete newEdits[uniqueId];
            setEdits(newEdits);
        } else {
            setSelectedVisits([...selectedVisits, uniqueId]);
            setEdits({
                ...edits,
                [uniqueId]: {
                    newStore: '',
                    visitType: '',
                    reason: '',
                    newStartTime: visit.checkIn,
                    newEndTime: visit.checkOut
                }
            });
        }
    };

    const handleEditChange = (uniqueId, field, value) => {
        setEdits({
            ...edits,
            [uniqueId]: {
                ...edits[uniqueId],
                [field]: value
            }
        });
    };

    const buildMessage = (isExecution = false) => {
        let message = '';

        if (mode === 'jp') {
            message = isExecution
                ? `*EXECUÇÃO DE ALTERAÇÃO EM MASSA (JP)*\n✅ Já alinhado com o André.\n\n`
                : `Olá, André. Por gentileza, é possível realizar a alteração de Loja (JP) dessas visitas abaixo?\n\n`;
        } else {
            message = isExecution
                ? `*EXECUÇÃO DE ALTERAÇÃO EM MASSA (HORÁRIO)*\n✅ Já alinhado com o André.\n\n`
                : `Olá, André. Por gentileza, é possível alterar o horário de atendimento dessas lojas abaixo?\n\n`;
        }

        visits.forEach((group) => {
            group.visits.forEach((visit, vIdx) => {
                const uniqueId = `${group.dateStr}-${vIdx}`;
                if (!selectedVisits.includes(uniqueId)) return;

                const edit = edits[uniqueId];
                if (!edit) return;

                if (mode === 'jp') {
                    if (!isExecution) {
                        message += `*${group.dateStr}* ➡️ DE: ${visit.store} ➡️ PARA: ${edit.newStore}\n`;
                        message += `🏷️ Tipo: ${edit.visitType || '(SELECIONE O TIPO)'} | 🕒 ${edit.newStartTime || visit.checkIn} - ${edit.newEndTime || visit.checkOut}\n`;
                        message += `📝 Motivo: ${edit.reason || 'Não informado'}\n\n\n`;
                    } else {
                        message += `*${group.dateStr}* ➡️ DE: ${visit.store} ➡️ PARA: ${edit.newStore}\n`;
                        message += `🏷️ ${edit.visitType || '(SELECIONE O TIPO)'} | 🕒 ${edit.newStartTime || visit.checkIn} - ${edit.newEndTime || visit.checkOut}\n\n`;
                    }
                } else {
                    // TIME MODE
                    if (!isExecution) {
                        message += `*${group.dateStr}* | ${visit.store}\n`;
                        message += `🕒 DE: ${visit.checkIn} - ${visit.checkOut} ➡️ PARA: ${edit.newStartTime} - ${edit.newEndTime}\n`;
                        message += `📝 Motivo: ${edit.reason || 'Não informado'}\n\n\n`;
                    } else {
                        message += `*${group.dateStr}* | ${visit.store}\n`;
                        message += `🕒 NOVO HORÁRIO: ${edit.newStartTime} - ${edit.newEndTime}\n\n`;
                    }
                }
            });
        });

        return message;
    };

    const handleRequestToAndre = () => {
        if (selectedVisits.length === 0) return;

        if (hasRequestSent) {
            const confirmResend = window.confirm("Você já solicitou essa alteração. Deseja enviar novamente?");
            if (!confirmResend) return;
        }

        visits.forEach((group) => {
            group.visits.forEach((visit, vIdx) => {
                const uniqueId = `${group.dateStr}-${vIdx}`;
                if (selectedVisits.includes(uniqueId)) {
                    const edit = edits[uniqueId];
                    if (edit) {
                        const visitKey = `${group.dateStr}-${visit.store}`;

                        if (mode === 'jp') {
                            const newTimeFormatted = (edit.newStartTime && edit.newEndTime) ? `${edit.newStartTime}-${edit.newEndTime}` : `${visit.checkIn}-${visit.checkOut}`;
                            logToSheet({
                                consultant: user,
                                type: 'Massa JP',
                                originalDate: group.dateStr,
                                originalTime: `${visit.checkIn}-${visit.checkOut}`,
                                storeFrom: visit.store,
                                storeTo: edit.newStore,
                                newDate: group.dateStr,
                                newTime: newTimeFormatted,
                                visitType: edit.visitType,
                                reason: edit.reason
                            });

                            const requestData = {
                                originalStore: visit.store,
                                newStore: edit.newStore,
                                newTime: edit.newStartTime || visit.checkIn,
                                newTimeEnd: edit.newEndTime || visit.checkOut,
                                newDate: group.dateStr,
                                visitType: edit.visitType,
                                timestamp: new Date().toISOString(),
                                isMassEdit: true
                            };
                            localStorage.setItem(`pendingJPChange-${visitKey}`, JSON.stringify(requestData));

                        } else {
                            // TIME MODE
                            const newTimeFormatted = `${edit.newStartTime}-${edit.newEndTime}`;
                            logToSheet({
                                consultant: user,
                                type: 'Massa Horário',
                                originalDate: group.dateStr,
                                originalTime: `${visit.checkIn}-${visit.checkOut}`,
                                storeFrom: visit.store,
                                storeTo: visit.store, // Store unchanged
                                newDate: group.dateStr,
                                newTime: newTimeFormatted,
                                visitType: 'Alteração Horário',
                                reason: edit.reason
                            });

                            const requestData = {
                                originalTime: `${visit.checkIn} - ${visit.checkOut}`,
                                newTime: newTimeFormatted,
                                timestamp: new Date().toISOString(),
                                isMassEdit: true
                            };
                            localStorage.setItem(`pendingTimeChange-${visitKey}`, JSON.stringify(requestData));
                        }
                    }
                }
            });
        });

        const message = buildMessage(false);
        window.open(createWhatsAppLink(CONTACTS.ANDRE, message), '_blank');

        setHasRequestSent(true);
        localStorage.setItem(mode === 'time' ? 'hasPendingMassTimeRequest' : 'hasPendingMassRequest', 'true');
    };

    const handleExecution = () => {
        if (selectedVisits.length === 0) return;

        if (hasExecutionSent) {
            const confirmResend = window.confirm("Você já enviou o comprovante. Deseja enviar novamente?");
            if (!confirmResend) return;
        }

        const message = buildMessage(true);
        window.open(createWhatsAppLink(null, message), '_blank');

        setHasExecutionSent(true);
        localStorage.setItem(mode === 'time' ? 'hasPendingMassTimeExecution' : 'hasPendingMassExecution', 'true');
    };

    const isReadyToSubmit = selectedVisits.length > 0 && !selectedVisits.some(id => {
        const e = edits[id];
        if (!e) return true;
        if (mode === 'jp') {
            return !e.newStore || !e.visitType || !e.reason || !e.newStartTime || !e.newEndTime;
        } else {
            return !e.newStartTime || !e.newEndTime || !e.reason;
        }
    });

    if (step === 'selection') {
        return (
            <div className="mass-edit-container">
                <header className="mass-header">
                    <button onClick={onBack} className="back-btn"><ArrowLeft size={24} /></button>
                    <h2>{mode === 'jp' ? 'Selecione (JP)' : 'Selecione (Horário)'}</h2>
                </header>

                <div className="selection-list">
                    {visits.map((group, gIdx) => (
                        <div key={gIdx} className="date-group">
                            <h3 className="group-date">{group.dateStr}</h3>
                            {group.visits.map((visit, vIdx) => {
                                const uniqueId = `${group.dateStr}-${vIdx}`;
                                const isSelected = selectedVisits.includes(uniqueId);

                                return (
                                    <div
                                        key={uniqueId}
                                        className={`selection-item ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleSelect(visit, uniqueId)}
                                    >
                                        <div className="checkbox-ring">
                                            {isSelected && <div className="checkbox-dot" />}
                                        </div>
                                        <div className="item-info">
                                            <span className="item-time">{visit.checkIn} - {visit.checkOut}</span>
                                            <span className="item-store">{visit.store}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="mass-footer">
                    <button
                        className="primary-btn"
                        disabled={selectedVisits.length === 0}
                        onClick={() => setStep('editing')}
                    >
                        Confirmar Seleção ({selectedVisits.length})
                    </button>
                </div>
            </div>
        );
    }

    // Editing Step
    return (
        <div className="mass-edit-container">
            <header className="mass-header">
                <button onClick={() => setStep('selection')} className="back-btn"><ArrowLeft size={24} /></button>
                <h2>{mode === 'jp' ? 'Definir Lojas' : 'Definir Horários'}</h2>
            </header>

            <div className="table-container">
                <table className="excel-table">
                    <thead>
                        <tr>
                            <th>Data / Loja</th>
                            {mode === 'jp' ? (
                                <>
                                    <th className="highlight-header">Nova Loja</th>
                                    <th style={{ width: '100px' }}>Horário</th>
                                    <th style={{ width: '120px' }}>Tipo</th>
                                </>
                            ) : (
                                <>
                                    <th className="highlight-header">Início</th>
                                    <th className="highlight-header">Fim</th>
                                </>
                            )}
                            <th>Motivo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visits.map((group) => (
                            group.visits.map((visit, vIdx) => {
                                const uniqueId = `${group.dateStr}-${vIdx}`;
                                if (!selectedVisits.includes(uniqueId)) return null;

                                const edit = edits[uniqueId];

                                return (
                                    <tr key={uniqueId}>
                                        <td>
                                            <div className="cell-date">{group.dateStr}</div>
                                            <div className="cell-time" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                                {mode === 'jp' ? `${visit.checkIn} - ${visit.checkOut}` : visit.store}
                                            </div>
                                            {mode === 'time' && <div className="cell-time">{visit.checkIn} - {visit.checkOut}</div>}
                                        </td>

                                        {mode === 'jp' ? (
                                            <>
                                                <td className="highlight-cell">
                                                    <select
                                                        value={edit?.newStore || ''}
                                                        onChange={(e) => handleEditChange(uniqueId, 'newStore', e.target.value)}
                                                    >
                                                        <option value="" disabled>Selecione...</option>
                                                        {availableStores.map(s => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <div className="time-edit-group">
                                                        <input
                                                            type="time"
                                                            value={edit?.newStartTime || ''}
                                                            onChange={(e) => handleEditChange(uniqueId, 'newStartTime', e.target.value)}
                                                            className="time-input-mini"
                                                            style={{ marginBottom: '4px' }}
                                                        />
                                                        <input
                                                            type="time"
                                                            value={edit?.newEndTime || ''}
                                                            onChange={(e) => handleEditChange(uniqueId, 'newEndTime', e.target.value)}
                                                            className="time-input-mini"
                                                        />
                                                    </div>
                                                </td>
                                                <td>
                                                    <select
                                                        value={edit?.visitType || ''}
                                                        onChange={(e) => handleEditChange(uniqueId, 'visitType', e.target.value)}
                                                    >
                                                        <option value="" disabled>Selecione...</option>
                                                        <option value="Simples">Simples</option>
                                                        <option value="Completa">Completa</option>
                                                    </select>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="highlight-cell">
                                                    <input
                                                        type="time"
                                                        value={edit?.newStartTime || ''}
                                                        onChange={(e) => handleEditChange(uniqueId, 'newStartTime', e.target.value)}
                                                        className="time-input"
                                                    />
                                                </td>
                                                <td className="highlight-cell">
                                                    <input
                                                        type="time"
                                                        value={edit?.newEndTime || ''}
                                                        onChange={(e) => handleEditChange(uniqueId, 'newEndTime', e.target.value)}
                                                        className="time-input"
                                                    />
                                                </td>
                                            </>
                                        )}

                                        <td>
                                            <textarea
                                                value={edit?.reason || ''}
                                                onChange={(e) => handleEditChange(uniqueId, 'reason', e.target.value)}
                                                placeholder="Motivo..."
                                                rows="1"
                                            />
                                        </td>
                                    </tr>
                                );
                            })
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mass-footer mass-actions">
                <button
                    className="primary-btn request-btn"
                    onClick={handleRequestToAndre}
                    disabled={!isReadyToSubmit}
                    style={{
                        ...(hasRequestSent ? { background: '#4a4a4a', borderColor: '#666' } : {}),
                        ...(!isReadyToSubmit ? { opacity: 0.5, cursor: 'not-allowed' } : {})
                    }}
                >
                    <Send size={18} /> {hasRequestSent ? 'Solicitado (Reenviar)' : 'Solicitar (André)'}
                </button>

                {hasRequestSent && (
                    <button
                        className="primary-btn execute-btn"
                        onClick={handleExecution}
                        style={hasExecutionSent ? { background: '#4a4a4a', borderColor: '#666' } : {}}
                    >
                        <CheckCircle size={18} /> {hasExecutionSent ? 'Executado (Reenviar)' : 'Executar (WhatsApp)'}
                    </button>
                )}
            </div>
        </div>
    );
}
