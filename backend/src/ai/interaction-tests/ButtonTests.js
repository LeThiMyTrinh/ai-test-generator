/**
 * Group 4: Button Interaction Tests (8 cases)
 * 4.1 Single click response
 * 4.2 Double click prevention
 * 4.3 Disabled state
 * 4.4 Loading state
 * 4.5 Button type check
 * 4.6 Keyboard activation (Enter/Space)
 * 4.7 Visual feedback (hover/active/focus)
 * 4.8 Link styled as button (role check)
 */

const { createTestResult, runSafe, takeScreenshot, navigateBack } = require('./testHelpers');

class ButtonTests {
    /**
     * Run all button tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];
        const buttons = discovery.buttons.slice(0, 8);

        if (buttons.length === 0) {
            results.push(createTestResult('button', '4.0', 'Button tests', {
                status: 'skipped', details: 'Không tìm thấy buttons trên trang',
            }));
            return results;
        }

        // 4.1: Single click (test each button)
        for (const button of buttons.slice(0, 5)) {
            results.push(await this._testSingleClick(page, button, baseUrl));
        }

        // 4.2: Double click prevention (test first actionable button)
        results.push(await this._testDoubleClickPrevention(page, buttons, baseUrl));

        // 4.3: Disabled state
        results.push(await this._testDisabledState(page));

        // 4.4: Loading state
        results.push(await this._testLoadingState(page, buttons));

        // 4.5: Button type check
        results.push(await this._testButtonType(page, discovery));

        // 4.6: Keyboard activation
        results.push(await this._testKeyboardActivation(page, buttons, baseUrl));

        // 4.7: Visual feedback
        results.push(await this._testVisualFeedback(page, buttons));

        // 4.8: Link styled as button
        results.push(await this._testLinkStyledAsButton(page));

        return results;
    }

    /**
     * 4.1: Single click — check for DOM change/URL change/modal
     */
    async _testSingleClick(page, button, baseUrl) {
        const test = createTestResult('button', '4.1', `Click: "${button.text || button.id}"`);
        return runSafe(test, async (t) => {
            const selector = button.id ? `#${button.id}` : button.selector;
            const btn = await page.$(selector).catch(() => null);
            if (!btn) {
                t.status = 'skipped';
                t.details = 'Button không tìm thấy trong DOM';
                return;
            }

            const isVisible = await btn.isVisible().catch(() => false);
            if (!isVisible) {
                t.status = 'skipped';
                t.details = 'Button không visible';
                return;
            }

            const beforeUrl = page.url();
            const beforeHTML = await page.evaluate(() => document.body.innerHTML.length);

            await btn.click({ timeout: 5000 });
            await page.waitForTimeout(1000);

            const afterUrl = page.url();
            const afterHTML = await page.evaluate(() => document.body.innerHTML.length);

            const changes = [];
            if (afterUrl !== beforeUrl) changes.push(`URL changed → ${afterUrl}`);
            if (Math.abs(afterHTML - beforeHTML) > 100) changes.push(`DOM changed (${afterHTML - beforeHTML > 0 ? '+' : ''}${afterHTML - beforeHTML})`);

            const hasModal = await page.evaluate(() => {
                const modal = document.querySelector('.modal.show, [role="dialog"][aria-modal="true"], dialog[open]');
                return modal ? modal.textContent.substring(0, 80) : null;
            });
            if (hasModal) changes.push(`Modal: "${hasModal.substring(0, 40)}"`);

            t.status = 'passed';
            t.details = changes.length > 0
                ? `Phản hồi: ${changes.join('; ')}`
                : 'Click OK, không có DOM/URL changes rõ ràng';

            t.screenshot = await takeScreenshot(page);

            // Cleanup
            if (hasModal) {
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);
            }
            if (afterUrl !== beforeUrl) {
                await navigateBack(page, baseUrl);
            }
        });
    }

    /**
     * 4.2: Double click prevention
     */
    async _testDoubleClickPrevention(page, buttons, baseUrl) {
        const test = createTestResult('button', '4.2', 'Double click prevention');
        return runSafe(test, async (t) => {
            // Find a submit-like button or form button
            const targetBtn = buttons.find(b =>
                b.text.toLowerCase().includes('submit') || b.text.toLowerCase().includes('save') ||
                b.text.toLowerCase().includes('send') || b.text.toLowerCase().includes('gửi') ||
                b.text.toLowerCase().includes('đăng') || b.text.toLowerCase().includes('tạo')
            ) || buttons[0];

            const selector = targetBtn.id ? `#${targetBtn.id}` : targetBtn.selector;
            const btn = await page.$(selector).catch(() => null);
            if (!btn) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy button phù hợp để test double click';
                return;
            }

            const isVisible = await btn.isVisible().catch(() => false);
            if (!isVisible) {
                t.status = 'skipped';
                t.details = 'Button không visible';
                return;
            }

            // Monitor network requests to detect double submission
            let requestCount = 0;
            const requestHandler = (request) => {
                if (request.method() === 'POST' || request.method() === 'PUT') {
                    requestCount++;
                }
            };
            page.on('request', requestHandler);

            // Click rapidly twice
            await btn.click({ timeout: 3000 });
            await btn.click({ timeout: 3000 }).catch(() => {}); // may fail if button becomes disabled
            await page.waitForTimeout(1500);

            page.removeListener('request', requestHandler);

            // Check if button became disabled after first click
            const isDisabledAfter = await page.evaluate((sel) => {
                const b = document.querySelector(sel);
                if (!b) return false;
                return b.disabled || b.classList.contains('disabled') || b.getAttribute('aria-disabled') === 'true';
            }, selector).catch(() => false);

            if (requestCount <= 1) {
                t.status = 'passed';
                t.details = `Double click handled. ${requestCount} POST requests sent. ${isDisabledAfter ? 'Button disabled sau click.' : ''}`;
            } else if (isDisabledAfter) {
                t.status = 'passed';
                t.details = `${requestCount} requests nhưng button đã disabled sau click đầu`;
            } else {
                t.status = 'warning';
                t.details = `${requestCount} POST requests khi double click — nên có debounce/disable mechanism`;
            }

            t.screenshot = await takeScreenshot(page);
            await navigateBack(page, baseUrl);
        });
    }

    /**
     * 4.3: Disabled state — check disabled buttons cannot be clicked
     */
    async _testDisabledState(page) {
        const test = createTestResult('button', '4.3', 'Disabled button state');
        return runSafe(test, async (t) => {
            const disabledButtons = await page.evaluate(() => {
                const results = [];
                document.querySelectorAll('button[disabled], input[type="submit"][disabled], [role="button"][aria-disabled="true"], .btn.disabled').forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width === 0) return;
                    results.push({
                        text: btn.textContent.trim().substring(0, 40),
                        selector: btn.id ? `#${btn.id}` : null,
                        isActuallyDisabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true',
                        hasDisabledStyle: getComputedStyle(btn).pointerEvents === 'none' || getComputedStyle(btn).opacity < 1,
                        cursor: getComputedStyle(btn).cursor,
                    });
                });
                return results;
            });

            if (disabledButtons.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy disabled buttons trên trang';
                return;
            }

            const issues = [];
            for (const btn of disabledButtons) {
                if (!btn.isActuallyDisabled) {
                    issues.push(`"${btn.text}" có class disabled nhưng thiếu disabled attribute`);
                }
                if (btn.cursor !== 'not-allowed' && btn.cursor !== 'default') {
                    issues.push(`"${btn.text}" cursor="${btn.cursor}" (nên là not-allowed)`);
                }
            }

            if (issues.length > 0) {
                t.status = 'warning';
                t.details = `${disabledButtons.length} disabled buttons. Issues: ${issues.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${disabledButtons.length} disabled buttons có state đúng (disabled attr + cursor) ✓`;
            }
        });
    }

    /**
     * 4.4: Loading state — check for loading indicator after click
     */
    async _testLoadingState(page, buttons) {
        const test = createTestResult('button', '4.4', 'Loading state indicator');
        return runSafe(test, async (t) => {
            // Find a submit/save/send button
            const actionBtn = buttons.find(b =>
                b.text.toLowerCase().includes('submit') || b.text.toLowerCase().includes('save') ||
                b.text.toLowerCase().includes('load') || b.text.toLowerCase().includes('search') ||
                b.text.toLowerCase().includes('tìm') || b.text.toLowerCase().includes('tải')
            );

            if (!actionBtn) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy action button (submit/save/search) để test loading state';
                return;
            }

            const selector = actionBtn.id ? `#${actionBtn.id}` : actionBtn.selector;
            const btn = await page.$(selector).catch(() => null);
            if (!btn || !(await btn.isVisible().catch(() => false))) {
                t.status = 'skipped';
                t.details = 'Button không visible';
                return;
            }

            // Click and immediately check for loading indicators
            await btn.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);

            const hasLoading = await page.evaluate(() => {
                // Check for common loading indicators
                const indicators = [
                    '.spinner', '.loading', '.loader', '.spinner-border', '.spinner-grow',
                    '[role="progressbar"]', '.fa-spinner', '.fa-circle-notch',
                    '.btn-loading', '.is-loading', '.loading-indicator',
                    'svg.animate-spin', '.animate-spin',
                ];
                for (const sel of indicators) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const style = getComputedStyle(el);
                        if (style.display !== 'none' && style.visibility !== 'hidden') return sel;
                    }
                }
                // Check for disabled + text change pattern
                const btns = document.querySelectorAll('button[disabled], button.disabled');
                for (const b of btns) {
                    const text = b.textContent.toLowerCase();
                    if (text.includes('loading') || text.includes('đang') || text.includes('...') || text.includes('processing')) {
                        return `button: "${b.textContent.trim()}"`;
                    }
                }
                return null;
            });

            if (hasLoading) {
                t.status = 'passed';
                t.details = `Loading indicator detected: ${hasLoading} ✓`;
            } else {
                t.status = 'warning';
                t.details = `Không phát hiện loading indicator sau khi click "${actionBtn.text}". Nên có feedback cho user.`;
            }

            t.screenshot = await takeScreenshot(page);
            await page.waitForTimeout(1000); // Wait for action to complete
        });
    }

    /**
     * 4.5: Button type check — submit buttons should have type="submit"
     */
    async _testButtonType(page, discovery) {
        const test = createTestResult('button', '4.5', 'Button type attribute check');
        return runSafe(test, async (t) => {
            const buttonAudit = await page.evaluate(() => {
                const results = {
                    total: 0,
                    withType: 0,
                    withoutType: [],
                    submitInForm: [],
                    submitOutsideForm: [],
                };

                document.querySelectorAll('button').forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width === 0) return;
                    results.total++;

                    const type = btn.getAttribute('type');
                    if (type) {
                        results.withType++;
                    } else {
                        results.withoutType.push(btn.textContent.trim().substring(0, 30));
                    }

                    // Check submit buttons inside forms
                    if (btn.closest('form') && !type) {
                        results.submitInForm.push(btn.textContent.trim().substring(0, 30));
                    }
                });

                // Check for <a> styled as buttons without proper role
                document.querySelectorAll('a.btn, a.button, a[class*="btn-"]').forEach(a => {
                    if (!a.getAttribute('role')) {
                        results.submitOutsideForm.push({
                            text: a.textContent.trim().substring(0, 30),
                            hasRole: false,
                        });
                    }
                });

                return results;
            });

            const issues = [];
            if (buttonAudit.withoutType.length > 0) {
                issues.push(`${buttonAudit.withoutType.length} buttons thiếu type attr: ${buttonAudit.withoutType.slice(0, 3).join(', ')}`);
            }
            if (buttonAudit.submitInForm.length > 0) {
                issues.push(`${buttonAudit.submitInForm.length} buttons trong form thiếu type (defaults to submit): ${buttonAudit.submitInForm.slice(0, 2).join(', ')}`);
            }
            if (buttonAudit.submitOutsideForm.length > 0) {
                issues.push(`${buttonAudit.submitOutsideForm.length} <a> styled as button thiếu role="button"`);
            }

            if (issues.length > 0) {
                t.status = 'warning';
                t.details = `${buttonAudit.total} buttons total. Issues: ${issues.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${buttonAudit.total} buttons, ${buttonAudit.withType} có type attribute ✓`;
            }
        });
    }

    /**
     * 4.6: Keyboard activation — Focus + Enter/Space should trigger button
     */
    async _testKeyboardActivation(page, buttons, baseUrl) {
        const test = createTestResult('button', '4.6', 'Keyboard activation (Enter/Space)');
        return runSafe(test, async (t) => {
            const targetBtn = buttons.find(b => {
                const sel = b.id ? `#${b.id}` : b.selector;
                return sel && !sel.includes('has-text');
            });

            if (!targetBtn) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy button phù hợp để test keyboard';
                return;
            }

            const selector = targetBtn.id ? `#${targetBtn.id}` : targetBtn.selector;
            const btn = await page.$(selector).catch(() => null);
            if (!btn || !(await btn.isVisible().catch(() => false))) {
                t.status = 'skipped';
                t.details = 'Button không visible';
                return;
            }

            // Test Enter key
            const beforeUrl = page.url();
            const beforeHTML = await page.evaluate(() => document.body.innerHTML.length);

            await btn.focus();
            await page.keyboard.press('Enter');
            await page.waitForTimeout(800);

            const afterEnterUrl = page.url();
            const afterEnterHTML = await page.evaluate(() => document.body.innerHTML.length);
            const enterTriggered = afterEnterUrl !== beforeUrl || Math.abs(afterEnterHTML - beforeHTML) > 50;

            // Restore state
            if (afterEnterUrl !== beforeUrl) {
                await navigateBack(page, baseUrl);
            }

            // Also check if element is focusable
            const isFocusable = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return false;
                const tabindex = el.getAttribute('tabindex');
                return el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' ||
                    (tabindex !== null && tabindex !== '-1');
            }, selector);

            if (enterTriggered && isFocusable) {
                t.status = 'passed';
                t.details = `Button "${targetBtn.text}" kích hoạt được bằng Enter key ✓ (focusable: ${isFocusable})`;
            } else if (isFocusable) {
                t.status = 'warning';
                t.details = `Button "${targetBtn.text}" focusable nhưng Enter không trigger rõ ràng`;
            } else {
                t.status = 'failed';
                t.details = `Button "${targetBtn.text}" không focusable — không thể dùng keyboard`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 4.7: Visual feedback — hover/active/focus styles
     */
    async _testVisualFeedback(page, buttons) {
        const test = createTestResult('button', '4.7', 'Visual feedback (hover/focus styles)');
        return runSafe(test, async (t) => {
            const targetBtn = buttons[0];
            const selector = targetBtn.id ? `#${targetBtn.id}` : targetBtn.selector;
            const btn = await page.$(selector).catch(() => null);

            if (!btn || !(await btn.isVisible().catch(() => false))) {
                t.status = 'skipped';
                t.details = 'Button không visible';
                return;
            }

            // Get default styles
            const defaultStyles = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const s = getComputedStyle(el);
                return {
                    bg: s.backgroundColor,
                    color: s.color,
                    border: s.borderColor,
                    shadow: s.boxShadow,
                    transform: s.transform,
                    outline: s.outline,
                    cursor: s.cursor,
                };
            }, selector);

            if (!defaultStyles) {
                t.status = 'skipped';
                t.details = 'Không đọc được styles';
                return;
            }

            // Hover
            await btn.hover();
            await page.waitForTimeout(300);

            const hoverStyles = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const s = getComputedStyle(el);
                return { bg: s.backgroundColor, color: s.color, border: s.borderColor, shadow: s.boxShadow, transform: s.transform, cursor: s.cursor };
            }, selector);

            // Focus
            await btn.focus();
            await page.waitForTimeout(200);

            const focusStyles = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const s = getComputedStyle(el);
                return { bg: s.backgroundColor, outline: s.outline, shadow: s.boxShadow, outlineOffset: s.outlineOffset };
            }, selector);

            const feedback = [];
            if (hoverStyles && (hoverStyles.bg !== defaultStyles.bg || hoverStyles.shadow !== defaultStyles.shadow || hoverStyles.transform !== defaultStyles.transform)) {
                feedback.push('✓ hover style change');
            } else {
                feedback.push('✗ no hover change');
            }

            if (focusStyles && (focusStyles.outline !== 'none' && focusStyles.outline !== defaultStyles.outline || focusStyles.shadow !== defaultStyles.shadow)) {
                feedback.push('✓ focus indicator');
            } else {
                feedback.push('✗ no focus indicator');
            }

            if (defaultStyles.cursor === 'pointer') {
                feedback.push('✓ cursor: pointer');
            } else {
                feedback.push(`⚠ cursor: ${defaultStyles.cursor}`);
            }

            const failCount = feedback.filter(f => f.startsWith('✗')).length;
            t.status = failCount >= 2 ? 'failed' : failCount === 1 ? 'warning' : 'passed';
            t.details = `Button "${targetBtn.text}": ${feedback.join('; ')}`;
            t.screenshot = await takeScreenshot(page);
        });
    }
    /**
     * 4.8: Link styled as button — <a class="btn"> should have role="button"
     */
    async _testLinkStyledAsButton(page) {
        const test = createTestResult('button', '4.8', 'Link styled as button (a11y role check)');
        return runSafe(test, async (t) => {
            const audit = await page.evaluate(() => {
                const results = {
                    total: 0,
                    withRole: 0,
                    withoutRole: [],
                    withoutHref: [],
                };

                document.querySelectorAll('a.btn, a.button, a[class*="btn-"], a[class*="button-"]').forEach(a => {
                    const rect = a.getBoundingClientRect();
                    if (rect.width === 0) return;
                    results.total++;

                    const role = a.getAttribute('role');
                    const href = a.getAttribute('href');
                    const text = a.textContent.trim().substring(0, 30);

                    // If it acts as a button (no real navigation), it needs role="button"
                    const isAction = !href || href === '#' || href === 'javascript:void(0)' || href.startsWith('javascript:');

                    if (isAction) {
                        if (role === 'button') {
                            results.withRole++;
                        } else {
                            results.withoutRole.push({ text, href: href || '', hasRole: !!role });
                        }

                        if (!href || href === '#') {
                            results.withoutHref.push(text);
                        }
                    } else {
                        // It's a real link styled as button — OK, but should still be accessible
                        results.withRole++;
                    }
                });

                return results;
            });

            if (audit.total === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy <a> styled as button';
                return;
            }

            const issues = [];
            if (audit.withoutRole.length > 0) {
                issues.push(`${audit.withoutRole.length} <a> acts as button nhưng thiếu role="button": ${audit.withoutRole.slice(0, 3).map(r => `"${r.text}"`).join(', ')}`);
            }
            if (audit.withoutHref.length > 0) {
                issues.push(`${audit.withoutHref.length} <a> thiếu href hoặc href="#" — nên dùng <button> thay vì <a>`);
            }

            if (issues.length > 0) {
                t.status = 'warning';
                t.details = `${audit.total} link-buttons. ${issues.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${audit.total} link-buttons, ${audit.withRole} có role/href phù hợp ✓`;
            }
        });
    }
}

module.exports = ButtonTests;
