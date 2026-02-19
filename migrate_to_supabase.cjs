const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const Papa = require('papaparse');
const { parse, format } = require('date-fns');

// Configuração manual para o script de migração
const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const migrate = async () => {
    console.log('🚀 Iniciando migração para o Supabase...');

    if (!fs.existsSync('./public/JP_JANEIRO 2026.csv')) {
        console.error('❌ Arquivo CSV não encontrado em ./public/JP_JANEIRO 2026.csv');
        return;
    }

    const csvFile = fs.readFileSync('./public/JP_JANEIRO 2026.csv', 'utf8');

    Papa.parse(csvFile, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
        complete: async (results) => {
            const rows = results.data;
            console.log(`📊 Total de linhas encontradas no CSV: ${rows.length}`);

            const formattedRows = rows.map(row => {
                let formattedDate = null;
                const rawDate = row['DATA'] || row['Data'];

                if (rawDate) {
                    try {
                        // Tenta converter dd/mm/yyyy para yyyy-mm-dd
                        const parsedDate = parse(rawDate.trim(), 'dd/MM/yyyy', new Date());
                        formattedDate = format(parsedDate, 'yyyy-MM-dd');
                    } catch (e) {
                        // se falhar, mantém como está ou ignora
                    }
                }

                return {
                    data: formattedDate,
                    dia_da_semana: row['DIA DA SEMANA'] || row['DIA'] || '',
                    consultor: row['CONSULTOR'] || '',
                    cliente: row['CLIENTE'] || '',
                    loja: row['LOJA'] || '',
                    check_in: row['CHECK IN'] || row['ENTRADA'] || '',
                    check_out: row['CHECK OUT'] || row['SAIDA'] || '',
                    cnpj: row['CNPJ'] || '',
                    nome_pdv: row['NOME PDV'] || row['NOME_PDV'] || ''
                };
            }).filter(r => r.data && r.consultor);

            console.log(`🧹 Linhas válidas para envio: ${formattedRows.length}`);

            if (formattedRows.length === 0) {
                console.log('⚠️ Nenhuma linha válida para importar.');
                return;
            }

            // Enviar em lotes de 100 para evitar timeout
            const chunkSize = 100;
            for (let i = 0; i < formattedRows.length; i += chunkSize) {
                const chunk = formattedRows.slice(i, i + chunkSize);
                console.log(`📤 Enviando lote ${Math.floor(i / chunkSize) + 1}...`);

                const { error } = await supabase.from('visits').insert(chunk);
                if (error) {
                    console.error('❌ Erro no lote:', error.message);
                }
            }

            console.log('✅ Processo de migração concluído!');
        }
    });
};

migrate();
