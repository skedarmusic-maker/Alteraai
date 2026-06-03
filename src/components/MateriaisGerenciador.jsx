import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, FileText, UploadCloud, CheckCircle, RefreshCw, X, Folder, AlertCircle } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import './MateriaisGerenciador.css';

const CLIENTES_LIST = [
    'BHP',
    'Central Ar',
    'Clima Rio',
    'DIS',
    'Friopeças',
    'Monvizo',
    'Poloar',
    'Webcontinental',
    'Uniar',
    'Pro Tati',
    'Geral'
];

// Helper para carregar PDF.js via CDN dinamicamente
const loadPdfJs = () => {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) {
            resolve(window.pdfjsLib);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(window.pdfjsLib);
        };
        script.onerror = (err) => reject(new Error('Falha ao carregar a biblioteca de PDF.'));
        document.head.appendChild(script);
    });
};

export default function MateriaisGerenciador({ onBack }) {
    const [materiais, setMateriais] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: '' });
    const [viewMode, setViewMode] = useState('list'); // 'list' ou 'add'
    
    // Form fields
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [categoria, setCategoria] = useState('Geral');
    const [novaCategoria, setNovaCategoria] = useState('');
    const [ordem, setOrdem] = useState(10);
    const [file, setFile] = useState(null);
    const [signedUrls, setSignedUrls] = useState({});

    // Carregar materiais
    const loadMateriais = async () => {
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

        // Agrupar por material_grupo para exibição
        const gruposMap = {};
        data.forEach(m => {
            if (!gruposMap[m.material_grupo]) {
                gruposMap[m.material_grupo] = {
                    grupo: m.material_grupo,
                    titulo: m.titulo,
                    categoria: m.categoria,
                    descricao: m.descricao,
                    totalPaginas: m.total_paginas,
                    ordem: m.ordem,
                    paginas: [],
                    capaUrl: m.arquivo_url
                };
            }
            gruposMap[m.material_grupo].paginas.push(m);
            if (m.pagina === 1) {
                gruposMap[m.material_grupo].capaUrl = m.arquivo_url;
            }
        });

        const list = Object.values(gruposMap).sort((a, b) => a.ordem - b.ordem);
        setGrupos(list);
        setLoading(false);

        // Obter signed URLs para as capas
        list.forEach(async (g) => {
            if (g.capaUrl && !signedUrls[g.capaUrl]) {
                const { data: signData } = await supabase.storage
                    .from('materiais')
                    .createSignedUrl(g.capaUrl, 3600);
                if (signData?.signedUrl) {
                    setSignedUrls(prev => ({ ...prev, [g.capaUrl]: signData.signedUrl }));
                }
            }
        });
    };

    useEffect(() => {
        loadMateriais();
    }, []);

    // Remover material
    const handleDelete = async (grupo) => {
        const confirm = window.confirm(`Tem certeza que deseja excluir o material "${grupo.titulo}"? Isso apagará todas as ${grupo.totalPaginas} página(s) do banco e do Storage.`);
        if (!confirm) return;

        setLoading(true);
        try {
            // 1. Apagar arquivos do Storage
            const arquivosParaDeletar = grupo.paginas.map(p => p.arquivo_url);
            const { error: storageErr } = await supabase.storage
                .from('materiais')
                .remove(arquivosParaDeletar);

            if (storageErr) {
                console.warn('Erro ao remover arquivos do Storage (alguns podem já ter sido deletados):', storageErr.message);
            }

            // 2. Apagar linhas da tabela do banco de dados
            const { error: dbErr } = await supabase
                .from('materiais')
                .delete()
                .eq('material_grupo', grupo.grupo);

            if (dbErr) throw dbErr;

            alert('Material excluído com sucesso!');
            loadMateriais();
        } catch (err) {
            console.error('Erro ao deletar:', err);
            alert(`Erro ao excluir: ${err.message}`);
            setLoading(false);
        }
    };

    // Submeter upload de material
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!titulo.trim()) return alert('Insira um título para o material');
        if (!file) return alert('Selecione um arquivo (PDF ou Imagem)');

        setIsUploading(true);
        setUploadProgress({ current: 0, total: 0, status: 'Iniciando upload...' });

        const finalCategoria = categoria === 'NOVA' ? novaCategoria.trim() : categoria;
        if (!finalCategoria) {
            alert('Insira o nome da nova pasta/cliente.');
            setIsUploading(false);
            return;
        }

        const categorySlug = finalCategoria.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const groupId = crypto.randomUUID ? crypto.randomUUID() : 'group_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

        try {
            const isPdf = file.name.toLowerCase().endsWith('.pdf');
            const rowsToInsert = [];

            if (isPdf) {
                // --- LÓGICA DO PDF ---
                setUploadProgress({ current: 0, total: 0, status: 'Carregando biblioteca do leitor de PDF...' });
                const pdfjsLib = await loadPdfJs();

                setUploadProgress({ current: 0, total: 0, status: 'Lendo arquivo PDF...' });
                const fileReader = new FileReader();

                const pdfData = await new Promise((resolve, reject) => {
                    fileReader.onload = () => resolve(new Uint8Array(fileReader.result));
                    fileReader.onerror = () => reject(new Error('Erro ao ler o arquivo PDF.'));
                    fileReader.readAsArrayBuffer(file);
                });

                const pdf = await pdfjsLib.getDocument(pdfData).promise;
                const numPages = pdf.numPages;
                setUploadProgress({ current: 0, total: numPages, status: `Renderizando páginas... (0/${numPages})` });

                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    setUploadProgress({ 
                        current: pageNum, 
                        total: numPages, 
                        status: `Convertendo página ${pageNum} de ${numPages}...` 
                    });

                    const page = await pdf.getPage(pageNum);
                    // Usar escala 2.0 para manter uma excelente definição de texto e peso moderado
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const context = canvas.getContext('2d');
                    
                    // Renderizar página no canvas
                    await page.render({ canvasContext: context, viewport }).promise;

                    // Converter canvas em blob JPG com compressão de 80%
                    const blob = await new Promise((resolve) => {
                        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8);
                    });

                    // Subir para o Storage
                    const storagePath = `${categorySlug}/${groupId}_p${pageNum}.jpg`;
                    const { error: uploadErr } = await supabase.storage
                        .from('materiais')
                        .upload(storagePath, blob, { 
                            upsert: true, 
                            contentType: 'image/jpeg',
                            cacheControl: '3600'
                        });

                    if (uploadErr) throw new Error(`Erro ao subir página ${pageNum}: ${uploadErr.message}`);

                    // Criar linha para o insert no banco
                    rowsToInsert.push({
                        titulo,
                        descricao: descricao.trim() || null,
                        categoria: finalCategoria,
                        arquivo_url: storagePath,
                        pagina: pageNum,
                        total_paginas: numPages,
                        material_grupo: groupId,
                        ordem: Number(ordem)
                    });
                }
            } else {
                // --- LÓGICA DE IMAGEM ---
                setUploadProgress({ current: 1, total: 1, status: 'Subindo imagem original...' });
                const extension = file.name.split('.').pop() || 'png';
                const storagePath = `${categorySlug}/${groupId}_p1.${extension}`;

                const { error: uploadErr } = await supabase.storage
                    .from('materiais')
                    .upload(storagePath, file, { 
                        upsert: true, 
                        contentType: file.type,
                        cacheControl: '3600'
                    });

                if (uploadErr) throw uploadErr;

                rowsToInsert.push({
                    titulo,
                    descricao: descricao.trim() || null,
                    categoria: finalCategoria,
                    arquivo_url: storagePath,
                    pagina: 1,
                    total_paginas: 1,
                    material_grupo: groupId,
                    ordem: Number(ordem)
                });
            }

            // Inserir metadados no banco de dados de uma vez só
            setUploadProgress({ current: 100, total: 100, status: 'Salvando informações no banco...' });
            const { error: dbErr } = await supabase
                .from('materiais')
                .insert(rowsToInsert);

            if (dbErr) throw dbErr;

            setUploadProgress({ current: 100, total: 100, status: 'Concluído com sucesso!' });
            setTimeout(() => {
                setIsUploading(false);
                setTitulo('');
                setDescricao('');
                setOrdem(10);
                setFile(null);
                setViewMode('list');
                loadMateriais();
            }, 1000);

        } catch (error) {
            console.error('Erro no upload/conversão:', error);
            alert(`Falha no upload: ${error.message}`);
            setIsUploading(false);
        }
    };

    return (
        <div className="manager-container">
            <header className="manager-header">
                <div className="header-left">
                    <button onClick={onBack} className="back-btn" disabled={isUploading}>
                        <ArrowLeft size={24} />
                    </button>
                    <h2>Gerenciar Galeria de Materiais</h2>
                </div>
                {viewMode === 'list' && (
                    <button onClick={() => setViewMode('add')} className="add-material-btn">
                        <Plus size={18} /> Novo Material
                    </button>
                )}
            </header>

            <AnimatePresence mode="wait">
                {viewMode === 'list' ? (
                    <motion.div 
                        key="list"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        className="manager-content"
                    >
                        {loading ? (
                            <div className="manager-loading">
                                <RefreshCw className="spin" size={32} />
                                <p>Carregando materiais...</p>
                            </div>
                        ) : grupos.length === 0 ? (
                            <div className="manager-empty">
                                <AlertCircle size={48} color="#FD5003" />
                                <p>Nenhum material cadastrado na galeria ainda.</p>
                                <button onClick={() => setViewMode('add')} className="add-material-btn-empty">
                                    Adicionar Primeiro Material
                                </button>
                            </div>
                        ) : (
                            <div className="grupos-list-grid">
                                {grupos.map((g) => (
                                    <div key={g.grupo} className="grupo-manager-card">
                                        <div className="card-media">
                                            {signedUrls[g.capaUrl] ? (
                                                <img src={signedUrls[g.capaUrl]} alt="Capa" />
                                            ) : (
                                                <div className="media-placeholder">
                                                    <FileText size={32} />
                                                </div>
                                            )}
                                            <span className="card-badge">{g.categoria}</span>
                                        </div>
                                        <div className="card-info">
                                            <h4>{g.titulo}</h4>
                                            <p className="desc">{g.descricao || 'Sem descrição'}</p>
                                            <div className="card-meta">
                                                <span>Páginas: <strong>{g.totalPaginas}</strong></span>
                                                <span>Ordem: <strong>{g.ordem}</strong></span>
                                            </div>
                                        </div>
                                        <div className="card-actions">
                                            <button 
                                                onClick={() => handleDelete(g)} 
                                                className="delete-action-btn"
                                                title="Excluir material completo"
                                            >
                                                <Trash2 size={16} /> Excluir
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div 
                        key="add"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        className="manager-form-container"
                    >
                        <form onSubmit={handleSubmit} className="premium-form">
                            <h3>Adicionar Novo Material</h3>
                            <p className="form-subtitle">O sistema processa e compacta PDFs de forma automática.</p>
                            
                            <div className="form-group">
                                <label>Título do Material *</label>
                                <input 
                                    type="text" 
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    placeholder="Ex: Regulamento BHP - Junho 2026"
                                    required
                                    disabled={isUploading}
                                />
                            </div>

                            <div className="form-group">
                                <label>Descrição / Informações Adicionais</label>
                                <textarea 
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    placeholder="Escreva detalhes sobre o material..."
                                    rows={3}
                                    disabled={isUploading}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group flex-2">
                                    <label>Pasta / Cliente *</label>
                                    <select 
                                        value={categoria}
                                        onChange={(e) => setCategoria(e.target.value)}
                                        disabled={isUploading}
                                    >
                                        {CLIENTES_LIST.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                        <option value="NOVA">Nova Pasta/Cliente...</option>
                                    </select>
                                </div>

                                <div className="form-group flex-1">
                                    <label>Ordem de Exibição *</label>
                                    <input 
                                        type="number" 
                                        value={ordem}
                                        onChange={(e) => setOrdem(e.target.value)}
                                        required
                                        min={0}
                                        disabled={isUploading}
                                    />
                                </div>
                            </div>

                            {categoria === 'NOVA' && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="form-group"
                                >
                                    <label>Nome do Novo Cliente/Pasta *</label>
                                    <input 
                                        type="text" 
                                        value={novaCategoria}
                                        onChange={(e) => setNovaCategoria(e.target.value)}
                                        placeholder="Ex: Nome da Empresa"
                                        required
                                        disabled={isUploading}
                                    />
                                </motion.div>
                            )}

                            <div className="form-group">
                                <label>Arquivo (PDF ou Imagem) *</label>
                                <div className={`file-dropzone ${file ? 'has-file' : ''}`}>
                                    <input 
                                        type="file" 
                                        accept=".pdf,image/*"
                                        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                        required
                                        disabled={isUploading}
                                        id="file-upload-input"
                                    />
                                    <label htmlFor="file-upload-input" className="dropzone-label">
                                        <UploadCloud size={36} color="#FD5003" />
                                        {file ? (
                                            <div className="file-selected-info">
                                                <span className="file-name">{file.name}</span>
                                                <span className="file-size">({Math.round(file.size / 1024)} kb)</span>
                                            </div>
                                        ) : (
                                            <span>Arraste ou clique para selecionar PDF ou Imagem</span>
                                        )}
                                    </label>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button 
                                    type="button" 
                                    onClick={() => setViewMode('list')} 
                                    className="btn-cancel"
                                    disabled={isUploading}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-submit"
                                    disabled={isUploading}
                                >
                                    {isUploading ? 'Processando...' : 'Salvar e Publicar'}
                                </button>
                            </div>
                        </form>

                        {/* Modal/Overlay de Progresso */}
                        {isUploading && (
                            <div className="upload-progress-overlay">
                                <div className="progress-card">
                                    <RefreshCw className="spin text-primary" size={40} />
                                    <h4>Processando Upload</h4>
                                    <p className="status-text">{uploadProgress.status}</p>
                                    
                                    {uploadProgress.total > 0 && (
                                        <div className="progress-bar-container">
                                            <div 
                                                className="progress-bar-fill" 
                                                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                            />
                                            <span className="progress-label">
                                                {uploadProgress.current} de {uploadProgress.total} páginas
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
