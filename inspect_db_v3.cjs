const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const debug = async () => {
    const { data: visits, error } = await supabase
        .from('visits')
        .select('id, data, loja, check_in, check_out')
        .eq('data', '2026-02-19')
        .ilike('consultor', '%BIBIANO%');

    if (error) return console.error(error.message);

    console.log('COUNT:', visits.length);
    for (const v of visits) {
        console.log(`V: ${v.id} | ${v.check_in} TO ${v.check_out} | ${v.loja.substring(0, 20)}`);
    }
};
debug();
