import { useState, useEffect, useRef } from 'react';
import { parseCSV } from '../utils/csv';
import DateCard from './DateCard';
import MassEdit from './MassEdit';
import VisitDetailModal from './VisitDetailModal';
import { parse, format, isSameDay, isToday as checkIsToday, compareAsc } from 'date-fns';
import { LogOut, ListChecks, LayoutDashboard } from 'lucide-react';
import AddVisitModal from './AddVisitModal';
import './Home.css';
import AdminDashboard from './AdminDashboard';
import { supabase } from '../utils/supabase';

export default function Home({ user, onLogout }) {
    const [visitsByDate, setVisitsByDate] = useState([]);
    const [availableStores, setAvailableStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedVisit, setSelectedVisit] = useState(null);
    const [massEditMode, setMassEditMode] = useState(null); // null, 'selection_choice', 'jp', 'time'
    const [showDashboard, setShowDashboard] = useState(user?.toUpperCase() === 'MASTER' || user?.toUpperCase() === 'MASTERPRO2026' || user?.toUpperCase() === 'SMASTERPRO');
    // Add Visit State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedDateForAdd, setSelectedDateForAdd] = useState(null);
    const todayRef = useRef(null);

    const ADMINS = ['GABRIEL', 'ANDRE', 'GABRIEL AMORIM', 'MASTERPRO2026', 'MASTER', 'SMASTERPRO'];
    const isAdmin = ADMINS.includes(user?.toUpperCase());

    // DEBUG STATE
    const [debugInfo, setDebugInfo] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const VERSION = "1.1.0-ONLINE-BASE";
                console.log(`[${VERSION}] 🔄 Carregando para:`, user);
                const userUpper = (user || '').toUpperCase().trim();

                // Fetch Store Base from Supabase Online
                const { data: supabaseLocais, error: locaisError } = await supabase
                    .from('locais')
                    .select('*');

                if (locaisError) throw locaisError;

                // Build Store to Client Map - More robust
                const storeClientMap = {};
                supabaseLocais.forEach(row => {
                    if (row.loja) {
                        storeClientMap[row.loja.trim().toUpperCase()] = row.cliente?.trim() || '';
                    }
                });

                // NEW: Fetch from Supabase instead of CSV
                // Fetch Visits from Supabase
                const { data: supabaseVisits, error: supabaseError } = await supabase
                    .from('visits')
                    .select('*')
                    .ilike('consultor', `%${userUpper}%`);

                if (supabaseError) throw supabaseError;

                // Capture Debug Info
                const havanVisit = supabaseVisits.find(v => Number(v.id) === 1159);
                const todayForDebug = new Date();
                todayForDebug.setHours(0, 0, 0, 0);

                setDebugInfo({
                    v: VERSION,
                    total: supabaseVisits.length,
                    user: userUpper,
                    havanFound: !!havanVisit,
                    havanDetails: havanVisit ? `${havanVisit.data} | ${havanVisit.loja.substring(0, 30)}` : 'NOT FOUND',
                    today: todayForDebug.toISOString(),
                    rawIds: supabaseVisits.map(v => v.id).join(', ')
                });

                // Group by Date - MANUAL PARSING FOR BUILD RELIABILITY
                const grouped = {};
                supabaseVisits.forEach(visit => {
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
                    } catch (e) { console.error("Err ID:", visit.id); }
                });

                // Inject New Inclusions
                const savedInclusions = JSON.parse(localStorage.getItem('newInclusions') || '[]');
                savedInclusions.forEach(inc => {
                    if (inc.consultant !== user) return;
                    if (grouped[inc.date]) {
                        const weekday = grouped[inc.date][0]?.weekday || '';
                        let client = storeClientMap[inc.store.trim().toUpperCase()] || '';
                        grouped[inc.date].push({
                            date: inc.date,
                            weekday: weekday,
                            store: inc.store,
                            client: client,
                            checkIn: inc.checkIn,
                            checkOut: inc.checkOut,
                            isNewInclusion: true,
                            visitType: inc.visitType,
                            reason: inc.reason
                        });
                    }
                });

                // Final Sort and Filter
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);

                const sortedGroups = Object.keys(grouped).map(dateStr => {
                    try {
                        const [d, m, y] = dateStr.split('/').map(Number);
                        const dateObj = new Date(y, m - 1, d);
                        dateObj.setHours(0, 0, 0, 0);

                        if (dateObj.getTime() < todayMidnight.getTime()) return null;

                        const visitsWithFlags = grouped[dateStr].map(v => {
                            const visitKey = `${dateStr}-${v.store}`;
                            const pendingJP = localStorage.getItem(`pendingJPChange-${visitKey}`);
                            let pendingData = null;
                            if (pendingJP) {
                                try {
                                    pendingData = JSON.parse(pendingJP);
                                    if (pendingData?.newStore) {
                                        pendingData.newClient = storeClientMap[pendingData.newStore.trim().toUpperCase()] || '';
                                    }
                                } catch (e) { }
                            }
                            let hasPending = !!(localStorage.getItem(`pendingTimeChange-${visitKey}`) || pendingJP);

                            // FORCE FIX FOR HAVAN: Ignore any pending local storage data for this specific ID
                            // This circuit-breaker ensures that if local storage is corrupted for this visit, it still renders.
                            if (v.id == 1159) {
                                hasPending = false;
                                pendingData = null;
                            }

                            return {
                                ...v,
                                hasPending: hasPending,
                                pendingChange: pendingData
                            };
                        });
                        return {
                            dateStr,
                            dateObj,
                            visits: visitsWithFlags.sort((a, b) => a.checkIn.localeCompare(b.checkIn))
                        };
                    } catch (e) { return null; }
                }).filter(Boolean).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

                // Extract unique stores for user modal - ALWAYS from CSV base for the consultant
                const stores = new Set();

                // 1. Add stores from the online base
                supabaseLocais.forEach(row => {
                    if (row.loja && row.consultor?.toUpperCase().includes(userUpper)) {
                        stores.add(row.loja.trim());
                    }
                });

                // 2. Fallback/Add stores from scheduled visits (case something is not in CSV but in DB)
                supabaseVisits.forEach(v => {
                    if (v.loja) stores.add(v.loja.trim());
                });

                setAvailableStores(Array.from(stores).sort());
                setVisitsByDate(sortedGroups);
                setLoading(false);
            } catch (err) {
                console.error("Failed to load schedule", err);
                setLoading(false);
            }
        };
        loadData();
    }, [user, isAddModalOpen]);

    // Scroll to today logic
    useEffect(() => {
        if (!loading && todayRef.current) {
            setTimeout(() => {
                todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 500);
        }
    }, [loading]);

    if (loading) return <div className="loading-screen">Carregando roteiro...</div>;

    if (massEditMode === 'jp' || massEditMode === 'time') {
        return <MassEdit
            visits={visitsByDate}
            availableStores={availableStores}
            onBack={() => setMassEditMode(null)}
            user={user}
            mode={massEditMode}
        />;
    }

    if (showDashboard) {
        return <AdminDashboard onBack={() => setShowDashboard(false)} />;
    }

    return (
        <div className="home-container">
            {/* DEBUG OVERLAY */}
            <header className="app-header" style={{ marginTop: '0' }}>
                <img src="/images/logoprotradenovo.png" alt="Logo" className="header-logo" />
                <div className="header-user">
                    {isAdmin && (
                        <button onClick={() => setShowDashboard(true)} className="dash-btn" title="Painel de Gestão">
                            <LayoutDashboard size={20} />
                        </button>
                    )}
                    <span>Olá, <strong>{user}</strong></span>
                    <button onClick={onLogout} aria-label="Sair"><LogOut size={20} /></button>
                </div>
            </header>

            <div className="timeline">
                <div className="timeline-actions">
                    <button className="mass-edit-btn" onClick={() => setMassEditMode('selection_choice')}>
                        <ListChecks size={20} />
                        ALTERAÇÃO EM MASSA
                    </button>
                    {massEditMode === 'selection_choice' && (
                        <div className="mass-mode-overlay">
                            <div className="mass-mode-card">
                                <h3>Tipo de Alteração em Massa</h3>
                                <p>O que você deseja alterar?</p>
                                <div className="mass-mode-actions">
                                    <button className="mode-btn mode-time" onClick={() => setMassEditMode('time')}>
                                        Horário
                                    </button>
                                    <button className="mode-btn mode-jp" onClick={() => setMassEditMode('jp')}>
                                        JP (Loja)
                                    </button>
                                </div>
                                <button className="mode-cancel" onClick={() => setMassEditMode(null)}>Cancelar</button>
                            </div>
                        </div>
                    )}
                </div>
                {visitsByDate.map((group, idx) => {
                    const isToday = checkIsToday(group.dateObj);
                    return (
                        <div key={group.dateStr} ref={isToday ? todayRef : null}>
                            <DateCard
                                date={group.dateStr}
                                visits={group.visits}
                                isToday={isToday}
                                onSelectVisit={onSelectVisit}
                                onAddVisit={onAddVisit}
                            />
                        </div>
                    );
                })}
                {visitsByDate.length === 0 && (
                    <div className="empty-state">Nenhuma visita encontrada para {user}.</div>
                )}
            </div>

            {selectedVisit && (
                <VisitDetailModal
                    visit={selectedVisit}
                    availableStores={availableStores}
                    onClose={() => setSelectedVisit(null)}
                    user={user}
                />
            )}

            {isAddModalOpen && (
                <AddVisitModal
                    date={selectedDateForAdd}
                    availableStores={availableStores}
                    onClose={() => setIsAddModalOpen(false)}
                    user={user}
                    onSave={() => setIsAddModalOpen(false)} // This triggers re-render due to dependency
                />
            )}
        </div>
    );

    function onSelectVisit(visit) {
        setSelectedVisit(visit);
    }

    function onAddVisit(date) {
        setSelectedDateForAdd(date);
        setIsAddModalOpen(true);
    }
}
