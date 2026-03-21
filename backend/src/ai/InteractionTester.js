/**
 * InteractionTester - Auto-discover interactive elements and test them
 * 3 Levels: Static Scan → Smart Interaction → Chaos Test
 * ZERO API dependency
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const AutoLogin = require('./AutoLogin');

class InteractionTester {
    /**
     * Run interaction tests on a URL
     * @param {string} url
     * @param {object} opts - { level, loginEmail, loginPassword, viewport, maxActions }
     *   level: 'static' | 'smart' | 'chaos' | 'full'
     */
    async test(url, opts = {}) {
        const level = opts.level || 'smart';
        const viewport = opts.viewport || { width: 1920, height: 1080 };
        const loginEmail = opts.loginEmail || null;
        const loginPassword = opts.loginPassword || null;
        const maxActions = opts.maxActions || 500;

        const startTime = Date.now();
        const browser = await chromium.launch({ headless: true });

        try {
            const context = await browser.newContext({ viewport });
            const page = await context.newPage();

            // Collect errors during the entire test
            const errors = [];
            const consoleErrors = [];
            page.on('pageerror', err => {
                errors.push({ type: 'JS_ERROR', message: err.message, stack: err.stack, timestamp: Date.now() });
            });
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleErrors.push({ type: 'CONSOLE_ERROR', message: msg.text().substring(0, 300), timestamp: Date.now() });
                }
            });

            // Navigate
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(1500);

            // Auto-login if needed
            if (loginEmail && loginPassword) {
                const autoLogin = new AutoLogin();
                const loginSuccess = await autoLogin.attemptLogin(page, loginEmail, loginPassword);
                if (loginSuccess) {
                    console.log('[InteractionTester] Auto-login successful');
                    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                    await page.waitForTimeout(2000);
                }
            }

            // Take initial screenshot
            const initialScreenshot = await page.screenshot({ fullPage: true, type: 'png' });
            const initialBase64 = 'data:image/png;base64,' + initialScreenshot.toString('base64');

            // Step 1: Discover interactive elements
            console.log('[InteractionTester] Discovering interactive elements...');
            const discovery = await this._discoverElements(page);

            const results = {
                url,
                level,
                discovery,
                initialScreenshot: initialBase64,
                tests: [],
                chaosResult: null,
                errors,
                consoleErrors,
                summary: null,
                duration_ms: 0,
            };

            // Step 2: Run smart interaction tests
            if (level === 'smart' || level === 'full') {
                console.log('[InteractionTester] Running smart interaction tests...');
                results.tests = await this._runSmartTests(page, discovery, url);
            }

            // Step 3: Run chaos test
            if (level === 'chaos' || level === 'full') {
                console.log('[InteractionTester] Running chaos test...');
                // Re-navigate to clean state
                await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                await page.waitForTimeout(1000);
                results.chaosResult = await this._runChaosTest(page, maxActions);
            }

            // Final screenshot
            const finalScreenshot = await page.screenshot({ fullPage: true, type: 'png' });
            results.finalScreenshot = 'data:image/png;base64,' + finalScreenshot.toString('base64');

            // Generate summary
            results.duration_ms = Date.now() - startTime;
            results.summary = this._generateSummary(results);

            await context.close();
            await browser.close();

            return results;
        } catch (err) {
            await browser.close();
            throw err;
        }
    }

    /**
     * Discover all interactive elements on the page
     */
    async _discoverElements(page) {
        return await page.evaluate(() => {
            const discovery = {
                forms: [],
                navLinks: [],
                buttons: [],
                modals: [],
                dropdowns: [],
                inputs: [],
                totalInteractive: 0,
            };

            // Forms
            document.querySelectorAll('form').forEach(form => {
                const fields = [];
                form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea').forEach(input => {
                    fields.push({
                        tag: input.tagName.toLowerCase(),
                        type: input.type || 'text',
                        name: input.name || '',
                        id: input.id || '',
                        required: input.required,
                        placeholder: input.placeholder || '',
                        selector: input.id ? `#${input.id}` : (input.name ? `[name="${input.name}"]` : `${input.tagName.toLowerCase()}[type="${input.type}"]`),
                    });
                });

                const submitBtn = form.querySelector('[type="submit"], button:not([type="button"]):not([type="reset"])');
                discovery.forms.push({
                    id: form.id || '',
                    action: form.action || '',
                    method: form.method || 'get',
                    fields,
                    submitSelector: submitBtn ? (submitBtn.id ? `#${submitBtn.id}` : 'button[type="submit"]') : null,
                    submitText: submitBtn ? submitBtn.textContent.trim().substring(0, 50) : null,
                    selector: form.id ? `#${form.id}` : 'form',
                });
            });

            // Navigation links
            document.querySelectorAll('nav a[href], header a[href], .navbar a[href]').forEach(a => {
                const href = a.href;
                if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '#') return;
                const rect = a.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;
                discovery.navLinks.push({
                    text: a.textContent.trim().substring(0, 50),
                    href,
                    isExternal: !href.startsWith(window.location.origin),
                    selector: a.id ? `#${a.id}` : `a[href="${a.getAttribute('href')}"]`,
                });
            });

            // Buttons (non-submit, non-nav)
            document.querySelectorAll('button:not([type="submit"]), [role="button"], .btn, .button').forEach(btn => {
                const rect = btn.getBoundingClientRect();
                const style = getComputedStyle(btn);
                if (rect.width === 0 || rect.height === 0 || style.display === 'none') return;
                // Skip if inside a form (handled by forms section)
                if (btn.closest('form') && btn.type === 'submit') return;

                discovery.buttons.push({
                    text: btn.textContent.trim().substring(0, 50),
                    id: btn.id || '',
                    classes: btn.className.toString().substring(0, 80),
                    selector: btn.id ? `#${btn.id}` : (btn.textContent.trim() ? `button:has-text("${btn.textContent.trim().substring(0, 30)}")` : btn.tagName.toLowerCase()),
                    hasClickHandler: !!btn.onclick,
                    ariaExpanded: btn.getAttribute('aria-expanded'),
                    dataToggle: btn.getAttribute('data-toggle') || btn.getAttribute('data-bs-toggle') || '',
                });
            });

            // Modal triggers
            document.querySelectorAll('[data-toggle="modal"], [data-bs-toggle="modal"], [data-target], [data-bs-target]').forEach(trigger => {
                const target = trigger.getAttribute('data-target') || trigger.getAttribute('data-bs-target') || '';
                discovery.modals.push({
                    triggerText: trigger.textContent.trim().substring(0, 50),
                    triggerSelector: trigger.id ? `#${trigger.id}` : `[data-bs-target="${target}"]`,
                    targetSelector: target,
                });
            });

            // Dropdowns
            document.querySelectorAll('[data-toggle="dropdown"], [data-bs-toggle="dropdown"], details > summary').forEach(dd => {
                discovery.dropdowns.push({
                    text: dd.textContent.trim().substring(0, 50),
                    selector: dd.id ? `#${dd.id}` : dd.tagName.toLowerCase(),
                    type: dd.tagName === 'SUMMARY' ? 'details' : 'bootstrap',
                });
            });

            // Standalone inputs (outside forms)
            document.querySelectorAll('input:not(form input):not([type="hidden"]), textarea:not(form textarea)').forEach(input => {
                const rect = input.getBoundingClientRect();
                if (rect.width === 0) return;
                discovery.inputs.push({
                    type: input.type || 'text',
                    name: input.name || '',
                    placeholder: input.placeholder || '',
                    selector: input.id ? `#${input.id}` : `input[name="${input.name}"]`,
                });
            });

            discovery.totalInteractive =
                discovery.forms.length + discovery.navLinks.length +
                discovery.buttons.length + discovery.modals.length +
                discovery.dropdowns.length + discovery.inputs.length;

            return discovery;
        });
    }

    /**
     * Run smart interaction tests based on discovered elements
     */
    async _runSmartTests(page, discovery, baseUrl) {
        const tests = [];

        // Test navigation links (limit to 10)
        const navToTest = discovery.navLinks.filter(l => !l.isExternal).slice(0, 10);
        for (const link of navToTest) {
            const test = await this._testNavigation(page, link, baseUrl);
            tests.push(test);
        }

        // Test forms
        for (const form of discovery.forms.slice(0, 5)) {
            // Test 1: Submit empty form (validation check)
            const emptyTest = await this._testFormEmpty(page, form);
            tests.push(emptyTest);

            // Test 2: Fill and submit with sample data
            const fillTest = await this._testFormFill(page, form);
            tests.push(fillTest);
        }

        // Test buttons
        for (const button of discovery.buttons.slice(0, 10)) {
            const btnTest = await this._testButton(page, button);
            tests.push(btnTest);
        }

        // Test modals
        for (const modal of discovery.modals.slice(0, 5)) {
            const modalTest = await this._testModal(page, modal);
            tests.push(modalTest);
        }

        // Test dropdowns
        for (const dd of discovery.dropdowns.slice(0, 5)) {
            const ddTest = await this._testDropdown(page, dd);
            tests.push(ddTest);
        }

        return tests;
    }

    /**
     * Test a navigation link
     */
    async _testNavigation(page, link, baseUrl) {
        const test = {
            type: 'navigation',
            name: `Navigate: "${link.text}"`,
            selector: link.selector,
            target: link.href,
            status: 'pending',
            details: '',
            screenshot: null,
            duration_ms: 0,
        };

        const start = Date.now();
        try {
            const currentUrl = page.url();
            const response = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(500);

            if (response && response.status() >= 400) {
                test.status = 'failed';
                test.details = `HTTP ${response.status()} error`;
            } else {
                test.status = 'passed';
                test.details = `Loaded successfully (${response ? response.status() : 'OK'})`;
            }

            // Take screenshot
            const ss = await page.screenshot({ type: 'png' });
            test.screenshot = 'data:image/png;base64,' + ss.toString('base64');

            // Navigate back
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(500);
        } catch (err) {
            test.status = 'failed';
            test.details = `Error: ${err.message.substring(0, 200)}`;
        }
        test.duration_ms = Date.now() - start;
        return test;
    }

    /**
     * Test submitting empty form (validation)
     */
    async _testFormEmpty(page, form) {
        const test = {
            type: 'form_validation',
            name: `Form validation: "${form.submitText || form.selector}"`,
            selector: form.selector,
            status: 'pending',
            details: '',
            screenshot: null,
            duration_ms: 0,
        };

        const start = Date.now();
        try {
            if (!form.submitSelector) {
                test.status = 'skipped';
                test.details = 'No submit button found';
                test.duration_ms = Date.now() - start;
                return test;
            }

            // Click submit without filling anything
            const submitBtn = await page.$(form.submitSelector);
            if (!submitBtn) {
                test.status = 'skipped';
                test.details = 'Submit button not found in DOM';
                test.duration_ms = Date.now() - start;
                return test;
            }

            await submitBtn.click();
            await page.waitForTimeout(1000);

            // Check if HTML5 validation triggered
            const hasValidationErrors = await page.evaluate((formSelector) => {
                const formEl = document.querySelector(formSelector);
                if (!formEl) return false;
                const inputs = formEl.querySelectorAll('input[required], select[required], textarea[required]');
                for (const input of inputs) {
                    if (!input.checkValidity()) return true;
                }
                return false;
            }, form.selector);

            // Check for visible error messages
            const errorMessages = await page.evaluate(() => {
                const errorSelectors = [
                    '.error', '.error-message', '.invalid-feedback', '.field-error',
                    '[role="alert"]', '.alert-danger', '.form-error', '.validation-error',
                    '.text-danger', '.text-red-500', '.has-error'
                ];
                const errors = [];
                for (const sel of errorSelectors) {
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
                return errors;
            });

            const requiredFields = form.fields.filter(f => f.required);

            if (hasValidationErrors || errorMessages.length > 0) {
                test.status = 'passed';
                test.details = `Validation hoạt động đúng. ${requiredFields.length} required fields, ${errorMessages.length} error messages hiển thị`;
                if (errorMessages.length > 0) {
                    test.details += `. Errors: ${errorMessages.slice(0, 3).join('; ')}`;
                }
            } else if (requiredFields.length > 0) {
                test.status = 'warning';
                test.details = `Form có ${requiredFields.length} required fields nhưng không hiển thị validation errors khi submit trống`;
            } else {
                test.status = 'passed';
                test.details = 'Form không có required fields';
            }

            const ss = await page.screenshot({ type: 'png' });
            test.screenshot = 'data:image/png;base64,' + ss.toString('base64');
        } catch (err) {
            test.status = 'error';
            test.details = `Error: ${err.message.substring(0, 200)}`;
        }
        test.duration_ms = Date.now() - start;
        return test;
    }

    /**
     * Test filling form with sample data
     */
    async _testFormFill(page, form) {
        const test = {
            type: 'form_fill',
            name: `Form fill: "${form.submitText || form.selector}"`,
            selector: form.selector,
            status: 'pending',
            details: '',
            screenshot: null,
            duration_ms: 0,
        };

        const start = Date.now();
        try {
            const filledFields = [];
            for (const field of form.fields) {
                try {
                    const el = await page.$(field.selector);
                    if (!el) continue;

                    const value = this._getSampleValue(field);
                    if (value === null) continue;

                    if (field.tag === 'select') {
                        // Select first non-empty option
                        await page.selectOption(field.selector, { index: 1 }).catch(() => {});
                        filledFields.push(`${field.name || field.type}: [selected option]`);
                    } else if (field.type === 'checkbox' || field.type === 'radio') {
                        await el.check().catch(() => {});
                        filledFields.push(`${field.name}: checked`);
                    } else {
                        await el.fill(value);
                        filledFields.push(`${field.name || field.type}: "${value}"`);
                    }
                } catch (e) {
                    // Skip fields we can't interact with
                }
            }

            test.status = 'passed';
            test.details = `Filled ${filledFields.length}/${form.fields.length} fields: ${filledFields.join(', ')}`;

            const ss = await page.screenshot({ type: 'png' });
            test.screenshot = 'data:image/png;base64,' + ss.toString('base64');
        } catch (err) {
            test.status = 'error';
            test.details = `Error: ${err.message.substring(0, 200)}`;
        }
        test.duration_ms = Date.now() - start;
        return test;
    }

    /**
     * Get sample data for a form field
     */
    _getSampleValue(field) {
        const name = (field.name || '').toLowerCase();
        const type = (field.type || 'text').toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();

        if (type === 'email' || name.includes('email')) return 'test@example.com';
        if (type === 'password' || name.includes('password')) return 'TestPass123!';
        if (type === 'tel' || name.includes('phone') || name.includes('tel')) return '0901234567';
        if (type === 'url') return 'https://example.com';
        if (type === 'number' || name.includes('age') || name.includes('quantity')) return '25';
        if (type === 'date') return '2025-01-15';
        if (name.includes('name') || name.includes('user')) return 'Test User';
        if (name.includes('address')) return '123 Test Street';
        if (name.includes('city')) return 'Ho Chi Minh City';
        if (name.includes('zip') || name.includes('postal')) return '700000';
        if (name.includes('search') || placeholder.includes('search') || placeholder.includes('tìm')) return 'test search query';
        if (name.includes('message') || name.includes('comment') || name.includes('content')) return 'This is a test message for automated testing.';
        if (type === 'text') return 'Test Input';
        if (type === 'checkbox' || type === 'radio') return null; // handled separately
        if (field.tag === 'textarea') return 'This is test content for the textarea field.';
        if (field.tag === 'select') return null; // handled separately
        return 'test';
    }

    /**
     * Test a button click
     */
    async _testButton(page, button) {
        const test = {
            type: 'button_click',
            name: `Click: "${button.text || button.id}"`,
            selector: button.selector,
            status: 'pending',
            details: '',
            screenshot: null,
            duration_ms: 0,
        };

        const start = Date.now();
        try {
            // Capture state before click
            const beforeUrl = page.url();
            const beforeHTML = await page.evaluate(() => document.body.innerHTML.length);

            // Try to click
            const btn = await page.$(button.id ? `#${button.id}` : button.selector).catch(() => null);
            if (!btn) {
                test.status = 'skipped';
                test.details = 'Button not found in DOM';
                test.duration_ms = Date.now() - start;
                return test;
            }

            // Check if visible
            const isVisible = await btn.isVisible().catch(() => false);
            if (!isVisible) {
                test.status = 'skipped';
                test.details = 'Button is not visible';
                test.duration_ms = Date.now() - start;
                return test;
            }

            await btn.click({ timeout: 5000 });
            await page.waitForTimeout(1000);

            // Check what changed
            const afterUrl = page.url();
            const afterHTML = await page.evaluate(() => document.body.innerHTML.length);

            const changes = [];
            if (afterUrl !== beforeUrl) changes.push(`URL changed to ${afterUrl}`);
            if (Math.abs(afterHTML - beforeHTML) > 100) changes.push(`DOM changed (${afterHTML - beforeHTML > 0 ? '+' : ''}${afterHTML - beforeHTML} chars)`);

            // Check for new dialogs/modals
            const hasModal = await page.evaluate(() => {
                const modal = document.querySelector('.modal.show, [role="dialog"][aria-modal="true"], dialog[open]');
                return modal ? modal.textContent.substring(0, 100) : null;
            });
            if (hasModal) changes.push(`Modal opened: "${hasModal.substring(0, 50)}"`);

            test.status = 'passed';
            test.details = changes.length > 0
                ? `Button clicked successfully. Changes: ${changes.join('; ')}`
                : 'Button clicked, no visible changes detected';

            const ss = await page.screenshot({ type: 'png' });
            test.screenshot = 'data:image/png;base64,' + ss.toString('base64');

            // Try to close modal if opened
            if (hasModal) {
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);
            }

            // Navigate back if URL changed
            if (afterUrl !== beforeUrl) {
                await page.goBack().catch(() => page.goto(beforeUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }));
                await page.waitForTimeout(500);
            }
        } catch (err) {
            test.status = 'error';
            test.details = `Error: ${err.message.substring(0, 200)}`;
        }
        test.duration_ms = Date.now() - start;
        return test;
    }

    /**
     * Test modal open/close
     */
    async _testModal(page, modal) {
        const test = {
            type: 'modal',
            name: `Modal: "${modal.triggerText}"`,
            selector: modal.triggerSelector,
            status: 'pending',
            details: '',
            screenshot: null,
            duration_ms: 0,
        };

        const start = Date.now();
        try {
            const trigger = await page.$(modal.triggerSelector);
            if (!trigger) {
                test.status = 'skipped';
                test.details = 'Modal trigger not found';
                test.duration_ms = Date.now() - start;
                return test;
            }

            await trigger.click();
            await page.waitForTimeout(800);

            // Check if modal opened
            const modalVisible = await page.evaluate((targetSel) => {
                if (targetSel) {
                    const modal = document.querySelector(targetSel);
                    if (modal) {
                        const style = getComputedStyle(modal);
                        return style.display !== 'none' && style.visibility !== 'hidden';
                    }
                }
                // Fallback: check for any visible modal
                const anyModal = document.querySelector('.modal.show, .modal.in, [role="dialog"]:not([aria-hidden="true"]), dialog[open]');
                return !!anyModal;
            }, modal.targetSelector);

            if (modalVisible) {
                test.status = 'passed';
                test.details = 'Modal opened successfully';

                const ss = await page.screenshot({ type: 'png' });
                test.screenshot = 'data:image/png;base64,' + ss.toString('base64');

                // Close modal
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);

                // Verify closed
                const stillVisible = await page.evaluate(() => {
                    const modal = document.querySelector('.modal.show, .modal.in, dialog[open]');
                    return !!modal;
                });

                if (stillVisible) {
                    test.details += ' | Warning: Modal không đóng bằng ESC key';
                    // Try clicking close button
                    const closeBtn = await page.$('.modal.show .close, .modal.show [data-dismiss="modal"], .modal.show [data-bs-dismiss="modal"], dialog[open] button');
                    if (closeBtn) await closeBtn.click().catch(() => {});
                    await page.waitForTimeout(300);
                } else {
                    test.details += ' | ESC close hoạt động đúng';
                }
            } else {
                test.status = 'failed';
                test.details = 'Modal trigger clicked but modal did not appear';
            }
        } catch (err) {
            test.status = 'error';
            test.details = `Error: ${err.message.substring(0, 200)}`;
        }
        test.duration_ms = Date.now() - start;
        return test;
    }

    /**
     * Test dropdown open/close
     */
    async _testDropdown(page, dd) {
        const test = {
            type: 'dropdown',
            name: `Dropdown: "${dd.text}"`,
            selector: dd.selector,
            status: 'pending',
            details: '',
            duration_ms: 0,
        };

        const start = Date.now();
        try {
            const trigger = await page.$(dd.selector);
            if (!trigger) {
                test.status = 'skipped';
                test.details = 'Dropdown trigger not found';
                test.duration_ms = Date.now() - start;
                return test;
            }

            await trigger.click();
            await page.waitForTimeout(500);

            // Check if dropdown/menu appeared
            const menuVisible = await page.evaluate(() => {
                const menus = document.querySelectorAll('.dropdown-menu.show, .dropdown-menu[style*="display: block"], details[open] > *:not(summary)');
                return menus.length > 0;
            });

            if (menuVisible) {
                test.status = 'passed';
                test.details = 'Dropdown opened successfully';
            } else {
                test.status = 'warning';
                test.details = 'Dropdown trigger clicked, could not verify menu visibility';
            }

            // Close by clicking outside
            await page.click('body', { position: { x: 10, y: 10 } }).catch(() => {});
            await page.waitForTimeout(300);
        } catch (err) {
            test.status = 'error';
            test.details = `Error: ${err.message.substring(0, 200)}`;
        }
        test.duration_ms = Date.now() - start;
        return test;
    }

    /**
     * Run chaos/monkey test using random interactions
     */
    async _runChaosTest(page, maxActions = 500) {
        const result = {
            totalActions: 0,
            jsErrors: [],
            consoleErrors: [],
            fpsDrops: [],
            unresponsive: false,
            duration_ms: 0,
        };

        const start = Date.now();
        const chaosErrors = [];
        const chaosConsoleErrors = [];

        page.on('pageerror', err => {
            chaosErrors.push({ message: err.message, timestamp: Date.now() - start });
        });
        page.on('console', msg => {
            if (msg.type() === 'error') {
                chaosConsoleErrors.push({ message: msg.text().substring(0, 200), timestamp: Date.now() - start });
            }
        });

        try {
            // Inject and run chaos test
            await page.evaluate((max) => {
                return new Promise((resolve) => {
                    let actionCount = 0;
                    const errors = [];

                    function getRandomElement() {
                        const interactable = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [onclick]');
                        if (interactable.length === 0) return null;
                        return interactable[Math.floor(Math.random() * interactable.length)];
                    }

                    function getRandomPosition() {
                        return {
                            x: Math.floor(Math.random() * window.innerWidth),
                            y: Math.floor(Math.random() * Math.min(window.innerHeight * 2, document.body.scrollHeight))
                        };
                    }

                    function doRandomAction() {
                        if (actionCount >= max) {
                            resolve({ actionCount, errors });
                            return;
                        }
                        actionCount++;

                        const actionType = Math.random();

                        try {
                            if (actionType < 0.35) {
                                // Click random element
                                const el = getRandomElement();
                                if (el) {
                                    el.click();
                                }
                            } else if (actionType < 0.50) {
                                // Click random position
                                const pos = getRandomPosition();
                                const el = document.elementFromPoint(
                                    Math.min(pos.x, window.innerWidth - 1),
                                    Math.min(pos.y, window.innerHeight - 1)
                                );
                                if (el) el.click();
                            } else if (actionType < 0.65) {
                                // Type random text in random input
                                const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea');
                                if (inputs.length > 0) {
                                    const input = inputs[Math.floor(Math.random() * inputs.length)];
                                    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
                                    let text = '';
                                    for (let i = 0; i < Math.floor(Math.random() * 20) + 1; i++) {
                                        text += chars[Math.floor(Math.random() * chars.length)];
                                    }
                                    input.focus();
                                    input.value = text;
                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                    input.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            } else if (actionType < 0.80) {
                                // Scroll randomly
                                window.scrollTo({
                                    top: Math.floor(Math.random() * document.body.scrollHeight),
                                    behavior: 'auto'
                                });
                            } else if (actionType < 0.90) {
                                // Hover random element
                                const el = getRandomElement();
                                if (el) {
                                    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                                    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                                }
                            } else {
                                // Double click random element
                                const el = getRandomElement();
                                if (el) {
                                    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                                }
                            }
                        } catch (e) {
                            errors.push({ action: actionCount, message: e.message });
                        }

                        // Next action with small delay
                        setTimeout(doRandomAction, 20);
                    }

                    doRandomAction();
                });
            }, maxActions);

            // Wait for any pending effects
            await page.waitForTimeout(2000);

            // Check if page is still responsive
            const isResponsive = await Promise.race([
                page.evaluate(() => document.title).then(() => true),
                new Promise(resolve => setTimeout(() => resolve(false), 5000))
            ]);

            result.totalActions = maxActions;
            result.jsErrors = chaosErrors;
            result.consoleErrors = chaosConsoleErrors;
            result.unresponsive = !isResponsive;
            result.duration_ms = Date.now() - start;

        } catch (err) {
            result.totalActions = maxActions;
            result.jsErrors = chaosErrors;
            result.consoleErrors = chaosConsoleErrors;
            result.unresponsive = true;
            result.duration_ms = Date.now() - start;
            result.crashError = err.message;
        }

        return result;
    }

    /**
     * Generate test summary
     */
    _generateSummary(results) {
        const tests = results.tests || [];
        const passed = tests.filter(t => t.status === 'passed').length;
        const failed = tests.filter(t => t.status === 'failed').length;
        const warnings = tests.filter(t => t.status === 'warning').length;
        const errors = tests.filter(t => t.status === 'error').length;
        const skipped = tests.filter(t => t.status === 'skipped').length;

        const summary = {
            totalTests: tests.length,
            passed,
            failed,
            warnings,
            errors,
            skipped,
            passRate: tests.length > 0 ? Math.round(passed / (tests.length - skipped) * 100) || 0 : 0,
            jsErrors: results.errors.length + (results.chaosResult?.jsErrors?.length || 0),
            consoleErrors: results.consoleErrors.length + (results.chaosResult?.consoleErrors?.length || 0),
            discovery: {
                forms: results.discovery.forms.length,
                navLinks: results.discovery.navLinks.length,
                buttons: results.discovery.buttons.length,
                modals: results.discovery.modals.length,
                dropdowns: results.discovery.dropdowns.length,
                totalInteractive: results.discovery.totalInteractive,
            },
            chaosTest: results.chaosResult ? {
                actions: results.chaosResult.totalActions,
                jsErrors: results.chaosResult.jsErrors.length,
                consoleErrors: results.chaosResult.consoleErrors.length,
                pageStillResponsive: !results.chaosResult.unresponsive,
                verdict: results.chaosResult.unresponsive
                    ? 'FAIL - Trang bị treo sau chaos test'
                    : results.chaosResult.jsErrors.length > 5
                        ? 'WARNING - Nhiều JS errors phát hiện'
                        : results.chaosResult.jsErrors.length > 0
                            ? 'PASS với cảnh báo - Có JS errors nhưng trang vẫn hoạt động'
                            : 'PASS - Trang chịu được chaos test',
            } : null,
            duration_ms: results.duration_ms,
        };

        // Overall verdict
        if (failed > 0 || (results.chaosResult?.unresponsive)) {
            summary.verdict = 'FAIL';
            summary.verdictText = `${failed} test thất bại${results.chaosResult?.unresponsive ? ', trang bị treo sau chaos test' : ''}`;
        } else if (warnings > 0 || errors > 0) {
            summary.verdict = 'WARNING';
            summary.verdictText = `Passed ${passed}/${tests.length - skipped} tests với ${warnings} cảnh báo`;
        } else {
            summary.verdict = 'PASS';
            summary.verdictText = `Passed ${passed}/${tests.length - skipped} tests`;
        }

        return summary;
    }
}

module.exports = InteractionTester;
