/**
 * Group 3: Form Boundary Testing (10 cases)
 * 3.1 XSS script injection
 * 3.2 HTML injection
 * 3.3 SQL injection
 * 3.4 Extra long input (10000+ chars)
 * 3.5 Special characters
 * 3.6 Unicode/Emoji
 * 3.7 Number in text field
 * 3.8 Negative/zero in number field
 * 3.9 Copy-paste behavior
 * 3.10 Leading/trailing spaces
 */

const {
    createTestResult, runSafe, takeScreenshot,
    getXSSPayloads, getHTMLPayloads, getSQLPayloads,
    fillField, findFirstTextField,
} = require('./testHelpers');

class FormBoundaryTests {
    /**
     * Run all boundary tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];
        const forms = discovery.forms.slice(0, 3);

        if (forms.length === 0) {
            results.push(createTestResult('form_boundary', '3.0', 'Form boundary tests', {
                status: 'skipped', details: 'Không tìm thấy form trên trang',
            }));
            return results;
        }

        for (const form of forms) {
            results.push(await this._testXSSInjection(page, form));
            results.push(await this._testHTMLInjection(page, form));
            results.push(await this._testSQLInjection(page, form));
            results.push(await this._testExtraLongInput(page, form));
            results.push(await this._testSpecialCharacters(page, form));
            results.push(await this._testUnicodeEmoji(page, form));
            results.push(await this._testNumberInTextField(page, form));
            results.push(await this._testNegativeZeroNumber(page, form));
            results.push(await this._testCopyPaste(page, form));
            results.push(await this._testLeadingTrailingSpaces(page, form));
        }

        return results.filter(Boolean);
    }

    /**
     * 3.1: XSS script injection
     */
    async _testXSSInjection(page, form) {
        const test = createTestResult('form_boundary', '3.1', `XSS injection: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const textField = await findFirstTextField(page, form.selector);
            if (!textField) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy text field để test';
                return;
            }

            const payloads = getXSSPayloads();
            const results = [];
            let alertTriggered = false;

            // Listen for dialog (alert/confirm/prompt)
            const dialogHandler = () => { alertTriggered = true; };
            page.on('dialog', async dialog => {
                alertTriggered = true;
                await dialog.dismiss();
            });

            for (const payload of payloads.slice(0, 3)) {
                try {
                    alertTriggered = false;
                    await fillField(page, textField.selector, payload);
                    await page.waitForTimeout(100);

                    // Try submit
                    if (form.submitSelector) {
                        const btn = await page.$(form.submitSelector);
                        if (btn) await btn.click();
                        await page.waitForTimeout(100);
                    }

                    // Check if script was executed
                    const wasExecuted = await page.evaluate(() => {
                        // Check if there's an unescaped script tag in the DOM
                        const bodyHTML = document.body.innerHTML;
                        return bodyHTML.includes('<script>alert') || bodyHTML.includes('onerror=alert');
                    });

                    if (alertTriggered || wasExecuted) {
                        results.push(`"${payload.substring(0, 30)}": ✗ XSS executed!`);
                    } else {
                        results.push(`"${payload.substring(0, 30)}": ✓ escaped`);
                    }
                } catch {
                    results.push(`"${payload.substring(0, 30)}": ✓ blocked`);
                }
            }

            page.removeListener('dialog', dialogHandler);

            const failCount = results.filter(r => r.includes('✗')).length;
            t.status = failCount > 0 ? 'failed' : 'passed';
            t.details = failCount > 0
                ? `⚠ XSS VULNERABILITY DETECTED! ${results.join('; ')}`
                : `XSS payloads đều bị chặn/escape đúng. ${results.join('; ')}`;
            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 3.2: HTML injection
     */
    async _testHTMLInjection(page, form) {
        const test = createTestResult('form_boundary', '3.2', `HTML injection: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const textField = await findFirstTextField(page, form.selector);
            if (!textField) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy text field để test';
                return;
            }

            const payloads = getHTMLPayloads();
            const results = [];

            for (const payload of payloads.slice(0, 3)) {
                try {
                    await fillField(page, textField.selector, payload);

                    if (form.submitSelector) {
                        const btn = await page.$(form.submitSelector);
                        if (btn) await btn.click();
                        await page.waitForTimeout(100);
                    }

                    // Check if HTML was rendered as actual elements
                    const wasRendered = await page.evaluate((pl) => {
                        // Look for injected elements that shouldn't be there
                        const bodyHTML = document.body.innerHTML;
                        if (pl.includes('<img') && bodyHTML.includes('onerror=alert')) return true;
                        if (pl.includes('<iframe') && document.querySelector('iframe[src*="javascript"]')) return true;
                        if (pl.includes('onmouseover') && bodyHTML.includes('onmouseover="alert')) return true;
                        return false;
                    }, payload);

                    results.push(`"${payload.substring(0, 30)}": ${wasRendered ? '✗ rendered' : '✓ escaped'}`);
                } catch {
                    results.push(`"${payload.substring(0, 30)}": ✓ blocked`);
                }
            }

            const failCount = results.filter(r => r.includes('✗')).length;
            t.status = failCount > 0 ? 'failed' : 'passed';
            t.details = failCount > 0
                ? `⚠ HTML INJECTION detected! ${results.join('; ')}`
                : `HTML payloads đều bị escape đúng. ${results.join('; ')}`;
            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 3.3: SQL injection (frontend check only)
     */
    async _testSQLInjection(page, form) {
        const test = createTestResult('form_boundary', '3.3', `SQL injection (frontend): "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const textField = await findFirstTextField(page, form.selector);
            if (!textField) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy text field để test';
                return;
            }

            const payloads = getSQLPayloads();
            const results = [];
            let serverErrors = 0;

            // Monitor for network errors
            const responses = [];
            const responseHandler = (response) => {
                if (response.status() >= 500) {
                    responses.push({ url: response.url(), status: response.status() });
                }
            };
            page.on('response', responseHandler);

            for (const payload of payloads.slice(0, 3)) {
                try {
                    responses.length = 0;
                    await fillField(page, textField.selector, payload);

                    if (form.submitSelector) {
                        const btn = await page.$(form.submitSelector);
                        if (btn) await btn.click();
                        await page.waitForTimeout(100);
                    }

                    // Check for server error indicators on page
                    const hasServerError = await page.evaluate(() => {
                        const bodyText = document.body.innerText.toLowerCase();
                        return bodyText.includes('sql') || bodyText.includes('syntax error') ||
                            bodyText.includes('database error') || bodyText.includes('mysql') ||
                            bodyText.includes('postgresql') || bodyText.includes('sqlite') ||
                            bodyText.includes('internal server error') || bodyText.includes('500');
                    });

                    if (responses.length > 0 || hasServerError) {
                        serverErrors++;
                        results.push(`"${payload.substring(0, 25)}": ✗ server error/SQL leak`);
                    } else {
                        results.push(`"${payload.substring(0, 25)}": ✓ handled`);
                    }
                } catch {
                    results.push(`"${payload.substring(0, 25)}": ✓ blocked`);
                }
            }

            page.removeListener('response', responseHandler);

            t.status = serverErrors > 0 ? 'failed' : 'passed';
            t.details = serverErrors > 0
                ? `⚠ SQL injection có thể gây lỗi server! ${results.join('; ')}`
                : `SQL payloads xử lý đúng, không lỗi server. ${results.join('; ')}`;
            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 3.4: Extra long input (10000+ chars)
     */
    async _testExtraLongInput(page, form) {
        const test = createTestResult('form_boundary', '3.4', `Extra long input: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const textField = await findFirstTextField(page, form.selector);
            if (!textField) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy text field để test';
                return;
            }

            const longString = 'A'.repeat(10000);
            try {
                await fillField(page, textField.selector, longString);
                await page.waitForTimeout(100);

                const actualLength = await page.evaluate((sel) => {
                    const inp = document.querySelector(sel);
                    return inp ? inp.value.length : -1;
                }, textField.selector);

                // Check page didn't crash
                const pageOk = await page.evaluate(() => !!document.body).catch(() => false);

                if (!pageOk) {
                    t.status = 'failed';
                    t.details = 'Page bị crash khi nhập 10000+ ký tự!';
                } else if (textField.maxLength && actualLength <= textField.maxLength) {
                    t.status = 'passed';
                    t.details = `Input bị giới hạn bởi maxlength=${textField.maxLength}. Accepted: ${actualLength} chars`;
                } else if (actualLength >= 10000) {
                    t.status = 'warning';
                    t.details = `Field accepted ${actualLength} chars (10000+). Nên có maxlength limit.`;
                } else {
                    t.status = 'passed';
                    t.details = `Input handled OK. Accepted: ${actualLength} chars`;
                }
            } catch (err) {
                t.status = 'warning';
                t.details = `Long input gây lỗi: ${err.message.substring(0, 100)}`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 3.5: Special characters
     */
    async _testSpecialCharacters(page, form) {
        const test = createTestResult('form_boundary', '3.5', `Special characters: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const textField = await findFirstTextField(page, form.selector);
            if (!textField) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy text field để test';
                return;
            }

            const specialInputs = [
                '!@#$%^&*()_+{}[]|\\:";\'<>?,./~`',
                '../../../../etc/passwd',
                '${7*7}{{7*7}}',
                '\x00\x01\x02\x03',
            ];

            const results = [];
            for (const input of specialInputs) {
                try {
                    await fillField(page, textField.selector, input);
                    await page.waitForTimeout(100);

                    const pageOk = await page.evaluate(() => !!document.body).catch(() => false);
                    const jsErrors = await page.evaluate(() => {
                        return window.__testErrors ? window.__testErrors.length : 0;
                    }).catch(() => 0);

                    results.push(`"${input.substring(0, 20)}": ${pageOk ? '✓ OK' : '✗ crash'}`);
                } catch {
                    results.push(`"${input.substring(0, 20)}": ✗ error`);
                }
            }

            const failCount = results.filter(r => r.includes('✗')).length;
            t.status = failCount > 0 ? 'failed' : 'passed';
            t.details = `Special chars: ${results.join('; ')}`;
            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 3.6: Unicode/Emoji
     */
    async _testUnicodeEmoji(page, form) {
        const test = createTestResult('form_boundary', '3.6', `Unicode/Emoji: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const textField = await findFirstTextField(page, form.selector);
            if (!textField) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy text field để test';
                return;
            }

            const unicodeInputs = [
                { label: 'Chinese', value: '测试数据输入' },
                { label: 'Arabic', value: 'مرحبا بالعالم' },
                { label: 'Japanese', value: 'テストデータ' },
                { label: 'Emoji', value: '🎉🚀💯✨🔥' },
                { label: 'Mixed', value: 'Test 测试 🎉 العربية' },
            ];

            const results = [];
            for (const input of unicodeInputs) {
                try {
                    await fillField(page, textField.selector, input.value);
                    await page.waitForTimeout(100);

                    const displayedValue = await page.evaluate((sel) => {
                        const inp = document.querySelector(sel);
                        return inp ? inp.value : '';
                    }, textField.selector);

                    const matches = displayedValue === input.value;
                    results.push(`${input.label}: ${matches ? '✓ hiển thị đúng' : '✗ bị lỗi'}`);
                } catch {
                    results.push(`${input.label}: ✗ error`);
                }
            }

            const failCount = results.filter(r => r.includes('✗')).length;
            t.status = failCount > 0 ? 'warning' : 'passed';
            t.details = `Unicode/Emoji: ${results.join('; ')}`;
            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 3.7: Number in text field
     */
    async _testNumberInTextField(page, form) {
        const textField = form.fields.find(f =>
            (f.type === 'text' || !f.type) &&
            (f.name.toLowerCase().includes('name') || f.name.toLowerCase().includes('first') || f.name.toLowerCase().includes('last'))
        );
        if (!textField) return null;

        const test = createTestResult('form_boundary', '3.7', `Number in text field: "${textField.name}"`);
        return runSafe(test, async (t) => {
            const numericInputs = ['12345', '0.5', '-100'];
            const results = [];

            for (const input of numericInputs) {
                try {
                    await fillField(page, textField.selector, input);
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(100);

                    const hasError = await page.evaluate((sel) => {
                        const inp = document.querySelector(sel);
                        if (!inp) return false;
                        return !inp.checkValidity() || inp.classList.contains('is-invalid') || inp.getAttribute('aria-invalid') === 'true';
                    }, textField.selector);

                    results.push(`"${input}": ${hasError ? 'rejected' : 'accepted'}`);
                } catch {
                    results.push(`"${input}": error`);
                }
            }

            t.status = 'passed'; // informational — both accept and reject are valid behaviors
            t.details = `Number in "${textField.name}": ${results.join('; ')}. (Cả accept và reject đều hợp lệ tùy business logic)`;
        });
    }

    /**
     * 3.8: Negative/zero in number field
     */
    async _testNegativeZeroNumber(page, form) {
        const numberField = form.fields.find(f =>
            f.type === 'number' || f.name.toLowerCase().includes('quantity') ||
            f.name.toLowerCase().includes('amount') || f.name.toLowerCase().includes('price') ||
            f.name.toLowerCase().includes('age')
        );
        if (!numberField) return null;

        const test = createTestResult('form_boundary', '3.8', `Negative/zero in number: "${numberField.name}"`);
        return runSafe(test, async (t) => {
            const testValues = [
                { value: '-1', label: 'negative' },
                { value: '0', label: 'zero' },
                { value: '-999999', label: 'large negative' },
                { value: '0.001', label: 'tiny decimal' },
            ];

            const results = [];
            for (const tv of testValues) {
                try {
                    await fillField(page, numberField.selector, tv.value);
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(100);

                    const fieldState = await page.evaluate((sel) => {
                        const inp = document.querySelector(sel);
                        if (!inp) return { valid: false, value: '' };
                        return {
                            valid: inp.checkValidity(),
                            value: inp.value,
                            min: inp.min,
                            max: inp.max,
                        };
                    }, numberField.selector);

                    if (!fieldState.valid) {
                        results.push(`${tv.label} (${tv.value}): ✓ rejected (min=${fieldState.min || 'none'})`);
                    } else {
                        results.push(`${tv.label} (${tv.value}): accepted`);
                    }
                } catch {
                    results.push(`${tv.label}: error`);
                }
            }

            // If negative values are accepted for quantity/price, it might be an issue
            const name = numberField.name.toLowerCase();
            const shouldRejectNegative = name.includes('quantity') || name.includes('price') || name.includes('age') || name.includes('amount');
            const negativeAccepted = results.some(r => r.includes('negative') && r.includes('accepted'));

            if (shouldRejectNegative && negativeAccepted) {
                t.status = 'warning';
                t.details = `Field "${numberField.name}" chấp nhận giá trị âm — nên có min="0". ${results.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `Number boundary: ${results.join('; ')}`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }
    /**
     * 3.9: Copy-paste behavior — pasted content should be handled correctly
     */
    async _testCopyPaste(page, form) {
        const test = createTestResult('form_boundary', '3.9', `Copy-paste behavior: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const textField = await findFirstTextField(page, form.selector);
            if (!textField) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy text field để test';
                return;
            }

            const pasteValues = [
                { label: 'normal text', value: 'Hello World Test' },
                { label: 'with newlines', value: 'Line1\nLine2\nLine3' },
                { label: 'with tabs', value: 'Col1\tCol2\tCol3' },
                { label: 'formatted number', value: '1,234,567.89' },
            ];

            const results = [];
            for (const pv of pasteValues) {
                try {
                    // Clear and set value via clipboard simulation
                    await page.evaluate((sel, val) => {
                        const inp = document.querySelector(sel);
                        if (!inp) return;
                        inp.focus();
                        inp.value = '';
                        // Simulate paste event
                        const pasteEvent = new ClipboardEvent('paste', {
                            clipboardData: new DataTransfer(),
                            bubbles: true,
                            cancelable: true,
                        });
                        pasteEvent.clipboardData.setData('text/plain', val);
                        const allowed = inp.dispatchEvent(pasteEvent);
                        if (allowed) {
                            inp.value = val;
                            inp.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }, textField.selector, pv.value);
                    await page.waitForTimeout(100);

                    const actualValue = await page.evaluate((sel) => {
                        const inp = document.querySelector(sel);
                        return inp ? inp.value : '';
                    }, textField.selector);

                    const pageOk = await page.evaluate(() => !!document.body).catch(() => false);
                    results.push(`${pv.label}: ${pageOk ? '✓ OK' : '✗ crash'} (len=${actualValue.length})`);
                } catch {
                    results.push(`${pv.label}: ✗ error`);
                }
            }

            const failCount = results.filter(r => r.includes('✗')).length;
            t.status = failCount > 0 ? 'warning' : 'passed';
            t.details = `Copy-paste: ${results.join('; ')}`;
        });
    }

    /**
     * 3.10: Leading/trailing spaces — should be trimmed or handled
     */
    async _testLeadingTrailingSpaces(page, form) {
        const test = createTestResult('form_boundary', '3.10', `Leading/trailing spaces: "${form.submitText || form.selector}"`);
        return runSafe(test, async (t) => {
            const textField = await findFirstTextField(page, form.selector);
            if (!textField) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy text field để test';
                return;
            }

            const spaceInputs = [
                { label: 'leading spaces', value: '   hello' },
                { label: 'trailing spaces', value: 'hello   ' },
                { label: 'both sides', value: '   hello   ' },
                { label: 'only spaces', value: '     ' },
            ];

            const results = [];
            for (const si of spaceInputs) {
                try {
                    await fillField(page, textField.selector, si.value);
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(100);

                    const actualValue = await page.evaluate((sel) => {
                        const inp = document.querySelector(sel);
                        return inp ? inp.value : '';
                    }, textField.selector);

                    const trimmed = actualValue.trim() !== si.value && actualValue.length < si.value.length;
                    const isOnlySpaces = si.value.trim() === '';

                    if (isOnlySpaces) {
                        // Check if only-spaces is rejected or accepted
                        const hasError = await page.evaluate((sel) => {
                            const inp = document.querySelector(sel);
                            if (!inp) return false;
                            return !inp.checkValidity() || inp.classList.contains('is-invalid');
                        }, textField.selector);
                        results.push(`${si.label}: ${hasError ? '✓ rejected' : 'accepted (OK nếu không required)'}`);
                    } else {
                        results.push(`${si.label}: ${trimmed ? 'auto-trimmed' : 'kept as-is'}`);
                    }
                } catch {
                    results.push(`${si.label}: ✗ error`);
                }
            }

            // Informational — both trim and keep behaviors are valid
            t.status = results.some(r => r.includes('✗')) ? 'warning' : 'passed';
            t.details = `Spaces handling: ${results.join('; ')}`;
        });
    }
}

module.exports = FormBoundaryTests;
