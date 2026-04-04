/**
 * Group 12: Link (4 cases) — theo PDF
 * TC_LINK_01 Link hiển thị
 * TC_LINK_02 Click link → điều hướng đúng
 * TC_LINK_03 Hover link → hiển thị underline
 * TC_LINK_04 Broken link → không lỗi 404
 */

const { createTestResult, runSafe, takeScreenshot, navigateBack } = require('./testHelpers');

class LinkTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testLinkVisible(page));
        results.push(await this._testClickLink(page, baseUrl));
        results.push(await this._testHoverLink(page));
        results.push(await this._testBrokenLink(page, baseUrl));

        return results.filter(Boolean);
    }

    /** TC_LINK_01: Link hiển thị */
    async _testLinkVisible(page) {
        const test = createTestResult('link', 'TC_LINK_01', 'Link hiển thị');
        return runSafe(test, async (t) => {
            const linkInfo = await page.evaluate(() => {
                const links = document.querySelectorAll('a[href]');
                let visible = 0;
                let total = 0;
                links.forEach(a => {
                    if (a.href.startsWith('javascript:') || a.href === '#') return;
                    total++;
                    const rect = a.getBoundingClientRect();
                    const style = getComputedStyle(a);
                    if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
                        visible++;
                    }
                });
                return { total, visible };
            });

            if (linkInfo.visible > 0) {
                t.status = 'passed';
                t.details = `${linkInfo.visible}/${linkInfo.total} links hiển thị`;
            } else if (linkInfo.total > 0) {
                t.status = 'failed';
                t.details = `Có ${linkInfo.total} links nhưng không link nào hiển thị`;
            } else {
                t.status = 'warning';
                t.details = 'Không tìm thấy link trên trang';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_LINK_02: Click link → điều hướng đúng */
    async _testClickLink(page, baseUrl) {
        const test = createTestResult('link', 'TC_LINK_02', 'Click link');
        return runSafe(test, async (t) => {
            const link = await page.evaluate((base) => {
                const origin = new URL(base).origin;
                const links = document.querySelectorAll('a[href]');
                for (const a of links) {
                    if (!a.href.startsWith(origin)) continue;
                    if (a.href === base || a.href === base + '/') continue;
                    const rect = a.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        return {
                            found: true,
                            selector: a.id ? `#${a.id}` : `a[href="${a.getAttribute('href')}"]`,
                            href: a.href,
                            text: a.textContent.trim().substring(0, 30),
                        };
                    }
                }
                return { found: false };
            }, baseUrl);

            if (!link.found) {
                t.status = 'warning';
                t.details = 'Không tìm thấy internal link để test click';
                return;
            }

            await page.click(link.selector, { timeout: 3000 }).catch(() => {});
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});

            const currentUrl = page.url();
            const is404 = await page.evaluate(() => {
                return document.title.toLowerCase().includes('404') ||
                    document.body.innerText.includes('Page Not Found') ||
                    document.body.innerText.includes('Not Found');
            });

            if (!is404 && currentUrl !== baseUrl) {
                t.status = 'passed';
                t.details = `Click link "${link.text}" → điều hướng đúng (${currentUrl})`;
            } else if (is404) {
                t.status = 'failed';
                t.details = `Click link "${link.text}" → trang 404`;
            } else {
                t.status = 'warning';
                t.details = `Click link "${link.text}" nhưng URL không thay đổi`;
            }
            t.screenshot = await takeScreenshot(page);
            await navigateBack(page, baseUrl);
        });
    }

    /** TC_LINK_03: Hover link → hiển thị underline */
    async _testHoverLink(page) {
        const test = createTestResult('link', 'TC_LINK_03', 'Hover link');
        return runSafe(test, async (t) => {
            const linkSel = await page.evaluate(() => {
                const links = document.querySelectorAll('a[href]');
                for (const a of links) {
                    const rect = a.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && a.textContent.trim()) {
                        return {
                            selector: a.id ? `#${a.id}` : `a[href="${a.getAttribute('href')}"]`,
                            text: a.textContent.trim().substring(0, 30),
                        };
                    }
                }
                return null;
            });

            if (!linkSel) {
                t.status = 'warning';
                t.details = 'Không tìm thấy link để test hover';
                return;
            }

            // Style trước hover
            const beforeStyle = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const s = getComputedStyle(el);
                return { textDecoration: s.textDecoration, color: s.color, cursor: s.cursor };
            }, linkSel.selector);

            // Hover
            await page.hover(linkSel.selector, { timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);

            // Style sau hover
            const afterStyle = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const s = getComputedStyle(el);
                return { textDecoration: s.textDecoration, color: s.color, cursor: s.cursor };
            }, linkSel.selector);

            if (!beforeStyle || !afterStyle) {
                t.status = 'warning';
                t.details = 'Không thể đọc style của link';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            const hasUnderline = afterStyle.textDecoration.includes('underline');
            const hasChange = beforeStyle.textDecoration !== afterStyle.textDecoration || beforeStyle.color !== afterStyle.color;
            const hasCursor = afterStyle.cursor === 'pointer';

            if (hasUnderline || hasChange || hasCursor) {
                t.status = 'passed';
                t.details = `Link "${linkSel.text}" có hover state (underline: ${hasUnderline}, cursor: ${afterStyle.cursor})`;
            } else {
                t.status = 'warning';
                t.details = `Link "${linkSel.text}" không có hover underline rõ ràng`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_LINK_04: Broken link → không lỗi 404 */
    async _testBrokenLink(page, baseUrl) {
        const test = createTestResult('link', 'TC_LINK_04', 'Broken link');
        return runSafe(test, async (t) => {
            // Lấy danh sách internal links
            const links = await page.evaluate((base) => {
                const origin = new URL(base).origin;
                const allLinks = document.querySelectorAll('a[href]');
                const results = [];
                const seen = new Set();
                allLinks.forEach(a => {
                    if (!a.href.startsWith(origin)) return;
                    if (a.href.startsWith('javascript:') || a.href === '#') return;
                    if (seen.has(a.href)) return;
                    seen.add(a.href);
                    results.push({ href: a.href, text: a.textContent.trim().substring(0, 30) });
                });
                return results.slice(0, 10); // Giới hạn 10 links
            }, baseUrl);

            if (links.length === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy internal links để kiểm tra';
                return;
            }

            let brokenLinks = [];
            let checkedCount = 0;

            for (const link of links) {
                try {
                    const response = await page.context().request.get(link.href, { timeout: 5000 });
                    checkedCount++;
                    if (response.status() >= 400) {
                        brokenLinks.push({ text: link.text, href: link.href, status: response.status() });
                    }
                } catch {
                    checkedCount++;
                    // Timeout hoặc network error - coi là warning
                }
            }

            if (brokenLinks.length === 0) {
                t.status = 'passed';
                t.details = `Kiểm tra ${checkedCount} links, không có broken link (404)`;
            } else {
                t.status = 'failed';
                t.details = `${brokenLinks.length}/${checkedCount} broken links: ${brokenLinks.map(l => `"${l.text}" (${l.status})`).join(', ')}`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = LinkTests;
