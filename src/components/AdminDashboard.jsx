import { useState, useEffect } from 'react';
import { ArrowLeft, Activity, Users, Filter, X, Check, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie, Legend, LabelList } from 'recharts';
import { fetchLogs, updateLogStatus } from '../utils/logger';
import { parseCSV } from '../utils/csv';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import './AdminDashboard.css';

export default function AdminDashboard({ onBack }) {
    console.log("Rendering AdminDashboard");
    const user = localStorage.getItem('visitAppUser');
    const isMaster = user && (user.toUpperCase() === 'MASTERPRO2026' || user.toUpperCase() === 'MASTER');
    const isSuperMaster = user && (user.toUpperCase() === 'SMASTERPRO');
    const [loading, setLoading] = useState(true);
    const [rawLogs, setRawLogs] = useState([]);
    const [storeToClientMap, setStoreToClientMap] = useState({});
    const [unmatchedStores, setUnmatchedStores] = useState([]);
    const [mapDebugSize, setMapDebugSize] = useState(0);

    // Filters
    const [filterType, setFilterType] = useState('all'); // all, week, custom
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [selectedConsultant, setSelectedConsultant] = useState(null);
    const [selectedType, setSelectedType] = useState(null);
    const [selectedClient, setSelectedClient] = useState(null);

    // Derived Stats
    const [stats, setStats] = useState({
        total: 0,
        byType: [],
        byConsultant: [],
        byClient: [],
        filteredLogs: []
    });

    // Pagination & View State
    const [showPendingOnly, setShowPendingOnly] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    // Derived Data for Display
    const processedLogs = stats.filteredLogs
        .filter(log => !showPendingOnly || log.status !== 'Feito')
        .sort((a, b) => {
            // Sort by Pending first, then by Date descending
            if (a.status !== 'Feito' && b.status === 'Feito') return -1;
            if (a.status === 'Feito' && b.status !== 'Feito') return 1;
            return new Date(b.date || 0) - new Date(a.date || 0);
        });

    const totalPages = Math.ceil(processedLogs.length / ITEMS_PER_PAGE);
    const paginatedLogs = processedLogs.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    useEffect(() => {
        const loadData = async () => {
            let data = await fetchLogs();

            // Helper to safely find property (case insensitive)
            const getVal = (obj, ...keys) => {
                const objKeys = Object.keys(obj);
                for (const key of keys) {
                    const found = objKeys.find(k => k.toLowerCase() === key.toLowerCase());
                    if (found) return obj[found];
                }
                return '';
            };

            // Normalize data (Handling Portuguese Headers from Sheets)
            // Normalize data (Handling Portuguese Headers from Sheets)
            const normalized = (data || []).map((row, index) => ({
                id: index + 2, // Row Index in Sheet (assuming header is 1, and 0-indexed array) - Adjust if header is row 1
                date: getVal(row, 'Data da Solicitação', 'date'),
                consultant: getVal(row, 'Consultor', 'consultant'),
                type: getVal(row, 'Tipo (Horário/JP/Massa)', 'type'),
                originalDate: getVal(row, 'Data Original', 'originalDate'),
                originalTime: getVal(row, 'Horário Original', 'originalTime'),
                storeFrom: getVal(row, 'Loja Original', 'storeFrom', 'originalStore'),
                storeTo: getVal(row, 'Nova Loja', 'storeTo', 'newStore'),
                newDate: getVal(row, 'Nova Data', 'newDate'),
                newTime: getVal(row, 'Novo Horário', 'newTime'),
                reason: getVal(row, 'Motivo', 'reason'),
                status: getVal(row, 'Status', 'status')
            }));

            setRawLogs(normalized);
            setLoading(false);
        };

        const loadStoreData = async () => {
            try {
                const data = await parseCSV('/BASE AC NOVA.csv');
                const mapping = {};

                // Robust helper to find values by multiple candidate headers
                const getRowValue = (row, ...candidates) => {
                    const keys = Object.keys(row);
                    for (const candidate of candidates) {
                        // Exact match (cleaned)
                        const match = keys.find(k => k.trim().toUpperCase() === candidate.toUpperCase());
                        if (match) return row[match];
                        // Partial match
                        const partial = keys.find(k => k.trim().toUpperCase().includes(candidate.toUpperCase()));
                        if (partial) return row[partial];
                    }
                    return null;
                };

                data.forEach(row => {
                    const store = getRowValue(row, 'LOJA', 'NOME PDV', 'NOME_PDV');
                    const client = getRowValue(row, 'CLIENTE', 'CLIENT');
                    if (store && client) {
                        const storeStr = String(store).trim().toUpperCase();
                        mapping[storeStr] = String(client).trim();
                    }
                });

                console.log("Mapping built with", Object.keys(mapping).length, "stores");
                setStoreToClientMap(mapping);
                setMapDebugSize(Object.keys(mapping).length);
            } catch (error) {
                console.error("Error loading base CSV", error);
            }
        };

        loadData();
        loadStoreData();
    }, []);

    // Effect to filtering and recalculate stats
    useEffect(() => {
        if (loading) return;

        let filtered = rawLogs;

        // 1. Date Filter
        const today = new Date();
        if (filterType === 'week') {
            const start = startOfWeek(today, { weekStartsOn: 1 }); // Monday
            const end = endOfWeek(today, { weekStartsOn: 1 });
            filtered = filtered.filter(log => {
                const logDate = new Date(log.date || log.originalDate); // Fallback
                return isWithinInterval(logDate, { start, end });
            });
        } else if (filterType === 'custom' && dateRange.start && dateRange.end) {
            const start = startOfDay(parseISO(dateRange.start));
            const end = endOfDay(parseISO(dateRange.end));
            filtered = filtered.filter(log => {
                const logDate = new Date(log.date || log.originalDate);
                return isWithinInterval(logDate, { start, end });
            });
        }

        // 2. Consultant Filter
        if (selectedConsultant) {
            filtered = filtered.filter(log =>
                (log.consultant || '').toUpperCase() === selectedConsultant.toUpperCase()
            );
        }

        // 3. Type Filter
        if (selectedType) {
            filtered = filtered.filter(log =>
                (log.type || '').toUpperCase() === selectedType.toUpperCase()
            );
        }

        // Helper to normalize strings into tokens
        const tokenize = (str) => {
            if (!str) return [];
            return str.toUpperCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Remove accents
                .replace(/[^A-Z0-9]/g, ' ') // Replace punct with space
                .split(' ')
                .filter(t => t.length > 1); // Ignore single chars
        };

        const storeKeys = Object.keys(storeToClientMap);
        // Pre-tokenize keys for performance
        const tokenizedKeys = storeKeys.map(k => ({ original: k, tokens: tokenize(k) }));

        const findMatch = (rawStore) => {
            if (!rawStore) return null;
            const logTokens = tokenize(rawStore);
            if (logTokens.length === 0) return null;
            const upperRaw = rawStore.toUpperCase();

            // Manual Alias / Synonym Injection
            if (upperRaw.includes('POLOAR') || upperRaw.includes('STR')) {
                logTokens.push('UNIAR');
            }
            if (upperRaw.includes('WEBCONTINENTAL')) {
                logTokens.push('TRAVENIDAESSA'); // Base CSV typo
                logTokens.push('WEBCONTINENTAL');
            }

            let bestMatch = null;
            let maxScore = 0;

            for (const keyObj of tokenizedKeys) {
                const intersection = keyObj.tokens.filter(t => logTokens.includes(t));
                let score = intersection.length;

                // Boost for Brand Match (First token usually)
                if (logTokens[0] && keyObj.tokens.includes(logTokens[0])) {
                    score += 1.5;
                }

                // Boost for Alias Match
                if (logTokens.includes('UNIAR') && keyObj.tokens.includes('UNIAR')) score += 2;

                if (score > maxScore) {
                    maxScore = score;
                    bestMatch = keyObj;
                }

                // Perfect subset match?
                if (intersection.length === logTokens.length && intersection.length > 0) {
                    return keyObj.original;
                }
            }

            if (maxScore >= 2.5) return bestMatch ? bestMatch.original : null;
            return null;
        };

        // 4. Client Filter
        if (selectedClient) {
            filtered = filtered.filter(log => {
                const storeRaw = (log.storeFrom || log.storeTo || '').trim().toUpperCase();
                let client = storeToClientMap[storeRaw];

                if (!client && storeRaw) {
                    const matchedKey = findMatch(storeRaw);
                    client = matchedKey ? storeToClientMap[matchedKey] : 'N/A';
                } else if (!client) {
                    client = 'N/A';
                }

                return client === selectedClient;
            });
        }

        // 5. Calculate Stats
        const consultantCount = {};
        const typeCount = {};
        const clientCount = {};
        const unmatchedLog = new Set();

        filtered.forEach(item => {
            const name = item.consultant || 'Desconhecido';
            consultantCount[name] = (consultantCount[name] || 0) + 1;

            const type = item.type || 'Outros';
            typeCount[type] = (typeCount[type] || 0) + 1;

            // Client Stats
            const storeRaw = (item.storeFrom || item.storeTo || '').trim().toUpperCase();
            if (storeRaw) {
                let client = storeToClientMap[storeRaw];

                // Fuzzy fallback
                if (!client) {
                    const matchedKey = findMatch(storeRaw);
                    client = matchedKey ? storeToClientMap[matchedKey] : 'N/A';

                    if (client === 'N/A') {
                        unmatchedLog.add(storeRaw);
                    }
                }

                clientCount[client] = (clientCount[client] || 0) + 1;
            }
        });

        // Update Unmatched Logic
        setUnmatchedStores(Array.from(unmatchedLog).slice(0, 50));

        const byConsultant = Object.keys(consultantCount).map(k => ({
            name: k,
            value: consultantCount[k]
        })).sort((a, b) => b.value - a.value).slice(0, 5);

        const byType = Object.keys(typeCount).map(k => ({
            name: k,
            value: typeCount[k]
        }));

        const byClient = Object.keys(clientCount).map(k => ({
            name: k,
            value: clientCount[k]
        })).sort((a, b) => b.value - a.value).slice(0, 5);

        setStats({
            total: filtered.length,
            byType,
            byConsultant,
            byClient,
            filteredLogs: filtered
        });

    }, [rawLogs, filterType, dateRange, selectedConsultant, selectedType, selectedClient, loading, storeToClientMap]);

    const handlePieClick = (data) => {
        if (data && data.name) {
            setSelectedType(prev => prev === data.name ? null : data.name);
        }
    };

    const handleBarClick = (data) => {
        // Handle Recharts Chart Click
        let clickedName = null;
        if (data && data.activeLabel) {
            clickedName = data.activeLabel;
        } else if (data && data.activePayload && data.activePayload.length > 0) {
            clickedName = data.activePayload[0].payload.name;
        } else if (data && data.name) {
            // If attached directly to Bar/Cell
            clickedName = data.name;
        }

        if (clickedName) {
            setSelectedConsultant(prev => prev === clickedName ? null : clickedName);
        }
    };

    const handleClientClick = (data) => {
        // Handle Recharts Chart Click
        let clickedName = null;
        if (data && data.activeLabel) {
            clickedName = data.activeLabel;
        } else if (data && data.activePayload && data.activePayload.length > 0) {
            clickedName = data.activePayload[0].payload.name;
        } else if (data && data.name) {
            // If attached directly to Bar/Cell
            clickedName = data.name;
        }

        if (clickedName) {
            setSelectedClient(prev => prev === clickedName ? null : clickedName);
        }
    };

    const handleStatusUpdate = async (rowIndex, currentStatus) => {
        if (!isMaster) return;
        if (currentStatus === 'Feito') return;

        const confirm = window.confirm('Deseja marcar esta solicitação como FEITO?');
        if (confirm) {
            // Optimistic update
            setRawLogs(prev => prev.map(log =>
                log.id === rowIndex ? { ...log, status: 'Feito' } : log
            ));

            await updateLogStatus(rowIndex, 'Feito');
        }
    };

    const COLORS = ['#FF006C', '#6A0AAA', '#FD5003', '#00C49F', '#FFBB28'];

    if (loading) return <div className="loading-screen">Carregando Dashboard...</div>;

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-left">
                    <button onClick={onBack} className="back-btn"><ArrowLeft size={24} /></button>
                    <h2>Painel de Gestão</h2>
                </div>
                <img src="/images/logoprotradepreto.png" alt="ProTrade Logo" className="dashboard-logo" />
            </header>

            {/* Pending Alert - High Priority */}
            {stats.filteredLogs.some(l => l.status !== 'Feito') && (
                <div
                    className="pending-alert-banner"
                    onClick={() => {
                        // Optional: Auto filter to pending if desired? 
                        // For now just scroll to table
                        document.querySelector('.logs-table-container')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                >
                    <div className="alert-content">
                        <AlertCircle size={24} color="#FFF" />
                        <div className="alert-text">
                            <h3>{stats.filteredLogs.filter(l => l.status !== 'Feito').length} Solicitações Pendentes</h3>
                            <p>Clique para ver os detalhes e aprovar</p>
                        </div>
                    </div>
                    <div className="alert-action">
                        Ver Lista <ArrowLeft size={16} style={{ transform: 'rotate(-90deg)' }} />
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filters-bar">
                <div className="filter-group">
                    <button
                        className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                        onClick={() => { setFilterType('all'); setSelectedConsultant(null); setSelectedClient(null); setSelectedType(null); setCurrentPage(1); }}
                    >
                        Tudo
                    </button>
                    <button
                        className={`filter-btn ${filterType === 'week' ? 'active' : ''}`}
                        onClick={() => { setFilterType('week'); setSelectedConsultant(null); setSelectedClient(null); setSelectedType(null); setCurrentPage(1); }}
                    >
                        Esta Semana
                    </button>
                    <div className="custom-date">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={e => { setFilterType('custom'); setDateRange(prev => ({ ...prev, start: e.target.value })); setCurrentPage(1); }}
                        />
                        <span>até</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={e => { setFilterType('custom'); setDateRange(prev => ({ ...prev, end: e.target.value })); setCurrentPage(1); }}
                        />
                    </div>
                </div>

                {selectedConsultant && (
                    <div className="active-filter-badge" onClick={() => setSelectedConsultant(null)}>
                        Consultor: <strong>{selectedConsultant}</strong> <X size={14} />
                    </div>
                )}
                {selectedType && (
                    <div className="active-filter-badge type-badge" onClick={() => setSelectedType(null)}>
                        Tipo: <strong>{selectedType}</strong> <X size={14} />
                    </div>
                )}
                {selectedClient && (
                    <div className="active-filter-badge" style={{ borderColor: '#FD5003', color: '#FD5003', background: 'rgba(253, 80, 3, 0.1)' }} onClick={() => setSelectedClient(null)}>
                        Cliente: <strong>{selectedClient}</strong> <X size={14} />
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-icon"><Activity size={24} color="#FF006C" /></div>
                    <div className="kpi-info">
                        <span className="kpi-label">Solicitações no Período</span>
                        <span className="kpi-value">{stats.total}</span>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon"><Users size={24} color="#6A0AAA" /></div>
                    <div className="kpi-info">
                        <span className="kpi-label">Consultores no Período</span>
                        <span className="kpi-value">{stats.byConsultant.length}</span>
                    </div>
                </div>
            </div>

            {/* Charts Area */}
            <div className="charts-grid">
                <div className="chart-card clickable-chart">
                    <h3>Solicitações por Tipo (Clique para filtrar)</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={250}>
                            <RePieChart>
                                <Pie
                                    data={stats.byType}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    onClick={handlePieClick}
                                    stroke="none"
                                >
                                    {stats.byType.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                            fillOpacity={!selectedType || selectedType === entry.name ? 1 : 0.3}
                                            style={{ cursor: 'pointer', outline: 'none' }}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1A1A1A', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend />
                            </RePieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-card clickable-chart">
                    <h3>Top Consultores (Clique para filtrar)</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                                data={stats.byConsultant}
                                layout="vertical"
                                margin={{ left: 40, right: 40 }}
                                onClick={handleBarClick}
                            >
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke="#FFF"
                                    fontSize={13}
                                    fontWeight={700}
                                    tickLine={false}
                                    axisLine={false}
                                    width={120}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#1A1A1A', border: 'none', borderRadius: '8px' }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                                    {stats.byConsultant.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={selectedConsultant === entry.name ? '#FF006C' : '#6A0AAA'}
                                        />
                                    ))}
                                    <LabelList dataKey="value" position="right" fill="#FFF" fontSize={12} offset={10} fontWeight={700} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Clients Chart */}
            <div className="charts-container" style={{ marginTop: '20px' }}>
                <div className="chart-card wide-chart clickable-chart">
                    <h3>Top Clientes Substituídos (Clique para filtrar)</h3>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={stats.byClient}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                onClick={handleClientClick}
                            >
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={150}
                                    tick={{ fill: '#aaa', fontSize: 12 }}
                                    interval={0}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#1A1A1A', border: 'none', borderRadius: '8px' }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {stats.byClient.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={selectedClient === entry.name ? '#FF006C' : '#FD5003'}
                                        />
                                    ))}
                                    <LabelList dataKey="value" position="right" fill="#FFF" fontSize={12} offset={10} fontWeight={700} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            {!isSuperMaster && (
                <div className="logs-table-container">
                    <div className="table-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3>Detalhamento {selectedConsultant ? `- ${selectedConsultant}` : ''} {selectedClient ? `- ${selectedClient}` : ''} </h3>
                        <div className="table-actions">
                            <label style={{ marginRight: '8px', fontSize: '0.9rem', color: '#888' }}>
                                <input
                                    type="checkbox"
                                    checked={showPendingOnly}
                                    onChange={(e) => { setShowPendingOnly(e.target.checked); setCurrentPage(1); }}
                                    style={{ marginRight: '6px' }}
                                />
                                Apenas Pendentes
                            </label>
                        </div>
                    </div>

                    <div className="table-responsive">
                        <table className="logs-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Consultor</th>
                                    <th>Tipo</th>
                                    <th>Loja Original</th>
                                    <th>Horário Orig.</th>
                                    <th>Nova Loja</th>
                                    <th>Nova Data</th>
                                    <th>Novo Horário</th>
                                    <th>Motivo</th>
                                    <th>Status</th>
                                    {isMaster && <th>Ação</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedLogs.map((log, idx) => (
                                    <tr key={idx} className={log.status === 'Feito' ? 'row-done' : ''}>
                                        <td>{new Date(log.date || Date.now()).toLocaleDateString()}</td>
                                        <td className="highlight-text">{log.consultant}</td>
                                        <td>
                                            <span className={`badge badge-${(log.type || '').split(' ')[0].toLowerCase()}`}>
                                                {log.type}
                                            </span>
                                        </td>
                                        <td>{log.storeFrom || '-'}</td>
                                        <td>{log.originalTime || '-'}</td>
                                        <td>{log.storeTo || '-'}</td>
                                        <td>
                                            {log.newDate && String(log.newDate).includes('T')
                                                ? new Date(log.newDate).toLocaleDateString()
                                                : (log.newDate || '-')}
                                        </td>
                                        <td>{log.newTime || '-'}</td>
                                        <td className="reason-cell">{log.reason}</td>
                                        <td>
                                            <span className={`status-badge ${log.status === 'Feito' ? 'status-done' : 'status-pending'}`}>
                                                {log.status || 'Pendente'}
                                            </span>
                                        </td>
                                        {isMaster && (
                                            <td>
                                                {log.status !== 'Feito' && (
                                                    <button
                                                        className="action-btn-approve"
                                                        onClick={() => handleStatusUpdate(log.id, log.status)}
                                                        title="Marcar como Feito"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {paginatedLogs.length === 0 && (
                                    <tr>
                                        <td colSpan="11" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                                            Nenhum registro encontrado para este filtro.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* DEBUG SECTION */}
                    <div style={{ marginTop: '40px', padding: '20px', border: '1px solid red', backgroundColor: '#fff0f0', borderRadius: '8px' }}>
                        <h3 style={{ color: '#d32f2f' }}>🔧 Debug Info (N/A Issue)</h3>
                        <p><strong>Total Stores in Map:</strong> {mapDebugSize}</p>
                        <p><strong>Unmatched Stores in Current Filter (Top 50):</strong> (These stores appear in logs but not in BASE CSV)</p>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            <ol>
                                {unmatchedStores.map((s, i) => (
                                    <li key={i}>{s}</li>
                                ))}
                            </ol>
                        </div>
                        {unmatchedStores.length === 0 && <p style={{ color: 'green' }}>All stores matched!</p>}
                    </div>


                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            >
                                Anterior
                            </button>
                            <span>Página {currentPage} de {totalPages}</span>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            >
                                Próxima
                            </button>
                        </div>
                    )}
                </div>
            )
            }
        </div >
    );
}
