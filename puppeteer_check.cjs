const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Capturar erros do console
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('PAGE LOG ERROR:', msg.text());
        }
    });

    page.on('pageerror', err => {
        console.error('PAGE ERROR EXCEPTION:', err.toString());
    });

    try {
        console.log("Navigating to http://localhost:5173/");
        await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

        // Preencher login
        await page.type('input[placeholder="Insira seu código..."]', 'MASTERPRO2026');
        await page.click('button[type="submit"]');

        // Esperar navegação
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        console.log("Current URL:", page.url());

        // Ir para Admin (caso não tenha ido automaticamente ou haja um botão)
        if (!page.url().includes('admin')) {
            await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle2' });
        }

        console.log("On Admin page. Waiting for charts to load...");
        // Esperar um dos gráficos carregar (Top Consultores)
        await page.waitForSelector('.recharts-bar-rectangle', { timeout: 10000 });

        // Clicar no primeiro bar-rectangle que encontrarmos (esperamos que seja de consultor)
        const bars = await page.$$('.recharts-wrapper .recharts-bar-rectangle');
        if (bars.length > 0) {
            console.log(`Found ${bars.length} bars. Clicking the first one...`);
            // Achar a barra do meio que seja do grafico Top Consultores
            // Como não sabemos qual é, vamos clicar em algumas com try-catch
            for (let i = 0; i < Math.min(bars.length, 5); i++) {
                console.log(`Clicking bar ${i}...`);
                await bars[i].click().catch(e => console.log(e.message));
                await new Promise(r => setTimeout(r, 1000));
            }
        } else {
            console.log("No bars found.");
        }

        console.log("Waiting to see if it crashed...");
        await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
        console.error("Test script failed:", err);
    } finally {
        await browser.close();
    }
})();
