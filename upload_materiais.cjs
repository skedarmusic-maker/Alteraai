/**
 * upload_materiais.cjs — v2
 * - Sanitiza nomes de arquivo (remove acentos e caracteres especiais)
 * - Usa service_role key para bypassar RLS do Storage
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
// Precisamos da SERVICE ROLE KEY para fazer upload no Storage (bypass RLS)
// Pegue em: Supabase → Settings → API → service_role (secret)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';

// Usa service key se disponível, senão usa anon (pode falhar no storage)
const keyToUse = supabaseServiceKey || supabaseAnonKey;
if (!supabaseServiceKey) {
    console.warn('⚠️  SUPABASE_SERVICE_KEY não definida. Usando anon key (pode falhar no Storage).');
    console.warn('   Defina: $env:SUPABASE_SERVICE_KEY="eyJ..."  antes de rodar.\n');
}

const supabase = createClient(supabaseUrl, keyToUse);

const PDF_DIR = path.join(__dirname, 'PDFs');
const CONV_DIR = path.join(PDF_DIR, 'convertidos');

// Sanitiza nome para uso como chave no Supabase Storage
// Remove acentos, substitui espaços/underscores/caracteres especiais
function sanitizeKey(str) {
    return str
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-zA-Z0-9._\-\/]/g, '_')              // Substitui chars inválidos
        .replace(/_+/g, '_')                               // Remove underscores duplos
        .toLowerCase();
}

// =============================================================================
const GRUPOS = [
    {
        grupo: 'email_monvizo',
        categoria: 'Comunicação',
        titulo: 'Email - Linha FJM Monvizo',
        descricao: 'Comunicação de lançamento da Linha FJM - Monvizo',
        ordem: 1,
        arquivos: [{ nome: '086_email_Linha_FJM_Monvizo_0605.png', fromOriginal: true }],
    },
    {
        grupo: 'email_web',
        categoria: 'Comunicação',
        titulo: 'Email - Linha FJM Web',
        descricao: 'Comunicação de lançamento da Linha FJM - Web',
        ordem: 2,
        arquivos: [{ nome: '086_email_Linha_FJM_Web_0605.png', fromOriginal: true }],
    },
    {
        grupo: 'tabela_pontos_geral',
        categoria: 'Tabela de Pontos',
        titulo: 'Tabela de Pontos AC Maio/26',
        descricao: 'Tabela de pontos de ar-condicionado - Maio 2026',
        ordem: 3,
        prefixo: 'Conex',  // busca por prefixo nos convertidos (sem acento)
        matchFn: f => f.startsWith('Conex') && !f.includes('Monvizo') && !f.includes('Uniar') && !f.includes('Webcontinental'),
    },
    {
        grupo: 'tabela_pontos_monvizo',
        categoria: 'Tabela de Pontos',
        titulo: 'Tabela de Pontos AC Maio/26 - Monvizo',
        descricao: 'Tabela de pontos AC - Monvizo - Maio 2026',
        ordem: 4,
        matchFn: f => f.includes('Monvizo'),
    },
    {
        grupo: 'tabela_pontos_uniar',
        categoria: 'Tabela de Pontos',
        titulo: 'Tabela de Pontos AC Maio/26 - Uniar',
        descricao: 'Tabela de pontos AC - Uniar - Maio 2026',
        ordem: 5,
        matchFn: f => f.includes('Uniar'),
    },
    {
        grupo: 'tabela_pontos_webcontinental',
        categoria: 'Tabela de Pontos',
        titulo: 'Tabela de Pontos AC Maio/26 - Webcontinental',
        descricao: 'Tabela de pontos AC - Webcontinental - Maio 2026',
        ordem: 6,
        matchFn: f => f.includes('Webcontinental'),
    },
];

function getPageNum(filename) {
    const match = filename.match(/_p(\d+)\.png$/i);
    return match ? parseInt(match[1]) : 1;
}

function resolveArquivos(grupo) {
    if (grupo.arquivos) {
        return grupo.arquivos.map(a => ({
            localPath: path.join(a.fromOriginal ? PDF_DIR : CONV_DIR, a.nome),
            originalName: a.nome,
            page: 1,
        }));
    }
    const allFiles = fs.readdirSync(CONV_DIR);
    return allFiles
        .filter(grupo.matchFn)
        .sort((a, b) => getPageNum(a) - getPageNum(b))
        .map((f, i) => ({
            localPath: path.join(CONV_DIR, f),
            originalName: f,
            page: getPageNum(f) || i + 1,
        }));
}

async function uploadGrupo(grupo) {
    const arquivos = resolveArquivos(grupo);
    const totalPages = arquivos.length;

    console.log(`\n📁 ${grupo.titulo} (${totalPages} arquivo(s))`);

    // Limpar registros anteriores
    const { error: delErr } = await supabase
        .from('materiais')
        .delete()
        .eq('material_grupo', grupo.grupo);
    if (delErr) console.warn(`   ⚠️  Limpeza: ${delErr.message}`);

    for (const arq of arquivos) {
        if (!fs.existsSync(arq.localPath)) {
            console.warn(`   ⚠️  Não encontrado: ${arq.localPath}`);
            continue;
        }

        const fileBuffer = fs.readFileSync(arq.localPath);
        // Chave sanitizada para o Storage
        const safeKey = sanitizeKey(`${grupo.grupo}/${arq.originalName}`);

        // Upload
        const { error: uploadErr } = await supabase.storage
            .from('materiais')
            .upload(safeKey, fileBuffer, {
                contentType: 'image/png',
                upsert: true,
            });

        if (uploadErr) {
            console.error(`   ❌ Upload ${arq.originalName}: ${uploadErr.message}`);
            continue;
        }

        // Insert metadados
        const { error: insertErr } = await supabase.from('materiais').insert({
            titulo: grupo.titulo,
            descricao: grupo.descricao,
            categoria: grupo.categoria,
            arquivo_url: safeKey,
            pagina: arq.page,
            total_paginas: totalPages,
            material_grupo: grupo.grupo,
            ordem: grupo.ordem * 100 + arq.page,
        });

        if (insertErr) {
            console.error(`   ❌ Insert ${arq.originalName}: ${insertErr.message}`);
        } else {
            const sizeKb = Math.round(fileBuffer.length / 1024);
            console.log(`   ✅ p${arq.page}/${totalPages} → ${safeKey} (${sizeKb}kb)`);
        }
    }
}

async function main() {
    console.log('🚀 Upload de materiais para o Supabase...\n');
    for (const grupo of GRUPOS) {
        await uploadGrupo(grupo);
    }
    console.log('\n🏁 Concluído!');
}

main().catch(err => {
    console.error('❌ Erro fatal:', err.message);
    process.exit(1);
});
