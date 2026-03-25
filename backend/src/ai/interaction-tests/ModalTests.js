/**
 * Group 5: Modal & Dialog Tests (10 cases)
 * 5.1 Open modal
 * 5.2 Close by ESC
 * 5.3 Close by X button
 * 5.4 Close by backdrop click
 * 5.5 Focus trap
 * 5.6 Scroll lock (body scroll disabled)
 * 5.7 Content readable
 * 5.8 ARIA attributes
 * 5.9 Nested modal
 * 5.10 Modal with form
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class ModalTests {
    /**
     * Run all modal tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];
        const modals = discovery.modals.slice(0, 5);

        if (modals.length === 0) {
            results.push(createTestResult('modal', '5.0', 'Modal tests', {
                status: 'skipped', details: 'Không tìm thấy modal triggers trên trang',
            }));
            return results;
        }

        for (const modal of modals) {
            // Run all 8 tests for each modal
            const modalResults = await this._testModalFull(page, modal);
            results.push(...modalResults);
        }

        // 5.9 + 5.10: Cross-modal tests (run once, not per-modal)
        results.push(await this._testNestedModal(page, modals));
        results.push(await this._testModalWithForm(page, modals));

        return results;
    }

    /**
     * Run all 8 test cases for a single modal
     */
    async _testModalFull(page, modal) {
        const results = [];
        const label = modal.triggerText.substring(0, 25);

        // 5.1: Open modal
        const openResult = await this._testOpen(page, modal, label);
        results.push(openResult);

        // If modal didn't open, skip the rest
        if (openResult.status !== 'passed') {
            return results;
        }

        // 5.8: ARIA attributes (check while open)
        results.push(await this._testAriaAttributes(page, modal, label));

        // 5.7: Content readable
        results.push(await this._testContentReadable(page, modal, label));

        // 5.6: Scroll lock
        results.push(await this._testScrollLock(page, label));

        // 5.5: Focus trap
        results.push(await this._testFocusTrap(page, label));

        // 5.2: Close by ESC
        // First need to ensure modal is open
        await this._ensureModalOpen(page, modal);
        results.push(await this._testCloseESC(page, modal, label));

        // 5.3: Close by X button
        await this._ensureModalOpen(page, modal);
        results.push(await this._testCloseXButton(page, modal, label));

        // 5.4: Close by backdrop
        await this._ensureModalOpen(page, modal);
        results.push(await this._testCloseBackdrop(page, modal, label));

        return results;
    }

    /**
     * Open a modal by clicking its trigger
     */
    async _openModal(page, modal) {
        const trigger = await page.$(modal.triggerSelector);
        if (!trigger) return false;

        const isVisible = await trigger.isVisible().catch(() => false);
        if (!isVisible) return false;

        await trigger.click();
        await page.waitForTimeout(800);

        return await this._isModalVisible(page, modal);
    }

    /**
     * Ensure modal is open, re-open if needed
     */
    async _ensureModalOpen(page, modal) {
        const isOpen = await this._isModalVisible(page, modal);
        if (!isOpen) {
            await this._openModal(page, modal);
        }
    }

    /**
     * Check if a modal is currently visible
     */
    async _isModalVisible(page, modal) {
        return page.evaluate((targetSel) => {
            // Check specific target
            if (targetSel) {
                const m = document.querySelector(targetSel);
                if (m) {
                    const style = getComputedStyle(m);
                    if (style.display !== 'none' && style.visibility !== 'hidden') return true;
                }
            }
            // Check generic modal selectors
            const anyModal = document.querySelector('.modal.show, .modal.in, [role="dialog"]:not([aria-hidden="true"]), dialog[open]');
            return !!anyModal;
        }, modal.targetSelector);
    }

    /**
     * Close any open modal
     */
    async _closeModal(page) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        // Fallback: click close button
        const closeBtn = await page.$('.modal.show .close, .modal.show [data-dismiss="modal"], .modal.show [data-bs-dismiss="modal"], dialog[open] button[class*="close"]');
        if (closeBtn) {
            await closeBtn.click().catch(() => {});
            await page.waitForTimeout(300);
        }
    }

    /**
     * 5.1: Open modal
     */
    async _testOpen(page, modal, label) {
        const test = createTestResult('modal', '5.1', `Modal open: "${label}"`);
        return runSafe(test, async (t) => {
            const opened = await this._openModal(page, modal);
            if (opened) {
                t.status = 'passed';
                t.details = `Modal "${label}" mở thành công`;
                t.screenshot = await takeScreenshot(page);
            } else {
                t.status = 'failed';
                t.details = `Click trigger nhưng modal không xuất hiện`;
            }
        });
    }

    /**
     * 5.2: Close by ESC
     */
    async _testCloseESC(page, modal, label) {
        const test = createTestResult('modal', '5.2', `Modal close ESC: "${label}"`);
        return runSafe(test, async (t) => {
            const wasBefore = await this._isModalVisible(page, modal);
            if (!wasBefore) {
                t.status = 'skipped';
                t.details = 'Modal không mở được để test ESC';
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(600);

            const isStillOpen = await this._isModalVisible(page, modal);
            if (!isStillOpen) {
                t.status = 'passed';
                t.details = 'ESC đóng modal thành công ✓';
            } else {
                t.status = 'failed';
                t.details = 'Modal không đóng bằng ESC key';
                await this._closeModal(page);
            }
        });
    }

    /**
     * 5.3: Close by X button
     */
    async _testCloseXButton(page, modal, label) {
        const test = createTestResult('modal', '5.3', `Modal close X button: "${label}"`);
        return runSafe(test, async (t) => {
            const wasBefore = await this._isModalVisible(page, modal);
            if (!wasBefore) {
                t.status = 'skipped';
                t.details = 'Modal không mở được';
                return;
            }

            // Find close button
            const closeBtn = await page.evaluate(() => {
                const selectors = [
                    '.modal.show .close', '.modal.show .btn-close',
                    '.modal.show [data-dismiss="modal"]', '.modal.show [data-bs-dismiss="modal"]',
                    '.modal.show button[aria-label="Close"]',
                    'dialog[open] button[class*="close"]', 'dialog[open] .close',
                    '[role="dialog"] button[aria-label="Close"]',
                    '[role="dialog"] .close', '[role="dialog"] .btn-close',
                ];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0) return sel;
                    }
                }
                return null;
            });

            if (!closeBtn) {
                t.status = 'warning';
                t.details = 'Không tìm thấy close (X) button trong modal';
                await this._closeModal(page);
                return;
            }

            await page.click(closeBtn);
            await page.waitForTimeout(600);

            const isStillOpen = await this._isModalVisible(page, modal);
            if (!isStillOpen) {
                t.status = 'passed';
                t.details = `Close button (${closeBtn}) đóng modal thành công ✓`;
            } else {
                t.status = 'failed';
                t.details = `Click close button nhưng modal vẫn mở`;
                await this._closeModal(page);
            }
        });
    }

    /**
     * 5.4: Close by backdrop click
     */
    async _testCloseBackdrop(page, modal, label) {
        const test = createTestResult('modal', '5.4', `Modal close backdrop: "${label}"`);
        return runSafe(test, async (t) => {
            const wasBefore = await this._isModalVisible(page, modal);
            if (!wasBefore) {
                t.status = 'skipped';
                t.details = 'Modal không mở được';
                return;
            }

            // Click on backdrop/overlay area
            const backdropClicked = await page.evaluate(() => {
                const backdrop = document.querySelector('.modal-backdrop, .modal.show, .overlay, [class*="backdrop"]');
                if (backdrop) return true;
                return false;
            });

            // Click outside modal content (at edge of viewport)
            await page.mouse.click(10, 10);
            await page.waitForTimeout(600);

            const isStillOpen = await this._isModalVisible(page, modal);
            if (!isStillOpen) {
                t.status = 'passed';
                t.details = 'Backdrop click đóng modal thành công ✓';
            } else {
                t.status = 'warning';
                t.details = 'Modal không đóng khi click backdrop (có thể là intentional — static backdrop)';
                await this._closeModal(page);
            }
        });
    }

    /**
     * 5.5: Focus trap — Tab should not escape modal
     */
    async _testFocusTrap(page, label) {
        const test = createTestResult('modal', '5.5', `Focus trap: "${label}"`);
        return runSafe(test, async (t) => {
            const isOpen = await page.evaluate(() => {
                return !!document.querySelector('.modal.show, [role="dialog"]:not([aria-hidden="true"]), dialog[open]');
            });

            if (!isOpen) {
                t.status = 'skipped';
                t.details = 'Modal không mở';
                return;
            }

            // Tab multiple times and check if focus stays inside modal
            const focusTrapped = await page.evaluate(() => {
                const modalEl = document.querySelector('.modal.show, [role="dialog"]:not([aria-hidden="true"]), dialog[open]');
                if (!modalEl) return { trapped: false, reason: 'no modal' };

                const focusable = modalEl.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
                return {
                    trapped: true, // Can't fully test from evaluate, but check if focusable elements exist
                    focusableCount: focusable.length,
                    hasTabindex: modalEl.getAttribute('tabindex') !== null,
                };
            });

            // Tab 10 times and check focus position
            for (let i = 0; i < 10; i++) {
                await page.keyboard.press('Tab');
            }
            await page.waitForTimeout(200);

            const focusLocation = await page.evaluate(() => {
                const active = document.activeElement;
                const modal = document.querySelector('.modal.show, [role="dialog"]:not([aria-hidden="true"]), dialog[open]');
                if (!modal || !active) return { inModal: false };
                return {
                    inModal: modal.contains(active),
                    activeTag: active.tagName,
                    activeText: active.textContent?.substring(0, 30),
                };
            });

            if (focusLocation.inModal) {
                t.status = 'passed';
                t.details = `Focus trap hoạt động — sau 10 Tab, focus vẫn trong modal (${focusTrapped.focusableCount} focusable elements) ✓`;
            } else {
                t.status = 'failed';
                t.details = `Focus thoát khỏi modal — active element: ${focusLocation.activeTag}. Cần implement focus trap.`;
            }
        });
    }

    /**
     * 5.6: Scroll lock — body should not scroll when modal is open
     */
    async _testScrollLock(page, label) {
        const test = createTestResult('modal', '5.6', `Scroll lock: "${label}"`);
        return runSafe(test, async (t) => {
            const scrollState = await page.evaluate(() => {
                const body = document.body;
                const html = document.documentElement;
                const bodyStyle = getComputedStyle(body);
                const htmlStyle = getComputedStyle(html);

                return {
                    bodyOverflow: bodyStyle.overflow,
                    bodyOverflowY: bodyStyle.overflowY,
                    htmlOverflow: htmlStyle.overflow,
                    bodyHasClass: body.classList.contains('modal-open') || body.classList.contains('overflow-hidden') || body.classList.contains('no-scroll'),
                    paddingRight: bodyStyle.paddingRight,
                    isLocked: bodyStyle.overflow === 'hidden' || bodyStyle.overflowY === 'hidden' ||
                        htmlStyle.overflow === 'hidden' || body.classList.contains('modal-open'),
                };
            });

            if (scrollState.isLocked) {
                t.status = 'passed';
                t.details = `Body scroll locked khi modal mở ✓ (overflow: ${scrollState.bodyOverflow}, class: ${scrollState.bodyHasClass ? 'modal-open' : 'none'})`;
            } else {
                t.status = 'warning';
                t.details = `Body scroll không bị lock — overflow: ${scrollState.bodyOverflow}. User có thể scroll behind modal.`;
            }
        });
    }

    /**
     * 5.7: Content readable — modal should have actual content
     */
    async _testContentReadable(page, modal, label) {
        const test = createTestResult('modal', '5.7', `Modal content: "${label}"`);
        return runSafe(test, async (t) => {
            const content = await page.evaluate((targetSel) => {
                const modalEl = document.querySelector('.modal.show .modal-body, .modal.show .modal-content, [role="dialog"] .modal-body, dialog[open]');
                const fallback = targetSel ? document.querySelector(targetSel) : null;
                const el = modalEl || fallback;
                if (!el) return { found: false };

                const text = el.textContent.trim();
                const hasImages = el.querySelectorAll('img').length;
                const hasInputs = el.querySelectorAll('input, select, textarea').length;
                const hasButtons = el.querySelectorAll('button, a').length;

                return {
                    found: true,
                    textLength: text.length,
                    textPreview: text.substring(0, 150),
                    hasImages,
                    hasInputs,
                    hasButtons,
                };
            }, modal.targetSelector);

            if (!content.found) {
                t.status = 'warning';
                t.details = 'Không tìm thấy modal content element';
                return;
            }

            if (content.textLength === 0 && content.hasImages === 0 && content.hasInputs === 0) {
                t.status = 'failed';
                t.details = 'Modal content rỗng — không có text, images, hay form fields';
            } else {
                t.status = 'passed';
                t.details = `Content: ${content.textLength} chars, ${content.hasImages} images, ${content.hasInputs} inputs, ${content.hasButtons} buttons. Preview: "${content.textPreview.substring(0, 80)}"`;
            }
        });
    }

    /**
     * 5.8: ARIA attributes — role="dialog", aria-modal, aria-label
     */
    async _testAriaAttributes(page, modal, label) {
        const test = createTestResult('modal', '5.8', `Modal ARIA: "${label}"`);
        return runSafe(test, async (t) => {
            const aria = await page.evaluate((targetSel) => {
                const modalEl = document.querySelector('.modal.show, [role="dialog"], dialog[open]');
                const el = modalEl || (targetSel ? document.querySelector(targetSel) : null);
                if (!el) return { found: false };

                const hasRole = el.getAttribute('role') === 'dialog' || el.tagName === 'DIALOG';
                const hasAriaModal = el.getAttribute('aria-modal') === 'true' || el.tagName === 'DIALOG';
                const hasAriaLabel = !!el.getAttribute('aria-label') || !!el.getAttribute('aria-labelledby');
                const hasTitle = !!el.querySelector('.modal-title, [class*="title"], h1, h2, h3, h4, h5');

                return {
                    found: true,
                    tag: el.tagName,
                    hasRole,
                    hasAriaModal,
                    hasAriaLabel,
                    hasTitle,
                    role: el.getAttribute('role'),
                    ariaModal: el.getAttribute('aria-modal'),
                };
            }, modal.targetSelector);

            if (!aria.found) {
                t.status = 'warning';
                t.details = 'Modal element không tìm thấy để kiểm tra ARIA';
                return;
            }

            const checks = [];
            if (aria.hasRole) checks.push('✓ role="dialog"');
            else checks.push('✗ thiếu role="dialog"');

            if (aria.hasAriaModal) checks.push('✓ aria-modal="true"');
            else checks.push('✗ thiếu aria-modal');

            if (aria.hasAriaLabel || aria.hasTitle) checks.push('✓ có label/title');
            else checks.push('✗ thiếu aria-label/aria-labelledby');

            const failCount = checks.filter(c => c.startsWith('✗')).length;
            t.status = failCount === 0 ? 'passed' : failCount >= 2 ? 'failed' : 'warning';
            t.details = `${aria.tag} modal: ${checks.join('; ')}`;
        });
    }
    /**
     * 5.9: Nested modal — check if opening a modal inside modal works
     */
    async _testNestedModal(page, modals) {
        const test = createTestResult('modal', '5.9', 'Nested modal check');
        return runSafe(test, async (t) => {
            if (modals.length < 2) {
                t.status = 'skipped';
                t.details = 'Cần ít nhất 2 modals để test nested modal';
                return;
            }

            // Open first modal
            const opened = await this._openModal(page, modals[0]);
            if (!opened) {
                t.status = 'skipped';
                t.details = 'Không mở được modal đầu tiên';
                return;
            }

            // Check if there's a trigger inside the open modal for another modal
            const nestedTrigger = await page.evaluate(() => {
                const modal = document.querySelector('.modal.show, [role="dialog"]:not([aria-hidden="true"]), dialog[open]');
                if (!modal) return null;
                const trigger = modal.querySelector('[data-toggle="modal"], [data-bs-toggle="modal"], [data-target], [data-bs-target]');
                if (!trigger) return null;
                return {
                    text: trigger.textContent.trim().substring(0, 30),
                    selector: trigger.id ? `#${trigger.id}` : null,
                };
            });

            if (nestedTrigger && nestedTrigger.selector) {
                try {
                    await page.click(nestedTrigger.selector);
                    await page.waitForTimeout(800);

                    const openModals = await page.evaluate(() => {
                        return document.querySelectorAll('.modal.show, [role="dialog"]:not([aria-hidden="true"]), dialog[open]').length;
                    });

                    if (openModals >= 2) {
                        t.status = 'passed';
                        t.details = `Nested modal hoạt động: ${openModals} modals open simultaneously ✓`;
                    } else {
                        t.status = 'passed';
                        t.details = 'Nested trigger clicked — modal switched (single modal pattern)';
                    }
                } catch {
                    t.status = 'warning';
                    t.details = 'Nested modal trigger tìm thấy nhưng không click được';
                }
            } else {
                t.status = 'skipped';
                t.details = 'Không tìm thấy nested modal trigger bên trong modal';
            }

            // Cleanup
            await this._closeModal(page);
            await page.waitForTimeout(300);
            await this._closeModal(page);
        });
    }

    /**
     * 5.10: Modal with form — form inside modal should be functional
     */
    async _testModalWithForm(page, modals) {
        const test = createTestResult('modal', '5.10', 'Modal with form');
        return runSafe(test, async (t) => {
            // Try to find a modal that contains a form
            let formModal = null;
            for (const modal of modals) {
                const opened = await this._openModal(page, modal);
                if (!opened) continue;

                const hasForm = await page.evaluate(() => {
                    const modalEl = document.querySelector('.modal.show, [role="dialog"]:not([aria-hidden="true"]), dialog[open]');
                    if (!modalEl) return null;
                    const form = modalEl.querySelector('form');
                    if (!form) {
                        // Also check for input fields without <form> tag
                        const inputs = modalEl.querySelectorAll('input:not([type="hidden"]), textarea, select');
                        if (inputs.length === 0) return null;
                        return {
                            hasFormTag: false,
                            inputCount: inputs.length,
                            hasSubmit: !!modalEl.querySelector('button[type="submit"], button.submit, .btn-submit'),
                        };
                    }
                    const inputs = form.querySelectorAll('input:not([type="hidden"]), textarea, select');
                    return {
                        hasFormTag: true,
                        inputCount: inputs.length,
                        hasSubmit: !!form.querySelector('button[type="submit"], button:not([type="button"]):not([type="reset"])'),
                    };
                });

                if (hasForm) {
                    formModal = { modal, formInfo: hasForm };
                    break;
                }

                await this._closeModal(page);
                await page.waitForTimeout(300);
            }

            if (!formModal) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy modal chứa form/inputs';
                return;
            }

            const issues = [];
            if (!formModal.formInfo.hasFormTag) {
                issues.push('inputs không nằm trong <form> tag');
            }
            if (!formModal.formInfo.hasSubmit) {
                issues.push('thiếu submit button');
            }

            // Check that form inputs are focusable
            const focusable = await page.evaluate(() => {
                const modalEl = document.querySelector('.modal.show, [role="dialog"]:not([aria-hidden="true"]), dialog[open]');
                if (!modalEl) return 0;
                const inputs = modalEl.querySelectorAll('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])');
                return inputs.length;
            });

            if (issues.length > 0) {
                t.status = 'warning';
                t.details = `Modal form: ${formModal.formInfo.inputCount} inputs, ${focusable} focusable. Issues: ${issues.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `Modal form: ${formModal.formInfo.inputCount} inputs, ${focusable} focusable, has submit button ✓`;
            }

            await this._closeModal(page);
        });
    }
}

module.exports = ModalTests;
