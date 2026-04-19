/**
 * NetworkAnalysis - Theo dõi requests: waterfall, slowest, failed, cache hit rate
 * Sử dụng Playwright page.on('response'/'requestfailed') events
 */

class NetworkAnalysis {
    constructor() {
        this._requests = [];
        this._failed = [];
        this._startTime = 0;
    }

    /**
     * Setup network listeners BEFORE navigation
     * @param {import('playwright').Page} page
     */
    setupListeners(page) {
        this._requests = [];
        this._failed = [];
        this._startTime = Date.now();

        page.on('response', async (response) => {
            try {
                const request = response.request();
                const timing = response.timing();
                const url = request.url();

                // Skip data URIs and blob URLs
                if (url.startsWith('data:') || url.startsWith('blob:')) return;

                const headers = await response.allHeaders().catch(() => ({}));
                const size = parseInt(headers['content-length'] || '0', 10);

                this._requests.push({
                    url: url.substring(0, 300),
                    method: request.method(),
                    status: response.status(),
                    type: request.resourceType(),
                    size,
                    startTime: timing?.startTime || 0,
                    responseEnd: timing?.responseEnd || 0,
                    duration: (timing?.responseEnd || 0) - (timing?.startTime || 0),
                    cached: response.status() === 304 || response.fromServiceWorker(),
                    contentType: headers['content-type'] || '',
                    contentEncoding: headers['content-encoding'] || '',
                    cacheControl: headers['cache-control'] || '',
                    timestamp: Date.now() - this._startTime,
                });
            } catch (_) {}
        });

        page.on('requestfailed', (request) => {
            try {
                const url = request.url();
                if (url.startsWith('data:') || url.startsWith('blob:')) return;

                this._failed.push({
                    url: url.substring(0, 300),
                    method: request.method(),
                    type: request.resourceType(),
                    error: request.failure()?.errorText || 'Unknown error',
                    timestamp: Date.now() - this._startTime,
                });
            } catch (_) {}
        });
    }

    /**
     * Collect network analysis results after page load
     * @returns {Object} Network analysis data
     */
    collect() {
        const requests = [...this._requests];
        const failed = [...this._failed];

        // Sort by timestamp for waterfall
        requests.sort((a, b) => a.timestamp - b.timestamp);

        // Find slowest requests
        const slowest = [...requests]
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 10)
            .map(r => ({
                url: r.url,
                duration: Math.round(r.duration),
                type: r.type,
                size: r.size,
                status: r.status,
            }));

        // Cache hit rate
        const cacheableRequests = requests.filter(r =>
            r.type !== 'document' && r.type !== 'websocket' && r.type !== 'fetch'
        );
        const cachedCount = cacheableRequests.filter(r => r.cached).length;
        const cacheHitRate = cacheableRequests.length > 0
            ? (cachedCount / cacheableRequests.length) * 100
            : 0;

        // Total transfer size
        const totalTransferSize = requests.reduce((sum, r) => sum + (r.size || 0), 0);

        // By type summary
        const byType = {};
        for (const r of requests) {
            if (!byType[r.type]) {
                byType[r.type] = { count: 0, size: 0, avgDuration: 0, totalDuration: 0 };
            }
            byType[r.type].count++;
            byType[r.type].size += r.size || 0;
            byType[r.type].totalDuration += r.duration || 0;
        }
        for (const type of Object.keys(byType)) {
            byType[type].avgDuration = Math.round(byType[type].totalDuration / byType[type].count);
        }

        // Waterfall data (simplified for display)
        const maxTimestamp = Math.max(...requests.map(r => r.timestamp + (r.duration || 0)), 1);
        const waterfall = requests.slice(0, 50).map(r => ({
            url: r.url,
            type: r.type,
            status: r.status,
            start: r.timestamp,
            duration: Math.round(r.duration || 0),
            size: r.size,
            startPercent: Math.round((r.timestamp / maxTimestamp) * 10000) / 100,
            widthPercent: Math.round(((r.duration || 1) / maxTimestamp) * 10000) / 100,
        }));

        return {
            totalRequests: requests.length,
            totalTransferSize,
            byType,
            slowest,
            failed,
            cacheHitRate: Math.round(cacheHitRate * 100) / 100,
            cachedCount,
            waterfall,
        };
    }

    /**
     * Reset state for next test
     */
    reset() {
        this._requests = [];
        this._failed = [];
        this._startTime = 0;
    }
}

module.exports = NetworkAnalysis;
