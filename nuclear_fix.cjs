const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const nuclearFix = async () => {
    console.log('🚀 Iniciando limpeza nuclear dos dados...');

    // 1. Buscar todas as visitas de BIBIANO para hoje
    const { data: visits, error } = await supabase
        .from('visits')
        .select('*')
        .eq('data', '2026-02-19')
        .ilike('consultor', '%BIBIANO%');

    if (error) {
        console.error('❌ Erro ao buscar visitas:', error.message);
        return;
    }

    console.log(`Encontradas ${visits.length} visitas. Limpando...`);

    for (const v of visits) {
        // Limpeza agressiva: remove quebras de linha, tabs e espaços múltiplos
        const cleanLoja = v.loja.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
        const cleanConsultor = 'BIBIANO RODRIGUES NETO';

        const { error: updateError } = await supabase
            .from('visits')
            .update({
                loja: cleanLoja,
                consultor: cleanConsultor,
                // Garantir horários da planilha para não ter erro
                check_in: v.id === 1159 ? '12:10' : v.check_in,
                check_out: v.id === 1159 ? '18:00' : (v.id === 1024 ? '17:00' : v.check_out)
            })
            .eq('id', v.id);

        if (updateError) {
            console.error(`❌ Erro ao atualizar ID ${v.id}:`, updateError.message);
        } else {
            console.log(`✅ ID ${v.id} limpo: "${cleanLoja.substring(0, 30)}..."`);
        }
    }

    console.log('🏁 Limpeza concluída!');
};

nuclearFix();
