const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const TEMPLATE_PATH = path.join(__dirname, '../templates/report.ejs');
const REPORTS_DIR = path.join(__dirname, '../../../reports');
const EVIDENCE_BASE = path.join(__dirname, '../../../evidence');

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

class Reporter {
    /**
     * Convert a relative evidence path to a base64 data URI
     * @param {string} relPath - e.g. "evidence/RUN-xxx/TC-xxx/step-001.png"
     * @returns {string} base64 data URI or empty string
     */
    toBase64(relPath) {
        if (!relPath) return '';
        const absPath = path.join(__dirname, '../../../', relPath);
        try {
            if (fs.existsSync(absPath)) {
                const ext = path.extname(absPath).toLowerCase();
                const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
                const mime = mimeMap[ext] || 'image/png';
                const data = fs.readFileSync(absPath);
                return `data:${mime};base64,${data.toString('base64')}`;
            }
        } catch (e) { /* file not accessible */ }
        return '';
    }

    /**
     * Convert video to base64 data URI
     */
    videoToBase64(relPath) {
        if (!relPath) return '';
        const absPath = path.join(__dirname, '../../../', relPath);
        try {
            if (fs.existsSync(absPath)) {
                const data = fs.readFileSync(absPath);
                return `data:video/webm;base64,${data.toString('base64')}`;
            }
        } catch (e) { /* file not accessible */ }
        return '';
    }

    async generateHTML(run, suiteInfo, testResults) {
        // Pre-process: convert all evidence paths to base64 data URIs
        const processedResults = testResults.map(r => {
            const stepsRaw = r.steps_result_json ? JSON.parse(r.steps_result_json) : [];
            const steps = stepsRaw.map(s => ({
                ...s,
                screenshot_data: this.toBase64(s.screenshot)
            }));
            return {
                ...r,
                _steps: steps,
                video_data: this.videoToBase64(r.video_path)
            };
        });

        const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
        const html = ejs.render(template, {
            run,
            suite: suiteInfo,
            results: processedResults,
            generatedAt: new Date().toLocaleString('vi-VN')
        });

        const filename = `report-${run.id}.html`;
        const outputPath = path.join(REPORTS_DIR, filename);
        fs.writeFileSync(outputPath, html, 'utf-8');
        return { path: outputPath, filename };
    }

    async generatePDF(htmlPath) {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
        const pdfFilename = path.basename(htmlPath, '.html') + '.pdf';
        const pdfPath = path.join(REPORTS_DIR, pdfFilename);
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
        await browser.close();
        return { path: pdfPath, filename: pdfFilename };
    }
}

module.exports = Reporter;
