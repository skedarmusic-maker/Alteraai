/**
 * setup_supabase_materiais.cjs
 * Cria a tabela `materiais` e o bucket `materiais` no Supabase via API
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vpvdprunhcvaztrqewjp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdmRwcnVuaGN2YXp0cnFld2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTI0MDksImV4cCI6MjA4NzA4ODQwOX0.WKx85-6gZtwqZDp2h6g6hul2TorumD5RCIG75RhK0Ws';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setup() {
    console.log('🔧 Configurando Supabase...\n');

    // 1. Criar bucket de storage (pode já existir - tudo bem)
    console.log('📦 Criando bucket "materiais"...');
    const { data: bucket, error: bucketErr } = await supabase.storage.createBucket('materiais', {
        public: false, // privado — acesso via signed URL
        fileSizeLimit: '10MB',
        allowedMimeTypes: ['image/png', 'image/jpeg'],
    });

    if (bucketErr) {
        if (bucketErr.message.includes('already exists')) {
            console.log('   ℹ️  Bucket já existe, continuando...');
        } else {
            console.error('   ❌ Erro ao criar bucket:', bucketErr.message);
            return;
        }
    } else {
        console.log('   ✅ Bucket "materiais" criado!');
    }

    // 2. Verificar tabela materiais (inserindo um item de teste e removendo)
    console.log('\n📋 Verificando tabela "materiais"...');
    const { data: testData, error: testErr } = await supabase
        .from('materiais')
        .select('id')
        .limit(1);

    if (testErr) {
        console.log('\n⚠️  A tabela "materiais" não existe ou não está acessível.');
        console.log('Execute o seguinte SQL no editor do Supabase (https://app.supabase.com → SQL Editor):\n');
        console.log(`
-- =============================================
-- Criar tabela materiais
-- =============================================
CREATE TABLE IF NOT EXISTS public.materiais (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo text NOT NULL,
    descricao text,
    categoria text NOT NULL DEFAULT 'Geral',
    arquivo_url text NOT NULL,
    pagina integer NOT NULL DEFAULT 1,
    total_paginas integer NOT NULL DEFAULT 1,
    material_grupo text,
    ordem integer NOT NULL DEFAULT 0,
    criado_em timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;

-- Policy: qualquer usuário autenticado pode ler
CREATE POLICY "Leitura liberada"
ON public.materiais
FOR SELECT
USING (true);

-- =============================================
-- Criar bucket e configurar acesso (já feito pelo script, mas caso queira garantir)
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('materiais', 'materiais', false)
ON CONFLICT (id) DO NOTHING;

-- Policy para leitura do storage (signed URL)
CREATE POLICY "Acesso autenticado aos materiais"
ON storage.objects
FOR SELECT
USING (bucket_id = 'materiais');
`);
        console.log('\nApós executar o SQL acima, rode este script novamente para confirmar.');
        return;
    }

    console.log('   ✅ Tabela "materiais" acessível!');
    console.log('\n✅ Setup completo! Agora rode: node upload_materiais.cjs');
}

setup().catch(err => console.error('Erro:', err.message));
