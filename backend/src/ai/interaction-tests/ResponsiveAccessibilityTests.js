/**
 * Group 11: Responsive Menu & Accessibility Tests (9 cases)
 * 11.1 Hamburger menu open
 * 11.2 Hamburger menu close
 * 11.3 Menu overlay (backdrop)
 * 11.4 Tab order (logical focus order)
 * 11.5 Focus visible (focus indicator)
 * 11.6 Skip navigation link
 * 11.7 ARIA labels on interactive elements
 * 11.8 Touch target size (>=44x44px)
 * 11.9 Viewport meta tag check
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class ResponsiveAccessibilityTests {
    /**
     * Run all responsive & accessibility tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];

        // Discover hamburger / mobile menu
        const hamburger = await this._discoverHamburger(page);

        // 11.1: Hamburger open
        results.push(await this._testHamburgerOpen(page, hamburger));

        // 11.2: Hamburger close
        results.push(await this._testHamburgerClose(page, hamburger));

        // 11.3: Menu overlay
        results.push(await this._testMenuOverlay(page, hamburger));

        // 11.4: Tab order
        results.push(await this._testTabOrder(page));

        // 11.5: Focus visible
        results.push(await this._testFocusVisible(page));

        // 11.6: Skip nav link
        results.push(await this._testSkipNavLink(page));

        // 11.7: ARIA labels
        results.push(await this._testAriaLabels(page));

        // 11.8: Touch target size
        results.push(await this._testTouchTargetSize(page));

        // 11.9: Viewport meta tag
        results.push(await this._testViewportMeta(page));

        return results;
    }

    /**
     * Discover hamburger / mobile menu trigger
     */
    async _discoverHamburger(page) {
        return page.evaluate(() => {
            const selectors = [
                '.navbar-toggler',
                '.hamburger',
                '.menu-toggle',
                '.mobile-menu-toggle',
                '.nav-toggle',
                'button.toggle',
                '[data-toggle="collapse"][data-target*="nav"]',
                '[data-bs-toggle="collapse"][data-bs-target*="nav"]',
                'button[aria-label*="menu"]',
                'button[aria-label*="Menu"]',
                'button[aria-label*="navigation"]',
                'button[aria-expanded][class*="nav"]',
                '.burger',
                '#menu-toggle',
                '#hamburger',
                '.header-menu-toggle',
            ];

            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const style = getComputedStyle(el);
                    // Hamburger is often hidden on desktop, visible on mobile
                    const isVisible = rect.width > 0 && style.display !== 'none' && style.visibility !== 'hidden';
                    const target = el.getAttribute('data-bs-target') || el.getAttribute('data-target') || el.getAttribute('aria-controls') || '';

                    return {
                        found: true,
                        selector: el.id ? `#${el.id}` : sel,
                        isVisible,
                        target,
                        ariaExpanded: el.getAttribute('aria-expanded'),
                        ariaLabel: el.getAttribute('aria-label') || '',
                        text: el.textContent.trim().substring(0, 30),
                    };
                }
            }

            // Fallback: look for any button with 3 horizontal lines (hamburger icon)
            const buttons = document.querySelectorAll('button, [role="button"]');
            for (const btn of buttons) {
                const rect = btn.getBoundingClientRect();
                if (rect.width === 0) continue;

                // Check if button contains hamburger-like icon (3 spans/lines)
                const spans = btn.querySelectorAll('span');
                const svgs = btn.querySelectorAll('svg');
                const hasHamburgerIcon = spans.length >= 3 || svgs.length > 0;
                const textContent = btn.textContent.trim().toLowerCase();
                const isMenuButton = textContent === '' || textContent === 'menu' || textContent === '☰';

                if (hasHamburgerIcon && isMenuButton) {
                    return {
                        found: true,
                        selector: btn.id ? `#${btn.id}` : 'button',
                        isVisible: getComputedStyle(btn).display !== 'none',
                        target: btn.getAttribute('aria-controls') || '',
                        ariaExpanded: btn.getAttribute('aria-expanded'),
                        ariaLabel: btn.getAttribute('aria-label') || '',
                        text: btn.textContent.trim().substring(0, 30),
                    };
                }
            }

            return { found: false };
        });
    }

    /**
     * Check if mobile menu is currently open
     */
    async _isMenuOpen(page, hamburger) {
        if (!hamburger || !hamburger.found) return false;
        return page.evaluate((target, sel) => {
            // Check aria-expanded on trigger
            const trigger = document.querySelector(sel);
            if (trigger && trigger.getAttribute('aria-expanded') === 'true') return true;

            // Check target visibility
            if (target) {
                const menu = document.querySelector(target);
                if (menu) {
                    const s = getComputedStyle(menu);
                    if (s.display !== 'none' && s.visibility !== 'hidden' &&
                        (menu.classList.contains('show') || menu.classList.contains('open') || menu.classList.contains('active'))) {
                        return true;
                    }
                }
            }

            // Check common mobile menu selectors
            const mobileMenus = document.querySelectorAll('.mobile-menu.open, .mobile-menu.active, .nav-menu.show, .offcanvas.show, .sidebar.open');
            return mobileMenus.length > 0;
        }, hamburger.target, hamburger.selector);
    }

    /**
     * 11.1: Hamburger menu open
     */
    async _testHamburgerOpen(page, hamburger) {
        const test = createTestResult('responsive_a11y', '11.1', 'Hamburger menu open');
        return runSafe(test, async (t) => {
            if (!hamburger.found) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy hamburger/mobile menu trigger';
                return;
            }

            if (!hamburger.isVisible) {
                t.status = 'skipped';
                t.details = 'Hamburger trigger tồn tại nhưng ẩn (có thể chỉ hiện trên mobile viewport). Test trên mobile viewport để kiểm tra.';
                return;
            }

            const trigger = await page.$(hamburger.selector).catch(() => null);
            if (!trigger) {
                t.status = 'skipped';
                t.details = 'Trigger không tìm thấy trong DOM';
                return;
            }

            await trigger.click();
            await page.waitForTimeout(600);

            const isOpen = await this._isMenuOpen(page, hamburger);

            if (isOpen) {
                t.status = 'passed';
                t.details = `Hamburger menu mở thành công ✓ (trigger: ${hamburger.selector})`;
                t.screenshot = await takeScreenshot(page);
            } else {
                // Check if any menu-like element appeared
                const anyMenuVisible = await page.evaluate(() => {
                    const menus = document.querySelectorAll('nav, .nav, .menu, .mobile-menu, .offcanvas, [role="navigation"]');
                    for (const m of menus) {
                        const s = getComputedStyle(m);
                        if (s.display !== 'none' && s.visibility !== 'hidden') return m.textContent.trim().substring(0, 50);
                    }
                    return null;
                });

                if (anyMenuVisible) {
                    t.status = 'passed';
                    t.details = `Click trigger → menu content visible: "${anyMenuVisible}"`;
                } else {
                    t.status = 'failed';
                    t.details = 'Click hamburger nhưng menu không xuất hiện';
                }
                t.screenshot = await takeScreenshot(page);
            }
        });
    }

    /**
     * 11.2: Hamburger menu close
     */
    async _testHamburgerClose(page, hamburger) {
        const test = createTestResult('responsive_a11y', '11.2', 'Hamburger menu close');
        return runSafe(test, async (t) => {
            if (!hamburger.found || !hamburger.isVisible) {
                t.status = 'skipped';
                t.details = 'Hamburger không available';
                return;
            }

            // Ensure menu is open
            const wasOpen = await this._isMenuOpen(page, hamburger);
            if (!wasOpen) {
                const trigger = await page.$(hamburger.selector).catch(() => null);
                if (trigger) {
                    await trigger.click();
                    await page.waitForTimeout(600);
                }
            }

            const isOpenNow = await this._isMenuOpen(page, hamburger);
            if (!isOpenNow) {
                t.status = 'skipped';
                t.details = 'Menu không mở được để test close';
                return;
            }

            // Try closing: click hamburger again
            const trigger = await page.$(hamburger.selector).catch(() => null);
            if (trigger) {
                await trigger.click();
                await page.waitForTimeout(600);
            }

            let isClosed = !(await this._isMenuOpen(page, hamburger));

            if (!isClosed) {
                // Try close button inside menu
                const closeBtn = await page.$('.offcanvas .btn-close, .mobile-menu .close, .nav-close, [data-bs-dismiss="offcanvas"]').catch(() => null);
                if (closeBtn) {
                    await closeBtn.click();
                    await page.waitForTimeout(500);
                    isClosed = !(await this._isMenuOpen(page, hamburger));
                }
            }

            if (!isClosed) {
                // Try ESC
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
                isClosed = !(await this._isMenuOpen(page, hamburger));
            }

            if (isClosed) {
                t.status = 'passed';
                t.details = 'Hamburger menu đóng thành công ✓';
            } else {
                t.status = 'failed';
                t.details = 'Menu không đóng được bằng click/close button/ESC';
            }
        });
    }

    /**
     * 11.3: Menu overlay — check backdrop and click-outside close
     */
    async _testMenuOverlay(page, hamburger) {
        const test = createTestResult('responsive_a11y', '11.3', 'Menu overlay/backdrop');
        return runSafe(test, async (t) => {
            if (!hamburger.found || !hamburger.isVisible) {
                t.status = 'skipped';
                t.details = 'Hamburger không available';
                return;
            }

            // Open menu
            const trigger = await page.$(hamburger.selector).catch(() => null);
            if (trigger) {
                await trigger.click();
                await page.waitForTimeout(600);
            }

            const isOpen = await this._isMenuOpen(page, hamburger);
            if (!isOpen) {
                t.status = 'skipped';
                t.details = 'Menu không mở được';
                return;
            }

            // Check for overlay/backdrop
            const overlayCheck = await page.evaluate(() => {
                const overlaySelectors = [
                    '.offcanvas-backdrop', '.modal-backdrop', '.overlay',
                    '.menu-overlay', '.backdrop', '[class*="backdrop"]',
                    '[class*="overlay"]',
                ];

                for (const sel of overlaySelectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const s = getComputedStyle(el);
                        if (s.display !== 'none' && s.visibility !== 'hidden') {
                            return { found: true, selector: sel };
                        }
                    }
                }

                // Check for body overlay class
                const body = document.body;
                if (body.classList.contains('overlay-open') || body.classList.contains('menu-open') ||
                    body.classList.contains('no-scroll') || getComputedStyle(body).overflow === 'hidden') {
                    return { found: true, selector: 'body.overlay' };
                }

                return { found: false };
            });

            if (overlayCheck.found) {
                // Try clicking overlay to close
                await page.mouse.click(10, 10);
                await page.waitForTimeout(600);
                const closedByOverlay = !(await this._isMenuOpen(page, hamburger));

                t.status = 'passed';
                t.details = `Overlay tìm thấy (${overlayCheck.selector}). ${closedByOverlay ? 'Click overlay đóng menu ✓' : 'Click overlay không đóng menu (có thể intentional)'}`;
            } else {
                t.status = 'warning';
                t.details = 'Menu mở nhưng không có overlay/backdrop. Nên thêm để cải thiện UX.';
            }

            // Ensure menu is closed for next tests
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            if (await this._isMenuOpen(page, hamburger)) {
                const tr = await page.$(hamburger.selector).catch(() => null);
                if (tr) await tr.click().catch(() => {});
                await page.waitForTimeout(300);
            }
        });
    }

    /**
     * 11.4: Tab order — tab through page should have logical focus order
     */
    async _testTabOrder(page) {
        const test = createTestResult('responsive_a11y', '11.4', 'Tab order (logical focus)');
        return runSafe(test, async (t) => {
            // Scroll to top and focus body
            await page.evaluate(() => {
                window.scrollTo({ top: 0 });
                document.body.focus();
            });
            await page.waitForTimeout(300);

            // Tab through first 15 interactive elements
            const focusOrder = [];
            for (let i = 0; i < 15; i++) {
                await page.keyboard.press('Tab');
                await page.waitForTimeout(150);

                const focusedEl = await page.evaluate(() => {
                    const el = document.activeElement;
                    if (!el || el === document.body) return null;
                    const rect = el.getBoundingClientRect();
                    return {
                        tag: el.tagName.toLowerCase(),
                        text: (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().substring(0, 30),
                        id: el.id || '',
                        tabIndex: el.tabIndex,
                        top: Math.round(rect.top),
                        left: Math.round(rect.left),
                        isVisible: rect.width > 0 && rect.height > 0,
                    };
                });

                if (focusedEl) {
                    focusOrder.push(focusedEl);
                }
            }

            if (focusOrder.length === 0) {
                t.status = 'failed';
                t.details = 'Không có element nào nhận focus khi Tab — có thể tất cả interactive elements thiếu tabindex';
                return;
            }

            // Check for logical order issues
            const issues = [];

            // Check if focus goes top-to-bottom generally
            let prevTop = -Infinity;
            let orderBreaks = 0;
            for (let i = 1; i < focusOrder.length; i++) {
                if (focusOrder[i].top < prevTop - 100) {
                    orderBreaks++;
                }
                prevTop = focusOrder[i].top;
            }

            if (orderBreaks > 3) {
                issues.push(`Focus nhảy lên-xuống ${orderBreaks} lần — tab order có thể không logical`);
            }

            // Check for hidden elements getting focus
            const hiddenFocus = focusOrder.filter(el => !el.isVisible);
            if (hiddenFocus.length > 0) {
                issues.push(`${hiddenFocus.length} hidden elements nhận focus`);
            }

            // Check for positive tabindex (anti-pattern)
            const positiveTabindex = focusOrder.filter(el => el.tabIndex > 0);
            if (positiveTabindex.length > 0) {
                issues.push(`${positiveTabindex.length} elements có tabindex > 0 (anti-pattern, nên dùng 0 hoặc -1)`);
            }

            const focusPath = focusOrder.slice(0, 8).map(el => `${el.tag}${el.id ? '#' + el.id : ''}`).join(' → ');

            if (issues.length === 0) {
                t.status = 'passed';
                t.details = `Tab order logical. ${focusOrder.length} elements nhận focus: ${focusPath} ✓`;
            } else {
                t.status = 'warning';
                t.details = `${focusOrder.length} elements. Issues: ${issues.join('; ')}. Path: ${focusPath}`;
            }
        });
    }

    /**
     * 11.5: Focus visible — focus indicator should be visible
     */
    async _testFocusVisible(page) {
        const test = createTestResult('responsive_a11y', '11.5', 'Focus visible indicator');
        return runSafe(test, async (t) => {
            await page.evaluate(() => {
                window.scrollTo({ top: 0 });
                document.body.focus();
            });
            await page.waitForTimeout(200);

            const focusResults = [];

            for (let i = 0; i < 8; i++) {
                await page.keyboard.press('Tab');
                await page.waitForTimeout(200);

                const focusStyle = await page.evaluate(() => {
                    const el = document.activeElement;
                    if (!el || el === document.body) return null;

                    const style = getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0) return null;

                    // Check for focus indicators
                    const outline = style.outline;
                    const outlineWidth = parseFloat(style.outlineWidth) || 0;
                    const outlineStyle = style.outlineStyle;
                    const boxShadow = style.boxShadow;
                    const borderColor = style.borderColor;

                    const hasOutline = outlineStyle !== 'none' && outlineWidth > 0;
                    const hasBoxShadow = boxShadow !== 'none' && boxShadow !== '';
                    const hasFocusClass = el.classList.contains('focus') || el.classList.contains('focused');

                    // Check :focus-visible pseudo-class effect by comparing with a non-focused sibling
                    const hasFocusIndicator = hasOutline || hasBoxShadow || hasFocusClass;

                    return {
                        tag: el.tagName.toLowerCase(),
                        text: (el.textContent || '').trim().substring(0, 25),
                        hasOutline,
                        hasBoxShadow,
                        outline: outline,
                        hasFocusIndicator,
                    };
                });

                if (focusStyle) {
                    focusResults.push(focusStyle);
                }
            }

            if (focusResults.length === 0) {
                t.status = 'failed';
                t.details = 'Không có elements nhận focus để kiểm tra indicator';
                return;
            }

            const withIndicator = focusResults.filter(r => r.hasFocusIndicator);
            const withoutIndicator = focusResults.filter(r => !r.hasFocusIndicator);

            if (withoutIndicator.length === 0) {
                t.status = 'passed';
                t.details = `${focusResults.length}/${focusResults.length} focused elements có visible indicator ✓`;
            } else if (withoutIndicator.length <= 2) {
                t.status = 'warning';
                t.details = `${withIndicator.length}/${focusResults.length} elements có focus indicator. Thiếu: ${withoutIndicator.map(r => `${r.tag} "${r.text}"`).join(', ')}`;
            } else {
                t.status = 'failed';
                t.details = `${withoutIndicator.length}/${focusResults.length} elements THIẾU focus indicator. Keyboard users không thấy focus ở đâu. Elements: ${withoutIndicator.slice(0, 3).map(r => `${r.tag} "${r.text}"`).join(', ')}`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 11.6: Skip navigation link — should have "Skip to content" link
     */
    async _testSkipNavLink(page) {
        const test = createTestResult('responsive_a11y', '11.6', 'Skip navigation link');
        return runSafe(test, async (t) => {
            const skipLink = await page.evaluate(() => {
                // Check for skip links (usually first link in body, hidden until focused)
                const candidates = document.querySelectorAll('a[href="#main"], a[href="#content"], a[href="#main-content"], a.skip-link, a.skip-nav, a.skip-to-content, [class*="skip"]');

                for (const a of candidates) {
                    return {
                        found: true,
                        text: a.textContent.trim().substring(0, 50),
                        href: a.getAttribute('href'),
                        selector: a.id ? `#${a.id}` : `a[href="${a.getAttribute('href')}"]`,
                    };
                }

                // Also check first few links
                const firstLinks = document.querySelectorAll('a');
                for (let i = 0; i < Math.min(5, firstLinks.length); i++) {
                    const text = firstLinks[i].textContent.trim().toLowerCase();
                    if (text.includes('skip') || text.includes('bỏ qua') || text.includes('chuyển đến')) {
                        return {
                            found: true,
                            text: firstLinks[i].textContent.trim().substring(0, 50),
                            href: firstLinks[i].getAttribute('href'),
                            selector: firstLinks[i].id ? `#${firstLinks[i].id}` : 'a',
                        };
                    }
                }

                return { found: false };
            });

            if (skipLink.found) {
                // Verify the target exists
                const targetExists = await page.evaluate((href) => {
                    if (!href || !href.startsWith('#')) return false;
                    const id = href.substring(1);
                    return !!document.getElementById(id);
                }, skipLink.href);

                if (targetExists) {
                    t.status = 'passed';
                    t.details = `Skip link "${skipLink.text}" → ${skipLink.href} (target exists) ✓`;
                } else {
                    t.status = 'warning';
                    t.details = `Skip link "${skipLink.text}" tìm thấy nhưng target ${skipLink.href} không tồn tại`;
                }
            } else {
                t.status = 'warning';
                t.details = 'Không có "Skip to content" link. Nên thêm để keyboard users có thể bỏ qua navigation.';
            }
        });
    }

    /**
     * 11.7: ARIA labels — interactive elements should have accessible names
     */
    async _testAriaLabels(page) {
        const test = createTestResult('responsive_a11y', '11.7', 'ARIA labels audit');
        return runSafe(test, async (t) => {
            const audit = await page.evaluate(() => {
                const results = {
                    total: 0,
                    withLabel: 0,
                    withoutLabel: [],
                    issues: [],
                };

                // Check all interactive elements
                const interactiveSelectors = 'button, a, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"]';

                document.querySelectorAll(interactiveSelectors).forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;
                    results.total++;

                    // Determine accessible name
                    const text = el.textContent.trim();
                    const ariaLabel = el.getAttribute('aria-label');
                    const ariaLabelledby = el.getAttribute('aria-labelledby');
                    const title = el.getAttribute('title');
                    const alt = el.getAttribute('alt'); // for input type=image
                    const placeholder = el.getAttribute('placeholder');
                    const associatedLabel = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
                    const parentLabel = el.closest('label');

                    const hasAccessibleName = !!(text || ariaLabel || ariaLabelledby || title || alt || (associatedLabel && associatedLabel.textContent.trim()) || (parentLabel && parentLabel.textContent.trim()));

                    // For inputs, placeholder alone is not sufficient
                    const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
                    const onlyHasPlaceholder = isInput && !hasAccessibleName && !!placeholder;

                    if (hasAccessibleName) {
                        results.withLabel++;
                    } else if (onlyHasPlaceholder) {
                        results.issues.push({
                            tag: el.tagName.toLowerCase(),
                            type: el.type || '',
                            name: el.name || el.id || '',
                            issue: 'placeholder-only (cần label hoặc aria-label)',
                        });
                    } else {
                        results.withoutLabel.push({
                            tag: el.tagName.toLowerCase(),
                            type: el.type || '',
                            name: el.name || el.id || '',
                            classes: el.className.toString().substring(0, 40),
                            html: el.outerHTML.substring(0, 60),
                        });
                    }
                });

                // Check for landmark roles
                const hasMain = !!document.querySelector('main, [role="main"]');
                const hasNav = !!document.querySelector('nav, [role="navigation"]');
                const hasBanner = !!document.querySelector('header, [role="banner"]');
                const hasContentinfo = !!document.querySelector('footer, [role="contentinfo"]');
                const hasLang = !!document.documentElement.getAttribute('lang');

                results.landmarks = { hasMain, hasNav, hasBanner, hasContentinfo, hasLang };

                return results;
            });

            const issues = [];

            // Report unlabeled elements
            if (audit.withoutLabel.length > 0) {
                issues.push(`${audit.withoutLabel.length} interactive elements thiếu accessible name: ${audit.withoutLabel.slice(0, 3).map(el => `${el.tag}${el.name ? '[' + el.name + ']' : ''}`).join(', ')}`);
            }

            // Report placeholder-only inputs
            if (audit.issues.length > 0) {
                issues.push(`${audit.issues.length} inputs chỉ có placeholder (cần label): ${audit.issues.slice(0, 2).map(i => i.name || i.tag).join(', ')}`);
            }

            // Report missing landmarks
            const missingLandmarks = [];
            if (!audit.landmarks.hasMain) missingLandmarks.push('<main>');
            if (!audit.landmarks.hasNav) missingLandmarks.push('<nav>');
            if (!audit.landmarks.hasLang) missingLandmarks.push('html[lang]');
            if (missingLandmarks.length > 0) {
                issues.push(`Thiếu landmarks: ${missingLandmarks.join(', ')}`);
            }

            const labelRate = audit.total > 0 ? Math.round(audit.withLabel / audit.total * 100) : 100;

            if (issues.length === 0) {
                t.status = 'passed';
                t.details = `${audit.total} interactive elements, ${labelRate}% có accessible name. Landmarks OK ✓`;
            } else if (audit.withoutLabel.length > 5 || !audit.landmarks.hasLang) {
                t.status = 'failed';
                t.details = `${audit.total} elements, ${labelRate}% labeled. ${issues.join('; ')}`;
            } else {
                t.status = 'warning';
                t.details = `${audit.total} elements, ${labelRate}% labeled. ${issues.join('; ')}`;
            }
        });
    }
    /**
     * 11.8: Touch target size — interactive elements should be >= 44x44px
     */
    async _testTouchTargetSize(page) {
        const test = createTestResult('responsive_a11y', '11.8', 'Touch target size (>=44x44px)');
        return runSafe(test, async (t) => {
            const audit = await page.evaluate(() => {
                const minSize = 44;
                const results = {
                    total: 0,
                    tooSmall: [],
                    ok: 0,
                };

                const interactiveSelectors = 'button, a, input[type="checkbox"], input[type="radio"], select, [role="button"], [role="tab"], [role="menuitem"]';

                document.querySelectorAll(interactiveSelectors).forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    // Skip hidden elements
                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return;

                    results.total++;

                    if (rect.width < minSize || rect.height < minSize) {
                        results.tooSmall.push({
                            tag: el.tagName.toLowerCase(),
                            text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 25),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                        });
                    } else {
                        results.ok++;
                    }
                });

                return results;
            });

            if (audit.total === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy interactive elements';
                return;
            }

            const smallCount = audit.tooSmall.length;
            const smallRate = Math.round(smallCount / audit.total * 100);

            if (smallCount === 0) {
                t.status = 'passed';
                t.details = `${audit.total} interactive elements đều >= 44x44px ✓`;
            } else if (smallRate > 30) {
                t.status = 'failed';
                t.details = `${smallCount}/${audit.total} (${smallRate}%) elements < 44x44px. Examples: ${audit.tooSmall.slice(0, 3).map(e => `${e.tag} "${e.text}" (${e.width}x${e.height})`).join('; ')}`;
            } else {
                t.status = 'warning';
                t.details = `${smallCount}/${audit.total} elements < 44x44px: ${audit.tooSmall.slice(0, 3).map(e => `${e.tag} "${e.text}" (${e.width}x${e.height})`).join('; ')}`;
            }
        });
    }

    /**
     * 11.9: Viewport meta tag — check for proper responsive meta tag
     */
    async _testViewportMeta(page) {
        const test = createTestResult('responsive_a11y', '11.9', 'Viewport meta tag check');
        return runSafe(test, async (t) => {
            const viewport = await page.evaluate(() => {
                const meta = document.querySelector('meta[name="viewport"]');
                if (!meta) return { found: false };

                const content = meta.getAttribute('content') || '';
                const parts = {};
                content.split(',').forEach(part => {
                    const [key, value] = part.trim().split('=').map(s => s.trim());
                    if (key) parts[key] = value;
                });

                return {
                    found: true,
                    content,
                    hasWidth: !!parts['width'],
                    widthValue: parts['width'] || '',
                    hasInitialScale: !!parts['initial-scale'],
                    initialScale: parts['initial-scale'] || '',
                    hasMaxScale: !!parts['maximum-scale'],
                    maxScale: parts['maximum-scale'] || '',
                    hasUserScalable: !!parts['user-scalable'],
                    userScalable: parts['user-scalable'] || '',
                    disablesZoom: parts['user-scalable'] === 'no' || parts['user-scalable'] === '0' || parseFloat(parts['maximum-scale'] || '10') < 2,
                };
            });

            if (!viewport.found) {
                t.status = 'failed';
                t.details = 'Thiếu <meta name="viewport"> — trang sẽ không responsive trên mobile';
                return;
            }

            const issues = [];

            if (!viewport.hasWidth || viewport.widthValue !== 'device-width') {
                issues.push(`width="${viewport.widthValue}" (nên là device-width)`);
            }
            if (!viewport.hasInitialScale) {
                issues.push('thiếu initial-scale');
            }
            if (viewport.disablesZoom) {
                issues.push('zoom bị disable (user-scalable=no hoặc maximum-scale < 2) — ảnh hưởng accessibility');
            }

            if (issues.length === 0) {
                t.status = 'passed';
                t.details = `Viewport meta OK: "${viewport.content}" ✓`;
            } else if (viewport.disablesZoom) {
                t.status = 'failed';
                t.details = `Viewport: "${viewport.content}". Issues: ${issues.join('; ')}`;
            } else {
                t.status = 'warning';
                t.details = `Viewport: "${viewport.content}". Issues: ${issues.join('; ')}`;
            }
        });
    }
}

module.exports = ResponsiveAccessibilityTests;
