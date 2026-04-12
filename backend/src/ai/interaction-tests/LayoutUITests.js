/**
 * Group 1: Layout & UI hiển thị (7 cases)
 * 1.1 Layout không vỡ (check overflow, elements nằm trong viewport)
 * 1.2 Không bị scroll ngang
 * 1.3 Text không tràn
 * 1.4 Button không bị che
 * 1.5 Menu mobile hoạt động đúng
 * 1.6 Animation hoạt động
 * 1.7 Font không bị lỗi
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class LayoutUITests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testLayoutNotBroken(page));
        results.push(await this._testNoHorizontalScroll(page));
        results.push(await this._testTextNotOverflow(page));
        results.push(await this._testButtonNotHidden(page));
        results.push(await this._testMobileMenu(page));
        results.push(await this._testAnimationWorking(page));
        results.push(await this._testFontNotBroken(page));

        return results;
    }

    /**
     * 1.1: Layout không vỡ — check elements overflow viewport
     */
    async _testLayoutNotBroken(page) {
        const test = createTestResult('layoutUI', '1.1', 'Layout không vỡ');
        return runSafe(test, async (t) => {
            const layoutCheck = await page.evaluate(() => {
                const vw = window.innerWidth;
                const issues = [];
                const elements = document.querySelectorAll('div, section, main, article, aside, header, footer, nav');

                elements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return;

                    // Check if element overflows viewport width
                    if (rect.right > vw + 5) {
                        issues.push({
                            tag: el.tagName.toLowerCase(),
                            id: el.id || '',
                            classes: el.className.toString().substring(0, 40),
                            overflow: Math.round(rect.right - vw),
                        });
                    }
                });

                return { total: elements.length, issues: issues.slice(0, 5) };
            });

            if (layoutCheck.issues.length > 0) {
                t.status = 'failed';
                t.details = `${layoutCheck.issues.length} elements tràn khỏi viewport: ${layoutCheck.issues.slice(0, 3).map(i => `${i.tag}${i.id ? '#' + i.id : ''} (+${i.overflow}px)`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${layoutCheck.total} layout elements kiểm tra — không có element nào tràn viewport ✓`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 1.2: Không bị scroll ngang
     */
    async _testNoHorizontalScroll(page) {
        const test = createTestResult('layoutUI', '1.2', 'Không bị scroll ngang');
        return runSafe(test, async (t) => {
            const scrollCheck = await page.evaluate(() => {
                const bodyWidth = document.body.scrollWidth;
                const viewportWidth = window.innerWidth;
                const htmlWidth = document.documentElement.scrollWidth;
                const maxWidth = Math.max(bodyWidth, htmlWidth);

                return {
                    bodyWidth,
                    viewportWidth,
                    htmlWidth,
                    hasHorizontalScroll: maxWidth > viewportWidth + 2,
                    overflow: maxWidth - viewportWidth,
                };
            });

            if (scrollCheck.hasHorizontalScroll) {
                t.status = 'failed';
                t.details = `Trang bị scroll ngang: body=${scrollCheck.bodyWidth}px, viewport=${scrollCheck.viewportWidth}px (tràn ${scrollCheck.overflow}px)`;
            } else {
                t.status = 'passed';
                t.details = `Không có scroll ngang: body=${scrollCheck.bodyWidth}px, viewport=${scrollCheck.viewportWidth}px ✓`;
            }
        });
    }

    /**
     * 1.3: Text không tràn
     */
    async _testTextNotOverflow(page) {
        const test = createTestResult('layoutUI', '1.3', 'Text không tràn');
        return runSafe(test, async (t) => {
            const textCheck = await page.evaluate(() => {
                const overflowElements = [];
                const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, li, td, th, label, div');

                textElements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    const style = getComputedStyle(el);
                    if (style.display === 'none') return;

                    // Check if text content overflows its container
                    const isOverflowHidden = style.overflow === 'hidden' || style.overflowX === 'hidden';
                    const isTextOverflow = style.textOverflow === 'ellipsis';

                    // Check actual overflow: scrollWidth > clientWidth means text overflows
                    if (el.scrollWidth > el.clientWidth + 2 && !isOverflowHidden && !isTextOverflow) {
                        const text = el.textContent.trim().substring(0, 40);
                        if (text.length > 5) {
                            overflowElements.push({
                                tag: el.tagName.toLowerCase(),
                                text,
                                scrollWidth: el.scrollWidth,
                                clientWidth: el.clientWidth,
                                overflow: el.scrollWidth - el.clientWidth,
                            });
                        }
                    }
                });

                return { checked: textElements.length, overflows: overflowElements.slice(0, 5) };
            });

            if (textCheck.overflows.length > 3) {
                t.status = 'failed';
                t.details = `${textCheck.overflows.length} elements bị tràn chữ: ${textCheck.overflows.slice(0, 3).map(o => `${o.tag} "${o.text}" (+${o.overflow}px)`).join('; ')}`;
            } else if (textCheck.overflows.length > 0) {
                t.status = 'warning';
                t.details = `${textCheck.overflows.length} elements có thể bị tràn chữ: ${textCheck.overflows.map(o => `${o.tag} "${o.text}"`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `Kiểm tra ${textCheck.checked} text elements — không bị tràn chữ ✓`;
            }
        });
    }

    /**
     * 1.4: Button không bị che
     */
    async _testButtonNotHidden(page) {
        const test = createTestResult('layoutUI', '1.4', 'Button không bị che');
        return runSafe(test, async (t) => {
            const buttonCheck = await page.evaluate(() => {
                const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], .btn');
                const issues = [];
                let total = 0;

                buttons.forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    const style = getComputedStyle(btn);
                    if (style.display === 'none') return;
                    total++;

                    // Check if button is partially or fully hidden
                    const vw = window.innerWidth;
                    const vh = window.innerHeight;
                    const isPartiallyHidden = rect.right > vw || rect.left < 0 || rect.bottom > document.body.scrollHeight;

                    // Check z-index overlap: get element at button center
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    if (centerX >= 0 && centerX < vw && centerY >= 0 && centerY < vh) {
                        const topElement = document.elementFromPoint(centerX, centerY);
                        const isBlocked = topElement && topElement !== btn && !btn.contains(topElement) && !topElement.contains(btn);

                        if (isBlocked) {
                            issues.push({
                                text: btn.textContent.trim().substring(0, 30),
                                reason: 'bị che bởi element khác',
                                blocker: topElement.tagName.toLowerCase(),
                            });
                        }
                    }

                    if (isPartiallyHidden && style.position !== 'fixed' && style.position !== 'sticky') {
                        issues.push({
                            text: btn.textContent.trim().substring(0, 30),
                            reason: 'nằm ngoài viewport',
                        });
                    }
                });

                return { total, issues: issues.slice(0, 5) };
            });

            if (buttonCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy buttons trên trang';
                return;
            }

            if (buttonCheck.issues.length > 0) {
                t.status = 'failed';
                t.details = `${buttonCheck.issues.length}/${buttonCheck.total} buttons bị che: ${buttonCheck.issues.slice(0, 3).map(i => `"${i.text}" — ${i.reason}`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${buttonCheck.total} buttons đều visible và không bị che ✓`;
            }
        });
    }

    /**
     * 1.5: Menu mobile hoạt động đúng
     */
    async _testMobileMenu(page) {
        const test = createTestResult('layoutUI', '1.5', 'Menu mobile hoạt động đúng');
        return runSafe(test, async (t) => {
            // Discover hamburger / mobile menu trigger
            const hamburger = await page.evaluate(() => {
                const selectors = [
                    '.navbar-toggler', '.hamburger', '.menu-toggle', '.mobile-menu-toggle',
                    '.nav-toggle', 'button.toggle',
                    '[data-toggle="collapse"][data-target*="nav"]',
                    '[data-bs-toggle="collapse"][data-bs-target*="nav"]',
                    'button[aria-label*="menu"]', 'button[aria-label*="Menu"]',
                    'button[aria-expanded][class*="nav"]',
                    '.burger', '#menu-toggle', '#hamburger',
                ];

                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        const style = getComputedStyle(el);
                        return {
                            found: true,
                            selector: el.id ? `#${el.id}` : sel,
                            isVisible: rect.width > 0 && style.display !== 'none' && style.visibility !== 'hidden',
                            ariaExpanded: el.getAttribute('aria-expanded'),
                        };
                    }
                }
                return { found: false };
            });

            if (!hamburger.found) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy hamburger/mobile menu trigger (có thể chỉ hiện trên mobile viewport)';
                return;
            }

            if (!hamburger.isVisible) {
                t.status = 'passed';
                t.details = 'Hamburger trigger tồn tại nhưng ẩn ở desktop viewport (bình thường) ✓';
                return;
            }

            // Test open
            const trigger = await page.$(hamburger.selector).catch(() => null);
            if (!trigger) {
                t.status = 'warning';
                t.details = 'Hamburger trigger không tìm thấy trong DOM';
                return;
            }

            await trigger.click();
            await page.waitForTimeout(200);

            const isOpen = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el && el.getAttribute('aria-expanded') === 'true') return true;
                const menus = document.querySelectorAll('.navbar-collapse.show, .mobile-menu.open, .offcanvas.show, .nav-menu.show');
                return menus.length > 0;
            }, hamburger.selector);

            if (isOpen) {
                // Test close
                await trigger.click();
                await page.waitForTimeout(200);

                const isClosed = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (el && el.getAttribute('aria-expanded') === 'false') return true;
                    const menus = document.querySelectorAll('.navbar-collapse.show, .mobile-menu.open, .offcanvas.show');
                    return menus.length === 0;
                }, hamburger.selector);

                t.status = 'passed';
                t.details = `Menu mobile mở/đóng ${isClosed ? 'đúng' : '(mở OK, đóng chưa xác nhận)'} ✓`;
            } else {
                t.status = 'failed';
                t.details = 'Click hamburger nhưng menu không mở';
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 1.6: Animation hoạt động
     */
    async _testAnimationWorking(page) {
        const test = createTestResult('layoutUI', '1.6', 'Animation hoạt động');
        return runSafe(test, async (t) => {
            const animCheck = await page.evaluate(() => {
                const results = {
                    cssAnimations: 0,
                    cssTransitions: 0,
                    keyframes: 0,
                    issues: [],
                };

                // Check for CSS animations and transitions on visible elements
                const allElements = document.querySelectorAll('*');
                allElements.forEach(el => {
                    const style = getComputedStyle(el);
                    if (style.display === 'none') return;

                    if (style.animationName && style.animationName !== 'none') {
                        results.cssAnimations++;
                        // Check if animation is paused
                        if (style.animationPlayState === 'paused') {
                            results.issues.push(`Animation "${style.animationName}" bị paused`);
                        }
                    }

                    if (style.transitionProperty && style.transitionProperty !== 'none' && style.transitionProperty !== 'all 0s ease 0s') {
                        results.cssTransitions++;
                    }
                });

                // Count @keyframes in stylesheets
                try {
                    for (const sheet of document.styleSheets) {
                        try {
                            for (const rule of sheet.cssRules || []) {
                                if (rule.type === CSSRule.KEYFRAMES_RULE) {
                                    results.keyframes++;
                                }
                            }
                        } catch { /* cross-origin stylesheet */ }
                    }
                } catch { /* access denied */ }

                return results;
            });

            const total = animCheck.cssAnimations + animCheck.cssTransitions;

            if (total === 0 && animCheck.keyframes === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy CSS animations/transitions trên trang';
                return;
            }

            if (animCheck.issues.length > 0) {
                t.status = 'warning';
                t.details = `${animCheck.cssAnimations} animations, ${animCheck.cssTransitions} transitions, ${animCheck.keyframes} @keyframes. Issues: ${animCheck.issues.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${animCheck.cssAnimations} animations, ${animCheck.cssTransitions} transitions, ${animCheck.keyframes} @keyframes — hoạt động ✓`;
            }
        });
    }

    /**
     * 1.7: Font không bị lỗi
     */
    async _testFontNotBroken(page) {
        const test = createTestResult('layoutUI', '1.7', 'Font không bị lỗi');
        return runSafe(test, async (t) => {
            const fontCheck = await page.evaluate(async () => {
                const results = {
                    fontsReady: false,
                    fontsLoaded: [],
                    fontsFailed: [],
                    usedFonts: new Set(),
                    fallbackDetected: false,
                };

                // Check document.fonts API
                try {
                    await document.fonts.ready;
                    results.fontsReady = true;

                    document.fonts.forEach(font => {
                        if (font.status === 'loaded') {
                            results.fontsLoaded.push(font.family);
                        } else if (font.status === 'error') {
                            results.fontsFailed.push(font.family);
                        }
                    });
                } catch { /* fonts API not available */ }

                // Check what fonts are used on text elements
                const textElements = document.querySelectorAll('h1, h2, h3, p, a, span, button, li');
                textElements.forEach(el => {
                    const style = getComputedStyle(el);
                    if (style.display === 'none') return;
                    const fontFamily = style.fontFamily;
                    if (fontFamily) {
                        results.usedFonts.add(fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
                    }
                });

                // Check for common fallback fonts only (may indicate web font failed)
                const genericFonts = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];
                const usedArr = [...results.usedFonts];
                results.fallbackDetected = usedArr.length > 0 && usedArr.every(f => genericFonts.includes(f.toLowerCase()));

                return {
                    fontsReady: results.fontsReady,
                    loaded: [...new Set(results.fontsLoaded)].slice(0, 10),
                    failed: [...new Set(results.fontsFailed)].slice(0, 5),
                    usedFonts: usedArr.slice(0, 10),
                    fallbackDetected: results.fallbackDetected,
                };
            });

            if (fontCheck.failed.length > 0) {
                t.status = 'failed';
                t.details = `${fontCheck.failed.length} fonts bị lỗi: ${fontCheck.failed.join(', ')}. Loaded: ${fontCheck.loaded.length}`;
            } else if (fontCheck.fallbackDetected) {
                t.status = 'warning';
                t.details = `Chỉ sử dụng generic fonts (${fontCheck.usedFonts.join(', ')}). Web fonts có thể chưa load.`;
            } else if (!fontCheck.fontsReady) {
                t.status = 'warning';
                t.details = 'document.fonts API không available — không kiểm tra được font loading';
            } else {
                t.status = 'passed';
                t.details = `Fonts ready. ${fontCheck.loaded.length} fonts loaded: ${fontCheck.loaded.slice(0, 5).join(', ')} ✓`;
            }
        });
    }
}

module.exports = LayoutUITests;
