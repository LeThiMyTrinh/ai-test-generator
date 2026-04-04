/**
 * Group 4: Form Validation (5 cases) — theo PDF
 * TC_FORM_01 Submit form hợp lệ → thành công
 * TC_FORM_02 Submit thiếu field required → hiển thị lỗi
 * TC_FORM_03 Email sai format → hiển thị error
 * TC_FORM_04 Password ngắn → hiển thị error
 * TC_FORM_05 Reset form → clear dữ liệu
 */

const { createTestResult, runSafe, takeScreenshot, getSampleValue, fillField, navigateBack } = require('./testHelpers');

class FormValidationTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testSubmitValid(page, discovery, baseUrl));
        results.push(await this._testSubmitMissingRequired(page, discovery, baseUrl));
        results.push(await this._testInvalidEmail(page, discovery, baseUrl));
        results.push(await this._testShortPassword(page, discovery, baseUrl));
        results.push(await this._testResetForm(page, discovery, baseUrl));

        return results.filter(Boolean);
    }

    /** TC_FORM_01: Submit form hợp lệ */
    async _testSubmitValid(page, discovery, baseUrl) {
        const test = createTestResult('formValidation', 'TC_FORM_01', 'Submit form hợp lệ');
        return runSafe(test, async (t) => {
            const form = discovery.forms[0];
            if (!form) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy form trên trang';
                return;
            }

            // Điền tất cả fields
            for (const field of form.fields) {
                const value = getSampleValue(field);
                if (value && field.tag !== 'select') {
                    await fillField(page, field.selector, value);
                } else if (field.tag === 'select') {
                    await page.evaluate((sel) => {
                        const select = document.querySelector(sel);
                        if (select && select.options.length > 1) select.selectedIndex = 1;
                    }, field.selector).catch(() => {});
                }
            }

            // Submit
            const beforeUrl = page.url();
            if (form.submitSelector) {
                await page.click(form.submitSelector, { timeout: 3000 }).catch(() => {});
            } else {
                await page.evaluate((sel) => {
                    const f = document.querySelector(sel);
                    if (f) f.submit();
                }, form.selector).catch(() => {});
            }
            await page.waitForTimeout(1000);

            // Kiểm tra thành công
            const result = await page.evaluate(() => {
                const successIndicators = ['.success', '.alert-success', '.toast-success', '[class*="success"]', '.thank'];
                const errorIndicators = ['.error', '.alert-danger', '.alert-error', '[class*="error"]', '.invalid-feedback:visible'];
                let hasSuccess = false;
                let hasError = false;
                for (const sel of successIndicators) {
                    const el = document.querySelector(sel);
                    if (el && el.offsetHeight > 0) hasSuccess = true;
                }
                for (const sel of errorIndicators) {
                    const el = document.querySelector(sel);
                    if (el && el.offsetHeight > 0) hasError = true;
                }
                return { hasSuccess, hasError, urlChanged: false };
            });

            const urlChanged = page.url() !== beforeUrl;

            if (result.hasSuccess || urlChanged) {
                t.status = 'passed';
                t.details = 'Submit form hợp lệ thành công';
            } else if (result.hasError) {
                t.status = 'warning';
                t.details = 'Submit form nhưng vẫn hiển thị error (có thể validation server-side)';
            } else {
                t.status = 'warning';
                t.details = 'Đã submit form, không phát hiện rõ kết quả success/error';
            }
            t.screenshot = await takeScreenshot(page);
            await navigateBack(page, baseUrl);
        });
    }

    /** TC_FORM_02: Submit thiếu field required → hiển thị lỗi */
    async _testSubmitMissingRequired(page, discovery, baseUrl) {
        const test = createTestResult('formValidation', 'TC_FORM_02', 'Submit thiếu field required');
        return runSafe(test, async (t) => {
            const form = discovery.forms[0];
            if (!form) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy form trên trang';
                return;
            }

            const requiredFields = form.fields.filter(f => f.required);
            if (requiredFields.length === 0) {
                t.status = 'skipped';
                t.details = 'Form không có field required';
                return;
            }

            // Không điền gì, submit trực tiếp
            if (form.submitSelector) {
                await page.click(form.submitSelector, { timeout: 3000 }).catch(() => {});
            }
            await page.waitForTimeout(500);

            const hasError = await page.evaluate(() => {
                // Kiểm tra HTML5 validation hoặc custom error
                const invalidInputs = document.querySelectorAll(':invalid');
                const errorMessages = document.querySelectorAll('.error, .invalid-feedback, .field-error, [class*="error"], .help-block.text-danger');
                let visibleErrors = 0;
                errorMessages.forEach(el => { if (el.offsetHeight > 0) visibleErrors++; });
                return { invalidCount: invalidInputs.length, visibleErrors };
            });

            if (hasError.invalidCount > 0 || hasError.visibleErrors > 0) {
                t.status = 'passed';
                t.details = `Hiển thị lỗi khi submit thiếu field (${hasError.invalidCount} invalid, ${hasError.visibleErrors} error messages)`;
            } else {
                t.status = 'failed';
                t.details = 'Submit form trống nhưng không hiển thị error';
            }
            t.screenshot = await takeScreenshot(page);
            await navigateBack(page, baseUrl);
        });
    }

    /** TC_FORM_03: Email sai format → hiển thị error */
    async _testInvalidEmail(page, discovery, baseUrl) {
        const test = createTestResult('formValidation', 'TC_FORM_03', 'Email sai format');
        return runSafe(test, async (t) => {
            // Tìm email field
            let emailField = null;
            for (const form of discovery.forms) {
                for (const field of form.fields) {
                    if (field.type === 'email' || field.name.toLowerCase().includes('email')) {
                        emailField = { field, form };
                        break;
                    }
                }
                if (emailField) break;
            }

            if (!emailField) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy email field trên trang';
                return;
            }

            // Nhập email sai format
            await fillField(page, emailField.field.selector, 'invalid-email');
            await page.waitForTimeout(200);

            // Submit
            if (emailField.form.submitSelector) {
                await page.click(emailField.form.submitSelector, { timeout: 3000 }).catch(() => {});
            }
            await page.waitForTimeout(500);

            const hasError = await page.evaluate((sel) => {
                const input = document.querySelector(sel);
                if (!input) return { hasValidationError: false };
                const isInvalid = !input.validity.valid;
                const parent = input.closest('.form-group, .field, .input-group') || input.parentElement;
                const errorEl = parent ? parent.querySelector('.error, .invalid-feedback, [class*="error"]') : null;
                return { hasValidationError: isInvalid, hasErrorMessage: errorEl && errorEl.offsetHeight > 0 };
            }, emailField.field.selector);

            if (hasError.hasValidationError || hasError.hasErrorMessage) {
                t.status = 'passed';
                t.details = 'Email sai format hiển thị error đúng';
            } else {
                t.status = 'failed';
                t.details = 'Nhập email sai format nhưng không hiển thị error';
            }
            t.screenshot = await takeScreenshot(page);
            await navigateBack(page, baseUrl);
        });
    }

    /** TC_FORM_04: Password ngắn → hiển thị error */
    async _testShortPassword(page, discovery, baseUrl) {
        const test = createTestResult('formValidation', 'TC_FORM_04', 'Password ngắn');
        return runSafe(test, async (t) => {
            let pwField = null;
            for (const form of discovery.forms) {
                for (const field of form.fields) {
                    if (field.type === 'password' || field.name.toLowerCase().includes('password') || field.name.toLowerCase().includes('pass')) {
                        pwField = { field, form };
                        break;
                    }
                }
                if (pwField) break;
            }

            if (!pwField) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy password field trên trang';
                return;
            }

            // Nhập password ngắn (1-2 ký tự)
            await fillField(page, pwField.field.selector, 'ab');
            await page.waitForTimeout(200);

            // Submit
            if (pwField.form.submitSelector) {
                await page.click(pwField.form.submitSelector, { timeout: 3000 }).catch(() => {});
            }
            await page.waitForTimeout(500);

            const hasError = await page.evaluate((sel) => {
                const input = document.querySelector(sel);
                if (!input) return { hasError: false };
                const isInvalid = !input.validity.valid;
                const minLen = input.minLength;
                const parent = input.closest('.form-group, .field, .input-group') || input.parentElement;
                const errorEl = parent ? parent.querySelector('.error, .invalid-feedback, [class*="error"]') : null;
                return { hasError: isInvalid || (errorEl && errorEl.offsetHeight > 0), minLength: minLen };
            }, pwField.field.selector);

            if (hasError.hasError) {
                t.status = 'passed';
                t.details = `Password ngắn hiển thị error (minLength: ${hasError.minLength || 'N/A'})`;
            } else {
                t.status = 'warning';
                t.details = 'Nhập password ngắn nhưng không phát hiện error (có thể validation ở server)';
            }
            t.screenshot = await takeScreenshot(page);
            await navigateBack(page, baseUrl);
        });
    }

    /** TC_FORM_05: Reset form → clear dữ liệu */
    async _testResetForm(page, discovery, baseUrl) {
        const test = createTestResult('formValidation', 'TC_FORM_05', 'Reset form');
        return runSafe(test, async (t) => {
            const form = discovery.forms[0];
            if (!form) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy form trên trang';
                return;
            }

            // Điền dữ liệu vào form
            let filledCount = 0;
            for (const field of form.fields) {
                const value = getSampleValue(field);
                if (value && field.tag !== 'select') {
                    const ok = await fillField(page, field.selector, value);
                    if (ok) filledCount++;
                }
            }

            if (filledCount === 0) {
                t.status = 'skipped';
                t.details = 'Không thể điền dữ liệu vào form';
                return;
            }

            // Tìm và click reset button
            const resetClicked = await page.evaluate((formSel) => {
                const form = document.querySelector(formSel);
                if (!form) return false;
                const resetBtn = form.querySelector('[type="reset"], button.reset, .btn-reset');
                if (resetBtn) {
                    resetBtn.click();
                    return true;
                }
                // Fallback: gọi form.reset()
                form.reset();
                return true;
            }, form.selector);

            await page.waitForTimeout(300);

            // Kiểm tra fields đã clear
            const cleared = await page.evaluate((formSel) => {
                const form = document.querySelector(formSel);
                if (!form) return { allCleared: false };
                const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea');
                let emptyCount = 0;
                inputs.forEach(input => {
                    if (!input.value || input.value === '' || input.value === input.defaultValue) emptyCount++;
                });
                return { allCleared: emptyCount === inputs.length, total: inputs.length, empty: emptyCount };
            }, form.selector);

            if (cleared.allCleared) {
                t.status = 'passed';
                t.details = `Reset form thành công, ${cleared.total} fields đã được clear`;
            } else {
                t.status = 'warning';
                t.details = `Reset form: ${cleared.empty}/${cleared.total} fields được clear`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = FormValidationTests;
