/**
 * CoreWebVitals - Đo LCP, FCP, CLS, TBT bằng PerformanceObserver
 * Inject script TRƯỚC navigation via page.evaluateOnNewDocument()
 */

class CoreWebVitals {
    /**
     * Script to inject before navigation to observe Web Vitals
     * Stored on window.__perfMetrics
     */
    getObserverScript() {
        return `
            window.__perfMetrics = {
                lcp: 0,
                fcp: 0,
                cls: 0,
                tbt: 0,
                longTasks: [],
                lcpElement: '',
                fcpTime: 0,
                clsEntries: [],
            };

            // LCP Observer
            try {
                new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const last = entries[entries.length - 1];
                    if (last) {
                        window.__perfMetrics.lcp = last.startTime;
                        window.__perfMetrics.lcpElement = last.element
                            ? last.element.tagName + (last.element.id ? '#' + last.element.id : '')
                              + (last.element.className ? '.' + String(last.element.className).split(' ')[0] : '')
                            : last.url || 'unknown';
                    }
                }).observe({ type: 'largest-contentful-paint', buffered: true });
            } catch(e) {}

            // FCP Observer
            try {
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.name === 'first-contentful-paint') {
                            window.__perfMetrics.fcp = entry.startTime;
                            window.__perfMetrics.fcpTime = entry.startTime;
                        }
                    }
                }).observe({ type: 'paint', buffered: true });
            } catch(e) {}

            // CLS Observer (session window approach)
            try {
                let clsSessionValue = 0;
                let clsSessionEntries = [];
                let clsMaxSessionValue = 0;
                let clsLastEntryTime = 0;

                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            // New session window if gap > 1s or session > 5s
                            if (entry.startTime - clsLastEntryTime > 1000 ||
                                (clsSessionEntries.length > 0 &&
                                 entry.startTime - clsSessionEntries[0].startTime > 5000)) {
                                // Start new session
                                clsSessionValue = 0;
                                clsSessionEntries = [];
                            }
                            clsSessionEntries.push(entry);
                            clsSessionValue += entry.value;
                            clsLastEntryTime = entry.startTime;

                            if (clsSessionValue > clsMaxSessionValue) {
                                clsMaxSessionValue = clsSessionValue;
                            }
                            window.__perfMetrics.cls = clsMaxSessionValue;
                            window.__perfMetrics.clsEntries.push({
                                value: entry.value,
                                time: entry.startTime,
                                sources: (entry.sources || []).map(s => ({
                                    node: s.node ? s.node.tagName : 'unknown',
                                })),
                            });
                        }
                    }
                }).observe({ type: 'layout-shift', buffered: true });
            } catch(e) {}

            // Long Tasks Observer (for TBT calculation)
            try {
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        const blockingTime = entry.duration - 50;
                        if (blockingTime > 0) {
                            window.__perfMetrics.tbt += blockingTime;
                            window.__perfMetrics.longTasks.push({
                                startTime: entry.startTime,
                                duration: entry.duration,
                                blockingTime: blockingTime,
                            });
                        }
                    }
                }).observe({ type: 'longtask', buffered: true });
            } catch(e) {}
        `;
    }

    /**
     * Inject observer scripts before navigation
     * Must be called BEFORE page.goto()
     * @param {import('playwright').Page} page
     */
    async injectObservers(page) {
        await page.addInitScript(this.getObserverScript());
    }

    /**
     * Collect Web Vitals metrics after page load
     * Must be called AFTER page.goto() and wait for stabilization
     * @param {import('playwright').Page} page
     * @returns {Promise<Object>} Core Web Vitals metrics
     */
    async collect(page) {
        const metrics = await page.evaluate(() => {
            return window.__perfMetrics || null;
        });

        if (!metrics) {
            return {
                lcp: 0, fcp: 0, cls: 0, tbt: 0,
                lcpElement: 'unknown',
                longTasks: [],
                clsEntries: [],
            };
        }

        return {
            lcp: Math.round(metrics.lcp * 100) / 100,
            fcp: Math.round(metrics.fcp * 100) / 100,
            cls: Math.round(metrics.cls * 10000) / 10000,
            tbt: Math.round(metrics.tbt * 100) / 100,
            lcpElement: metrics.lcpElement || 'unknown',
            longTasks: (metrics.longTasks || []).slice(0, 20), // Keep top 20
            clsEntries: (metrics.clsEntries || []).slice(0, 20),
        };
    }
}

module.exports = CoreWebVitals;
