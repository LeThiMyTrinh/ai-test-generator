/**
 * Group 1: Header / Navigation (5 cases) — theo PDF
 * TC_NAV_01 Logo hiển thị
 * TC_NAV_02 Click logo → điều hướng về Home
 * TC_NAV_03 Menu hiển thị
 * TC_NAV_04 Click menu → điều hướng đúng trang
 * TC_NAV_05 Menu active → highlight
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class NavigationTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testLogoVisible(page));
        results.push(await this._testClickLogo(page, baseUrl));
        results.push(await this._testMenuVisible(page, discovery));
        results.push(await this._testClickMenu(page, discovery, baseUrl));
        results.push(await this._testMenuActive(page, discovery, baseUrl));

        return results.filter(Boolean);
    }

    /** TC_NAV_01: Logo hiển thị đúng */
    async _testLogoVisible(page) {
        const test = createTestResult('navigation', 'TC_NAV_01', 'Logo hiển thị');
        return runSafe(test, async (t) => {
            const logo = await page.evaluate(() => {
                const selectors = [
                    'header img', 'nav img', '.logo', '.brand', '.navbar-brand',
                    '[class*="logo"]', 'header a:first-child img', 'header svg',
                    'a[href="/"] img', 'a[href="/"] svg',
                ];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            return { found: true, selector: sel, width: rect.width, height: rect.height };
                        }
                    }
                }
                return { found: false };
            });

            if (logo.found) {
                t.status = 'passed';
                t.details = `Logo hiển thị đúng (${Math.round(logo.width)}x${Math.round(logo.height)}px)`;
            } else {
                t.status = 'failed';
                t.details = 'Không tìm thấy logo trên trang';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_NAV_02: Click logo → điều hướng về Home */
    async _testClickLogo(page, baseUrl) {
        const test = createTestResult('navigation', 'TC_NAV_02', 'Click logo → về Home');
        return runSafe(test, async (t) => {
            const logoLink = await page.evaluate(() => {
                const selectors = [
                    'header a:has(img)', 'nav a:has(img)', 'a.logo', 'a.brand',
                    'a.navbar-brand', 'a[class*="logo"]', 'a[href="/"]',
                    'header a:first-child', 'a:has(svg[class*="logo"])',
                ];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.href) {
                        return { found: true, href: el.href, selector: sel };
                    }
                }
                return { found: false };
            });

            if (!logoLink.found) {
                t.status = 'warning';
                t.details = 'Không tìm thấy link logo để click';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            await page.click(logoLink.selector).catch(() => {});
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});

            const currentUrl = page.url();
            const origin = new URL(baseUrl).origin;
            const isHome = currentUrl === origin + '/' || currentUrl === origin || currentUrl === baseUrl;

            if (isHome) {
                t.status = 'passed';
                t.details = `Click logo điều hướng về Home thành công (${currentUrl})`;
            } else {
                t.status = 'warning';
                t.details = `Click logo điều hướng tới ${currentUrl}`;
            }
            t.screenshot = await takeScreenshot(page);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        });
    }

    /** TC_NAV_03: Menu hiển thị đầy đủ */
    async _testMenuVisible(page, discovery) {
        const test = createTestResult('navigation', 'TC_NAV_03', 'Menu hiển thị');
        return runSafe(test, async (t) => {
            if (discovery.navLinks.length === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy menu navigation trên trang';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            let visibleCount = 0;
            let hiddenItems = [];
            for (const link of discovery.navLinks) {
                const visible = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (!el) return false;
                    const rect = el.getBoundingClientRect();
                    const style = getComputedStyle(el);
                    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
                }, link.selector).catch(() => false);

                if (visible) visibleCount++;
                else hiddenItems.push(link.text);
            }

            if (visibleCount === discovery.navLinks.length) {
                t.status = 'passed';
                t.details = `Tất cả ${visibleCount} menu items hiển thị đúng`;
            } else if (visibleCount > 0) {
                t.status = 'warning';
                t.details = `${visibleCount}/${discovery.navLinks.length} menu hiển thị. Ẩn: ${hiddenItems.join(', ')}`;
            } else {
                t.status = 'failed';
                t.details = 'Không có menu item nào hiển thị';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_NAV_04: Click từng menu → điều hướng đúng trang */
    async _testClickMenu(page, discovery, baseUrl) {
        const test = createTestResult('navigation', 'TC_NAV_04', 'Click menu → điều hướng đúng');
        return runSafe(test, async (t) => {
            const internalLinks = discovery.navLinks.filter(l => !l.isExternal);
            if (internalLinks.length === 0) {
                t.status = 'warning';
                t.details = 'Không có internal menu links để test';
                return;
            }

            let successCount = 0;
            let failedLinks = [];
            const maxTest = Math.min(internalLinks.length, 5);

            for (let i = 0; i < maxTest; i++) {
                const link = internalLinks[i];
                try {
                    await page.click(link.selector, { timeout: 3000 });
                    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});

                    const is404 = await page.evaluate(() => {
                        return document.title.toLowerCase().includes('404') ||
                            document.body.innerText.includes('Page Not Found');
                    });

                    if (!is404) successCount++;
                    else failedLinks.push(link.text);

                    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    await page.waitForTimeout(200);
                } catch {
                    failedLinks.push(link.text);
                    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
                }
            }

            if (successCount === maxTest) {
                t.status = 'passed';
                t.details = `${successCount}/${maxTest} menu links điều hướng thành công`;
            } else if (successCount > 0) {
                t.status = 'warning';
                t.details = `${successCount}/${maxTest} thành công. Lỗi: ${failedLinks.join(', ')}`;
            } else {
                t.status = 'failed';
                t.details = `Tất cả ${maxTest} menu links điều hướng thất bại`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_NAV_05: Menu active được highlight */
    async _testMenuActive(page, discovery, baseUrl) {
        const test = createTestResult('navigation', 'TC_NAV_05', 'Menu active highlight');
        return runSafe(test, async (t) => {
            const internalLinks = discovery.navLinks.filter(l => !l.isExternal);
            if (internalLinks.length === 0) {
                t.status = 'warning';
                t.details = 'Không có menu links để kiểm tra active state';
                return;
            }

            const link = internalLinks[0];
            try {
                await page.click(link.selector, { timeout: 3000 });
                await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});

                const hasActiveState = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (!el) return { hasActive: false };
                    const classes = el.className.toString().toLowerCase();
                    const hasActiveClass = classes.includes('active') || classes.includes('current') ||
                        classes.includes('selected') || el.getAttribute('aria-current') === 'page';
                    const fontWeight = parseInt(getComputedStyle(el).fontWeight) || 400;
                    return { hasActive: hasActiveClass || fontWeight >= 600, activeClass: hasActiveClass, boldWeight: fontWeight >= 600 };
                }, link.selector);

                if (hasActiveState.hasActive) {
                    t.status = 'passed';
                    t.details = `Menu "${link.text}" có active state`;
                } else {
                    t.status = 'warning';
                    t.details = `Menu "${link.text}" không phát hiện active highlight rõ ràng`;
                }
            } catch {
                t.status = 'warning';
                t.details = 'Không thể click menu để kiểm tra active state';
            }

            t.screenshot = await takeScreenshot(page);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        });
    }
}

module.exports = NavigationTests;
