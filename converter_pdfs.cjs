/**
 * converter_pdfs.cjs
 * Converte todos os PDFs da pasta PDFs/ para PNG usando pdf-to-img
 */

const fs = require('fs');
const path = require('path');

const PDF_DIR = path.join(__dirname, 'PDFs');
const OUT_DIR = path.join(__dirname, 'PDFs', 'convertidos');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function convertPdf(pdfPath) {
    const { pdf } = await import('pdf-to-img');

    const fileName = path.basename(pdfPath, '.pdf');
    console.log(`\n📄 Convertendo: ${fileName}`);

    const doc = await pdf(pdfPath, { scale: 5.0 });
    const numPages = doc.length;
    console.log(`   ${numPages} página(s)`);

    let pageNum = 0;
    const outputPaths = [];

    for await (const image of doc) {
        pageNum++;
        const suffix = numPages > 1 ? `_p${pageNum}` : '';
        const outName = `${fileName}${suffix}.png`;
        const outPath = path.join(OUT_DIR, outName);

        fs.writeFileSync(outPath, image);
        outputPaths.push(outPath);
        console.log(`   ✅ Página ${pageNum}/${numPages} → ${outName} (${Math.round(image.length / 1024)}kb)`);
    }

    return outputPaths;
}

async function main() {
    const files = fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));

    if (files.length === 0) {
        console.log('Nenhum PDF encontrado.');
        return;
    }

    console.log(`🚀 Convertendo ${files.length} PDF(s)...`);
    let total = 0;

    for (const file of files) {
        const pages = await convertPdf(path.join(PDF_DIR, file));
        total += pages.length;
    }

    console.log(`\n🏁 Pronto! ${total} imagem(ns) gerada(s) em PDFs/convertidos/`);
}

main().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
