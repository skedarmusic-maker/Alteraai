const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const fix = async () => {
    // 1. Corrigir HAVAN
    const { error: errorHavan } = await supabase
        .from('visits')
        .update({
            check_in: '12:10',
            check_out: '18:00',
            data: '2026-02-19',
            consultor: 'BIBIANO RODRIGUES NETO'
        })
        .eq('id', 1159);

    // 2. Corrigir FRIGELAR (ajustando checkout para 17:00 como na imagem manual)
    const { error: errorFrigelar } = await supabase
        .from('visits')
        .update({
            check_out: '17:00'
        })
        .eq('id', 1024);

    if (errorHavan) console.error('Erro Havan:', errorHavan.message);
    if (errorFrigelar) console.error('Erro Frigelar:', errorFrigelar.message);

    console.log('✅ Visitas atualizadas no Supabase!');
};
fix();
