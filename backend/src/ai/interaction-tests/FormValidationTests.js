/**
 * Group 2: Form Validation Tests (12 cases)
 * 2.1  Submit empty form
 * 2.2  Required field individual
 * 2.3  Valid data submit
 * 2.4  Invalid email format
 * 2.5  Invalid phone format
 * 2.6  Password mismatch
 * 2.7  Form reset
 * 2.8  Autocomplete check
 * 2.9  Max length validation
 * 2.10 Min length validation
 * 2.11 File upload validation
 * 2.12 Multi-step form wizard
 */

const {
    createTestResult, runSafe, takeScreenshot,
    getSampleValue, getInvalidEmail, getInvalidPhone, fillField,
} = require('./testHelpers');

class FormValidationTests {
    /**
     * Run all form validation tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];
        const forms = discovery.forms.slice(0, 5);

        for (const form of forms) {
            // 2.1 Submit empty form
            results.push(await this._testSubmitEmpty(page, form));
            // 2.2 Required field individual
            results.push(await this._testRequiredFieldIndividual(page, form));
            // 2.3 Valid data submit
            results.push(await this._testValidDataSubmit(page, form));
            // 2.4 Invalid email
            results.push(await this._testInvalidEmail(page, form));
            // 2.5 Invalid phone
            results.push(await this._testInvalidPhone(page, form));
            // 2.6 Password mismatch
            results.push(await this._testPasswordMismatch(page, form));
            // 2.7 Form reset
            results.push(await this._testFormReset(page, form));
            // 2.8 Autocomplete check
            results.push(await this._testAutocomplete(page, form));
            // 2.9 Max length
            results.push(await this._testMaxLength(page, form));
            // 2.10 Min length
            results.push(await this._testMinLength(page, form));
            // 2.11 File upload validation
            results.push(await this._testFileUpload(page, form));
        }

        // 2.12 Multi-step form wizard (outside form loop — looks for wizard patterns)
        results.push(await this._testMultiStepForm(page));

        // Filter out null results (skipped because field type not found)
        return results.filter(Boolean);
    }

    /**
     * 2.1: Submit empty form → should show validation errors
     */
    async _testSubmitEmpty(page, form) {
        const test = createTestResult('form_validation', '2.1', `Empty form submit: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            if (!form.submitSelector) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy submit button';
                return;
            }

            // Clear all fields first
            for (const field of form.fields) {
                try {
                    const el = await page.$(field.selector);
                    if (el && field.type !== 'checkbox' && field.type !== 'radio' && field.tag !== 'select') {
                        await el.fill('');
                    }
                } catch { /* skip */ }
            }

            // Click submit
            const submitBtn = await page.$(form.submitSelector);
            if (!submitBtn) {
                t.status = 'skipped';
                t.details = 'Submit button không tìm thấy trong DOM';
                return;
            }

            await submitBtn.click();
            await page.waitForTimeout(100);

            // Check HTML5 validation
            const validation = await page.evaluate((formSel) => {
                const formEl = document.querySelector(formSel);
                if (!formEl) return { hasForm: false };
                const invalids = [];
                formEl.querySelectorAll('input[required], select[required], textarea[required]').forEach(inp => {
                    if (!inp.checkValidity()) {
                        invalids.push(inp.name || inp.id || inp.type);
                    }
                });
                return { hasForm: true, invalidCount: invalids.length, invalids };
            }, form.selector);

            // Check visible error messages
            const errorMsgs = await this._findErrorMessages(page);
            const requiredFields = form.fields.filter(f => f.required);

            if (validation.invalidCount > 0 || errorMsgs.length > 0) {
                t.status = 'passed';
                t.details = `Validation hoạt động đúng. ${requiredFields.length} required fields, ${validation.invalidCount} invalid, ${errorMsgs.length} error messages`;
            } else if (requiredFields.length > 0) {
                t.status = 'warning';
                t.details = `Form có ${requiredFields.length} required fields nhưng không hiển thị validation errors khi submit trống`;
            } else {
                t.status = 'passed';
                t.details = 'Form không có required fields — accepted empty submit';
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 2.2: Required field individual — leave each required field empty one at a time
     */
    async _testRequiredFieldIndividual(page, form) {
        const test = createTestResult('form_validation', '2.2', `Required field individual: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const requiredFields = form.fields.filter(f => f.required);
            if (requiredFields.length === 0) {
                t.status = 'skipped';
                t.details = 'Không có required fields';
                return;
            }
            if (!form.submitSelector) {
                t.status = 'skipped';
                t.details = 'Không có submit button';
                return;
            }

            const fieldResults = [];
            for (const targetField of requiredFields.slice(0, 5)) {
                // Fill all fields with valid data
                for (const field of form.fields) {
                    try {
                        const el = await page.$(field.selector);
                        if (!el) continue;
                        if (field.tag === 'select') {
                            await page.selectOption(field.selector, { index: 1 }).catch(() => {});
                        } else if (field.type === 'checkbox' || field.type === 'radio') {
                            await el.check().catch(() => {});
                        } else {
                            const val = getSampleValue(field);
                            if (val) await el.fill(val);
                        }
                    } catch { /* skip */ }
                }

                // Clear the target field
                try {
                    const targetEl = await page.$(targetField.selector);
                    if (targetEl && targetField.type !== 'checkbox' && targetField.type !== 'radio') {
                        await targetEl.fill('');
                    }
                } catch { /* skip */ }

                // Submit
                try {
                    const btn = await page.$(form.submitSelector);
                    if (btn) await btn.click();
                    await page.waitForTimeout(200);

                    const hasError = await page.evaluate((fieldSel) => {
                        const input = document.querySelector(fieldSel);
                        if (!input) return false;
                        if (!input.checkValidity()) return true;
                        // Check for sibling/parent error messages
                        const parent = input.closest('.form-group, .field, .input-group') || input.parentElement;
                        if (parent) {
                            const err = parent.querySelector('.error, .invalid-feedback, .text-danger, .field-error, .text-red-500');
                            if (err && err.textContent.trim().length > 0) return true;
                        }
                        return input.classList.contains('is-invalid') || input.classList.contains('error') || input.getAttribute('aria-invalid') === 'true';
                    }, targetField.selector);

                    fieldResults.push(`${targetField.name || targetField.type}: ${hasError ? '✓ có error' : '✗ không có error'}`);
                } catch {
                    fieldResults.push(`${targetField.name || targetField.type}: ✗ lỗi khi test`);
                }
            }

            const failCount = fieldResults.filter(r => r.includes('✗')).length;
            t.status = failCount === 0 ? 'passed' : failCount === requiredFields.length ? 'failed' : 'warning';
            t.details = `Tested ${fieldResults.length}/${requiredFields.length} required fields: ${fieldResults.join('; ')}`;
            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 2.3: Valid data submit
     */
    async _testValidDataSubmit(page, form) {
        const test = createTestResult('form_validation', '2.3', `Valid data submit: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            if (!form.submitSelector) {
                t.status = 'skipped';
                t.details = 'Không có submit button';
                return;
            }

            const filledFields = [];
            for (const field of form.fields) {
                try {
                    const el = await page.$(field.selector);
                    if (!el) continue;
                    if (field.tag === 'select') {
                        await page.selectOption(field.selector, { index: 1 }).catch(() => {});
                        filledFields.push(`${field.name || field.type}: [selected]`);
                    } else if (field.type === 'checkbox' || field.type === 'radio') {
                        await el.check().catch(() => {});
                        filledFields.push(`${field.name}: checked`);
                    } else {
                        const val = getSampleValue(field);
                        if (val) {
                            await el.fill(val);
                            filledFields.push(`${field.name || field.type}: "${val}"`);
                        }
                    }
                } catch { /* skip */ }
            }

            // Capture URL before submit
            const beforeUrl = page.url();

            // Submit
            const btn = await page.$(form.submitSelector);
            if (btn) await btn.click();
            await page.waitForTimeout(150);

            const afterUrl = page.url();
            const errorMsgs = await this._findErrorMessages(page);

            // Check for success indicators
            const successIndicators = await page.evaluate(() => {
                const selectors = ['.success', '.alert-success', '.toast-success', '.notification-success', '[role="alert"]'];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.textContent.trim().length > 0) {
                        const style = getComputedStyle(el);
                        if (style.display !== 'none') return el.textContent.trim().substring(0, 100);
                    }
                }
                return null;
            });

            if (errorMsgs.length > 0) {
                t.status = 'warning';
                t.details = `Submit với valid data nhưng có errors: ${errorMsgs.slice(0, 2).join('; ')}. Filled ${filledFields.length} fields.`;
            } else if (afterUrl !== beforeUrl || successIndicators) {
                t.status = 'passed';
                t.details = `Submit thành công. ${afterUrl !== beforeUrl ? 'Redirected.' : ''} ${successIndicators ? `Success: "${successIndicators}"` : ''} Filled ${filledFields.length} fields.`;
            } else {
                t.status = 'passed';
                t.details = `Submit hoàn tất (no errors). Filled ${filledFields.length}/${form.fields.length} fields.`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 2.4: Invalid email format
     */
    async _testInvalidEmail(page, form) {
        const emailField = form.fields.find(f =>
            f.type === 'email' || f.name.toLowerCase().includes('email')
        );
        if (!emailField) return null;

        const test = createTestResult('form_validation', '2.4', `Invalid email format: "${emailField.name || 'email'}"`);
        return runSafe(test, async (t) => {
            const invalidEmails = getInvalidEmail();
            const results = [];

            for (const badEmail of invalidEmails.slice(0, 3)) {
                try {
                    await fillField(page, emailField.selector, badEmail);
                    // Trigger validation
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(100);

                    // Try submit if button exists
                    if (form.submitSelector) {
                        const btn = await page.$(form.submitSelector);
                        if (btn) await btn.click();
                        await page.waitForTimeout(150);
                    }

                    const hasError = await page.evaluate((sel) => {
                        const input = document.querySelector(sel);
                        if (!input) return false;
                        if (!input.checkValidity()) return true;
                        if (input.classList.contains('is-invalid') || input.getAttribute('aria-invalid') === 'true') return true;
                        const parent = input.closest('.form-group, .field') || input.parentElement;
                        if (parent) {
                            const err = parent.querySelector('.error, .invalid-feedback, .text-danger, .text-red-500');
                            if (err && getComputedStyle(err).display !== 'none' && err.textContent.trim()) return true;
                        }
                        return false;
                    }, emailField.selector);

                    results.push(`"${badEmail}": ${hasError ? '✓ rejected' : '✗ accepted'}`);
                } catch {
                    results.push(`"${badEmail}": ✗ error`);
                }
            }

            const passCount = results.filter(r => r.includes('✓')).length;
            t.status = passCount === results.length ? 'passed' : passCount === 0 ? 'failed' : 'warning';
            t.details = `Email validation: ${results.join('; ')}`;
            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 2.5: Invalid phone format
     */
    async _testInvalidPhone(page, form) {
        const phoneField = form.fields.find(f =>
            f.type === 'tel' || f.name.toLowerCase().includes('phone') || f.name.toLowerCase().includes('tel')
        );
        if (!phoneField) return null;

        const test = createTestResult('form_validation', '2.5', `Invalid phone format: "${phoneField.name || 'phone'}"`);
        return runSafe(test, async (t) => {
            const invalidPhones = getInvalidPhone();
            const results = [];

            for (const badPhone of invalidPhones.slice(0, 3)) {
                try {
                    await fillField(page, phoneField.selector, badPhone);
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(100);

                    if (form.submitSelector) {
                        const btn = await page.$(form.submitSelector);
                        if (btn) await btn.click();
                        await page.waitForTimeout(150);
                    }

                    const hasError = await page.evaluate((sel) => {
                        const input = document.querySelector(sel);
                        if (!input) return false;
                        if (!input.checkValidity()) return true;
                        if (input.classList.contains('is-invalid') || input.getAttribute('aria-invalid') === 'true') return true;
                        const parent = input.closest('.form-group, .field') || input.parentElement;
                        if (parent) {
                            const err = parent.querySelector('.error, .invalid-feedback, .text-danger, .text-red-500');
                            if (err && getComputedStyle(err).display !== 'none' && err.textContent.trim()) return true;
                        }
                        return false;
                    }, phoneField.selector);

                    results.push(`"${badPhone}": ${hasError ? '✓ rejected' : '✗ accepted'}`);
                } catch {
                    results.push(`"${badPhone}": ✗ error`);
                }
            }

            const passCount = results.filter(r => r.includes('✓')).length;
            t.status = passCount === results.length ? 'passed' : passCount === 0 ? 'failed' : 'warning';
            t.details = `Phone validation: ${results.join('; ')}`;
            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 2.6: Password mismatch
     */
    async _testPasswordMismatch(page, form) {
        const passFields = form.fields.filter(f =>
            f.type === 'password' || f.name.toLowerCase().includes('password') || f.name.toLowerCase().includes('pass')
        );
        if (passFields.length < 2) return null;

        const test = createTestResult('form_validation', '2.6', 'Password mismatch check');
        return runSafe(test, async (t) => {
            // Fill first password
            await fillField(page, passFields[0].selector, 'TestPass123!');
            // Fill confirm with different value
            await fillField(page, passFields[1].selector, 'DifferentPass456!');

            // Submit
            if (form.submitSelector) {
                const btn = await page.$(form.submitSelector);
                if (btn) await btn.click();
                await page.waitForTimeout(100);
            } else {
                await page.keyboard.press('Tab');
                await page.waitForTimeout(150);
            }

            const hasError = await page.evaluate((sel) => {
                const input = document.querySelector(sel);
                if (!input) return false;
                if (!input.checkValidity()) return true;
                if (input.classList.contains('is-invalid') || input.getAttribute('aria-invalid') === 'true') return true;
                const parent = input.closest('.form-group, .field') || input.parentElement;
                if (parent) {
                    const err = parent.querySelector('.error, .invalid-feedback, .text-danger, .text-red-500');
                    if (err && getComputedStyle(err).display !== 'none' && err.textContent.trim()) return true;
                }
                return false;
            }, passFields[1].selector);

            const errorMsgs = await this._findErrorMessages(page);
            const hasMismatchError = errorMsgs.some(m =>
                m.toLowerCase().includes('match') || m.toLowerCase().includes('khớp') ||
                m.toLowerCase().includes('confirm') || m.toLowerCase().includes('same')
            );

            if (hasError || hasMismatchError) {
                t.status = 'passed';
                t.details = `Password mismatch detected đúng. ${hasMismatchError ? 'Error message: ' + errorMsgs.find(m => m.toLowerCase().includes('match') || m.toLowerCase().includes('confirm')) : ''}`;
            } else {
                t.status = 'warning';
                t.details = 'Nhập password khác nhau nhưng không thấy mismatch error (có thể validate server-side)';
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 2.7: Form reset
     */
    async _testFormReset(page, form) {
        const test = createTestResult('form_validation', '2.7', `Form reset: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            // Check for reset button
            const hasResetBtn = await page.evaluate((formSel) => {
                const formEl = document.querySelector(formSel);
                if (!formEl) return null;
                const resetBtn = formEl.querySelector('[type="reset"], button.reset, .btn-reset');
                return resetBtn ? (resetBtn.id ? `#${resetBtn.id}` : '[type="reset"]') : null;
            }, form.selector);

            if (!hasResetBtn) {
                t.status = 'skipped';
                t.details = 'Không có reset button trong form';
                return;
            }

            // Fill some fields
            for (const field of form.fields.slice(0, 3)) {
                try {
                    const el = await page.$(field.selector);
                    if (el && field.type !== 'checkbox' && field.type !== 'radio' && field.tag !== 'select') {
                        await el.fill('TEST RESET VALUE');
                    }
                } catch { /* skip */ }
            }

            // Click reset
            await page.click(hasResetBtn);
            await page.waitForTimeout(150);

            // Check if fields are empty
            const fieldsAfterReset = await page.evaluate((formSel) => {
                const formEl = document.querySelector(formSel);
                if (!formEl) return { checked: 0, empty: 0 };
                let checked = 0, empty = 0;
                formEl.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea').forEach(inp => {
                    checked++;
                    if (!inp.value || inp.value === inp.defaultValue) empty++;
                });
                return { checked, empty };
            }, form.selector);

            if (fieldsAfterReset.checked === 0) {
                t.status = 'skipped';
                t.details = 'Không có fields để kiểm tra sau reset';
            } else if (fieldsAfterReset.empty === fieldsAfterReset.checked) {
                t.status = 'passed';
                t.details = `Reset hoạt động đúng — ${fieldsAfterReset.empty}/${fieldsAfterReset.checked} fields trở về rỗng`;
            } else {
                t.status = 'failed';
                t.details = `Reset không hoàn toàn — chỉ ${fieldsAfterReset.empty}/${fieldsAfterReset.checked} fields trở về rỗng`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 2.8: Autocomplete check on sensitive fields
     */
    async _testAutocomplete(page, form) {
        const test = createTestResult('form_validation', '2.8', `Autocomplete check: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const sensitiveFields = await page.evaluate((formSel) => {
                const formEl = document.querySelector(formSel);
                if (!formEl) return [];
                const results = [];
                formEl.querySelectorAll('input').forEach(inp => {
                    const name = (inp.name || '').toLowerCase();
                    const type = (inp.type || '').toLowerCase();
                    const isSensitive = type === 'password' || name.includes('card') || name.includes('cvv') ||
                        name.includes('ssn') || name.includes('credit') || name.includes('secret') ||
                        name.includes('token') || name.includes('pin');
                    if (isSensitive) {
                        results.push({
                            name: inp.name || inp.id || type,
                            type,
                            autocomplete: inp.getAttribute('autocomplete'),
                            hasSafeValue: inp.getAttribute('autocomplete') === 'off' ||
                                inp.getAttribute('autocomplete') === 'new-password' ||
                                type === 'password',
                        });
                    }
                });
                return results;
            }, form.selector);

            if (sensitiveFields.length === 0) {
                t.status = 'skipped';
                t.details = 'Không có sensitive fields (password, card, cvv, etc.)';
                return;
            }

            const unsafe = sensitiveFields.filter(f => !f.hasSafeValue);
            if (unsafe.length > 0) {
                t.status = 'warning';
                t.details = `${unsafe.length} sensitive fields thiếu autocomplete="off": ${unsafe.map(f => f.name).join(', ')}`;
            } else {
                t.status = 'passed';
                t.details = `${sensitiveFields.length} sensitive fields đều có autocomplete phù hợp ✓`;
            }
        });
    }

    /**
     * 2.9: Max length validation
     */
    async _testMaxLength(page, form) {
        const test = createTestResult('form_validation', '2.9', `Max length validation: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const fieldsWithMax = await page.evaluate((formSel) => {
                const formEl = document.querySelector(formSel);
                if (!formEl) return [];
                const results = [];
                formEl.querySelectorAll('input[maxlength], textarea[maxlength]').forEach(inp => {
                    results.push({
                        name: inp.name || inp.id || inp.type,
                        selector: inp.id ? `#${inp.id}` : (inp.name ? `${formSel} [name="${inp.name}"]` : null),
                        maxLength: parseInt(inp.getAttribute('maxlength')),
                    });
                });
                return results.filter(f => f.selector && f.maxLength > 0);
            }, form.selector);

            if (fieldsWithMax.length === 0) {
                t.status = 'skipped';
                t.details = 'Không có fields có maxlength attribute';
                return;
            }

            const results = [];
            for (const field of fieldsWithMax.slice(0, 3)) {
                try {
                    const longText = 'A'.repeat(field.maxLength + 50);
                    await fillField(page, field.selector, longText);

                    const actualLength = await page.evaluate((sel) => {
                        const inp = document.querySelector(sel);
                        return inp ? inp.value.length : -1;
                    }, field.selector);

                    if (actualLength <= field.maxLength) {
                        results.push(`${field.name}: ✓ truncated to ${actualLength}/${field.maxLength}`);
                    } else {
                        results.push(`${field.name}: ✗ accepted ${actualLength} chars (max: ${field.maxLength})`);
                    }
                } catch {
                    results.push(`${field.name}: ✗ error`);
                }
            }

            const failCount = results.filter(r => r.includes('✗')).length;
            t.status = failCount === 0 ? 'passed' : 'failed';
            t.details = `Max length: ${results.join('; ')}`;
        });
    }

    /**
     * 2.10: Min length validation
     */
    async _testMinLength(page, form) {
        const test = createTestResult('form_validation', '2.10', `Min length validation: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const fieldsWithMin = await page.evaluate((formSel) => {
                const formEl = document.querySelector(formSel);
                if (!formEl) return [];
                const results = [];
                formEl.querySelectorAll('input[minlength], textarea[minlength]').forEach(inp => {
                    const minLen = parseInt(inp.getAttribute('minlength'));
                    if (minLen > 0) {
                        results.push({
                            name: inp.name || inp.id || inp.type,
                            selector: inp.id ? `#${inp.id}` : (inp.name ? `${formSel} [name="${inp.name}"]` : null),
                            minLength: minLen,
                        });
                    }
                });
                return results.filter(f => f.selector);
            }, form.selector);

            if (fieldsWithMin.length === 0) {
                t.status = 'skipped';
                t.details = 'Không có fields có minlength attribute';
                return;
            }

            const results = [];
            for (const field of fieldsWithMin.slice(0, 3)) {
                try {
                    // Input shorter than minlength
                    const shortText = 'A'.repeat(Math.max(1, field.minLength - 2));
                    await fillField(page, field.selector, shortText);
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(100);

                    // Try submit
                    if (form.submitSelector) {
                        const btn = await page.$(form.submitSelector);
                        if (btn) await btn.click();
                        await page.waitForTimeout(150);
                    }

                    const hasError = await page.evaluate((sel) => {
                        const input = document.querySelector(sel);
                        if (!input) return false;
                        return !input.checkValidity() || input.classList.contains('is-invalid') || input.getAttribute('aria-invalid') === 'true';
                    }, field.selector);

                    results.push(`${field.name} (min:${field.minLength}): ${hasError ? '✓ rejected short input' : '✗ accepted short input'}`);
                } catch {
                    results.push(`${field.name}: ✗ error`);
                }
            }

            const passCount = results.filter(r => r.includes('✓')).length;
            t.status = passCount === results.length ? 'passed' : passCount === 0 ? 'failed' : 'warning';
            t.details = `Min length: ${results.join('; ')}`;
            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 2.11: File upload validation — check accept attribute and required
     */
    async _testFileUpload(page, form) {
        const fileField = form.fields.find(f => f.type === 'file');
        if (!fileField) return null;

        const test = createTestResult('form_validation', '2.11', `File upload validation: "${fileField.name || 'file'}"`);
        return runSafe(test, async (t) => {
            const fileInfo = await page.evaluate((sel) => {
                const input = document.querySelector(sel);
                if (!input) return null;
                return {
                    accept: input.getAttribute('accept') || '',
                    required: input.required,
                    multiple: input.multiple,
                    hasLabel: !!input.getAttribute('aria-label') || !!document.querySelector(`label[for="${input.id}"]`),
                };
            }, fileField.selector);

            if (!fileInfo) {
                t.status = 'skipped';
                t.details = 'File input không tìm thấy';
                return;
            }

            const issues = [];
            if (!fileInfo.accept) {
                issues.push('thiếu accept attribute (nên giới hạn file types)');
            }
            if (!fileInfo.hasLabel) {
                issues.push('thiếu label/aria-label');
            }

            if (issues.length > 0) {
                t.status = 'warning';
                t.details = `File input: accept="${fileInfo.accept}", required=${fileInfo.required}, multiple=${fileInfo.multiple}. Issues: ${issues.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `File input OK: accept="${fileInfo.accept}", required=${fileInfo.required}, multiple=${fileInfo.multiple} ✓`;
            }
        });
    }

    /**
     * 2.12: Multi-step form wizard — detect and test step navigation
     */
    async _testMultiStepForm(page) {
        const test = createTestResult('form_validation', '2.12', 'Multi-step form wizard');
        return runSafe(test, async (t) => {
            const wizard = await page.evaluate(() => {
                // Detect multi-step/wizard form patterns
                const stepIndicators = document.querySelectorAll('.step, .wizard-step, .form-step, [class*="step-indicator"], .stepper, [class*="wizard"], .progress-step, [data-step]');
                const nextBtns = document.querySelectorAll('button[class*="next"], .btn-next, [data-action="next"], button:has-text("Next"), button:has-text("Tiếp")');
                const prevBtns = document.querySelectorAll('button[class*="prev"], .btn-prev, [data-action="prev"], button:has-text("Back"), button:has-text("Quay lại")');

                // Check for tab-based or fieldset-based steps
                const fieldsets = document.querySelectorAll('fieldset');
                const hasHiddenFieldsets = Array.from(fieldsets).some(f => getComputedStyle(f).display === 'none');

                return {
                    hasSteps: stepIndicators.length > 0,
                    stepCount: stepIndicators.length,
                    hasNextBtn: nextBtns.length > 0,
                    hasPrevBtn: prevBtns.length > 0,
                    nextBtnSelector: nextBtns.length > 0 ? (nextBtns[0].id ? `#${nextBtns[0].id}` : null) : null,
                    fieldsets: fieldsets.length,
                    hasHiddenFieldsets,
                    isWizard: stepIndicators.length >= 2 || (hasHiddenFieldsets && fieldsets.length >= 2),
                };
            });

            if (!wizard.isWizard) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy multi-step form wizard trên trang';
                return;
            }

            const details = [`${wizard.stepCount} steps detected`];
            const issues = [];

            if (!wizard.hasNextBtn) {
                issues.push('thiếu Next/Continue button');
            }
            if (wizard.stepCount >= 3 && !wizard.hasPrevBtn) {
                issues.push('thiếu Back/Previous button (nên có cho >= 3 steps)');
            }

            if (wizard.hasNextBtn && wizard.nextBtnSelector) {
                try {
                    await page.click(wizard.nextBtnSelector);
                    await page.waitForTimeout(200);
                    details.push('Next button click OK');
                } catch {
                    details.push('Next button click failed');
                }
            }

            if (issues.length > 0) {
                t.status = 'warning';
                t.details = `Wizard form: ${details.join(', ')}. Issues: ${issues.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `Wizard form: ${details.join(', ')}. hasNext=${wizard.hasNextBtn}, hasPrev=${wizard.hasPrevBtn} ✓`;
            }
        });
    }

    /**
     * Helper: Find visible error messages on page
     */
    async _findErrorMessages(page) {
        return page.evaluate(() => {
            const selectors = [
                '.error', '.error-message', '.invalid-feedback', '.field-error',
                '[role="alert"]', '.alert-danger', '.form-error', '.validation-error',
                '.text-danger', '.text-red-500', '.has-error', '.help-block.error',
            ];
            const errors = [];
            for (const sel of selectors) {
                document.querySelectorAll(sel).forEach(el => {
                    const text = el.textContent.trim();
                    if (text.length > 0 && text.length < 200) {
                        const style = getComputedStyle(el);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                            errors.push(text.substring(0, 100));
                        }
                    }
                });
            }
            return [...new Set(errors)];
        });
    }
}

module.exports = FormValidationTests;
