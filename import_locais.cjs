const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const Papa = require('papaparse');

const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CSV_FILE = 'C:/Users/Gabriel Amorim/Desktop/App alteração JP/public/BASE - Protrade I Samsung AC I Reestruturação.csv';

const importLocais = async () => {
    console.log(`📖 Lendo o arquivo: ${CSV_FILE}...`);
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`❌ Arquivo não encontrado: ${CSV_FILE}`);
        return;
    }

    const fileContent = fs.readFileSync(CSV_FILE, 'utf8');

    console.log('⚙️ Processando CSV...');
    const results = Papa.parse(fileContent, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_')
    });

    if (results.errors.length > 0) {
        console.error('❌ Erros no CSV:', results.errors);
        return;
    }

    let rows = results.data;
    console.log(`✅ ${rows.length} registros encontrados no array.`);

    // Converter para formato que o Supabase aceita
    let currentId = 1;
    const mappedRows = rows.map(row => ({
        id: currentId++,
        rede: row.bandeira || '',
        cliente: row.cliente || '',
        loja: row.nome_pdv_novo || '',
        consultor: row.responsável_1 || row.responsável || '',
        cnpj: row.cnpj || '',
        nome_pdv: row.nome_pdv_novo || ''
    })).filter(row => row.loja !== ''); // Ignorar linhas vazias

    console.log(`Filtrados: ${mappedRows.length} registros com nome de loja validos.`);

    console.log('🧹 Limpando tabela de locais antiga (base Supabase)...');
    const { error: deleteError } = await supabase
        .from('locais')
        .delete()
        .neq('id', 0);

    if (deleteError) {
        console.warn('⚠️ Nota sobre limpeza:', deleteError.message);
    } else {
        console.log('✨ Tabela de locais limpa.');
    }

    console.log(`📤 Enviando ${mappedRows.length} registros em lotes...`);
    const chunkSize = 100;
    for (let i = 0; i < mappedRows.length; i += chunkSize) {
        const chunk = mappedRows.slice(i, i + chunkSize);
        const { error: insertError } = await supabase
            .from('locais')
            .insert(chunk);

        if (insertError) {
            console.error(`❌ Erro no lote ${Math.floor(i / chunkSize) + 1}:`, insertError.message);
            return;
        } else {
            console.log(`✅ Progresso: ${i + chunk.length}/${mappedRows.length} inseridos.`);
        }
    }

    console.log('🏁 Importação da base de lojas completa!');
};

importLocais();
