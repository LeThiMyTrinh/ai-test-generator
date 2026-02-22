const XLSX = require('xlsx');
const NLStepParser = require('../parser/NLStepParser');

/**
 * ExcelImporter - reads test cases from Excel file
 * 
 * NL mode (mặc định): cột buoc_thuc_hien chứa ngôn ngữ tự nhiên → auto convert
 * Legacy mode: cột action/selector/value/expected (tương thích ngược)
 */
class ExcelImporter {
    constructor() {
        this.parser = new NLStepParser();
    }

    parse(filePath) {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) {
            throw new Error('File Excel trống hoặc không có dữ liệu hợp lệ');
        }

        const headers = Object.keys(rows[0]).map(h => h.trim().toLowerCase());

        // Detect mode: NL (buoc_thuc_hien) or Legacy (action)
        const isNLMode = headers.includes('buoc_thuc_hien');
        const isLegacyMode = headers.includes('action');

        if (!isNLMode && !isLegacyMode) {
            throw new Error('File không hợp lệ. Cần có cột "buoc_thuc_hien" (ngôn ngữ tự nhiên) hoặc cột "action" (kỹ thuật). Vui lòng tải file mẫu.');
        }

        // Validate tc_id column
        const tcIdCol = headers.find(h => h === 'tc_id');
        if (!tcIdCol) {
            throw new Error('Thiếu cột bắt buộc: "tc_id"');
        }

        return isNLMode ? this.parseNLMode(rows) : this.parseLegacyMode(rows);
    }

    /**
     * NL Mode: cột buoc_thuc_hien → NLStepParser chuyển đổi
     */
    parseNLMode(rows) {
        const tcMap = new Map();
        const allWarnings = [];

        for (const row of rows) {
            const tcId = this.str(row.tc_id || row.TC_ID);
            if (!tcId) continue;

            if (!tcMap.has(tcId)) {
                tcMap.set(tcId, {
                    excel_id: tcId,
                    title: this.str(row.tieu_de || row.title || 'Không có tiêu đề'),
                    url: this.str(row.url || row.URL || ''),
                    browser: (this.str(row.trinh_duyet || row.browser || 'chromium')).toLowerCase() || 'chromium',
                    description: '',
                    nlLines: []
                });
            }

            const tc = tcMap.get(tcId);
            // Fill title/url from first row (subsequent rows may be empty)
            if (!tc.title || tc.title === 'Không có tiêu đề') {
                const t = this.str(row.tieu_de || row.title);
                if (t) tc.title = t;
            }
            if (!tc.url) {
                const u = this.str(row.url || row.URL);
                if (u) tc.url = u;
            }

            const step = this.str(row.buoc_thuc_hien);
            if (step) {
                tc.nlLines.push(step);
            }
        }

        // Convert NL lines to steps using parser
        const results = [];
        for (const [tcId, tc] of tcMap) {
            if (tc.nlLines.length === 0) continue;

            const nlText = tc.nlLines.join('\n');
            const { steps, warnings } = this.parser.parse(nlText);

            if (warnings.length > 0) {
                allWarnings.push({
                    tc_id: tcId,
                    title: tc.title,
                    warnings
                });
            }

            results.push({
                excel_id: tc.excel_id,
                title: tc.title,
                url: tc.url,
                browser: tc.browser,
                description: tc.description,
                steps
            });
        }

        // Attach warnings to result for API to return
        results._warnings = allWarnings;
        return results;
    }

    /**
     * Legacy Mode: cột action/selector/value/expected (tương thích ngược)
     */
    parseLegacyMode(rows) {
        const tcMap = new Map();

        for (const row of rows) {
            const tcId = this.str(row.tc_id);
            if (!tcId) continue;

            if (!tcMap.has(tcId)) {
                tcMap.set(tcId, {
                    excel_id: tcId,
                    title: this.str(row.title || 'Không có tiêu đề'),
                    url: this.str(row.url || ''),
                    browser: (this.str(row.browser || 'chromium')).toLowerCase() || 'chromium',
                    description: this.str(row.description_tc || ''),
                    steps: []
                });
            }

            const tc = tcMap.get(tcId);
            const step = {
                step_id: parseInt(row.step_id) || tc.steps.length + 1,
                action: this.str(row.action).toLowerCase(),
                selector: this.str(row.selector),
                value: this.str(row.value),
                expected: this.str(row.expected),
                description: this.str(row.description)
            };

            if (step.action) {
                tc.steps.push(step);
            }
        }

        return Array.from(tcMap.values());
    }

    str(val) {
        return String(val || '').trim();
    }
}

module.exports = ExcelImporter;
