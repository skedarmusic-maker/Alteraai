/**
 * upload_materiais_manual.cjs
 * Script para subir imagens convertidas EXTERNAMENTE (alta qualidade).
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUxMjQwOSwiZXhwIjoyMDg3MDg4NDA5fQ.myL7Xg_npoGpbclk0jc-H95H6POrNWFFtwA5SweL8N4';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';

const keyToUse = supabaseServiceKey || supabaseAnonKey;
const supabase = createClient(supabaseUrl, keyToUse);

const FINAI_DIR = path.join(__dirname, 'PDFs', 'finais');

// Configuração dos grupos — ajuste os nomes conforme seus arquivos manuais
const GRUPOS = [
    {
        id: 'tabela_pontos_geral',
        titulo: 'Tabela de Pontos AC Maio/26',
        categoria: 'Tabela de Pontos',
        prefixo: 'tabela_geral', // Procura arquivos que começam com isso
    },
    {
        id: 'tabela_pontos_monvizo',
        titulo: 'Tabela de Pontos AC Maio/26 - Monvizo',
        categoria: 'Tabela de Pontos',
        prefixo: 'tabela_monvizo',
    },
    {
        id: 'tabela_pontos_uniar',
        titulo: 'Tabela de Pontos AC Maio/26 - Uniar',
        categoria: 'Tabela de Pontos',
        prefixo: 'tabela_uniar',
    },
    {
        id: 'tabela_pontos_webcontinental',
        titulo: 'Tabela de Pontos AC Maio/26 - Webcontinental',
        categoria: 'Tabela de Pontos',
        prefixo: 'tabela_web',
    },
    {
        id: 'email_monvizo',
        titulo: 'Email - Linha FJM Monvizo',
        categoria: 'Comunicação',
        prefixo: 'email_monvizo',
    },
    {
        id: 'email_web',
        titulo: 'Email - Linha FJM Web',
        categoria: 'Comunicação',
        prefixo: 'email_web',
    }
];

function sanitizeKey(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._\-\/]/g, '_').toLowerCase();
}

async function upload() {
    if (!fs.existsSync(FINAI_DIR)) {
        console.error('Pasta PDFs/finais não encontrada!');
        return;
    }

    const allFiles = fs.readdirSync(FINAI_DIR).filter(f => f.toLowerCase().endsWith('.png'));
    console.log(`🚀 Iniciando upload de ${allFiles.length} arquivos manuais...\n`);

    for (const grupo of GRUPOS) {
        const arquivosDoGrupo = allFiles
            .filter(f => f.startsWith(grupo.prefixo))
            .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)?.[0] || 0);
                const numB = parseInt(b.match(/\d+/)?.[0] || 0);
                return numA - numB;
            });

        if (arquivosDoGrupo.length === 0) {
            console.log(`ℹ️  Pulando ${grupo.titulo} (nenhum arquivo com prefixo "${grupo.prefixo}" encontrado)`);
            continue;
        }

        console.log(`\n📁 Enviando ${grupo.titulo}...`);

        // Limpa registros anteriores do grupo na tabela (opcional, mas recomendado)
        await supabase.from('materiais').delete().eq('material_grupo', grupo.id);

        for (let i = 0; i < arquivosDoGrupo.length; i++) {
            const fileName = arquivosDoGrupo[i];
            const filePath = path.join(FINAI_DIR, fileName);
            const fileBuffer = fs.readFileSync(filePath);
            const pageNum = i + 1;
            const storagePath = sanitizeKey(`${grupo.id}/${fileName}`);

            // 1. Upload Storage
            const { error: storageErr } = await supabase.storage
                .from('materiais')
                .upload(storagePath, fileBuffer, { upsert: true, contentType: 'image/png' });

            if (storageErr) {
                console.error(`   ❌ Erro Storage (${fileName}):`, storageErr.message);
                continue;
            }

            // 2. Insert Tabela
            const { error: dbErr } = await supabase.from('materiais').insert({
                titulo: grupo.titulo,
                categoria: grupo.categoria,
                arquivo_url: storagePath,
                pagina: pageNum,
                total_paginas: arquivosDoGrupo.length,
                material_grupo: grupo.id,
                ordem: (GRUPOS.indexOf(grupo) + 1) * 100 + pageNum
            });

            if (dbErr) {
                console.error(`   ❌ Erro Banco (${fileName}):`, dbErr.message);
            } else {
                console.log(`   ✅ Página ${pageNum}/${arquivosDoGrupo.length} enviada.`);
            }
        }
    }
    console.log('\n🏁 Processo concluído!');
}

upload();
