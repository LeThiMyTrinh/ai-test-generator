/**
 * Group 1: Navigation & Routing Tests (9 cases)
 * 1.1 Internal link navigation
 * 1.2 HTTP status check
 * 1.3 Back button
 * 1.4 Forward button
 * 1.5 Anchor/hash link
 * 1.6 Broken link detection
 * 1.7 External link check (rel="noopener")
 * 1.8 Redirect chain check
 * 1.9 Query parameter preservation
 */

const { createTestResult, runSafe, takeScreenshot, navigateBack } = require('./testHelpers');

class NavigationTests {
    /**
     * Run all navigation tests
     * @param {import('playwright').Page} page
     * @param {object} discovery - discovered elements
     * @param {string} baseUrl
     * @returns {Array} test results
     */
    async run(page, discovery, baseUrl) {
        const results = [];

        // 1.1 + 1.2: Internal link navigation & HTTP status check
        const internalLinks = discovery.navLinks.filter(l => !l.isExternal).slice(0, 8);
        for (const link of internalLinks) {
            results.push(await this._testInternalNavigation(page, link, baseUrl));
        }

        // 1.3 + 1.4: Back/Forward button
        if (internalLinks.length >= 1) {
            results.push(await this._testBackButton(page, internalLinks[0], baseUrl));
            results.push(await this._testForwardButton(page, internalLinks[0], baseUrl));
        }

        // 1.5: Anchor/hash links
        results.push(await this._testAnchorLinks(page, baseUrl));

        // 1.6: Broken link detection
        results.push(await this._testBrokenLinks(page, baseUrl));

        // 1.7: External link check
        results.push(await this._testExternalLinks(page));

        // 1.8: Redirect chain check
        results.push(await this._testRedirectChain(page, baseUrl));

        // 1.9: Query parameter preservation
        results.push(await this._testQueryParamPreservation(page, baseUrl));

        return results;
    }

    /**
     * 1.1 + 1.2: Internal link navigation + HTTP status check
     */
    async _testInternalNavigation(page, link, baseUrl) {
        const test = createTestResult('navigation', '1.1', `Internal navigation: "${link.text}"`);
        return runSafe(test, async (t) => {
            const response = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(500);

            const status = response ? response.status() : 0;

            if (status >= 400) {
                t.status = 'failed';
                t.details = `HTTP ${status} — link "${link.text}" trả về lỗi`;
            } else if (status === 0) {
                t.status = 'warning';
                t.details = `Không nhận được response cho "${link.text}"`;
            } else {
                t.status = 'passed';
                t.details = `HTTP ${status} — load thành công "${link.text}"`;
            }

            t.screenshot = await takeScreenshot(page);
            await navigateBack(page, baseUrl);
        });
    }

    /**
     * 1.3: Back button
     */
    async _testBackButton(page, link, baseUrl) {
        const test = createTestResult('navigation', '1.3', 'Back button navigation');
        return runSafe(test, async (t) => {
            // Navigate to a link first
            await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(500);
            const navigatedUrl = page.url();

            // Go back
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(500);
            const backUrl = page.url();

            // Verify we went back (URL should be different from navigated page)
            if (backUrl !== navigatedUrl) {
                t.status = 'passed';
                t.details = `goBack() hoạt động: ${navigatedUrl} → ${backUrl}`;
            } else {
                t.status = 'failed';
                t.details = `goBack() không hoạt động — URL vẫn là ${backUrl}`;
            }

            t.screenshot = await takeScreenshot(page);
            await navigateBack(page, baseUrl);
        });
    }

    /**
     * 1.4: Forward button
     */
    async _testForwardButton(page, link, baseUrl) {
        const test = createTestResult('navigation', '1.4', 'Forward button navigation');
        return runSafe(test, async (t) => {
            // Navigate to link
            await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(300);
            const targetUrl = page.url();

            // Go back
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(300);

            // Go forward
            await page.goForward({ waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(300);
            const forwardUrl = page.url();

            if (forwardUrl === targetUrl) {
                t.status = 'passed';
                t.details = `goForward() hoạt động: quay lại đúng ${targetUrl}`;
            } else {
                t.status = 'failed';
                t.details = `goForward() không đúng — expected ${targetUrl}, got ${forwardUrl}`;
            }

            t.screenshot = await takeScreenshot(page);
            await navigateBack(page, baseUrl);
        });
    }

    /**
     * 1.5: Anchor/hash links
     */
    async _testAnchorLinks(page, baseUrl) {
        const test = createTestResult('navigation', '1.5', 'Anchor/hash link navigation');
        return runSafe(test, async (t) => {
            await navigateBack(page, baseUrl);

            const anchorLinks = await page.evaluate(() => {
                const links = [];
                document.querySelectorAll('a[href*="#"]').forEach(a => {
                    const href = a.getAttribute('href');
                    if (href && href !== '#' && !href.startsWith('javascript:')) {
                        const hash = href.includes('#') ? href.split('#')[1] : '';
                        if (hash) {
                            links.push({
                                href: a.href,
                                hash,
                                text: a.textContent.trim().substring(0, 40),
                                selector: a.id ? `#${a.id}` : `a[href*="#${hash}"]`,
                            });
                        }
                    }
                });
                return links.slice(0, 5);
            });

            if (anchorLinks.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy anchor/hash links trên trang';
                return;
            }

            const results = [];
            for (const anchor of anchorLinks.slice(0, 3)) {
                try {
                    await page.click(anchor.selector, { timeout: 3000 });
                    await page.waitForTimeout(500);

                    // Check if target element exists
                    const targetExists = await page.evaluate((hash) => {
                        const el = document.getElementById(hash) || document.querySelector(`[name="${hash}"]`);
                        if (!el) return { exists: false };
                        const rect = el.getBoundingClientRect();
                        return {
                            exists: true,
                            inView: rect.top >= -50 && rect.top <= window.innerHeight,
                        };
                    }, anchor.hash);

                    if (targetExists.exists && targetExists.inView) {
                        results.push(`✓ #${anchor.hash} — scroll đúng`);
                    } else if (targetExists.exists) {
                        results.push(`⚠ #${anchor.hash} — element tồn tại nhưng chưa scroll vào view`);
                    } else {
                        results.push(`✗ #${anchor.hash} — target element không tồn tại`);
                    }
                } catch {
                    results.push(`✗ #${anchor.hash} — không click được`);
                }
            }

            const failCount = results.filter(r => r.startsWith('✗')).length;
            t.status = failCount > 0 ? 'failed' : results.some(r => r.startsWith('⚠')) ? 'warning' : 'passed';
            t.details = `${anchorLinks.length} anchor links tìm thấy. Tested: ${results.join('; ')}`;
            t.screenshot = await takeScreenshot(page);
            await navigateBack(page, baseUrl);
        });
    }

    /**
     * 1.6: Broken link detection - scan all <a href>
     */
    async _testBrokenLinks(page, baseUrl) {
        const test = createTestResult('navigation', '1.6', 'Broken link detection');
        return runSafe(test, async (t) => {
            await navigateBack(page, baseUrl);

            // Collect all links on the page
            const allLinks = await page.evaluate(() => {
                const links = [];
                document.querySelectorAll('a[href]').forEach(a => {
                    const href = a.href;
                    if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && href !== '#') {
                        links.push({
                            href,
                            text: a.textContent.trim().substring(0, 40),
                            isExternal: !href.startsWith(window.location.origin),
                        });
                    }
                });
                // Dedupe by href
                const seen = new Set();
                return links.filter(l => {
                    if (seen.has(l.href)) return false;
                    seen.add(l.href);
                    return true;
                });
            });

            if (allLinks.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy links trên trang';
                return;
            }

            // Check internal links only (external takes too long)
            const internalLinks = allLinks.filter(l => !l.isExternal).slice(0, 20);
            const brokenLinks = [];
            let checkedCount = 0;

            for (const link of internalLinks) {
                try {
                    const response = await page.context().request.head(link.href, { timeout: 8000 }).catch(() => null);
                    // Fallback to GET if HEAD fails
                    const resp = response || await page.context().request.get(link.href, { timeout: 8000 }).catch(() => null);
                    checkedCount++;
                    if (resp && resp.status() >= 400) {
                        brokenLinks.push({ href: link.href, text: link.text, status: resp.status() });
                    }
                } catch {
                    checkedCount++;
                }
            }

            if (brokenLinks.length > 0) {
                t.status = 'failed';
                t.details = `${brokenLinks.length}/${checkedCount} links bị broken: ${brokenLinks.map(l => `"${l.text}" → ${l.status}`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `Checked ${checkedCount}/${allLinks.length} links (${allLinks.filter(l => l.isExternal).length} external bỏ qua). Không có broken link.`;
            }
        });
    }

    /**
     * 1.7: External link check - target="_blank" should have rel="noopener"
     */
    async _testExternalLinks(page) {
        const test = createTestResult('navigation', '1.7', 'External link security (rel="noopener")');
        return runSafe(test, async (t) => {
            const externalLinkIssues = await page.evaluate(() => {
                const issues = [];
                const safe = [];
                document.querySelectorAll('a[target="_blank"]').forEach(a => {
                    const rel = (a.getAttribute('rel') || '').toLowerCase();
                    const href = a.href || '';
                    const text = a.textContent.trim().substring(0, 40);
                    if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
                        issues.push({ href: href.substring(0, 80), text, rel });
                    } else {
                        safe.push(text);
                    }
                });
                return { issues, safeCount: safe.length, total: issues.length + safe.length };
            });

            if (externalLinkIssues.total === 0) {
                t.status = 'skipped';
                t.details = 'Không có link target="_blank" trên trang';
                return;
            }

            if (externalLinkIssues.issues.length > 0) {
                t.status = 'failed';
                t.details = `${externalLinkIssues.issues.length}/${externalLinkIssues.total} external links thiếu rel="noopener": ${externalLinkIssues.issues.slice(0, 3).map(i => `"${i.text}"`).join(', ')}`;
            } else {
                t.status = 'passed';
                t.details = `${externalLinkIssues.safeCount} external links đều có rel="noopener" ✓`;
            }
        });
    }
    /**
     * 1.8: Redirect chain check — detect excessive redirects
     */
    async _testRedirectChain(page, baseUrl) {
        const test = createTestResult('navigation', '1.8', 'Redirect chain check');
        return runSafe(test, async (t) => {
            const redirects = [];
            const redirectHandler = (response) => {
                const status = response.status();
                if (status >= 300 && status < 400) {
                    redirects.push({
                        url: response.url().substring(0, 80),
                        status,
                        location: response.headers()['location'] || '',
                    });
                }
            };
            page.on('response', redirectHandler);

            try {
                await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await page.waitForTimeout(500);
            } catch { /* timeout is OK */ }

            page.removeListener('response', redirectHandler);

            if (redirects.length === 0) {
                t.status = 'passed';
                t.details = 'Không có redirect chain — direct navigation ✓';
            } else if (redirects.length <= 2) {
                t.status = 'passed';
                t.details = `${redirects.length} redirects (acceptable): ${redirects.map(r => `${r.status} → ${r.location.substring(0, 50)}`).join(' → ')}`;
            } else {
                t.status = 'warning';
                t.details = `${redirects.length} redirects (quá nhiều — ảnh hưởng performance): ${redirects.map(r => `${r.status}`).join(' → ')}. Nên giảm redirect chain.`;
            }
        });
    }

    /**
     * 1.9: Query parameter preservation — params should survive navigation
     */
    async _testQueryParamPreservation(page, baseUrl) {
        const test = createTestResult('navigation', '1.9', 'Query parameter preservation');
        return runSafe(test, async (t) => {
            // Add test query params to base URL
            const url = new URL(baseUrl);
            url.searchParams.set('utm_source', 'test');
            url.searchParams.set('ref', 'autotest');
            const urlWithParams = url.toString();

            await page.goto(urlWithParams, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(500);

            const finalUrl = page.url();
            const finalParams = new URL(finalUrl).searchParams;

            const preserved = [];
            const lost = [];

            if (finalParams.get('utm_source') === 'test') preserved.push('utm_source');
            else lost.push('utm_source');

            if (finalParams.get('ref') === 'autotest') preserved.push('ref');
            else lost.push('ref');

            if (lost.length === 0) {
                t.status = 'passed';
                t.details = `Query params preserved: ${preserved.join(', ')} ✓`;
            } else if (preserved.length > 0) {
                t.status = 'warning';
                t.details = `Một số params bị mất: lost=[${lost.join(', ')}], kept=[${preserved.join(', ')}]`;
            } else {
                t.status = 'warning';
                t.details = `Tất cả query params bị strip sau navigation. URL: ${finalUrl.substring(0, 80)}`;
            }

            await navigateBack(page, baseUrl);
        });
    }
}

module.exports = NavigationTests;
