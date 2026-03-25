/**
 * Group 13: Loading & Error State Tests (5 cases)
 * 13.1 Skeleton/placeholder loading
 * 13.2 Network error handling (offline simulation)
 * 13.3 404 page check
 * 13.4 Empty state display
 * 13.5 Timeout/slow response behavior
 */

const { createTestResult, runSafe, takeScreenshot, navigateBack } = require('./testHelpers');

class LoadingErrorStateTests {
    /**
     * Run all loading & error state tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testSkeletonLoading(page, baseUrl));
        results.push(await this._testNetworkError(page, baseUrl));
        results.push(await this._test404Page(page, baseUrl));
        results.push(await this._testEmptyState(page));
        results.push(await this._testSlowResponse(page, baseUrl));

        return results;
    }

    /**
     * 13.1: Skeleton/placeholder loading — check for loading indicators during page load
     */
    async _testSkeletonLoading(page, baseUrl) {
        const test = createTestResult('loading_error', '13.1', 'Skeleton/placeholder loading');
        return runSafe(test, async (t) => {
            // Check if page has any skeleton/loading patterns in the markup
            const loadingPatterns = await page.evaluate(() => {
                const patterns = {
                    skeletons: 0,
                    spinners: 0,
                    placeholders: 0,
                    progressBars: 0,
                    lazyContainers: 0,
                };

                const skeletonSels = '.skeleton, .placeholder, [class*="skeleton"], [class*="placeholder"], [class*="shimmer"], .loading-placeholder';
                document.querySelectorAll(skeletonSels).forEach(() => patterns.skeletons++);

                const spinnerSels = '.spinner, .loader, .loading, .spinner-border, .spinner-grow, [class*="spinner"], [class*="loader"]';
                document.querySelectorAll(spinnerSels).forEach(() => patterns.spinners++);

                document.querySelectorAll('[role="progressbar"], progress').forEach(() => patterns.progressBars++);

                document.querySelectorAll('[data-src], [data-lazy], .lazy, .lazyload').forEach(() => patterns.lazyContainers++);

                // Check CSS animations that look like loading
                const allElements = document.querySelectorAll('*');
                let animatedLoading = 0;
                allElements.forEach(el => {
                    const anim = getComputedStyle(el).animationName;
                    if (anim && anim !== 'none' && (anim.includes('pulse') || anim.includes('shimmer') || anim.includes('loading') || anim.includes('skeleton'))) {
                        animatedLoading++;
                    }
                });
                patterns.animatedLoading = animatedLoading;

                return patterns;
            });

            const total = Object.values(loadingPatterns).reduce((a, b) => a + b, 0);

            if (total > 0) {
                const details = [];
                if (loadingPatterns.skeletons > 0) details.push(`${loadingPatterns.skeletons} skeleton elements`);
                if (loadingPatterns.spinners > 0) details.push(`${loadingPatterns.spinners} spinners`);
                if (loadingPatterns.progressBars > 0) details.push(`${loadingPatterns.progressBars} progress bars`);
                if (loadingPatterns.lazyContainers > 0) details.push(`${loadingPatterns.lazyContainers} lazy containers`);
                if (loadingPatterns.animatedLoading > 0) details.push(`${loadingPatterns.animatedLoading} loading animations`);

                t.status = 'passed';
                t.details = `Loading patterns tìm thấy: ${details.join(', ')} ✓`;
            } else {
                t.status = 'passed';
                t.details = 'Page loaded hoàn toàn — không có skeleton/placeholder visible (normal for static pages)';
            }
        });
    }

    /**
     * 13.2: Network error handling — simulate offline and check behavior
     */
    async _testNetworkError(page, baseUrl) {
        const test = createTestResult('loading_error', '13.2', 'Network error handling');
        return runSafe(test, async (t) => {
            // Save current URL
            const currentUrl = page.url();

            // Simulate offline
            await page.context().setOffline(true);
            await page.waitForTimeout(300);

            // Try to navigate or trigger an API call
            let offlineHandled = false;
            let errorMessage = '';

            try {
                // Try a fetch request
                const result = await page.evaluate(async () => {
                    try {
                        const resp = await fetch(window.location.href, { signal: AbortSignal.timeout(3000) });
                        return { ok: resp.ok, status: resp.status };
                    } catch (err) {
                        return { error: err.message };
                    }
                });

                if (result.error) {
                    offlineHandled = true;
                    errorMessage = result.error;
                }
            } catch {
                offlineHandled = true;
            }

            // Check if there's an offline/error indicator
            const hasOfflineUI = await page.evaluate(() => {
                const body = document.body.innerText.toLowerCase();
                return body.includes('offline') || body.includes('no connection') ||
                    body.includes('không có kết nối') || body.includes('network error') ||
                    body.includes('internet') || body.includes('mất kết nối');
            }).catch(() => false);

            // Restore online
            await page.context().setOffline(false);
            await page.waitForTimeout(500);

            // Try to recover
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);

            const pageRecovered = await page.evaluate(() => !!document.body).catch(() => false);

            if (hasOfflineUI) {
                t.status = 'passed';
                t.details = 'Offline mode → page hiển thị offline indicator ✓. Page recovered sau khi online.';
            } else if (pageRecovered) {
                t.status = 'passed';
                t.details = `Network error handled gracefully. ${offlineHandled ? 'Fetch failed as expected.' : ''} Page recovered sau online ✓`;
            } else {
                t.status = 'warning';
                t.details = 'Page không recover sau network error — cần reload. Nên handle offline state.';
            }
        });
    }

    /**
     * 13.3: 404 page — navigate to invalid URL, check for custom 404 page
     */
    async _test404Page(page, baseUrl) {
        const test = createTestResult('loading_error', '13.3', '404 page check');
        return runSafe(test, async (t) => {
            // Build a clearly invalid URL
            const url = new URL(baseUrl);
            const notFoundUrl = `${url.origin}/this-page-definitely-does-not-exist-${Date.now()}`;

            let response;
            try {
                response = await page.goto(notFoundUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            } catch {
                // Navigation might fail entirely
            }

            await page.waitForTimeout(800);

            const status = response ? response.status() : 0;

            const pageContent = await page.evaluate(() => {
                const body = document.body;
                if (!body) return { hasContent: false };

                const text = body.innerText.trim();
                const has404Text = text.includes('404') || text.toLowerCase().includes('not found') ||
                    text.toLowerCase().includes('không tìm thấy') || text.toLowerCase().includes('page not found');
                const hasCustomContent = text.length > 100; // More than just a status code
                const hasHomeLink = !!document.querySelector('a[href="/"], a[href*="home"], a[href*="trang-chu"]');
                const hasSearchBox = !!document.querySelector('input[type="search"], .search');

                return {
                    hasContent: true,
                    has404Text,
                    hasCustomContent,
                    hasHomeLink,
                    hasSearchBox,
                    textPreview: text.substring(0, 150),
                };
            }).catch(() => ({ hasContent: false }));

            if (status === 404 && pageContent.hasCustomContent) {
                const features = [];
                if (pageContent.has404Text) features.push('404 message');
                if (pageContent.hasHomeLink) features.push('home link');
                if (pageContent.hasSearchBox) features.push('search box');

                t.status = 'passed';
                t.details = `Custom 404 page: HTTP ${status}. Features: ${features.join(', ')} ✓`;
            } else if (status === 404) {
                t.status = 'warning';
                t.details = `HTTP 404 nhưng page content đơn giản. Nên có custom 404 page với navigation.`;
            } else if (status === 200 && pageContent.has404Text) {
                t.status = 'warning';
                t.details = 'Page trả HTTP 200 cho URL không tồn tại (soft 404). Nên trả status 404.';
            } else if (status === 200) {
                t.status = 'warning';
                t.details = `URL không tồn tại trả HTTP 200 — có thể SPA catch-all. Content: "${pageContent.textPreview?.substring(0, 60)}"`;
            } else {
                t.status = 'passed';
                t.details = `HTTP ${status} cho invalid URL. Page xử lý error.`;
            }

            t.screenshot = await takeScreenshot(page);
            await navigateBack(page, baseUrl);
        });
    }

    /**
     * 13.4: Empty state — lists/tables with no data should show empty message
     */
    async _testEmptyState(page) {
        const test = createTestResult('loading_error', '13.4', 'Empty state display');
        return runSafe(test, async (t) => {
            const emptyStateCheck = await page.evaluate(() => {
                const results = {
                    lists: 0,
                    emptyLists: 0,
                    tables: 0,
                    emptyTables: 0,
                    hasEmptyStateUI: false,
                    emptyStateTexts: [],
                };

                // Check lists
                document.querySelectorAll('ul, ol, .list, [class*="list"]').forEach(list => {
                    const items = list.querySelectorAll('li, .item, .list-item, [class*="item"]');
                    const rect = list.getBoundingClientRect();
                    if (rect.width === 0) return;
                    results.lists++;
                    if (items.length === 0) results.emptyLists++;
                });

                // Check tables
                document.querySelectorAll('table, .table').forEach(table => {
                    const rows = table.querySelectorAll('tbody tr, tr');
                    const rect = table.getBoundingClientRect();
                    if (rect.width === 0) return;
                    results.tables++;
                    if (rows.length <= 1) results.emptyTables++; // 1 = header only
                });

                // Check for empty state UI patterns
                const emptySelectors = [
                    '.empty-state', '.no-data', '.no-results', '.empty',
                    '[class*="empty-state"]', '[class*="no-data"]', '[class*="no-result"]',
                    '.placeholder-message', '.blank-state',
                ];
                for (const sel of emptySelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.textContent.trim().length > 0) {
                        results.hasEmptyStateUI = true;
                        results.emptyStateTexts.push(el.textContent.trim().substring(0, 60));
                    }
                }

                // Check for common empty state text
                const bodyText = document.body.innerText.toLowerCase();
                const emptyPhrases = ['no results', 'no data', 'không có dữ liệu', 'không tìm thấy',
                    'nothing here', 'empty', 'no items', 'chưa có'];
                for (const phrase of emptyPhrases) {
                    if (bodyText.includes(phrase)) {
                        results.hasEmptyStateUI = true;
                        break;
                    }
                }

                return results;
            });

            if (emptyStateCheck.emptyLists > 0 || emptyStateCheck.emptyTables > 0) {
                if (emptyStateCheck.hasEmptyStateUI) {
                    t.status = 'passed';
                    t.details = `Empty containers (${emptyStateCheck.emptyLists} lists, ${emptyStateCheck.emptyTables} tables) có empty state UI ✓`;
                } else {
                    t.status = 'warning';
                    t.details = `${emptyStateCheck.emptyLists} empty lists, ${emptyStateCheck.emptyTables} empty tables nhưng không có "no data" message. Nên thêm empty state UI.`;
                }
            } else if (emptyStateCheck.hasEmptyStateUI) {
                t.status = 'passed';
                t.details = `Có empty state UI: "${emptyStateCheck.emptyStateTexts.slice(0, 2).join('; ')}" ✓`;
            } else {
                t.status = 'passed';
                t.details = `${emptyStateCheck.lists} lists, ${emptyStateCheck.tables} tables — tất cả có data (không cần empty state).`;
            }
        });
    }

    /**
     * 13.5: Timeout/slow response — check if page handles slow loading
     */
    async _testSlowResponse(page, baseUrl) {
        const test = createTestResult('loading_error', '13.5', 'Slow response / timeout behavior');
        return runSafe(test, async (t) => {
            // Throttle network to simulate slow connection
            const cdpSession = await page.context().newCDPSession(page);

            try {
                // Simulate slow 3G
                await cdpSession.send('Network.emulateNetworkConditions', {
                    offline: false,
                    downloadThroughput: 50 * 1024, // 50 KB/s
                    uploadThroughput: 20 * 1024,    // 20 KB/s
                    latency: 2000,                  // 2s latency
                });

                const startTime = Date.now();

                // Try to reload page under throttled conditions
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
                await page.waitForTimeout(1000);

                const loadTime = Date.now() - startTime;

                // Check for loading indicators during slow load
                const hasLoadingUI = await page.evaluate(() => {
                    const indicators = document.querySelectorAll('.loading, .spinner, .skeleton, [class*="loading"], [class*="spinner"], progress, [role="progressbar"]');
                    let visibleCount = 0;
                    indicators.forEach(el => {
                        const s = getComputedStyle(el);
                        if (s.display !== 'none') visibleCount++;
                    });

                    // Check for noscript or loading screen
                    const loadingScreen = document.querySelector('#loading, .loading-screen, .app-loading, [class*="loading-screen"]');

                    return {
                        indicators: visibleCount,
                        hasLoadingScreen: !!loadingScreen,
                    };
                }).catch(() => ({ indicators: 0, hasLoadingScreen: false }));

                // Check page rendered content
                const pageOk = await page.evaluate(() => {
                    return document.body && document.body.innerText.trim().length > 50;
                }).catch(() => false);

                if (pageOk) {
                    t.status = 'passed';
                    t.details = `Page loaded under slow 3G in ${loadTime}ms. ${hasLoadingUI.indicators > 0 ? `${hasLoadingUI.indicators} loading indicators detected ✓` : 'No explicit loading UI.'} ${hasLoadingUI.hasLoadingScreen ? 'Has loading screen ✓' : ''}`;
                } else {
                    t.status = 'warning';
                    t.details = `Page chưa render đầy đủ under slow 3G (${loadTime}ms). Cần optimize performance.`;
                }
            } catch (err) {
                t.status = 'warning';
                t.details = `Cannot test slow network: ${err.message.substring(0, 100)}`;
            } finally {
                // Restore normal network
                try {
                    await cdpSession.send('Network.emulateNetworkConditions', {
                        offline: false,
                        downloadThroughput: -1,
                        uploadThroughput: -1,
                        latency: 0,
                    });
                    await cdpSession.detach();
                } catch { /* ignore */ }
            }

            // Reload normally to restore state
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        });
    }
}

module.exports = LoadingErrorStateTests;
