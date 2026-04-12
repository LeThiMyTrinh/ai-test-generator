/**
 * Group 8: Link & Navigation (6 cases)
 * 8.1 Menu link (click hoạt động, navigate đúng)
 * 8.2 Button link (button với href/onclick navigate)
 * 8.3 Footer link (link trong footer hoạt động)
 * 8.4 Breadcrumb (breadcrumb link hoạt động)
 * 8.5 Không có 404 (kiểm tra tất cả link không trả 404)
 * 8.6 Không redirect sai (redirect đến đúng URL)
 */

const { createTestResult, runSafe, takeScreenshot, navigateBack } = require('./testHelpers');

class LinkNavigationTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testMenuLinks(page, discovery, baseUrl));
        results.push(await this._testButtonLinks(page, baseUrl));
        results.push(await this._testFooterLinks(page, baseUrl));
        results.push(await this._testBreadcrumbLinks(page, baseUrl));
        results.push(await this._testNo404Links(page, baseUrl));
        results.push(await this._testNoWrongRedirect(page, discovery, baseUrl));

        return results;
    }

    /**
     * 8.1: Menu link — click hoạt động, navigate đúng
     */
    async _testMenuLinks(page, discovery, baseUrl) {
        const test = createTestResult('linkNavigation', '8.1', 'Menu link hoạt động');
        return runSafe(test, async (t) => {
            if (discovery.navLinks.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy navigation links';
                return;
            }

            const internalLinks = discovery.navLinks.filter(l => !l.isExternal).slice(0, 5);
            if (internalLinks.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy internal navigation links';
                return;
            }

            let tested = 0, ok = 0, errors = [];
            for (const link of internalLinks.slice(0, 3)) {
                try {
                    tested++;
                    // Navigate
                    const response = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    const status = response ? response.status() : 0;

                    if (status >= 200 && status < 400) {
                        ok++;
                    } else {
                        errors.push(`"${link.text}" → ${status}`);
                    }

                    // Return to base
                    await navigateBack(page, baseUrl);
                } catch (err) {
                    errors.push(`"${link.text}" → ${err.message.substring(0, 50)}`);
                    await navigateBack(page, baseUrl);
                }
            }

            if (errors.length === 0) {
                t.status = 'passed';
                t.details = `${ok}/${tested} menu links hoạt động đúng ✓`;
            } else {
                t.status = 'failed';
                t.details = `${errors.length} menu links lỗi: ${errors.join('; ')}`;
            }
        });
    }

    /**
     * 8.2: Button link — buttons with href or onclick navigation
     */
    async _testButtonLinks(page, baseUrl) {
        const test = createTestResult('linkNavigation', '8.2', 'Button link hoạt động');
        return runSafe(test, async (t) => {
            const buttonLinks = await page.evaluate(() => {
                const results = [];
                // Buttons that act as links
                document.querySelectorAll('a.btn, a.button, a[role="button"], button[onclick*="location"], button[onclick*="href"]').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0) return;
                    const style = getComputedStyle(el);
                    if (style.display === 'none') return;

                    results.push({
                        text: el.textContent.trim().substring(0, 40),
                        href: el.href || '',
                        tag: el.tagName.toLowerCase(),
                        isExternal: el.href ? !el.href.startsWith(window.location.origin) : false,
                    });
                });
                return results;
            });

            if (buttonLinks.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy button links trên trang';
                return;
            }

            const internal = buttonLinks.filter(b => !b.isExternal && b.href).slice(0, 3);
            if (internal.length === 0) {
                t.status = 'passed';
                t.details = `${buttonLinks.length} button links tìm thấy (tất cả external hoặc no href) ✓`;
                return;
            }

            let tested = 0, ok = 0;
            for (const btn of internal) {
                try {
                    tested++;
                    const response = await page.goto(btn.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    if (response && response.status() < 400) ok++;
                    await navigateBack(page, baseUrl);
                } catch {
                    await navigateBack(page, baseUrl);
                }
            }

            if (ok === tested) {
                t.status = 'passed';
                t.details = `${ok}/${tested} button links navigate thành công ✓`;
            } else {
                t.status = 'warning';
                t.details = `${ok}/${tested} button links hoạt động. ${tested - ok} lỗi.`;
            }
        });
    }

    /**
     * 8.3: Footer link — link trong footer hoạt động
     */
    async _testFooterLinks(page, baseUrl) {
        const test = createTestResult('linkNavigation', '8.3', 'Footer link hoạt động');
        return runSafe(test, async (t) => {
            const footerLinks = await page.evaluate(() => {
                const footer = document.querySelector('footer, .footer, [role="contentinfo"]');
                if (!footer) return [];

                const links = [];
                footer.querySelectorAll('a[href]').forEach(a => {
                    const href = a.href;
                    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '#') return;
                    const rect = a.getBoundingClientRect();
                    if (rect.width === 0) return;

                    links.push({
                        text: a.textContent.trim().substring(0, 40),
                        href,
                        isExternal: !href.startsWith(window.location.origin),
                    });
                });
                return links;
            });

            if (footerLinks.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy footer hoặc không có links trong footer';
                return;
            }

            const internalFooterLinks = footerLinks.filter(l => !l.isExternal).slice(0, 3);
            if (internalFooterLinks.length === 0) {
                t.status = 'passed';
                t.details = `${footerLinks.length} footer links tìm thấy (tất cả external) ✓`;
                return;
            }

            let tested = 0, ok = 0, errors = [];
            for (const link of internalFooterLinks) {
                try {
                    tested++;
                    const response = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    if (response && response.status() < 400) {
                        ok++;
                    } else {
                        errors.push(`"${link.text}" → ${response?.status()}`);
                    }
                    await navigateBack(page, baseUrl);
                } catch (err) {
                    errors.push(`"${link.text}" → timeout`);
                    await navigateBack(page, baseUrl);
                }
            }

            if (errors.length === 0) {
                t.status = 'passed';
                t.details = `${ok}/${tested} footer links hoạt động đúng ✓`;
            } else {
                t.status = 'failed';
                t.details = `${errors.length} footer links lỗi: ${errors.join('; ')}`;
            }
        });
    }

    /**
     * 8.4: Breadcrumb — breadcrumb links hoạt động
     */
    async _testBreadcrumbLinks(page, baseUrl) {
        const test = createTestResult('linkNavigation', '8.4', 'Breadcrumb link hoạt động');
        return runSafe(test, async (t) => {
            const breadcrumbs = await page.evaluate(() => {
                const selectors = [
                    '[aria-label="breadcrumb"]', '.breadcrumb', '.breadcrumbs',
                    'nav.breadcrumb', 'ol.breadcrumb', 'ul.breadcrumb',
                    '[itemtype*="BreadcrumbList"]',
                ];

                for (const sel of selectors) {
                    const bc = document.querySelector(sel);
                    if (bc) {
                        const links = [];
                        bc.querySelectorAll('a[href]').forEach(a => {
                            const href = a.href;
                            if (!href || href === '#') return;
                            links.push({
                                text: a.textContent.trim().substring(0, 30),
                                href,
                            });
                        });
                        return links;
                    }
                }
                return [];
            });

            if (breadcrumbs.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy breadcrumb trên trang';
                return;
            }

            let tested = 0, ok = 0;
            for (const link of breadcrumbs.slice(0, 3)) {
                try {
                    tested++;
                    const response = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    if (response && response.status() < 400) ok++;
                    await navigateBack(page, baseUrl);
                } catch {
                    await navigateBack(page, baseUrl);
                }
            }

            if (ok === tested) {
                t.status = 'passed';
                t.details = `${ok} breadcrumb links hoạt động đúng ✓`;
            } else {
                t.status = 'warning';
                t.details = `${ok}/${tested} breadcrumb links hoạt động`;
            }
        });
    }

    /**
     * 8.5: Không có 404 — kiểm tra tất cả links không trả 404
     */
    async _testNo404Links(page, baseUrl) {
        const test = createTestResult('linkNavigation', '8.5', 'Không có link 404');
        return runSafe(test, async (t) => {
            // Chỉ navigate lại base page
            await navigateBack(page, baseUrl);

            const allLinks = await page.evaluate(() => {
                const links = [];
                document.querySelectorAll('a[href]').forEach(a => {
                    const href = a.href;
                    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '#' || href.startsWith('data:')) return;
                    if (!href.startsWith(window.location.origin)) return; // only check internal
                    const rect = a.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;

                    if (!links.some(l => l.href === href)) {
                        links.push({
                            text: a.textContent.trim().substring(0, 30),
                            href,
                        });
                    }
                });
                return links;
            });

            if (allLinks.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy internal links trên trang';
                return;
            }

            // Test up to 10 links via fetch-like approach using page.request
            const brokenLinks = [];
            const linksToCheck = allLinks.slice(0, 10);

            for (const link of linksToCheck) {
                try {
                    const response = await page.request.get(link.href, { timeout: 8000 });
                    const status = response.status();
                    if (status === 404 || status === 410) {
                        brokenLinks.push({ text: link.text, href: link.href.substring(0, 60), status });
                    }
                } catch {
                    // timeout or network error — skip
                }
            }

            if (brokenLinks.length > 0) {
                t.status = 'failed';
                t.details = `${brokenLinks.length}/${linksToCheck.length} links trả 404: ${brokenLinks.slice(0, 3).map(l => `"${l.text}" (${l.status})`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `Kiểm tra ${linksToCheck.length}/${allLinks.length} internal links — không có 404 ✓`;
            }
        });
    }

    /**
     * 8.6: Không redirect sai — redirect đến đúng URL expected
     */
    async _testNoWrongRedirect(page, discovery, baseUrl) {
        const test = createTestResult('linkNavigation', '8.6', 'Không redirect sai');
        return runSafe(test, async (t) => {
            const linksToTest = discovery.navLinks.filter(l => !l.isExternal).slice(0, 5);

            if (linksToTest.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy internal navigation links để test redirect';
                return;
            }

            let tested = 0, wrongRedirect = [];

            for (const link of linksToTest.slice(0, 3)) {
                try {
                    tested++;
                    const response = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    const finalUrl = page.url();

                    // Check if redirected to a completely different path (not just trailing slash difference)
                    const expectedPath = new URL(link.href).pathname.replace(/\/$/, '');
                    const actualPath = new URL(finalUrl).pathname.replace(/\/$/, '');

                    // Allow same-origin redirects, but flag cross-origin or unexpected path redirects
                    const expectedOrigin = new URL(link.href).origin;
                    const actualOrigin = new URL(finalUrl).origin;

                    if (actualOrigin !== expectedOrigin) {
                        wrongRedirect.push({
                            text: link.text,
                            expected: link.href.substring(0, 50),
                            actual: finalUrl.substring(0, 50),
                            reason: 'Cross-origin redirect',
                        });
                    } else if (expectedPath !== actualPath && !actualPath.startsWith(expectedPath)) {
                        // Check for login redirect (common pattern)
                        const isLoginRedirect = actualPath.includes('login') || actualPath.includes('signin') || actualPath.includes('auth');
                        if (!isLoginRedirect) {
                            wrongRedirect.push({
                                text: link.text,
                                expected: expectedPath,
                                actual: actualPath,
                                reason: 'Unexpected redirect',
                            });
                        }
                    }

                    await navigateBack(page, baseUrl);
                } catch {
                    await navigateBack(page, baseUrl);
                }
            }

            if (wrongRedirect.length === 0) {
                t.status = 'passed';
                t.details = `${tested} links kiểm tra — không có redirect sai ✓`;
            } else {
                t.status = 'warning';
                t.details = `${wrongRedirect.length} links có redirect bất thường: ${wrongRedirect.slice(0, 2).map(r => `"${r.text}" (${r.reason}: ${r.actual})`).join('; ')}`;
            }
        });
    }
}

module.exports = LinkNavigationTests;
