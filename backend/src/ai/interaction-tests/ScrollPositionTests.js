/**
 * Group 5: Scroll & Position (4 cases)
 * 5.1 Sticky header
 * 5.2 Back to top button
 * 5.3 Lazy loading image
 * 5.4 Scroll không bị giật
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class ScrollPositionTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testStickyHeader(page));
        results.push(await this._testBackToTopButton(page));
        results.push(await this._testLazyLoadingImages(page));
        results.push(await this._testSmoothScroll(page));

        return results;
    }

    /**
     * 5.1: Sticky header
     */
    async _testStickyHeader(page) {
        const test = createTestResult('scrollPosition', '5.1', 'Sticky header');
        return runSafe(test, async (t) => {
            const headerInfo = await page.evaluate(() => {
                const headers = document.querySelectorAll('header, nav, .navbar, .header, [role="banner"], .sticky-top, .fixed-top');
                for (const h of headers) {
                    const rect = h.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) continue;
                    const style = getComputedStyle(h);
                    return {
                        selector: h.id ? `#${h.id}` : (h.tagName === 'HEADER' ? 'header' : 'nav'),
                        position: style.position,
                        isSticky: style.position === 'sticky' || style.position === 'fixed',
                    };
                }
                return null;
            });

            if (!headerInfo) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy header/nav element';
                return;
            }

            // Scroll down
            await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'auto' }));
            await page.waitForTimeout(200);

            const afterScroll = await page.evaluate((sel) => {
                const h = document.querySelector(sel);
                if (!h) return null;
                const rect = h.getBoundingClientRect();
                const style = getComputedStyle(h);
                return {
                    top: rect.top,
                    visible: rect.top >= -rect.height && rect.top <= window.innerHeight,
                    position: style.position,
                    isSticky: style.position === 'sticky' || style.position === 'fixed',
                };
            }, headerInfo.selector);

            // Scroll back
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
            await page.waitForTimeout(100);

            if (!afterScroll) {
                t.status = 'warning';
                t.details = 'Header biến mất sau scroll';
                return;
            }

            if (afterScroll.isSticky && afterScroll.visible) {
                t.status = 'passed';
                t.details = `Header sticky (position: ${afterScroll.position}) — vẫn visible sau scroll ✓`;
            } else if (afterScroll.visible) {
                t.status = 'passed';
                t.details = `Header visible sau scroll (position: ${afterScroll.position})`;
            } else if (headerInfo.isSticky) {
                t.status = 'failed';
                t.details = `Header có position: ${headerInfo.position} nhưng không visible sau scroll`;
            } else {
                t.status = 'passed';
                t.details = `Header không sticky (position: ${headerInfo.position}) — behavior bình thường`;
            }
        });
    }

    /**
     * 5.2: Back to top button
     */
    async _testBackToTopButton(page) {
        const test = createTestResult('scrollPosition', '5.2', 'Back to top button');
        return runSafe(test, async (t) => {
            const pageHeight = await page.evaluate(() => document.body.scrollHeight);
            const viewportHeight = await page.evaluate(() => window.innerHeight);

            if (pageHeight < viewportHeight * 2) {
                t.status = 'skipped';
                t.details = `Page không đủ dài (${pageHeight}px) — back-to-top không cần thiết`;
                return;
            }

            // Scroll down
            await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'auto' }));
            await page.waitForTimeout(300);

            const backToTop = await page.evaluate(() => {
                const selectors = [
                    '#back-to-top', '#backToTop', '#scrollTop', '#scroll-top',
                    '.back-to-top', '.backToTop', '.scroll-top', '.scrollTop',
                    '.go-top', '.to-top', '[data-scroll="top"]',
                    'a[href="#top"]', 'a[href="#"]',
                    'button[aria-label*="top"]', 'button[title*="top"]',
                ];

                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        const style = getComputedStyle(el);
                        if (rect.width > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                            return { found: true, visible: true, selector: sel, text: el.textContent.trim().substring(0, 30) };
                        }
                        return { found: true, visible: false, selector: sel };
                    }
                }
                return { found: false };
            });

            if (backToTop.found && backToTop.visible) {
                try {
                    await page.click(backToTop.selector);
                    await page.waitForTimeout(300);
                    const scrolledToTop = await page.evaluate(() => window.scrollY < 100);
                    t.status = scrolledToTop ? 'passed' : 'warning';
                    t.details = scrolledToTop
                        ? `Back-to-top button hoạt động đúng ✓`
                        : 'Back-to-top button tìm thấy nhưng click không scroll to top';
                } catch {
                    t.status = 'warning';
                    t.details = 'Back-to-top button visible nhưng không click được';
                }
            } else if (backToTop.found) {
                t.status = 'warning';
                t.details = `Back-to-top button tìm thấy nhưng không visible sau scroll`;
            } else {
                t.status = 'warning';
                t.details = `Page dài ${pageHeight}px nhưng không có back-to-top button`;
            }

            t.screenshot = await takeScreenshot(page);
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
            await page.waitForTimeout(100);
        });
    }

    /**
     * 5.3: Lazy loading image
     */
    async _testLazyLoadingImages(page) {
        const test = createTestResult('scrollPosition', '5.3', 'Lazy loading image');
        return runSafe(test, async (t) => {
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
            await page.waitForTimeout(100);

            const lazyCheck = await page.evaluate(() => {
                const images = document.querySelectorAll('img');
                let total = 0, withLazy = 0;
                const belowFoldNoLazy = [];
                const viewportHeight = window.innerHeight;

                images.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;
                    total++;

                    const isLazy = img.getAttribute('loading') === 'lazy';
                    if (isLazy) withLazy++;

                    if (rect.top > viewportHeight && !isLazy) {
                        belowFoldNoLazy.push({
                            src: (img.src || '').substring(0, 50),
                            alt: (img.alt || '').substring(0, 30),
                        });
                    }
                });

                return { total, withLazy, belowFoldNoLazy: belowFoldNoLazy.slice(0, 5) };
            });

            if (lazyCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không có images trên trang';
                return;
            }

            if (lazyCheck.belowFoldNoLazy.length > 3) {
                t.status = 'warning';
                t.details = `${lazyCheck.total} images, ${lazyCheck.withLazy} có loading="lazy". ${lazyCheck.belowFoldNoLazy.length} below-fold images thiếu lazy loading`;
            } else {
                t.status = 'passed';
                t.details = `${lazyCheck.total} images, ${lazyCheck.withLazy} có loading="lazy" ✓`;
            }
        });
    }

    /**
     * 5.4: Scroll không bị giật (smooth scroll performance)
     */
    async _testSmoothScroll(page) {
        const test = createTestResult('scrollPosition', '5.4', 'Scroll không bị giật');
        return runSafe(test, async (t) => {
            const perfResult = await page.evaluate(async () => {
                const frames = [];
                let lastTime = performance.now();

                return new Promise((resolve) => {
                    let frameCount = 0;
                    const scrollStep = () => {
                        const now = performance.now();
                        frames.push(now - lastTime);
                        lastTime = now;
                        frameCount++;

                        window.scrollBy(0, 50);

                        if (frameCount < 30) {
                            requestAnimationFrame(scrollStep);
                        } else {
                            const avgFrame = frames.reduce((a, b) => a + b, 0) / frames.length;
                            const maxFrame = Math.max(...frames);
                            const jankFrames = frames.filter(f => f > 33).length; // > 30fps threshold
                            resolve({ avgFrame: Math.round(avgFrame), maxFrame: Math.round(maxFrame), jankFrames, totalFrames: frames.length });
                        }
                    };
                    requestAnimationFrame(scrollStep);
                });
            });

            // Scroll back
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
            await page.waitForTimeout(100);

            if (perfResult.jankFrames > 10) {
                t.status = 'warning';
                t.details = `Scroll bị giật: avg frame ${perfResult.avgFrame}ms, max ${perfResult.maxFrame}ms, jank ${perfResult.jankFrames}/${perfResult.totalFrames} frames`;
            } else if (perfResult.maxFrame > 100) {
                t.status = 'warning';
                t.details = `Scroll có frame spike ${perfResult.maxFrame}ms — avg ${perfResult.avgFrame}ms`;
            } else {
                t.status = 'passed';
                t.details = `Scroll mượt: avg frame ${perfResult.avgFrame}ms, max ${perfResult.maxFrame}ms, jank ${perfResult.jankFrames}/${perfResult.totalFrames} ✓`;
            }
        });
    }
}

module.exports = ScrollPositionTests;
