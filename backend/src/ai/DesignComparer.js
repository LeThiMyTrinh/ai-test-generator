/**
 * DesignComparer - Compare design image (upload/Figma) vs live webpage
 * Uses pixelmatch + sharp + looks-same for ZERO API dependency
 *
 * Two modes:
 * - Mode A: Upload design image (PNG/JPG) + URL
 * - Mode B: Figma URL + Node ID + URL (requires Figma token)
 */

const { chromium } = require('playwright');
const sharp = require('sharp');
const { PNG } = require('pngjs');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;

class DesignComparer {
    /**
     * Compare uploaded design image with live webpage screenshot
     * @param {Buffer} designImageBuffer - Design image as Buffer
     * @param {string} url - URL to screenshot
     * @param {object} opts - { viewport, threshold, ignoreRegions }
     */
    async compareWithUpload(designImageBuffer, url, opts = {}) {
        const viewport = opts.viewport || { width: 1920, height: 1080 };
        const threshold = opts.threshold || 0.15;
        const startTime = Date.now();

        // 1. Take screenshot of live page
        const browser = await chromium.launch({ headless: true });
        let pageScreenshot;
        let pageTitle = '';
        try {
            const context = await browser.newContext({ viewport });
            const page = await context.newPage();
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(1500);
            pageTitle = await page.title();
            pageScreenshot = await page.screenshot({ fullPage: false, type: 'png' });
            await context.close();
        } finally {
            await browser.close();
        }

        // 2. Normalize both images to same dimensions
        const designMeta = await sharp(designImageBuffer).metadata();
        const pageMeta = await sharp(pageScreenshot).metadata();

        // Use design image dimensions as reference
        const targetWidth = designMeta.width;
        const targetHeight = designMeta.height;

        const normalizedDesign = await sharp(designImageBuffer)
            .resize(targetWidth, targetHeight, { fit: 'fill' })
            .removeAlpha()
            .raw()
            .toBuffer();

        const normalizedPage = await sharp(pageScreenshot)
            .resize(targetWidth, targetHeight, { fit: 'fill' })
            .removeAlpha()
            .raw()
            .toBuffer();

        // 3. Convert to RGBA for pixelmatch
        const designRGBA = this._rgbToRgba(normalizedDesign, targetWidth, targetHeight);
        const pageRGBA = this._rgbToRgba(normalizedPage, targetWidth, targetHeight);

        // 4. Run pixelmatch
        const diffBuffer = new Uint8Array(targetWidth * targetHeight * 4);
        const diffPixels = pixelmatch(
            designRGBA, pageRGBA, diffBuffer,
            targetWidth, targetHeight,
            {
                threshold,
                includeAA: false,
                alpha: 0.3,
                diffColor: [255, 0, 0],
                diffColorAlt: [0, 255, 0],
            }
        );

        const totalPixels = targetWidth * targetHeight;
        const matchPercent = Math.round((1 - diffPixels / totalPixels) * 1000) / 10;

        // 5. Generate diff image as PNG base64
        const diffPNG = new PNG({ width: targetWidth, height: targetHeight });
        diffPNG.data = Buffer.from(diffBuffer);
        const diffImageBuffer = PNG.sync.write(diffPNG);
        const diffBase64 = 'data:image/png;base64,' + diffImageBuffer.toString('base64');

        // 6. Detect diff regions (clustering)
        const regions = this._clusterDiffRegions(diffBuffer, targetWidth, targetHeight);

        // 7. Analyze diff regions to categorize issues
        const issues = this._analyzeDiffRegions(regions, targetWidth, targetHeight);

        // 8. Color palette comparison
        const colorAnalysis = await this._compareColorPalettes(designImageBuffer, pageScreenshot);

        // 9. Create result screenshots as base64
        const designBase64 = 'data:image/png;base64,' + (await sharp(designImageBuffer)
            .resize(targetWidth, targetHeight, { fit: 'fill' })
            .png().toBuffer()).toString('base64');
        const pageBase64 = 'data:image/png;base64,' + (await sharp(pageScreenshot)
            .resize(targetWidth, targetHeight, { fit: 'fill' })
            .png().toBuffer()).toString('base64');

        return {
            matchPercent,
            diffPixels,
            totalPixels,
            dimensions: { width: targetWidth, height: targetHeight },
            designDimensions: { width: designMeta.width, height: designMeta.height },
            pageDimensions: { width: pageMeta.width, height: pageMeta.height },
            screenshots: {
                design: designBase64,
                page: pageBase64,
                diff: diffBase64,
            },
            regions,
            issues,
            colorAnalysis,
            pageTitle,
            duration_ms: Date.now() - startTime,
            summary: this._generateSummary(matchPercent, regions, issues, colorAnalysis),
        };
    }

    /**
     * Compare using Figma API
     * @param {string} figmaFileKey - Figma file key
     * @param {string} figmaNodeId - Figma node ID
     * @param {string} figmaToken - Personal access token
     * @param {string} url - URL to compare
     * @param {object} opts - options
     */
    async compareWithFigma(figmaFileKey, figmaNodeId, figmaToken, url, opts = {}) {
        // 1. Export Figma frame as PNG
        const figmaImageBuffer = await this._exportFigmaFrame(figmaFileKey, figmaNodeId, figmaToken, opts.scale || 2);

        // 2. Use the upload comparison flow
        return await this.compareWithUpload(figmaImageBuffer, url, opts);
    }

    /**
     * Export a Figma frame as PNG
     */
    async _exportFigmaFrame(fileKey, nodeId, token, scale = 2) {
        // Dynamic import for fetch (Node 18+ has native fetch)
        const encodedNodeId = encodeURIComponent(nodeId);
        const apiUrl = `https://api.figma.com/v1/images/${fileKey}?ids=${encodedNodeId}&scale=${scale}&format=png`;

        const response = await fetch(apiUrl, {
            headers: { 'X-Figma-Token': token }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Figma API error (${response.status}): ${text}`);
        }

        const data = await response.json();

        if (data.err) {
            throw new Error(`Figma API error: ${data.err}`);
        }

        // Get image URL from response
        const imageUrl = data.images[nodeId] || data.images[nodeId.replace('-', ':')];
        if (!imageUrl) {
            throw new Error('Figma API returned no image URL for the given node ID');
        }

        // Download the image
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) {
            throw new Error(`Failed to download Figma image: ${imgResponse.status}`);
        }

        const arrayBuffer = await imgResponse.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * Convert RGB buffer to RGBA Uint8Array
     */
    _rgbToRgba(rgbBuffer, width, height) {
        const rgba = new Uint8Array(width * height * 4);
        for (let i = 0; i < width * height; i++) {
            rgba[i * 4] = rgbBuffer[i * 3];
            rgba[i * 4 + 1] = rgbBuffer[i * 3 + 1];
            rgba[i * 4 + 2] = rgbBuffer[i * 3 + 2];
            rgba[i * 4 + 3] = 255;
        }
        return rgba;
    }

    /**
     * Cluster diff pixels into bounding box regions
     */
    _clusterDiffRegions(diffBuffer, width, height) {
        // Create a grid (divide image into cells)
        const cellSize = 40; // 40px grid cells
        const cols = Math.ceil(width / cellSize);
        const rows = Math.ceil(height / cellSize);
        const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

        // Count diff pixels per cell
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                // Check if pixel is red (diff marker)
                if (diffBuffer[idx] > 200 && diffBuffer[idx + 1] < 100 && diffBuffer[idx + 2] < 100) {
                    const col = Math.floor(x / cellSize);
                    const row = Math.floor(y / cellSize);
                    if (row < rows && col < cols) {
                        grid[row][col]++;
                    }
                }
            }
        }

        // Find connected regions of cells with significant diffs
        const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
        const regions = [];
        const minDiffPixels = cellSize * cellSize * 0.05; // 5% of cell must be different

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c] > minDiffPixels && !visited[r][c]) {
                    // BFS to find connected region
                    const region = { minRow: r, maxRow: r, minCol: c, maxCol: c, totalDiff: 0 };
                    const queue = [[r, c]];
                    visited[r][c] = true;

                    while (queue.length > 0) {
                        const [cr, cc] = queue.shift();
                        region.minRow = Math.min(region.minRow, cr);
                        region.maxRow = Math.max(region.maxRow, cr);
                        region.minCol = Math.min(region.minCol, cc);
                        region.maxCol = Math.max(region.maxCol, cc);
                        region.totalDiff += grid[cr][cc];

                        // Check 4-neighbors
                        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                            const nr = cr + dr;
                            const nc = cc + dc;
                            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc] && grid[nr][nc] > minDiffPixels) {
                                visited[nr][nc] = true;
                                queue.push([nr, nc]);
                            }
                        }
                    }

                    // Convert to pixel coordinates
                    regions.push({
                        x: region.minCol * cellSize,
                        y: region.minRow * cellSize,
                        width: (region.maxCol - region.minCol + 1) * cellSize,
                        height: (region.maxRow - region.minRow + 1) * cellSize,
                        diffPixels: region.totalDiff,
                        diffPercent: Math.round(region.totalDiff / ((region.maxCol - region.minCol + 1) * (region.maxRow - region.minRow + 1) * cellSize * cellSize) * 100),
                    });
                }
            }
        }

        // Sort by area (largest first) and limit to 20
        return regions
            .sort((a, b) => (b.width * b.height) - (a.width * a.height))
            .slice(0, 20);
    }

    /**
     * Analyze diff regions and categorize issues
     */
    _analyzeDiffRegions(regions, totalWidth, totalHeight) {
        const issues = [];

        for (let i = 0; i < regions.length; i++) {
            const r = regions[i];
            const area = r.width * r.height;
            const areaPercent = Math.round(area / (totalWidth * totalHeight) * 100);
            const location = this._getRegionLocation(r, totalWidth, totalHeight);

            let severity = 'LOW';
            if (r.diffPercent > 50 && areaPercent > 5) severity = 'CRITICAL';
            else if (r.diffPercent > 30 || areaPercent > 3) severity = 'HIGH';
            else if (r.diffPercent > 15 || areaPercent > 1) severity = 'MEDIUM';

            issues.push({
                type: 'DESIGN_MISMATCH',
                severity,
                description: `Vùng "${location}" khác biệt ${r.diffPercent}% so với design (${r.width}×${r.height}px)`,
                viewport: 'desktop',
                selector: '',
                details: `Vị trí: x=${r.x}, y=${r.y} | Kích thước: ${r.width}×${r.height}px | Chiếm ${areaPercent}% trang`,
                position: { x: r.x, y: r.y, width: r.width, height: r.height },
                region: r,
            });
        }

        return issues;
    }

    /**
     * Get human-readable location name for a region
     */
    _getRegionLocation(region, totalWidth, totalHeight) {
        const centerY = region.y + region.height / 2;
        const centerX = region.x + region.width / 2;

        let vertical = '';
        if (centerY < totalHeight * 0.15) vertical = 'Header';
        else if (centerY < totalHeight * 0.4) vertical = 'Phần trên';
        else if (centerY < totalHeight * 0.7) vertical = 'Phần giữa';
        else if (centerY < totalHeight * 0.9) vertical = 'Phần dưới';
        else vertical = 'Footer';

        let horizontal = '';
        if (centerX < totalWidth * 0.3) horizontal = 'bên trái';
        else if (centerX < totalWidth * 0.7) horizontal = 'giữa';
        else horizontal = 'bên phải';

        return `${vertical} - ${horizontal}`;
    }

    /**
     * Compare color palettes between design and page
     */
    async _compareColorPalettes(designBuffer, pageBuffer) {
        try {
            // Extract dominant colors using sharp (get pixel samples)
            const designColors = await this._extractDominantColors(designBuffer);
            const pageColors = await this._extractDominantColors(pageBuffer);

            // Find color differences
            const mismatches = [];
            for (const dc of designColors) {
                let closestDist = Infinity;
                let closestColor = null;
                for (const pc of pageColors) {
                    const dist = this._colorDistance(dc, pc);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestColor = pc;
                    }
                }
                if (closestDist > 30) { // Significant color difference
                    mismatches.push({
                        designColor: this._rgbToHex(dc),
                        pageColor: closestColor ? this._rgbToHex(closestColor) : 'N/A',
                        distance: Math.round(closestDist),
                    });
                }
            }

            return {
                designColors: designColors.map(c => this._rgbToHex(c)),
                pageColors: pageColors.map(c => this._rgbToHex(c)),
                mismatches,
                paletteMatch: mismatches.length === 0,
            };
        } catch (e) {
            console.warn('[DesignComparer] Color palette analysis error:', e.message);
            return { designColors: [], pageColors: [], mismatches: [], paletteMatch: true };
        }
    }

    /**
     * Extract dominant colors by sampling and clustering
     */
    async _extractDominantColors(imageBuffer) {
        // Resize to small image for fast processing
        const { data, info } = await sharp(imageBuffer)
            .resize(50, 50, { fit: 'fill' })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Simple k-means-like clustering
        const pixels = [];
        for (let i = 0; i < data.length; i += 3) {
            pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        }

        // Simple quantization: group into color buckets
        const buckets = {};
        for (const p of pixels) {
            const key = `${Math.round(p.r / 32) * 32}-${Math.round(p.g / 32) * 32}-${Math.round(p.b / 32) * 32}`;
            if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, count: 0 };
            buckets[key].r += p.r;
            buckets[key].g += p.g;
            buckets[key].b += p.b;
            buckets[key].count++;
        }

        // Get top colors by frequency
        return Object.values(buckets)
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
            .map(b => ({
                r: Math.round(b.r / b.count),
                g: Math.round(b.g / b.count),
                b: Math.round(b.b / b.count),
            }));
    }

    /**
     * Euclidean color distance
     */
    _colorDistance(c1, c2) {
        return Math.sqrt(
            Math.pow(c1.r - c2.r, 2) +
            Math.pow(c1.g - c2.g, 2) +
            Math.pow(c1.b - c2.b, 2)
        );
    }

    /**
     * RGB to HEX
     */
    _rgbToHex(color) {
        return '#' + [color.r, color.g, color.b].map(c => c.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate comparison summary
     */
    _generateSummary(matchPercent, regions, issues, colorAnalysis) {
        let grade = 'A';
        if (matchPercent < 70) grade = 'F';
        else if (matchPercent < 80) grade = 'D';
        else if (matchPercent < 85) grade = 'C';
        else if (matchPercent < 90) grade = 'B';
        else if (matchPercent < 95) grade = 'A';
        else grade = 'A+';

        const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
        const highCount = issues.filter(i => i.severity === 'HIGH').length;

        return {
            grade,
            matchPercent,
            totalRegions: regions.length,
            criticalMismatches: criticalCount,
            highMismatches: highCount,
            colorPaletteMatch: colorAnalysis.paletteMatch,
            colorMismatches: colorAnalysis.mismatches.length,
            verdict: matchPercent >= 90
                ? 'UI implementation khớp tốt với design'
                : matchPercent >= 80
                    ? 'UI implementation gần khớp design, có một số khác biệt cần review'
                    : matchPercent >= 70
                        ? 'UI implementation có nhiều khác biệt so với design, cần chỉnh sửa'
                        : 'UI implementation lệch nhiều so với design, cần làm lại',
        };
    }
}

module.exports = DesignComparer;
