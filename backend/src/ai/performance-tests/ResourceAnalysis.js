/**
 * ResourceAnalysis - Phân tích resources: type, size, render-blocking, compression, third-party
 * Sử dụng Performance Resource Timing API + DOM scan
 */

class ResourceAnalysis {
    /**
     * Analyze all loaded resources
     * @param {import('playwright').Page} page
     * @param {string} pageUrl - The page URL for third-party detection
     * @returns {Promise<Object>} Resource analysis results
     */
    async collect(page, pageUrl) {
        const pageHost = new URL(pageUrl).hostname;

        const data = await page.evaluate((host) => {
            const entries = performance.getEntriesByType('resource');

            // Categorize resources
            const byType = {};
            const large = [];
            const uncompressed = [];
            const thirdPartyMap = {};
            let totalSize = 0;

            for (const entry of entries) {
                const type = entry.initiatorType || 'other';
                const size = entry.decodedBodySize || entry.transferSize || 0;
                const transferSize = entry.transferSize || 0;

                // By type aggregation
                if (!byType[type]) {
                    byType[type] = { count: 0, size: 0, transferSize: 0 };
                }
                byType[type].count++;
                byType[type].size += size;
                byType[type].transferSize += transferSize;
                totalSize += size;

                // Large resources (> 500KB)
                if (size > 500 * 1024) {
                    large.push({
                        url: entry.name.substring(0, 200),
                        type,
                        size,
                        transferSize,
                        duration: Math.round(entry.duration),
                    });
                }

                // Uncompressed detection (transfer ~= decoded means no gzip/brotli)
                if (transferSize > 1024 && size > 1024) {
                    const ratio = transferSize / size;
                    if (ratio > 0.9) {
                        uncompressed.push({
                            url: entry.name.substring(0, 200),
                            type,
                            size,
                            transferSize,
                            savingEstimate: Math.round(size * 0.6), // ~60% compression typical
                        });
                    }
                }

                // Third-party detection
                try {
                    const resourceHost = new URL(entry.name).hostname;
                    if (resourceHost !== host && !resourceHost.endsWith('.' + host)) {
                        if (!thirdPartyMap[resourceHost]) {
                            thirdPartyMap[resourceHost] = { count: 0, size: 0 };
                        }
                        thirdPartyMap[resourceHost].count++;
                        thirdPartyMap[resourceHost].size += size;
                    }
                } catch (_) {}
            }

            // Detect render-blocking resources from DOM
            const renderBlocking = [];

            // Scripts in <head> without async/defer
            document.querySelectorAll('head script[src]').forEach(s => {
                if (!s.async && !s.defer) {
                    renderBlocking.push({
                        url: s.src.substring(0, 200),
                        type: 'script',
                        fix: 'Thêm async hoặc defer attribute',
                    });
                }
            });

            // Stylesheets without media query
            document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
                const media = l.media;
                if (!media || media === 'all' || media === '') {
                    renderBlocking.push({
                        url: l.href.substring(0, 200),
                        type: 'stylesheet',
                        fix: 'Thêm media query hoặc inline critical CSS',
                    });
                }
            });

            // Third-party summary
            const thirdPartyDomains = Object.entries(thirdPartyMap)
                .map(([domain, data]) => ({ domain, ...data }))
                .sort((a, b) => b.size - a.size);

            const thirdPartyTotal = thirdPartyDomains.reduce((sum, d) => sum + d.size, 0);
            const thirdPartyCount = thirdPartyDomains.reduce((sum, d) => sum + d.count, 0);

            return {
                totalCount: entries.length,
                totalSize,
                byType,
                renderBlocking,
                large: large.sort((a, b) => b.size - a.size),
                uncompressed: uncompressed.slice(0, 20),
                thirdParty: {
                    count: thirdPartyCount,
                    size: thirdPartyTotal,
                    domains: thirdPartyDomains.slice(0, 15),
                },
            };
        }, pageHost);

        return data;
    }
}

module.exports = ResourceAnalysis;
