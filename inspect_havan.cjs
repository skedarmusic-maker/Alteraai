const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const debug = async () => {
    const { data: visits, error } = await supabase
        .from('visits')
        .select('*')
        .eq('loja', '00779 - HAVAN - RUA ORESTES CAMILLI - 91 - CURITIBA - PR')
        .eq('data', '2026-02-19');

    if (error) return console.error(error.message);

    for (const v of visits) {
        console.log(`ID: ${v.id} | CONSULTOR: "${v.consultor}" | LOJA: ${v.loja}`);
    }
};
debug();
