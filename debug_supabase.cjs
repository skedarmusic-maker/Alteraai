const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const debug = async () => {
    const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('data', '2026-02-19')
        .ilike('consultor', '%BIBIANO%');

    if (error) {
        console.error('❌ Erro:', error.message);
        return;
    }

    console.log(`🔍 Visitas de BIBIANO em 19/02/2026: ${data.length}`);
    data.forEach((v, i) => {
        console.log(`${i + 1}. Loja: ${v.loja} | Horário: ${v.check_in} - ${v.check_out} | Consultor: ${v.consultor}`);
    });
};

debug();
