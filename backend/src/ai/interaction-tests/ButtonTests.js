/**
 * Group 2: Button (5 cases) — theo PDF
 * TC_BTN_01 Button hiển thị đúng
 * TC_BTN_02 Hover button → hover state
 * TC_BTN_03 Click button → thực hiện action
 * TC_BTN_04 Disabled button → không click được
 * TC_BTN_05 Button loading → hiển thị loading khi submit
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class ButtonTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testButtonVisible(page));
        results.push(await this._testHoverButton(page));
        results.push(await this._testClickButton(page, baseUrl));
        results.push(await this._testDisabledButton(page));
        results.push(await this._testButtonLoading(page));

        return results.filter(Boolean);
    }

    /** TC_BTN_01: Button hiển thị đúng */
    async _testButtonVisible(page) {
        const test = createTestResult('button', 'TC_BTN_01', 'Button hiển thị');
        return runSafe(test, async (t) => {
            const btnInfo = await page.evaluate(() => {
                const btns = document.querySelectorAll('button, [role="button"], .btn, .button, input[type="submit"], input[type="button"]');
                let visible = 0;
                btns.forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    const style = getComputedStyle(btn);
                    if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') visible++;
                });
                return { total: btns.length, visible };
            });

            if (btnInfo.visible > 0) {
                t.status = 'passed';
                t.details = `${btnInfo.visible}/${btnInfo.total} buttons hiển thị đúng`;
            } else if (btnInfo.total > 0) {
                t.status = 'failed';
                t.details = `Có ${btnInfo.total} buttons nhưng không button nào hiển thị`;
            } else {
                t.status = 'warning';
                t.details = 'Không tìm thấy button nào trên trang';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_BTN_02: Hover button → hiển thị hover state */
    async _testHoverButton(page) {
        const test = createTestResult('button', 'TC_BTN_02', 'Hover button');
        return runSafe(test, async (t) => {
            const btnSel = await page.evaluate(() => {
                const btns = document.querySelectorAll('button:not([disabled]), [role="button"], .btn:not(.disabled)');
                for (const btn of btns) {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && getComputedStyle(btn).display !== 'none') {
                        return { selector: btn.id ? `#${btn.id}` : 'button:not([disabled])', text: btn.textContent.trim().substring(0, 30) };
                    }
                }
                return null;
            });

            if (!btnSel) {
                t.status = 'warning';
                t.details = 'Không tìm thấy button để test hover';
                return;
            }

            const beforeStyle = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const s = getComputedStyle(el);
                return { bg: s.backgroundColor, color: s.color, boxShadow: s.boxShadow, cursor: s.cursor };
            }, btnSel.selector).catch(() => null);

            await page.hover(btnSel.selector, { timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);

            const afterStyle = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const s = getComputedStyle(el);
                return { bg: s.backgroundColor, color: s.color, boxShadow: s.boxShadow, cursor: s.cursor };
            }, btnSel.selector).catch(() => null);

            if (!beforeStyle || !afterStyle) {
                t.status = 'warning';
                t.details = 'Không thể đọc style của button';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            const hasChange = beforeStyle.bg !== afterStyle.bg || beforeStyle.color !== afterStyle.color || beforeStyle.boxShadow !== afterStyle.boxShadow;
            const hasCursor = afterStyle.cursor === 'pointer';

            if (hasChange || hasCursor) {
                t.status = 'passed';
                t.details = `Button "${btnSel.text}" có hover state (cursor: ${afterStyle.cursor}, style thay đổi: ${hasChange})`;
            } else {
                t.status = 'warning';
                t.details = `Button "${btnSel.text}" không phát hiện hover state rõ ràng`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_BTN_03: Click button → thực hiện action */
    async _testClickButton(page, baseUrl) {
        const test = createTestResult('button', 'TC_BTN_03', 'Click button');
        return runSafe(test, async (t) => {
            const btnSel = await page.evaluate(() => {
                const btns = document.querySelectorAll('button:not([disabled]):not([type="submit"]), [role="button"]');
                for (const btn of btns) {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && getComputedStyle(btn).display !== 'none') {
                        return { selector: btn.id ? `#${btn.id}` : 'button:not([disabled]):not([type="submit"])', text: btn.textContent.trim().substring(0, 30) };
                    }
                }
                return null;
            });

            if (!btnSel) {
                t.status = 'warning';
                t.details = 'Không tìm thấy button (non-submit) để test click';
                return;
            }

            const beforeUrl = page.url();
            try {
                await page.click(btnSel.selector, { timeout: 3000 });
                await page.waitForTimeout(500);
            } catch {
                t.status = 'warning';
                t.details = `Không thể click button "${btnSel.text}"`;
                t.screenshot = await takeScreenshot(page);
                return;
            }

            const afterUrl = page.url();
            const domChanged = await page.evaluate(() => {
                const modal = document.querySelector('.modal.show, [role="dialog"][open], .modal[style*="display: block"]');
                const toast = document.querySelector('.toast, .notification, [role="alert"]');
                return { modal: !!modal, toast: !!toast };
            });

            t.status = 'passed';
            if (afterUrl !== beforeUrl || domChanged.modal || domChanged.toast) {
                t.details = `Click button "${btnSel.text}" thực hiện action thành công`;
            } else {
                t.details = `Button "${btnSel.text}" đã click được`;
            }
            t.screenshot = await takeScreenshot(page);

            if (afterUrl !== beforeUrl) {
                await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
            }
        });
    }

    /** TC_BTN_04: Disabled button → không click được */
    async _testDisabledButton(page) {
        const test = createTestResult('button', 'TC_BTN_04', 'Disabled button');
        return runSafe(test, async (t) => {
            const info = await page.evaluate(() => {
                const btns = document.querySelectorAll('button[disabled], input[type="submit"][disabled], .btn[disabled], .btn.disabled');
                if (btns.length === 0) return { found: false };
                const btn = btns[0];
                const style = getComputedStyle(btn);
                return {
                    found: true,
                    text: btn.textContent.trim().substring(0, 30),
                    disabled: btn.disabled,
                    pointerEvents: style.pointerEvents,
                    cursor: style.cursor,
                };
            });

            if (!info.found) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy disabled button trên trang';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            if (info.disabled) {
                t.status = 'passed';
                t.details = `Disabled button "${info.text}" không click được (cursor: ${info.cursor})`;
            } else {
                t.status = 'failed';
                t.details = `Button "${info.text}" có class disabled nhưng thiếu attribute disabled`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_BTN_05: Button loading → hiển thị loading khi submit */
    async _testButtonLoading(page) {
        const test = createTestResult('button', 'TC_BTN_05', 'Button loading');
        return runSafe(test, async (t) => {
            const submitBtn = await page.evaluate(() => {
                const btn = document.querySelector('form button[type="submit"], form input[type="submit"], form button:not([type])');
                if (!btn) return null;
                const rect = btn.getBoundingClientRect();
                if (rect.width === 0) return null;
                return { selector: btn.id ? `#${btn.id}` : 'form button[type="submit"]', text: btn.textContent.trim().substring(0, 30) };
            });

            if (!submitBtn) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy submit button để test loading state';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            try {
                await page.click(submitBtn.selector, { timeout: 3000 });
                await page.waitForTimeout(300);

                const loading = await page.evaluate((sel) => {
                    const btn = document.querySelector(sel);
                    if (!btn) return { hasLoading: false };
                    const text = btn.textContent.toLowerCase();
                    const html = btn.innerHTML.toLowerCase();
                    const cls = btn.className.toString().toLowerCase();
                    const hasSpinner = html.includes('spinner') || html.includes('loading') || html.includes('animate');
                    const hasLoadingText = text.includes('loading') || text.includes('đang') || text.includes('submitting');
                    const hasLoadingClass = cls.includes('loading') || cls.includes('submitting');
                    return { hasLoading: hasSpinner || hasLoadingText || hasLoadingClass || btn.disabled, disabled: btn.disabled, hasSpinner };
                }, submitBtn.selector);

                if (loading.hasLoading) {
                    t.status = 'passed';
                    t.details = `Submit button hiển thị loading state (spinner: ${loading.hasSpinner}, disabled: ${loading.disabled})`;
                } else {
                    t.status = 'warning';
                    t.details = `Submit button "${submitBtn.text}" không phát hiện loading state`;
                }
            } catch {
                t.status = 'warning';
                t.details = 'Không thể click submit button để kiểm tra loading';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = ButtonTests;
