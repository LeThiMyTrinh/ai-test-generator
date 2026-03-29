/**
 * Group 8: Scroll & Lazy Load Tests (7 cases)
 * 8.1 Scroll to bottom
 * 8.2 Lazy load images
 * 8.3 Back-to-top button
 * 8.4 Sticky header
 * 8.5 Infinite scroll
 * 8.6 Scroll position restore
 * 8.7 Parallax smoothness
 */

const { createTestResult, runSafe, takeScreenshot, navigateBack } = require('./testHelpers');

class ScrollLazyLoadTests {
    /**
     * Run all scroll & lazy load tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];

        // 8.1: Scroll to bottom
        results.push(await this._testScrollToBottom(page));

        // 8.2: Lazy load images
        results.push(await this._testLazyLoadImages(page));

        // 8.3: Back-to-top button
        results.push(await this._testBackToTopButton(page));

        // 8.4: Sticky header
        results.push(await this._testStickyHeader(page));

        // 8.5: Infinite scroll
        results.push(await this._testInfiniteScroll(page));

        // 8.6: Scroll position restore
        results.push(await this._testScrollPositionRestore(page, discovery, baseUrl));

        // 8.7: Parallax smoothness
        results.push(await this._testParallaxSmoothness(page));

        return results;
    }

    /**
     * 8.1: Scroll to bottom — page shouldn't crash, content should load
     */
    async _testScrollToBottom(page) {
        const test = createTestResult('scroll', '8.1', 'Scroll to bottom');
        return runSafe(test, async (t) => {
            // Get initial page height
            const beforeHeight = await page.evaluate(() => document.body.scrollHeight);

            // Scroll to bottom in steps
            const viewportHeight = await page.evaluate(() => window.innerHeight);
            let currentScroll = 0;
            const maxSteps = 20;
            let step = 0;

            while (step < maxSteps) {
                currentScroll += viewportHeight;
                await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'auto' }), currentScroll);
                await page.waitForTimeout(100);
                step++;

                const scrollTop = await page.evaluate(() => window.scrollY);
                const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
                if (scrollTop + viewportHeight >= scrollHeight - 10) break;
            }

            await page.waitForTimeout(150);

            // Check page is still responsive
            const pageOk = await page.evaluate(() => {
                return {
                    responsive: !!document.body,
                    finalScrollHeight: document.body.scrollHeight,
                    atBottom: window.scrollY + window.innerHeight >= document.body.scrollHeight - 10,
                };
            }).catch(() => ({ responsive: false }));

            if (!pageOk.responsive) {
                t.status = 'failed';
                t.details = 'Page bị crash/unresponsive khi scroll to bottom!';
            } else {
                t.status = 'passed';
                t.details = `Scroll to bottom OK. Height: ${beforeHeight} → ${pageOk.finalScrollHeight}px. ${step} scroll steps. ${pageOk.atBottom ? 'Reached bottom ✓' : ''}`;
            }

            t.screenshot = await takeScreenshot(page);

            // Scroll back to top
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
            await page.waitForTimeout(100);
        });
    }

    /**
     * 8.2: Lazy load images — check loading="lazy" and actual loading behavior
     */
    async _testLazyLoadImages(page) {
        const test = createTestResult('scroll', '8.2', 'Lazy load images');
        return runSafe(test, async (t) => {
            // Scroll to top first
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
            await page.waitForTimeout(100);

            const imageAudit = await page.evaluate(() => {
                const images = document.querySelectorAll('img');
                let total = 0, withLazy = 0, withoutLazy = 0;
                const belowFold = [];
                const viewportHeight = window.innerHeight;

                images.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;
                    total++;

                    const isLazy = img.getAttribute('loading') === 'lazy';
                    const isBelowFold = rect.top > viewportHeight;

                    if (isLazy) withLazy++;

                    if (isBelowFold && !isLazy) {
                        belowFold.push({
                            src: (img.src || '').substring(0, 60),
                            alt: (img.alt || '').substring(0, 30),
                            top: Math.round(rect.top),
                        });
                    }
                });

                return { total, withLazy, belowFold: belowFold.slice(0, 5) };
            });

            if (imageAudit.total === 0) {
                t.status = 'skipped';
                t.details = 'Không có images trên trang';
                return;
            }

            if (imageAudit.belowFold.length > 3) {
                t.status = 'warning';
                t.details = `${imageAudit.total} images, ${imageAudit.withLazy} có loading="lazy". ${imageAudit.belowFold.length} images below fold thiếu lazy loading: ${imageAudit.belowFold.slice(0, 2).map(i => i.alt || i.src).join(', ')}`;
            } else {
                t.status = 'passed';
                t.details = `${imageAudit.total} images, ${imageAudit.withLazy} có loading="lazy". ${imageAudit.belowFold.length} below-fold images without lazy ✓`;
            }
        });
    }

    /**
     * 8.3: Back-to-top button
     */
    async _testBackToTopButton(page) {
        const test = createTestResult('scroll', '8.3', 'Back-to-top button');
        return runSafe(test, async (t) => {
            // Check if page is long enough to need back-to-top
            const pageHeight = await page.evaluate(() => document.body.scrollHeight);
            const viewportHeight = await page.evaluate(() => window.innerHeight);

            if (pageHeight < viewportHeight * 2) {
                t.status = 'skipped';
                t.details = `Page không đủ dài (${pageHeight}px) — back-to-top không cần thiết`;
                return;
            }

            // Scroll down
            await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'auto' }));
            await page.waitForTimeout(200);

            // Look for back-to-top button
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
                            return {
                                found: true,
                                visible: true,
                                selector: sel,
                                text: el.textContent.trim().substring(0, 30),
                            };
                        }
                        return { found: true, visible: false, selector: sel };
                    }
                }
                return { found: false };
            });

            if (backToTop.found && backToTop.visible) {
                // Try clicking it
                try {
                    await page.click(backToTop.selector);
                    await page.waitForTimeout(200);

                    const scrolledToTop = await page.evaluate(() => window.scrollY < 100);
                    if (scrolledToTop) {
                        t.status = 'passed';
                        t.details = `Back-to-top button "${backToTop.text || backToTop.selector}" hoạt động đúng — scrolled to top ✓`;
                    } else {
                        t.status = 'warning';
                        t.details = `Back-to-top button tìm thấy nhưng click không scroll to top`;
                    }
                } catch {
                    t.status = 'warning';
                    t.details = `Back-to-top button visible nhưng không click được`;
                }
            } else if (backToTop.found) {
                t.status = 'warning';
                t.details = `Back-to-top button tìm thấy (${backToTop.selector}) nhưng không visible sau scroll`;
            } else {
                t.status = 'warning';
                t.details = `Page dài ${pageHeight}px nhưng không có back-to-top button. Nên thêm để cải thiện UX.`;
            }

            t.screenshot = await takeScreenshot(page);

            // Scroll back to top
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
            await page.waitForTimeout(100);
        });
    }

    /**
     * 8.4: Sticky header — header stays visible when scrolling
     */
    async _testStickyHeader(page) {
        const test = createTestResult('scroll', '8.4', 'Sticky header');
        return runSafe(test, async (t) => {
            // Record header position at top
            const headerInfo = await page.evaluate(() => {
                const headers = document.querySelectorAll('header, nav, .navbar, .header, [role="banner"], .sticky-top, .fixed-top');
                for (const h of headers) {
                    const rect = h.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return null;
                    const style = getComputedStyle(h);
                    return {
                        selector: h.id ? `#${h.id}` : (h.tagName === 'HEADER' ? 'header' : (h.tagName === 'NAV' ? 'nav' : `.${h.className.split(' ')[0]}`)),
                        position: style.position,
                        top: rect.top,
                        height: rect.height,
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

            // Scroll down significantly
            await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'auto' }));
            await page.waitForTimeout(150);

            const headerAfterScroll = await page.evaluate((sel) => {
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

            // Scroll back to top
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
            await page.waitForTimeout(100);

            if (!headerAfterScroll) {
                t.status = 'warning';
                t.details = 'Header element biến mất sau scroll';
                return;
            }

            if (headerAfterScroll.isSticky && headerAfterScroll.visible) {
                t.status = 'passed';
                t.details = `Header sticky (position: ${headerAfterScroll.position}) — vẫn visible sau scroll ✓`;
            } else if (headerAfterScroll.visible) {
                t.status = 'passed';
                t.details = `Header visible sau scroll (position: ${headerAfterScroll.position})`;
            } else if (headerInfo.isSticky) {
                t.status = 'failed';
                t.details = `Header có position: ${headerInfo.position} nhưng không visible sau scroll (top: ${headerAfterScroll.top}px)`;
            } else {
                t.status = 'passed';
                t.details = `Header không sticky (position: ${headerInfo.position}) — normal behavior`;
            }
        });
    }

    /**
     * 8.5: Infinite scroll — detect and test dynamic content loading
     */
    async _testInfiniteScroll(page) {
        const test = createTestResult('scroll', '8.5', 'Infinite scroll / dynamic loading');
        return runSafe(test, async (t) => {
            // Record initial content count
            const before = await page.evaluate(() => {
                const items = document.querySelectorAll('article, .card, .item, .post, .product, [class*="list-item"], .grid > *, main li');
                return {
                    itemCount: items.length,
                    bodyHeight: document.body.scrollHeight,
                };
            });

            // Scroll to bottom
            await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }));
            await page.waitForTimeout(150);

            // Check for loading indicators
            const loadingDetected = await page.evaluate(() => {
                const loaders = document.querySelectorAll('.loading, .spinner, .loader, [class*="loading"], [class*="spinner"], .load-more');
                for (const l of loaders) {
                    const s = getComputedStyle(l);
                    if (s.display !== 'none' && s.visibility !== 'hidden') return true;
                }
                return false;
            });

            // Wait for potential content load
            if (loadingDetected) {
                await page.waitForTimeout(200);
            }

            const after = await page.evaluate(() => {
                const items = document.querySelectorAll('article, .card, .item, .post, .product, [class*="list-item"], .grid > *, main li');
                return {
                    itemCount: items.length,
                    bodyHeight: document.body.scrollHeight,
                };
            });

            const newItems = after.itemCount - before.itemCount;
            const heightGrew = after.bodyHeight > before.bodyHeight + 100;

            if (newItems > 0 || heightGrew) {
                t.status = 'passed';
                t.details = `Infinite scroll detected: ${newItems > 0 ? `+${newItems} items` : ''}${heightGrew ? ` height ${before.bodyHeight} → ${after.bodyHeight}px` : ''} ✓`;
            } else if (before.itemCount > 20) {
                t.status = 'warning';
                t.details = `${before.itemCount} items detected nhưng scroll to bottom không load thêm. Có thể cần pagination hoặc load-more button.`;
            } else {
                t.status = 'passed';
                t.details = `Trang static, ${before.itemCount} items. Không có infinite scroll (normal behavior).`;
            }

            // Scroll back to top
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
            await page.waitForTimeout(100);
        });
    }

    /**
     * 8.6: Scroll position restore — after navigate back, scroll position should restore
     */
    async _testScrollPositionRestore(page, discovery, baseUrl) {
        const test = createTestResult('scroll', '8.6', 'Scroll position restore');
        return runSafe(test, async (t) => {
            // Need a link to navigate to
            const internalLink = discovery.navLinks.find(l => !l.isExternal);
            if (!internalLink) {
                t.status = 'skipped';
                t.details = 'Không có internal link để test scroll restore';
                return;
            }

            // Scroll down first
            const targetScroll = 400;
            await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'auto' }), targetScroll);
            await page.waitForTimeout(150);

            const scrollBefore = await page.evaluate(() => window.scrollY);

            // Navigate away
            await page.goto(internalLink.href, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
            await page.waitForTimeout(150);

            // Navigate back
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
            await page.waitForTimeout(100);

            const scrollAfter = await page.evaluate(() => window.scrollY);
            const tolerance = 100; // allow some tolerance

            if (Math.abs(scrollAfter - scrollBefore) <= tolerance) {
                t.status = 'passed';
                t.details = `Scroll position restored: ${scrollBefore}px → navigate → back → ${scrollAfter}px ✓`;
            } else {
                t.status = 'warning';
                t.details = `Scroll position không restore: ${scrollBefore}px → navigate → back → ${scrollAfter}px. Delta: ${Math.abs(scrollAfter - scrollBefore)}px`;
            }

            // Navigate back to base
            await navigateBack(page, baseUrl);
        });
    }
    /**
     * 8.7: Parallax smoothness — detect parallax elements and check scroll performance
     */
    async _testParallaxSmoothness(page) {
        const test = createTestResult('scroll', '8.7', 'Parallax smoothness');
        return runSafe(test, async (t) => {
            // Detect parallax elements
            const parallaxCheck = await page.evaluate(() => {
                const parallaxSelectors = [
                    '.parallax', '[class*="parallax"]', '[data-parallax]',
                    '[data-speed]', '[data-rellax]', '.jarallax',
                    '[style*="background-attachment: fixed"]',
                ];

                const elements = [];
                for (const sel of parallaxSelectors) {
                    document.querySelectorAll(sel).forEach(el => {
                        const rect = el.getBoundingClientRect();
                        if (rect.width === 0) return;
                        elements.push({
                            selector: sel,
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                        });
                    });
                }

                // Also check for background-attachment: fixed (CSS parallax)
                const allElements = document.querySelectorAll('*');
                let fixedBgCount = 0;
                allElements.forEach(el => {
                    if (getComputedStyle(el).backgroundAttachment === 'fixed') {
                        fixedBgCount++;
                    }
                });

                // Check for scroll-linked animations (transform on scroll)
                const hasScrollListener = typeof window.onscroll === 'function' ||
                    document.querySelectorAll('[class*="scroll-animate"], [data-aos], [data-scroll]').length > 0;

                return {
                    parallaxElements: elements,
                    fixedBgCount,
                    hasScrollListener,
                    totalParallax: elements.length + fixedBgCount,
                };
            });

            if (parallaxCheck.totalParallax === 0 && !parallaxCheck.hasScrollListener) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy parallax/scroll-animation elements';
                return;
            }

            // Performance test: scroll and measure frame timing
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

            // Scroll back to top
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
            await page.waitForTimeout(100);

            const details = [];
            if (parallaxCheck.parallaxElements.length > 0) {
                details.push(`${parallaxCheck.parallaxElements.length} parallax elements`);
            }
            if (parallaxCheck.fixedBgCount > 0) {
                details.push(`${parallaxCheck.fixedBgCount} fixed backgrounds`);
            }
            if (parallaxCheck.hasScrollListener) {
                details.push('scroll animations detected');
            }
            details.push(`avg frame: ${perfResult.avgFrame}ms, max: ${perfResult.maxFrame}ms, jank: ${perfResult.jankFrames}/${perfResult.totalFrames}`);

            if (perfResult.jankFrames > 10) {
                t.status = 'warning';
                t.details = `Parallax scroll janky. ${details.join('. ')}. Nên optimize (prefer transform/opacity, avoid layout triggers).`;
            } else if (perfResult.maxFrame > 100) {
                t.status = 'warning';
                t.details = `Parallax có frame spike ${perfResult.maxFrame}ms. ${details.join('. ')}`;
            } else {
                t.status = 'passed';
                t.details = `Parallax scroll smooth. ${details.join('. ')} ✓`;
            }
        });
    }
}

module.exports = ScrollLazyLoadTests;
