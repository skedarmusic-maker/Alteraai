import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==========================================
// AI Reports Functions
// ==========================================

export async function saveAiReport(reportData) {
    const { data, error } = await supabase
        .from('ai_reports')
        .insert([{
            filter_type: reportData.filterType,
            date_start: reportData.dateStart || '',
            date_end: reportData.dateEnd || '',
            general_summary: reportData.generalSummary || null,
            individual_summaries: reportData.individualSummaries || {}
        }]);

    if (error) {
        console.error("Erro ao salvar relatório de IA:", error);
        throw error;
    }
    return data;
}

export async function fetchAiReport(filterType, dateStart, dateEnd) {
    let query = supabase.from('ai_reports').select('*').eq('filter_type', filterType);

    if (filterType === 'custom') {
        query = query.eq('date_start', dateStart || '').eq('date_end', dateEnd || '');
    }

    // Pegando sempre o mais recente que bater com o filtro
    query = query.order('created_at', { ascending: false }).limit(1);

    const { data, error } = query;
    if (error) {
        console.error("Erro ao buscar relatório de IA:", error);
        return null;
    }
    return data && data.length > 0 ? data[0] : null;
}

// ==========================================
// Solicitations (Duplicate Prevention)
// ==========================================

export async function checkDuplicateSolicitation(sol) {
    const { data, error } = await supabase
        .from('solicitations')
        .select('id')
        .eq('consultant', sol.consultant)
        .eq('original_date', sol.original_date)
        .eq('store_from', sol.store_from)
        .eq('new_store', sol.new_store || sol.store_from)
        .eq('new_time', sol.new_time)
        .neq('status', 'Negado') // Se foi negado, ele pode tentar de novo
        .limit(1);

    if (error) {
        console.error("Erro ao verificar duplicidade:", error);
        return false;
    }
    return data && data.length > 0;
}

export async function saveSolicitation(sol) {
    const { data, error } = await supabase
        .from('solicitations')
        .insert([sol]);

    if (error) {
        // Se cair aqui por causa da constraint UNIQUE, tratamos como duplicado
        if (error.code === '23505') return { duplicate: true };
        throw error;
    }
    return { success: true, data };
}
