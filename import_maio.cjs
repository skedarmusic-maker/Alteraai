const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const Papa = require('papaparse');

const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUxMjQwOSwiZXhwIjoyMDg3MDg4NDA5fQ.myL7Xg_npoGpbclk0jc-H95H6POrNWFFtwA5SweL8N4';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CSV_FILE = 'public/Journey Maio primeira semana.csv';

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

    // Converter para formato que o Supabase aceita (YYYY-MM-DD)
    const mappedRows = rows.map(row => {
        let cleanDate = (row.data || '').trim();
        if (cleanDate.includes('/')) {
            const parts = cleanDate.split('/');
            if (parts.length === 3) {
                const [d, m, y] = parts;
                // Forçar 2 dígitos para d e m
                const day = d.padStart(2, '0');
                const month = m.padStart(2, '0');
                cleanDate = `${y}-${month}-${day}`;
            }
        }

        // Limpar horários (remover segundos se houver)
        let checkIn = (row.check_in || '').trim();
        if (checkIn.split(':').length === 3) {
            checkIn = checkIn.substring(0, 5);
        }

        let checkOut = (row.check_out || '').trim();
        if (checkOut.split(':').length === 3) {
            checkOut = checkOut.substring(0, 5);
        }

        return {
            data: cleanDate,
            dia_da_semana: (row.dia_da_semana || '').trim(),
            consultor: (row.consultor || '').trim(),
            cliente: (row.cliente || '').trim(),
            loja: (row.loja || '').trim(),
            check_in: checkIn,
            check_out: checkOut
        };
    });

    console.log('🧹 Limpando tabela de visitas antiga...');
    // Vamos deletar todas as visitas para garantir que não haja duplicatas ou lixo
    const { error: deleteError } = await supabase
        .from('visits')
        .delete()
        .neq('id', 0); // Delete everything

    if (deleteError) {
        console.error('❌ Erro ao limpar tabela:', deleteError.message);
        return;
    }
    console.log('✨ Tabela de visitas limpa.');

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
