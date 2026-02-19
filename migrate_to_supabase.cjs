const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const Papa = require('papaparse');
const { parse, format } = require('date-fns');

const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const migrate = async () => {
    console.log('🚀 Iniciando migração limpa para o Supabase...');

    // 1. Limpar tabela atual
    console.log('🧹 Limpando tabela visits...');
    const { error: deleteError } = await supabase.from('visits').delete().neq('id', 0);
    if (deleteError) {
        console.error('❌ Erro ao limpar tabela:', deleteError.message);
        return;
    }

    if (!fs.existsSync('./public/JP_JANEIRO 2026.csv')) {
        console.error('❌ CSV não encontrado.');
        return;
    }

    const csvFile = fs.readFileSync('./public/JP_JANEIRO 2026.csv', 'utf8');

    Papa.parse(csvFile, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
        complete: async (results) => {
            const rows = results.data;
            console.log(`📊 Linhas no CSV: ${rows.length}`);

            const getValue = (row, ...keys) => {
                for (let k of keys) {
                    // Tenta achar a chave exata ou com trim
                    const foundKey = Object.keys(row).find(rk => rk.trim().toUpperCase() === k.toUpperCase());
                    if (foundKey) return row[foundKey];
                }
                return '';
            };

            const formattedRows = rows.map((row, idx) => {
                let formattedDate = null;
                const rawDate = getValue(row, 'DATA');

                if (rawDate) {
                    try {
                        const parsedDate = parse(rawDate.trim(), 'dd/MM/yyyy', new Date());
                        formattedDate = format(parsedDate, 'yyyy-MM-dd');
                    } catch (e) { }
                }

                const consultor = getValue(row, 'CONSULTOR').trim();
                const loja = getValue(row, 'LOJA').trim();

                return {
                    data: formattedDate,
                    dia_da_semana: getValue(row, 'DIA DA SEMANA', 'DIA').trim(),
                    consultor: consultor,
                    cliente: getValue(row, 'CLIENTE').trim(),
                    loja: loja,
                    check_in: getValue(row, 'CHECK IN', 'ENTRADA').trim(),
                    check_out: getValue(row, 'CHECK OUT', 'SAIDA').trim(),
                    cnpj: getValue(row, 'CNPJ').trim(),
                    nome_pdv: getValue(row, 'NOME PDV', 'NOME_PDV').trim()
                };
            }).filter(r => r.data && r.consultor && r.loja);

            console.log(`🧹 Linhas válidas processadas: ${formattedRows.length}`);

            const chunkSize = 100;
            for (let i = 0; i < formattedRows.length; i += chunkSize) {
                const chunk = formattedRows.slice(i, i + chunkSize);
                const { error } = await supabase.from('visits').insert(chunk);
                if (error) console.error(`❌ Erro lote ${i}:`, error.message);
                else console.log(`📤 Lote ${Math.floor(i / chunkSize) + 1} enviado...`);
            }

            console.log('✅ Migração finalizada!');
        }
    });
};

migrate();
