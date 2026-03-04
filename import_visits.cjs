const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const Papa = require('papaparse');

const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CSV_FILE = 'public/JP_JANEIRO 2026.csv';

const importVisits = async () => {
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
        skipEmptyLines: true
    });

    if (results.errors.length > 0) {
        console.error('❌ Erros no CSV:', results.errors);
        return;
    }

    const rows = results.data;
    console.log(`✅ ${rows.length} registros encontrados.`);

    // Converter para formato que o Supabase aceita
    const mappedRows = rows.map(row => {
        let cleanDate = row.data || '';
        if (cleanDate.includes('/')) {
            const [d, m, y] = cleanDate.split('/');
            cleanDate = `${y}-${m}-${d}`;
        }
        return {
            data: cleanDate,
            dia_da_semana: row.dia_da_semana || '',
            consultor: row.consultor || '',
            cliente: row.cliente || '',
            loja: row.loja || '',
            check_in: row.check_in || '',
            check_out: row.check_out || ''
        };
    });

    console.log('🧹 Limpando tabela de visitas antiga...');
    const { error: deleteError } = await supabase
        .from('visits')
        .delete()
        .neq('data', '1900-01-01'); // Hack to bypass RLS and delete all

    if (deleteError) {
        console.warn('⚠️ Nota sobre limpeza:', deleteError.message);
    } else {
        console.log('✨ Tabela de visitas limpa.');
    }

    console.log(`📤 Enviando ${mappedRows.length} registros em lotes...`);
    const chunkSize = 100;
    for (let i = 0; i < mappedRows.length; i += chunkSize) {
        const chunk = mappedRows.slice(i, i + chunkSize);
        const { error: insertError } = await supabase
            .from('visits')
            .insert(chunk);

        if (insertError) {
            console.error(`❌ Erro no lote ${Math.floor(i / chunkSize) + 1}:`, insertError.message);
            return;
        } else {
            console.log(`✅ Progresso: ${i + chunk.length}/${mappedRows.length} inseridos.`);
        }
    }

    console.log('🏁 Importação completa!');
};

importVisits();
