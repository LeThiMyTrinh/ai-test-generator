const path = require('path');
const fs = require('fs');

const EVIDENCE_BASE = path.join(__dirname, '../../../evidence');

class EvidenceManager {
    constructor(runId, tcId) {
        this.runId = runId;
        this.tcId = tcId;
        this.dir = path.join(EVIDENCE_BASE, runId, tcId);
        this.screenshots = [];
        if (!fs.existsSync(this.dir)) {
            fs.mkdirSync(this.dir, { recursive: true });
        }
    }

    async captureScreenshot(page, stepId, label = '') {
        const filename = `step-${String(stepId).padStart(3, '0')}${label ? '-' + label : ''}.png`;
        const filepath = path.join(this.dir, filename);
        await page.screenshot({ path: filepath, fullPage: false });
        this.screenshots.push(filepath);
        return filepath;
    }

    getVideoPath() {
        return path.join(this.dir, 'video.webm');
    }

    getRelativePath(absPath) {
        return absPath.replace(path.join(__dirname, '../../../'), '').replace(/\\/g, '/');
    }

    getAllScreenshots() {
        return this.screenshots.map(s => this.getRelativePath(s));
    }

    // Rename the playwright-generated video to our expected path
    async finalizeVideo(browserContext) {
        try {
            await browserContext.close();
        } catch (e) {
            // ignore
        }
    }
}

module.exports = EvidenceManager;
