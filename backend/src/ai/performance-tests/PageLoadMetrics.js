/**
 * PageLoadMetrics - Thu thập Navigation Timing API metrics
 * Đo: TTFB, DOM Content Loaded, Load Event, DOM Interactive, DNS, Connect, Redirect
 */

class PageLoadMetrics {
    /**
     * Collect page load timing metrics
     * @param {import('playwright').Page} page - Playwright page (already navigated)
     * @returns {Promise<Object>} Page load metrics
     */
    async collect(page) {
        const timing = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            if (!nav) return null;

            return {
                // Connection phase
                redirectTime: nav.redirectEnd - nav.redirectStart,
                dnsTime: nav.domainLookupEnd - nav.domainLookupStart,
                connectTime: nav.connectEnd - nav.connectStart,
                tlsTime: nav.secureConnectionStart > 0
                    ? nav.connectEnd - nav.secureConnectionStart
                    : 0,

                // Server response
                ttfb: nav.responseStart - nav.requestStart,
                responseTime: nav.responseEnd - nav.responseStart,

                // Document processing
                domInteractive: nav.domInteractive - nav.startTime,
                domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
                loadEvent: nav.loadEventEnd - nav.startTime,

                // DOM parsing
                domParsing: nav.domInteractive - nav.responseEnd,

                // Total
                totalTime: nav.loadEventEnd - nav.startTime,

                // Transfer
                transferSize: nav.transferSize || 0,
                encodedBodySize: nav.encodedBodySize || 0,
                decodedBodySize: nav.decodedBodySize || 0,

                // Protocol
                protocol: nav.nextHopProtocol || 'unknown',
                redirectCount: nav.redirectCount || 0,
            };
        });

        if (!timing) {
            return {
                ttfb: 0, dnsTime: 0, connectTime: 0, tlsTime: 0,
                redirectTime: 0, responseTime: 0,
                domInteractive: 0, domContentLoaded: 0, loadEvent: 0,
                domParsing: 0, totalTime: 0,
                transferSize: 0, encodedBodySize: 0, decodedBodySize: 0,
                protocol: 'unknown', redirectCount: 0,
            };
        }

        // Round all numeric values
        for (const key of Object.keys(timing)) {
            if (typeof timing[key] === 'number') {
                timing[key] = Math.round(timing[key] * 100) / 100;
            }
        }

        return timing;
    }
}

module.exports = PageLoadMetrics;
