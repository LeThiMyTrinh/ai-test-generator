/**
 * Group 3: Input Field (6 cases) — theo PDF
 * TC_INP_01 Nhập text → hiển thị đúng
 * TC_INP_02 Placeholder → hiển thị đúng
 * TC_INP_03 Focus input → hiển thị focus
 * TC_INP_04 Max length → không cho nhập quá
 * TC_INP_05 Required field → submit khi trống hiển thị error
 * TC_INP_06 Text area nhập nhiều dòng → hiển thị đúng
 */

const { createTestResult, runSafe, takeScreenshot, fillField } = require('./testHelpers');

class InputFieldTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testInputText(page, discovery));
        results.push(await this._testPlaceholder(page, discovery));
        results.push(await this._testFocusInput(page, discovery));
        results.push(await this._testMaxLength(page, discovery));
        results.push(await this._testRequiredField(page, discovery));
        results.push(await this._testTextarea(page));

        return results.filter(Boolean);
    }

    /** Tìm input text đầu tiên */
    async _findTextInput(page) {
        return page.evaluate(() => {
            const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="search"], input[type="tel"], input[type="url"], input:not([type])');
            for (const input of inputs) {
                const rect = input.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && getComputedStyle(input).display !== 'none') {
                    return {
                        found: true,
                        selector: input.id ? `#${input.id}` : (input.name ? `input[name="${input.name}"]` : 'input[type="text"]'),
                        type: input.type || 'text',
                        placeholder: input.placeholder || '',
                        maxLength: input.maxLength > 0 ? input.maxLength : null,
                        required: input.required,
                        name: input.name || '',
                    };
                }
            }
            return { found: false };
        });
    }

    /** TC_INP_01: Nhập text → hiển thị đúng */
    async _testInputText(page, discovery) {
        const test = createTestResult('inputField', 'TC_INP_01', 'Nhập text');
        return runSafe(test, async (t) => {
            const input = await this._findTextInput(page);
            if (!input.found) {
                t.status = 'warning';
                t.details = 'Không tìm thấy input text trên trang';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            const testText = 'Test nhập liệu 123';
            await fillField(page, input.selector, testText);
            await page.waitForTimeout(200);

            const value = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                return el ? el.value : '';
            }, input.selector);

            if (value === testText) {
                t.status = 'passed';
                t.details = `Nhập text hiển thị đúng: "${value}"`;
            } else if (value.length > 0) {
                t.status = 'warning';
                t.details = `Nhập "${testText}" nhưng hiển thị "${value}"`;
            } else {
                t.status = 'failed';
                t.details = 'Nhập text nhưng không hiển thị';
            }
            t.screenshot = await takeScreenshot(page);

            // Clear sau khi test
            await fillField(page, input.selector, '');
        });
    }

    /** TC_INP_02: Placeholder hiển thị đúng */
    async _testPlaceholder(page, discovery) {
        const test = createTestResult('inputField', 'TC_INP_02', 'Placeholder');
        return runSafe(test, async (t) => {
            const placeholders = await page.evaluate(() => {
                const inputs = document.querySelectorAll('input, textarea');
                const results = [];
                inputs.forEach(input => {
                    const rect = input.getBoundingClientRect();
                    if (rect.width === 0 || input.type === 'hidden' || input.type === 'submit') return;
                    results.push({
                        name: input.name || input.id || input.type,
                        placeholder: input.placeholder || '',
                        hasPlaceholder: !!input.placeholder,
                    });
                });
                return results;
            });

            const visibleInputs = placeholders.filter(p => p.name);
            const withPlaceholder = visibleInputs.filter(p => p.hasPlaceholder);

            if (visibleInputs.length === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy input trên trang';
            } else if (withPlaceholder.length === visibleInputs.length) {
                t.status = 'passed';
                t.details = `Tất cả ${withPlaceholder.length} inputs có placeholder`;
            } else if (withPlaceholder.length > 0) {
                t.status = 'warning';
                t.details = `${withPlaceholder.length}/${visibleInputs.length} inputs có placeholder`;
            } else {
                t.status = 'warning';
                t.details = 'Không input nào có placeholder (không bắt buộc)';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_INP_03: Focus input → hiển thị focus state */
    async _testFocusInput(page, discovery) {
        const test = createTestResult('inputField', 'TC_INP_03', 'Focus input');
        return runSafe(test, async (t) => {
            const input = await this._findTextInput(page);
            if (!input.found) {
                t.status = 'warning';
                t.details = 'Không tìm thấy input để test focus';
                return;
            }

            // Lấy style trước focus
            const beforeStyle = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const s = getComputedStyle(el);
                return { outline: s.outline, border: s.border, boxShadow: s.boxShadow, borderColor: s.borderColor };
            }, input.selector);

            // Focus vào input
            await page.click(input.selector, { timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);

            // Lấy style sau focus
            const afterStyle = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const s = getComputedStyle(el);
                return { outline: s.outline, border: s.border, boxShadow: s.boxShadow, borderColor: s.borderColor };
            }, input.selector);

            if (!beforeStyle || !afterStyle) {
                t.status = 'warning';
                t.details = 'Không thể đọc style của input';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            const hasChange = beforeStyle.outline !== afterStyle.outline ||
                beforeStyle.border !== afterStyle.border ||
                beforeStyle.boxShadow !== afterStyle.boxShadow ||
                beforeStyle.borderColor !== afterStyle.borderColor;

            if (hasChange) {
                t.status = 'passed';
                t.details = 'Input có focus state (border/outline/shadow thay đổi)';
            } else {
                t.status = 'warning';
                t.details = 'Input không có focus state visual rõ ràng';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_INP_04: Max length → không cho nhập quá */
    async _testMaxLength(page, discovery) {
        const test = createTestResult('inputField', 'TC_INP_04', 'Max length');
        return runSafe(test, async (t) => {
            // Tìm input có maxlength
            const inputInfo = await page.evaluate(() => {
                const inputs = document.querySelectorAll('input[maxlength], textarea[maxlength]');
                for (const input of inputs) {
                    const rect = input.getBoundingClientRect();
                    if (rect.width > 0 && input.maxLength > 0) {
                        return {
                            found: true,
                            selector: input.id ? `#${input.id}` : (input.name ? `input[name="${input.name}"]` : 'input[maxlength]'),
                            maxLength: input.maxLength,
                            name: input.name || input.id || 'unknown',
                        };
                    }
                }
                return { found: false };
            });

            if (!inputInfo.found) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy input có maxlength attribute';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            // Nhập chuỗi dài hơn maxlength
            const longText = 'A'.repeat(inputInfo.maxLength + 20);
            await fillField(page, inputInfo.selector, longText);
            await page.waitForTimeout(200);

            const actualLength = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                return el ? el.value.length : 0;
            }, inputInfo.selector);

            if (actualLength <= inputInfo.maxLength) {
                t.status = 'passed';
                t.details = `Input "${inputInfo.name}" không cho nhập quá ${inputInfo.maxLength} ký tự (nhập được: ${actualLength})`;
            } else {
                t.status = 'failed';
                t.details = `Input "${inputInfo.name}" cho nhập ${actualLength} ký tự (maxLength: ${inputInfo.maxLength})`;
            }
            t.screenshot = await takeScreenshot(page);
            await fillField(page, inputInfo.selector, '');
        });
    }

    /** TC_INP_05: Required field → submit khi trống hiển thị error */
    async _testRequiredField(page, discovery) {
        const test = createTestResult('inputField', 'TC_INP_05', 'Required field');
        return runSafe(test, async (t) => {
            const requiredInfo = await page.evaluate(() => {
                const required = document.querySelectorAll('input[required], textarea[required], select[required]');
                const results = [];
                required.forEach(input => {
                    const rect = input.getBoundingClientRect();
                    if (rect.width > 0) {
                        results.push({
                            name: input.name || input.id || input.type,
                            type: input.type || input.tagName.toLowerCase(),
                        });
                    }
                });
                return results;
            });

            if (requiredInfo.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy field required trên trang';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            // Tìm form chứa required field và submit
            const formSubmit = await page.evaluate(() => {
                const required = document.querySelector('[required]');
                if (!required) return null;
                const form = required.closest('form');
                if (!form) return null;
                const btn = form.querySelector('[type="submit"], button:not([type="button"])');
                return btn ? (btn.id ? `#${btn.id}` : 'form [type="submit"]') : null;
            });

            if (formSubmit) {
                await page.click(formSubmit, { timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(500);
            }

            const hasError = await page.evaluate(() => {
                const invalidInputs = document.querySelectorAll(':invalid');
                const errorMsgs = document.querySelectorAll('.error, .invalid-feedback, .field-error, [class*="error"]');
                let visibleErrors = 0;
                errorMsgs.forEach(el => { if (el.offsetHeight > 0) visibleErrors++; });
                return { invalidCount: invalidInputs.length, visibleErrors };
            });

            if (hasError.invalidCount > 0 || hasError.visibleErrors > 0) {
                t.status = 'passed';
                t.details = `Submit khi trống hiển thị error (${requiredInfo.length} required fields, ${hasError.invalidCount} invalid)`;
            } else {
                t.status = 'warning';
                t.details = `Có ${requiredInfo.length} required fields nhưng không phát hiện error khi submit trống`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_INP_06: Text area nhập nhiều dòng */
    async _testTextarea(page) {
        const test = createTestResult('inputField', 'TC_INP_06', 'Textarea nhập nhiều dòng');
        return runSafe(test, async (t) => {
            const textareaInfo = await page.evaluate(() => {
                const ta = document.querySelector('textarea');
                if (!ta) return { found: false };
                const rect = ta.getBoundingClientRect();
                if (rect.width === 0) return { found: false };
                return {
                    found: true,
                    selector: ta.id ? `#${ta.id}` : (ta.name ? `textarea[name="${ta.name}"]` : 'textarea'),
                    name: ta.name || ta.id || 'textarea',
                };
            });

            if (!textareaInfo.found) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy textarea trên trang';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            const multiLineText = 'Dòng 1\nDòng 2\nDòng 3';
            await fillField(page, textareaInfo.selector, multiLineText);
            await page.waitForTimeout(200);

            const result = await page.evaluate((sel) => {
                const ta = document.querySelector(sel);
                if (!ta) return { value: '', lines: 0 };
                const lines = ta.value.split('\n').length;
                return { value: ta.value, lines };
            }, textareaInfo.selector);

            if (result.lines >= 3) {
                t.status = 'passed';
                t.details = `Textarea nhập ${result.lines} dòng hiển thị đúng`;
            } else if (result.value.length > 0) {
                t.status = 'warning';
                t.details = `Textarea nhập được text nhưng chỉ ${result.lines} dòng`;
            } else {
                t.status = 'failed';
                t.details = 'Textarea không nhận được text';
            }
            t.screenshot = await takeScreenshot(page);
            await fillField(page, textareaInfo.selector, '');
        });
    }
}

module.exports = InputFieldTests;
