/**
 * RuntimeMetrics - Thu thập JS heap, DOM stats, layout metrics via CDP
 * Sử dụng Chrome DevTools Protocol (Performance.getMetrics)
 */

class RuntimeMetrics {
    /**
     * Collect runtime performance metrics via CDP session
     * @param {import('playwright').Page} page
     * @returns {Promise<Object>} Runtime metrics
     */
    async collect(page) {
        let cdpSession = null;
        try {
            cdpSession = await page.context().newCDPSession(page);
            await cdpSession.send('Performance.enable');
            const { metrics } = await cdpSession.send('Performance.getMetrics');

            const metricsMap = {};
            for (const m of metrics) {
                metricsMap[m.name] = m.value;
            }

            // Also collect DOM stats via page.evaluate
            const domStats = await page.evaluate(() => {
                const allElements = document.querySelectorAll('*');
                const scripts = document.querySelectorAll('script');
                const styles = document.querySelectorAll('link[rel="stylesheet"], style');
                const images = document.querySelectorAll('img');
                const iframes = document.querySelectorAll('iframe');

                // Calculate max DOM depth
                let maxDepth = 0;
                function getDepth(el, depth) {
                    if (depth > maxDepth) maxDepth = depth;
                    for (const child of el.children) {
                        getDepth(child, depth + 1);
                    }
                }
                getDepth(document.documentElement, 0);

                return {
                    totalElements: allElements.length,
                    scriptCount: scripts.length,
                    styleCount: styles.length,
                    imageCount: images.length,
                    iframeCount: iframes.length,
                    maxDomDepth: maxDepth,
                };
            });

            return {
                // JS Heap
                jsHeapUsed: Math.round(metricsMap.JSHeapUsedSize || 0),
                jsHeapTotal: Math.round(metricsMap.JSHeapTotalSize || 0),
                heapUsagePercent: metricsMap.JSHeapTotalSize > 0
                    ? Math.round((metricsMap.JSHeapUsedSize / metricsMap.JSHeapTotalSize) * 10000) / 100
                    : 0,

                // DOM
                domNodeCount: Math.round(metricsMap.Nodes || domStats.totalElements),
                documents: Math.round(metricsMap.Documents || 1),
                frames: Math.round(metricsMap.Frames || 1),

                // Layout
                layoutCount: Math.round(metricsMap.LayoutCount || 0),
                layoutDuration: Math.round((metricsMap.LayoutDuration || 0) * 1000 * 100) / 100,
                recalcStyleCount: Math.round(metricsMap.RecalcStyleCount || 0),
                recalcStyleDuration: Math.round((metricsMap.RecalcStyleDuration || 0) * 1000 * 100) / 100,

                // Script
                scriptDuration: Math.round((metricsMap.ScriptDuration || 0) * 1000 * 100) / 100,
                taskDuration: Math.round((metricsMap.TaskDuration || 0) * 1000 * 100) / 100,

                // DOM stats
                ...domStats,
            };
        } catch (err) {
            console.warn('[RuntimeMetrics] CDP error:', err.message);
            // Fallback: collect what we can without CDP
            const domStats = await page.evaluate(() => {
                const allElements = document.querySelectorAll('*');
                return {
                    totalElements: allElements.length,
                    scriptCount: document.querySelectorAll('script').length,
                    styleCount: document.querySelectorAll('link[rel="stylesheet"], style').length,
                    imageCount: document.querySelectorAll('img').length,
                    iframeCount: document.querySelectorAll('iframe').length,
                    maxDomDepth: 0,
                };
            });

            return {
                jsHeapUsed: 0, jsHeapTotal: 0, heapUsagePercent: 0,
                domNodeCount: domStats.totalElements,
                documents: 1, frames: 1,
                layoutCount: 0, layoutDuration: 0,
                recalcStyleCount: 0, recalcStyleDuration: 0,
                scriptDuration: 0, taskDuration: 0,
                ...domStats,
                _cdpError: err.message,
            };
        } finally {
            if (cdpSession) {
                try { await cdpSession.detach(); } catch (_) {}
            }
        }
    }
}

module.exports = RuntimeMetrics;
