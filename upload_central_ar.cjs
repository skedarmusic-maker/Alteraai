const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUxMjQwOSwiZXhwIjoyMDg3MDg4NDA5fQ.myL7Xg_npoGpbclk0jc-H95H6POrNWFFtwA5SweL8N4';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PDF_DIR = path.join(__dirname, 'PDFs');
const CONV_DIR = path.join(PDF_DIR, 'convertidos');

function sanitizeKey(str) {
    return str
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._\-\/]/g, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
}

function getPageNum(filename) {
    const match = filename.match(/_p(\d+)\.png$/i);
    return match ? parseInt(match[1]) : 1;
}

const grupoCentralAr = {
    grupo: 'tabela_pontos_central_ar',
    categoria: 'Tabela de Pontos',
    titulo: 'Tabela de Pontos AC Maio/26 - Central Ar',
    descricao: 'Tabela de pontos AC - Central Ar - Maio 2026',
    ordem: 7,
    matchFn: f => f.includes('Central_Ar'),
};

function resolveArquivos(grupo) {
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
        const safeKey = sanitizeKey(`${grupo.grupo}/${arq.originalName}`);

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
    console.log('🚀 Upload de Central Ar para o Supabase...\n');
    await uploadGrupo(grupoCentralAr);
    console.log('\n🏁 Concluído!');
}

main().catch(console.error);
