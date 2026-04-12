/**
 * Group 6: Loading & Animation (4 cases)
 * 6.1 Loading spinner
 * 6.2 Transition (CSS transition properties)
 * 6.3 Hover animation
 * 6.4 Modal open/close
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class LoadingAnimationTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testLoadingSpinner(page));
        results.push(await this._testTransition(page));
        results.push(await this._testHoverAnimation(page));
        results.push(await this._testModalOpenClose(page, discovery));

        return results;
    }

    /**
     * 6.1: Loading spinner — detect spinner/loader elements
     */
    async _testLoadingSpinner(page) {
        const test = createTestResult('loadingAnimation', '6.1', 'Loading spinner');
        return runSafe(test, async (t) => {
            const spinnerCheck = await page.evaluate(() => {
                const spinnerSelectors = [
                    '.spinner', '.loading', '.loader', '.spinner-border', '.spinner-grow',
                    '[role="progressbar"]', '.fa-spinner', '.fa-circle-notch',
                    '.loading-indicator', '.animate-spin', '.sk-spinner',
                    '.lds-ring', '.lds-dual-ring', '.lds-spinner',
                    '[class*="spinner"]', '[class*="loader"]', '[class*="loading"]',
                ];

                const found = [];
                for (const sel of spinnerSelectors) {
                    document.querySelectorAll(sel).forEach(el => {
                        const style = getComputedStyle(el);
                        found.push({
                            selector: sel,
                            display: style.display,
                            visible: style.display !== 'none' && style.visibility !== 'hidden',
                            hasAnimation: style.animationName !== 'none' || style.animationName !== '',
                        });
                    });
                }

                // Check for CSS @keyframes animations that look like spinners
                let spinAnimations = 0;
                try {
                    for (const sheet of document.styleSheets) {
                        try {
                            for (const rule of sheet.cssRules || []) {
                                if (rule.type === CSSRule.KEYFRAMES_RULE) {
                                    const name = rule.name.toLowerCase();
                                    if (name.includes('spin') || name.includes('rotate') || name.includes('load') || name.includes('pulse')) {
                                        spinAnimations++;
                                    }
                                }
                            }
                        } catch { /* cross-origin */ }
                    }
                } catch { /* access denied */ }

                return {
                    elements: found.slice(0, 5),
                    totalFound: found.length,
                    visibleNow: found.filter(f => f.visible).length,
                    spinAnimations,
                };
            });

            if (spinnerCheck.totalFound > 0) {
                t.status = 'passed';
                t.details = `${spinnerCheck.totalFound} loading elements tìm thấy (${spinnerCheck.visibleNow} visible hiện tại). ${spinnerCheck.spinAnimations} spin animations ✓`;
            } else if (spinnerCheck.spinAnimations > 0) {
                t.status = 'passed';
                t.details = `${spinnerCheck.spinAnimations} spin/loading animations tìm thấy trong CSS ✓`;
            } else {
                t.status = 'warning';
                t.details = 'Không tìm thấy loading spinner/indicator. Nên có loading feedback cho async operations.';
            }
        });
    }

    /**
     * 6.2: Transition — CSS transition properties tồn tại
     */
    async _testTransition(page) {
        const test = createTestResult('loadingAnimation', '6.2', 'CSS Transition');
        return runSafe(test, async (t) => {
            const transitionCheck = await page.evaluate(() => {
                const elements = document.querySelectorAll('button, a, .btn, input, .card, .nav-link, [class*="hover"], [class*="transition"]');
                let withTransition = 0, total = 0;
                const examples = [];

                elements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0) return;
                    const style = getComputedStyle(el);
                    if (style.display === 'none') return;
                    total++;

                    const transition = style.transition || style.transitionProperty;
                    if (transition && transition !== 'none' && transition !== 'all 0s ease 0s' && !transition.startsWith('none')) {
                        withTransition++;
                        if (examples.length < 3) {
                            examples.push({
                                tag: el.tagName.toLowerCase(),
                                transition: transition.substring(0, 60),
                            });
                        }
                    }
                });

                return { total, withTransition, examples };
            });

            if (transitionCheck.withTransition > 0) {
                t.status = 'passed';
                t.details = `${transitionCheck.withTransition}/${transitionCheck.total} interactive elements có CSS transitions: ${transitionCheck.examples.map(e => `${e.tag} (${e.transition})`).join('; ')} ✓`;
            } else {
                t.status = 'warning';
                t.details = `${transitionCheck.total} elements kiểm tra — không có CSS transitions. Nên thêm cho UX tốt hơn.`;
            }
        });
    }

    /**
     * 6.3: Hover animation — element thay đổi style khi hover
     */
    async _testHoverAnimation(page) {
        const test = createTestResult('loadingAnimation', '6.3', 'Hover animation');
        return runSafe(test, async (t) => {
            // Find interactive elements to test hover
            const elements = await page.$$('button:visible, a:visible, .btn:visible, .card:visible');

            if (elements.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy interactive elements để test hover';
                return;
            }

            let hoverChanges = 0;
            let tested = 0;
            const results = [];

            for (const el of elements.slice(0, 5)) {
                try {
                    // Get default styles
                    const before = await page.evaluate((e) => {
                        const s = getComputedStyle(e);
                        return { bg: s.backgroundColor, color: s.color, shadow: s.boxShadow, transform: s.transform, opacity: s.opacity };
                    }, el);

                    // Hover
                    await el.hover();
                    await page.waitForTimeout(150);

                    const after = await page.evaluate((e) => {
                        const s = getComputedStyle(e);
                        return { bg: s.backgroundColor, color: s.color, shadow: s.boxShadow, transform: s.transform, opacity: s.opacity };
                    }, el);

                    tested++;
                    const changed = before.bg !== after.bg || before.color !== after.color ||
                        before.shadow !== after.shadow || before.transform !== after.transform || before.opacity !== after.opacity;

                    if (changed) hoverChanges++;
                } catch { /* skip */ }
            }

            // Move mouse away
            await page.mouse.move(0, 0);
            await page.waitForTimeout(100);

            if (hoverChanges > 0) {
                t.status = 'passed';
                t.details = `${hoverChanges}/${tested} elements có hover animation/style change ✓`;
            } else {
                t.status = 'warning';
                t.details = `${tested} elements tested — không phát hiện hover animation. Nên thêm visual feedback.`;
            }
        });
    }

    /**
     * 6.4: Modal open/close
     */
    async _testModalOpenClose(page, discovery) {
        const test = createTestResult('loadingAnimation', '6.4', 'Modal open/close');
        return runSafe(test, async (t) => {
            if (discovery.modals.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy modal triggers trên trang';
                return;
            }

            const modal = discovery.modals[0];
            const trigger = await page.$(modal.triggerSelector).catch(() => null);
            if (!trigger) {
                t.status = 'skipped';
                t.details = 'Modal trigger không tìm thấy trong DOM';
                return;
            }

            // Open modal
            await trigger.click();
            await page.waitForTimeout(300);

            const isOpen = await page.evaluate(() => {
                const modal = document.querySelector('.modal.show, [role="dialog"][aria-modal="true"], dialog[open], .modal.active, .modal[style*="display: block"]');
                return !!modal;
            });

            if (!isOpen) {
                t.status = 'failed';
                t.details = `Click trigger "${modal.triggerText}" nhưng modal không mở`;
                return;
            }

            t.screenshot = await takeScreenshot(page);

            // Close modal (try ESC first, then close button)
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);

            let isClosed = await page.evaluate(() => {
                const modal = document.querySelector('.modal.show, [role="dialog"][aria-modal="true"], dialog[open]');
                return !modal;
            });

            if (!isClosed) {
                // Try close button
                const closeBtn = await page.$('.modal .btn-close, .modal .close, .modal [data-dismiss="modal"], .modal [data-bs-dismiss="modal"]').catch(() => null);
                if (closeBtn) {
                    await closeBtn.click();
                    await page.waitForTimeout(200);
                    isClosed = await page.evaluate(() => !document.querySelector('.modal.show, [role="dialog"][aria-modal="true"], dialog[open]'));
                }
            }

            if (isClosed) {
                t.status = 'passed';
                t.details = `Modal "${modal.triggerText}" mở/đóng hoạt động đúng ✓`;
            } else {
                t.status = 'warning';
                t.details = `Modal mở thành công nhưng không đóng được bằng ESC/close button`;
            }
        });
    }
}

module.exports = LoadingAnimationTests;
