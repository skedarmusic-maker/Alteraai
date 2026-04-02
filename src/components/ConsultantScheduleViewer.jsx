import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, Clock, Building, MapPin } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { format } from 'date-fns';
import { isToday as checkIsToday } from 'date-fns';

// Lista oficial de consultores
export const CONSULTANTS = [
    { label: 'Luiz', key: 'LUIZ' },
    { label: 'Diogo', key: 'DIOGO' },
    { label: 'Alexandre', key: 'ALEXANDRE' },
    { label: 'Liedy', key: 'LIEDY' },
    { label: 'Paulo', key: 'PAULO' },
    { label: 'Marcio', key: 'MARCIO' },
    { label: 'Tatiane', key: 'TATIANE' },
];

export default function ConsultantScheduleViewer({ consultantName, onBack }) {
    const [visitsByDate, setVisitsByDate] = useState([]);
    const [loading, setLoading] = useState(true);
    const todayRef = useRef(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const userUpper = consultantName.toUpperCase().trim();

                const { data: visits, error } = await supabase
                    .from('visits')
                    .select('*')
                    .ilike('consultor', `%${userUpper}%`);

                if (error) throw error;

                // Group by date
                const grouped = {};
                visits.forEach(visit => {
                    try {
                        let dObj;
                        if (visit.data.includes('-')) {
                            const [y, m, d] = visit.data.split('-').map(Number);
                            dObj = new Date(y, m - 1, d);
                        } else {
                            const [d, m, y] = visit.data.split('/').map(Number);
                            dObj = new Date(y, m - 1, d);
                        }
                        dObj.setHours(0, 0, 0, 0);
                        const dStr = format(dObj, 'dd/MM/yyyy');
                        if (!grouped[dStr]) grouped[dStr] = [];
                        grouped[dStr].push({
                            date: dStr,
                            weekday: (visit.dia_da_semana || '').trim(),
                            store: (visit.loja || '').trim(),
                            client: (visit.cliente || '').trim(),
                            checkIn: (visit.check_in || '00:00').trim(),
                            checkOut: (visit.check_out || '00:00').trim(),
                            id: visit.id
                        });
                    } catch (e) { /* skip */ }
                });

                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);

                const sorted = Object.keys(grouped).map(dateStr => {
                    const [d, m, y] = dateStr.split('/').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    dateObj.setHours(0, 0, 0, 0);
                    if (dateObj.getTime() < todayMidnight.getTime()) return null;
                    return {
                        dateStr,
                        dateObj,
                        visits: grouped[dateStr].sort((a, b) => a.checkIn.localeCompare(b.checkIn))
                    };
                }).filter(Boolean).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

                setVisitsByDate(sorted);
            } catch (err) {
                console.error('Erro ao carregar roteiro:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [consultantName]);

    // Scroll to today
    useEffect(() => {
        if (!loading && todayRef.current) {
            setTimeout(() => {
                todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 400);
        }
    }, [loading]);

    return (
        <div className="schedule-viewer-container">
            {/* Header */}
            <div className="schedule-viewer-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={22} />
                </button>
                <div className="schedule-viewer-title">
                    <Eye size={20} />
                    <span>Roteiro de <strong>{consultantName}</strong></span>
                </div>
                <span className="readonly-badge">Somente Leitura</span>
            </div>

            {loading ? (
                <div className="loading-screen">Carregando roteiro de {consultantName}...</div>
            ) : visitsByDate.length === 0 ? (
                <div className="empty-state" style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
                    Nenhuma visita encontrada para {consultantName}.
                </div>
            ) : (
                <div className="schedule-viewer-list">
                    {visitsByDate.map((group) => {
                        const isToday = checkIsToday(group.dateObj);
                        return (
                            <div
                                key={group.dateStr}
                                ref={isToday ? todayRef : null}
                                className={`viewer-date-block ${isToday ? 'is-today' : ''}`}
                            >
                                {/* Date Header */}
                                <div className="viewer-date-header">
                                    <div className="viewer-day-number">{group.dateStr.split('/')[0]}</div>
                                    <div className="viewer-date-info">
                                        <span className="viewer-weekday">
                                            {(group.visits[0]?.weekday || '').replace(/[^a-zA-ZçÇáÁéÉíÍóÓúÚãÃõÕâÂêÊ\-\s]/g, '').toUpperCase()}
                                        </span>
                                        <span className="viewer-date-full">{group.dateStr}</span>
                                    </div>
                                    {isToday && <span className="today-badge">HOJE</span>}
                                </div>

                                {/* Visits */}
                                <div className="viewer-visits-list">
                                    {group.visits.map((visit, idx) => (
                                        <motion.div
                                            key={visit.id || idx}
                                            className="viewer-visit-item"
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.04 }}
                                        >
                                            <div className="viewer-visit-time">
                                                <Clock size={14} />
                                                <span>{visit.checkIn} – {visit.checkOut}</span>
                                            </div>
                                            <div className="viewer-visit-details">
                                                <div className="viewer-visit-store">
                                                    <Building size={14} />
                                                    {visit.store}
                                                </div>
                                                {visit.client && (
                                                    <div className="viewer-visit-client">
                                                        <MapPin size={12} />
                                                        {visit.client}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
