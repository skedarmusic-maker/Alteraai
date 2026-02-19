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

    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch stores base from CSV (keep this for now as it's large and static)
                const storesData = await parseCSV('/BASE AC NOVA.csv');

                // Build Store to Client Map
                const storeClientMap = {};
                const getValue = (row, ...candidates) => {
                    const keys = Object.keys(row);
                    for (const candidate of candidates) {
                        const match = keys.find(k => k.trim().toUpperCase() === candidate);
                        if (match) return row[match];
                        const partial = keys.find(k => k.trim().toUpperCase().includes(candidate));
                        if (partial) return row[partial];
                    }
                    return '';
                };

                storesData.forEach(row => {
                    const store = getValue(row, 'LOJA');
                    const client = getValue(row, 'CLIENTE');
                    if (store && client) {
                        storeClientMap[store.trim().toUpperCase()] = client.trim();
                    }
                });

                // NEW: Fetch from Supabase instead of CSV
                console.log("🔍 Buscando visitas no Supabase...");
                const userUpper = (user || '').toUpperCase().trim();
                const { data: supabaseVisits, error: supabaseError } = await supabase
                    .from('visits')
                    .select('*')
                    .ilike('consultor', `%${userUpper}%`);

                if (supabaseError) throw supabaseError;

                console.log(`✅ Sucesso: ${supabaseVisits.length} visitas carregadas do banco de dados para ${userUpper}.`);

                // Group by Date
                const grouped = {};
                supabaseVisits.forEach(visit => {
                    // Convert yyyy-mm-dd from DB to dd/mm/yyyy for UI compatibility if needed
                    // but we'll use a standardized date object later
                    const dateObj = parse(visit.data, 'yyyy-MM-dd', new Date());
                    const dateStr = format(dateObj, 'dd/MM/yyyy');

                    if (!grouped[dateStr]) grouped[dateStr] = [];

                    grouped[dateStr].push({
                        date: dateStr,
                        weekday: visit.dia_da_semana || '',
                        store: visit.loja,
                        client: visit.cliente,
                        checkIn: visit.check_in,
                        checkOut: visit.check_out,
                        id: visit.id // Keep DB ID
                    });
                });

                // Inject New Inclusions from LocalStorage (Fallback for offline/temp)
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
                            reason: inc.reason
                        });
                    }
                });

                // Convert to array and sort
                const sortedGroups = Object.keys(grouped).map(dateStr => {
                    try {
                        const dateObj = parse(dateStr, 'dd/MM/yyyy', new Date());
                        const now = new Date();
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                        if (dateObj < today) return null;

                        const visitsWithFlags = grouped[dateStr].map(v => {
                            const visitKey = `${dateStr}-${v.store}`;
                            const pendingTime = localStorage.getItem(`pendingTimeChange-${visitKey}`);
                            const pendingJP = localStorage.getItem(`pendingJPChange-${visitKey}`);

                            let pendingData = null;
                            if (pendingJP) {
                                try {
                                    pendingData = JSON.parse(pendingJP);
                                    if (pendingData && pendingData.newStore) {
                                        const mappedClient = storeClientMap[pendingData.newStore.trim().toUpperCase()];
                                        if (mappedClient) pendingData.newClient = mappedClient;
                                    }
                                } catch (e) { }
                            }

                            return {
                                ...v,
                                hasPending: !!(pendingTime || pendingJP),
                                pendingChange: pendingData
                            };
                        });

                        return {
                            dateStr,
                            dateObj,
                            visits: visitsWithFlags.sort((a, b) => (a.checkIn || '00:00').localeCompare(b.checkIn || '00:00'))
                        };
                    } catch (e) { return null; }
                }).filter(Boolean).sort((a, b) => compareAsc(a.dateObj, b.dateObj));

                // Extract unique stores for the user
                const stores = new Set();
                storesData.forEach(row => {
                    const consul = getValue(row, 'CONSULTOR');
                    if (consul && consul.toUpperCase().includes(userUpper)) {
                        const storeName = getValue(row, 'LOJA');
                        if (storeName) stores.add(storeName.trim());
                    }
                });

                if (stores.size === 0) {
                    supabaseVisits.forEach(v => {
                        if (v.loja) stores.add(v.loja.trim());
                    });
                }

                setAvailableStores(Array.from(stores).sort());
                setVisitsByDate(sortedGroups);
                setLoading(false);
            } catch (err) {
                console.error("Failed to load schedule from Supabase", err);
                setLoading(false);
            }
        };
        loadData();
    }, [user, isAddModalOpen]); // Reload when modal closes/saves

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
            <header className="app-header">
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
