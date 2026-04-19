const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const TEMPLATE_PATH = path.join(__dirname, '../templates/load-test-report.ejs');
const REPORTS_DIR = path.join(__dirname, '../../../reports');

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

class LoadTestReporter {
    /**
     * Generate HTML report from load test history record
     */
    async generateHTML(record) {
        const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

        const html = ejs.render(template, {
            record,
            result: record.result || record,
            generatedAt: new Date().toLocaleString('vi-VN'),
        });

        const filename = `load-test-${record._id}.html`;
        const outputPath = path.join(REPORTS_DIR, filename);
        fs.writeFileSync(outputPath, html, 'utf-8');
        return { html, path: outputPath, filename };
    }

    /**
     * Generate PDF from HTML report
     */
    async generatePDF(htmlPath) {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
        const pdfFilename = path.basename(htmlPath, '.html') + '.pdf';
        const pdfPath = path.join(REPORTS_DIR, pdfFilename);
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
        });
        await browser.close();
        return { path: pdfPath, filename: pdfFilename };
    }
}

module.exports = LoadTestReporter;
