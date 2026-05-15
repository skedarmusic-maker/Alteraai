import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import './MateriaisGaleria.css';

export default function MateriaisGaleria({ user, onBack }) {
    const [materiais, setMateriais] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
    const [loading, setLoading] = useState(true);
    const [viewer, setViewer] = useState(null); // { grupo, pagina }
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const animFrameRef = useRef(null);
    const [zoom, setZoom] = useState(1);
    const [signedUrls, setSignedUrls] = useState({}); // cache de URLs

    // Carregar materiais do Supabase
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('materiais')
                .select('*')
                .order('ordem', { ascending: true });

            if (error) {
                console.error('Erro ao carregar materiais:', error);
                setLoading(false);
                return;
            }

            setMateriais(data);

            // Agrupar por material_grupo
            const gruposMap = {};
            data.forEach(m => {
                if (!gruposMap[m.material_grupo]) {
                    gruposMap[m.material_grupo] = {
                        grupo: m.material_grupo,
                        titulo: m.titulo,
                        categoria: m.categoria,
                        descricao: m.descricao,
                        totalPaginas: m.total_paginas,
                        paginas: [],
                        capa: null,
                    };
                }
                gruposMap[m.material_grupo].paginas.push(m);
                if (m.pagina === 1) gruposMap[m.material_grupo].capa = m;
            });

            const gruposList = Object.values(gruposMap);
            setGrupos(gruposList);

            const cats = ['Todos', ...new Set(gruposList.map(g => g.categoria))];
            setCategorias(cats);
            setLoading(false);
        };
        load();
    }, []);

    // Obter signed URL (com cache)
    const getSignedUrl = useCallback(async (arquivoUrl) => {
        if (signedUrls[arquivoUrl]) return signedUrls[arquivoUrl];

        const { data, error } = await supabase.storage
            .from('materiais')
            .createSignedUrl(arquivoUrl, 3600); // 1 hora

        if (error || !data?.signedUrl) {
            console.error('Erro ao gerar URL assinada:', error?.message);
            return null;
        }
        setSignedUrls(prev => ({ ...prev, [arquivoUrl]: data.signedUrl }));
        return data.signedUrl;
    }, [signedUrls]);

    // Renderizar imagem + marca d'água no canvas
        const ratio = window.devicePixelRatio || 1;
        const W = canvasEl.clientWidth;
        const H = canvasEl.clientHeight;
        
        // Ajusta a resolução interna do canvas para a densidade do celular
        canvasEl.width = W * ratio;
        canvasEl.height = H * ratio;
        
        const ctx = canvasEl.getContext('2d');
        ctx.scale(ratio, ratio);

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, W, H);

        // Calcular posição da imagem com zoom
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = W / H;
        let drawW, drawH, drawX, drawY;

        if (imgAspect > canvasAspect) {
            drawW = W * zoom;
            drawH = drawW / imgAspect;
        } else {
            drawH = H * zoom;
            drawW = drawH * imgAspect;
        }

        drawX = (W - drawW) / 2;
        drawY = (H - drawH) / 2;

        // Renderiza com suavização de imagem desabilitada para máxima nitidez de texto se necessário,
        // mas aqui vamos manter o padrão que o ratio já resolve.
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        // ── Marca d'água ──────────────────────────────────────────────────
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR');
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const watermarkText = `${userName.toUpperCase()} • ${dateStr} ${timeStr} • CONFIDENCIAL`;

        ctx.save();
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.textAlign = 'center';

        // Grade diagonal de marcas d'água
        const step = 260;
        ctx.rotate(-Math.PI / 6); // -30°

        for (let y = -H * 2; y < W * 2; y += step) {
            for (let x = -W * 2; x < W * 2; x += step) {
                ctx.fillText(watermarkText, x, y);
            }
        }

        ctx.restore();

        // Marca d'água fixa no rodapé
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, H - 32, W, 32);
        ctx.font = '12px Inter, monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.textAlign = 'center';
        ctx.fillText(`🔒 ${watermarkText} • Uso exclusivo interno`, W / 2, H - 12);
        ctx.restore();
    }, []);

    // Iniciar viewer + carregar imagem
    const openViewer = useCallback(async (grupo, pagina = 1) => {
        setViewer({ grupo, pagina });
        setZoom(1);
    }, []);

    // Carregar + renderizar no canvas quando viewer muda
    useEffect(() => {
        if (!viewer) return;
        let cancelled = false;

        const render = async () => {
            const grupoData = grupos.find(g => g.grupo === viewer.grupo);
            if (!grupoData) return;

            const paginaData = grupoData.paginas.find(p => p.pagina === viewer.pagina);
            if (!paginaData) return;

            const url = await getSignedUrl(paginaData.arquivo_url);
            if (!url || cancelled) return;

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = url;
            imgRef.current = img;

            img.onload = () => {
                if (cancelled) return;
                const canvas = canvasRef.current;
                if (!canvas) return;

                // Animar (re-desenha a cada segundo para atualizar horário na marca d'água)
                const loop = () => {
                    drawCanvas(img, canvas, user, zoom);
                    // Não precisa de loop de 1s se o zoom não mudar, mas mantemos para o relógio
                    animFrameRef.current = setTimeout(loop, 1000);
                };
                if (animFrameRef.current) clearTimeout(animFrameRef.current);
                loop();
            };
        };

        render();
        return () => {
            cancelled = true;
            if (animFrameRef.current) clearTimeout(animFrameRef.current);
        };
    }, [viewer, grupos, getSignedUrl, drawCanvas, user, zoom]);

    // Re-desenhar quando zoom muda
    useEffect(() => {
        if (imgRef.current && canvasRef.current && viewer) {
            drawCanvas(imgRef.current, canvasRef.current, user, zoom);
        }
    }, [zoom, drawCanvas, user, viewer]);

    const gruposFiltrados = categoriaAtiva === 'Todos'
        ? grupos
        : grupos.filter(g => g.categoria === categoriaAtiva);

    const viewerGrupo = viewer ? grupos.find(g => g.grupo === viewer.grupo) : null;

    const navegarPagina = (delta) => {
        if (!viewer || !viewerGrupo) return;
        const novaPag = viewer.pagina + delta;
        if (novaPag >= 1 && novaPag <= viewerGrupo.totalPaginas) {
            setViewer(prev => ({ ...prev, pagina: novaPag }));
        }
    };

    // Bloquear clique-direito
    const handleContextMenu = (e) => e.preventDefault();

    return (
        <div className="materiais-container" onContextMenu={handleContextMenu}>
            {/* Header */}
            <div className="materiais-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={22} />
                </button>
                <div className="materiais-header-title">
                    <BookOpen size={20} />
                    <span>Materiais & Informações</span>
                </div>
                <span className="readonly-badge">🔒 Confidencial</span>
            </div>

            {loading ? (
                <div className="materiais-loading">
                    <div className="loading-spinner" />
                    <span>Carregando materiais...</span>
                </div>
            ) : (
                <>
                    {/* Filtro de categorias */}
                    <div className="materiais-filtros">
                        {categorias.map(cat => (
                            <button
                                key={cat}
                                className={`filtro-btn ${categoriaAtiva === cat ? 'ativo' : ''}`}
                                onClick={() => setCategoriaAtiva(cat)}
                            >
                                {cat === 'Tabela de Pontos' ? '📊' : cat === 'Comunicação' ? '📧' : '📁'} {cat}
                            </button>
                        ))}
                    </div>

                    {/* Grid de materiais */}
                    <div className="materiais-grid">
                        <AnimatePresence>
                            {gruposFiltrados.map((grupo, idx) => (
                                <motion.div
                                    key={grupo.grupo}
                                    className="material-card"
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => openViewer(grupo.grupo)}
                                >
                                    <div className="material-card-thumb">
                                        <CapaPreview arquivoUrl={grupo.capa?.arquivo_url} getSignedUrl={getSignedUrl} />
                                        {grupo.totalPaginas > 1 && (
                                            <span className="paginas-badge">{grupo.totalPaginas} pág.</span>
                                        )}
                                    </div>
                                    <div className="material-card-info">
                                        <span className="material-categoria">{grupo.categoria}</span>
                                        <h3 className="material-titulo">{grupo.titulo}</h3>
                                        {grupo.descricao && (
                                            <p className="material-descricao">{grupo.descricao}</p>
                                        )}
                                    </div>
                                    <div className="material-card-action">
                                        <ZoomIn size={16} /> Visualizar
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {gruposFiltrados.length === 0 && (
                        <div className="materiais-empty">Nenhum material nesta categoria.</div>
                    )}
                </>
            )}

            {/* ── Lightbox Viewer ── */}
            <AnimatePresence>
                {viewer && viewerGrupo && (
                    <motion.div
                        className="viewer-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onContextMenu={handleContextMenu}
                    >
                        {/* Toolbar */}
                        <div className="viewer-toolbar">
                            <div className="viewer-info">
                                <span className="viewer-titulo">{viewerGrupo.titulo}</span>
                                <span className="viewer-pagina">
                                    {viewer.pagina} / {viewerGrupo.totalPaginas}
                                </span>
                            </div>
                            <div className="viewer-controls">
                                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} title="Diminuir">
                                    <ZoomOut size={18} />
                                </button>
                                <button onClick={() => setZoom(1)} title="Resetar zoom">
                                    <RotateCcw size={16} />
                                </button>
                                <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} title="Ampliar">
                                    <ZoomIn size={18} />
                                </button>
                                <button className="viewer-close" onClick={() => {
                                    setViewer(null);
                                    if (animFrameRef.current) clearTimeout(animFrameRef.current);
                                }}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Canvas */}
                        <div className="viewer-canvas-wrap">
                            <canvas
                                ref={canvasRef}
                                className="viewer-canvas"
                                onContextMenu={handleContextMenu}
                            />
                        </div>

                        {/* Navegação de páginas */}
                        {viewerGrupo.totalPaginas > 1 && (
                            <div className="viewer-nav">
                                <button
                                    className="nav-btn"
                                    onClick={() => navegarPagina(-1)}
                                    disabled={viewer.pagina <= 1}
                                >
                                    <ChevronLeft size={24} /> Anterior
                                </button>
                                <div className="nav-dots">
                                    {Array.from({ length: viewerGrupo.totalPaginas }, (_, i) => (
                                        <button
                                            key={i}
                                            className={`nav-dot ${viewer.pagina === i + 1 ? 'ativo' : ''}`}
                                            onClick={() => setViewer(prev => ({ ...prev, pagina: i + 1 }))}
                                            title={`Página ${i + 1}`}
                                        />
                                    ))}
                                </div>
                                <button
                                    className="nav-btn"
                                    onClick={() => navegarPagina(1)}
                                    disabled={viewer.pagina >= viewerGrupo.totalPaginas}
                                >
                                    Próxima <ChevronRight size={24} />
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Sub-componente para thumbnail da capa
function CapaPreview({ arquivoUrl, getSignedUrl }) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        if (!arquivoUrl) return;
        getSignedUrl(arquivoUrl).then(setUrl);
    }, [arquivoUrl, getSignedUrl]);

    if (!url) return (
        <div className="thumb-placeholder">
            <BookOpen size={32} opacity={0.3} />
        </div>
    );

    return (
        <img
            src={url}
            alt="Capa"
            className="thumb-img"
            onContextMenu={e => e.preventDefault()}
            draggable={false}
        />
    );
}
