/**
 * upload_protati.cjs
 * Script específico para subir o comunicado da Pro Tati.
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const FINAI_DIR = path.join(__dirname, 'PDFs', 'finais');
const FILE_NAME = 'protati_treinamento.jpeg';

const DATA = {
    id: 'comunicado_treinamento_fjm',
    titulo: 'Treinamento Categoria FJM',
    categoria: 'Pro Tati',
    descricao: `Time, em breve teremos nosso treinamento mensal. Segue mais informações abaixo:

📅 Data: 28/05
⏰ Horário: 09h às 12h

Após o treinamento será aplicada uma avaliação.

Contamos com a participação de todos!

Link: https://teams.microsoft.com/meet/45841440518245?p=C6ydUPaDyqygaktkiX

Todos devem justificar os atendimentos programados do período da manhã, e seguirem apenas com a visita do período da tarde (seguindo a programação do journey).`,
    ordem: 50 // Aparece primeiro ou entre os primeiros
};

async function run() {
    const filePath = path.join(FINAI_DIR, FILE_NAME);
    
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Erro: O arquivo ${FILE_NAME} não foi encontrado na pasta PDFs/finais/`);
        console.log('Por favor, salve a imagem enviada com esse nome exato.');
        return;
    }

    console.log('🚀 Subindo comunicado Pro Tati...');

    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `protati/${FILE_NAME}`;

    // 1. Upload Storage
    const { error: storageErr } = await supabase.storage
        .from('materiais')
        .upload(storagePath, fileBuffer, { upsert: true, contentType: 'image/png' });

    if (storageErr) {
        console.error('❌ Erro Storage:', storageErr.message);
        return;
    }

    // 2. Limpar anterior e Inserir Tabela
    await supabase.from('materiais').delete().eq('material_grupo', DATA.id);
    
    const { error: dbErr } = await supabase.from('materiais').insert({
        titulo: DATA.titulo,
        descricao: DATA.descricao,
        categoria: DATA.categoria,
        arquivo_url: storagePath,
        pagina: 1,
        total_paginas: 1,
        material_grupo: DATA.id,
        ordem: DATA.ordem
    });

    if (dbErr) {
        console.error('❌ Erro Banco:', dbErr.message);
    } else {
        console.log('✅ Comunicado Pro Tati enviado com sucesso!');
    }
}

run();
