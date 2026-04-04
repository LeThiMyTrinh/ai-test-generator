/**
 * InteractionTester - Auto-discover interactive elements and test them
 * 14 test groups (57 cases) — theo PDF "Kiểm tra Unit Test"
 *
 *  1. Header / Navigation (5 cases)
 *  2. Button (5 cases)
 *  3. Input Field (6 cases)
 *  4. Form Validation (5 cases)
 *  5. Image / Media (4 cases)
 *  6. Content / Text (3 cases)
 *  7. Checkbox (4 cases)
 *  8. Radio Button (3 cases)
 *  9. Dropdown / Combobox (5 cases)
 * 10. List Box (3 cases)
 * 11. Calendar / Date Picker (4 cases)
 * 12. Link (4 cases)
 * 13. Tab (3 cases)
 * 14. Hover & Tooltip (3 cases)
 *
 * 3 Levels: Static Scan → Smart Interaction → Chaos Test
 * ZERO API dependency
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const AutoLogin = require('./AutoLogin');

// 14 Test Groups — theo PDF
const NavigationTests = require('./interaction-tests/NavigationTests');
const ButtonTests = require('./interaction-tests/ButtonTests');
const InputFieldTests = require('./interaction-tests/InputFieldTests');
const FormValidationTests = require('./interaction-tests/FormValidationTests');
const ImageMediaTests = require('./interaction-tests/ImageMediaTests');
const ContentTextTests = require('./interaction-tests/ContentTextTests');
const CheckboxTests = require('./interaction-tests/CheckboxTests');
const RadioButtonTests = require('./interaction-tests/RadioButtonTests');
const DropdownTests = require('./interaction-tests/DropdownTests');
const ListBoxTests = require('./interaction-tests/ListBoxTests');
const CalendarTests = require('./interaction-tests/CalendarTests');
const LinkTests = require('./interaction-tests/LinkTests');
const TabTests = require('./interaction-tests/TabAccordionTests');
const HoverTooltipTests = require('./interaction-tests/HoverTooltipTests');

class InteractionTester {
    constructor() {
        this._navigationTests = new NavigationTests();
        this._buttonTests = new ButtonTests();
        this._inputFieldTests = new InputFieldTests();
        this._formValidationTests = new FormValidationTests();
        this._imageMediaTests = new ImageMediaTests();
        this._contentTextTests = new ContentTextTests();
        this._checkboxTests = new CheckboxTests();
        this._radioButtonTests = new RadioButtonTests();
        this._dropdownTests = new DropdownTests();
        this._listBoxTests = new ListBoxTests();
        this._calendarTests = new CalendarTests();
        this._linkTests = new LinkTests();
        this._tabTests = new TabTests();
        this._hoverTooltipTests = new HoverTooltipTests();
    }

    /**
     * Run interaction tests on a URL
     * @param {string} url
     * @param {object} opts - { level, loginEmail, loginPassword, viewport, maxActions }
     *   level: 'static' | 'smart' | 'chaos' | 'full'
     */
    async test(url, opts = {}) {
        const level = opts.level || 'smart';
        const viewport = opts.viewport || { width: 1920, height: 1080 };
        const contextOptions = opts.contextOptions || { viewport };
        const loginEmail = opts.loginEmail || null;
        const loginPassword = opts.loginPassword || null;
        const maxActions = opts.maxActions || 500;

        const startTime = Date.now();
        const browser = await chromium.launch({ headless: true });

        try {
            const context = await browser.newContext(contextOptions);
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
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

            // Auto-login if needed
            if (loginEmail && loginPassword) {
                const autoLogin = new AutoLogin();
                const loginSuccess = await autoLogin.attemptLogin(page, loginEmail, loginPassword);
                if (loginSuccess) {
                    console.log('[InteractionTester] Auto-login successful');
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
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
                testGroups: {},
                chaosResult: null,
                errors,
                consoleErrors,
                summary: null,
                duration_ms: 0,
            };

            // Step 2: Run smart interaction tests (14 groups)
            if (level === 'smart' || level === 'full') {
                console.log('[InteractionTester] Running smart tests (14 groups)...');
                const { allTests, groupResults } = await this._runSmartTests(page, discovery, url);
                results.tests = allTests;
                results.testGroups = groupResults;
            }

            // Step 3: Run chaos test
            if (level === 'chaos' || level === 'full') {
                console.log('[InteractionTester] Running chaos test...');
                // Re-navigate to clean state
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
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
                dropdowns: [],
                inputs: [],
                checkboxes: [],
                radios: [],
                listBoxes: [],
                dateInputs: [],
                links: [],
                images: [],
                tabs: [],
                tooltips: [],
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

            // Buttons
            document.querySelectorAll('button:not([type="submit"]), [role="button"], .btn, .button').forEach(btn => {
                const rect = btn.getBoundingClientRect();
                const style = getComputedStyle(btn);
                if (rect.width === 0 || rect.height === 0 || style.display === 'none') return;
                if (btn.closest('form') && btn.type === 'submit') return;
                discovery.buttons.push({
                    text: btn.textContent.trim().substring(0, 50),
                    id: btn.id || '',
                    selector: btn.id ? `#${btn.id}` : (btn.textContent.trim() ? `button:has-text("${btn.textContent.trim().substring(0, 30)}")` : btn.tagName.toLowerCase()),
                });
            });

            // Dropdowns (select + custom)
            document.querySelectorAll('select, [data-toggle="dropdown"], [data-bs-toggle="dropdown"], details > summary').forEach(dd => {
                const rect = dd.getBoundingClientRect();
                if (rect.width === 0) return;
                discovery.dropdowns.push({
                    text: dd.textContent.trim().substring(0, 50),
                    selector: dd.id ? `#${dd.id}` : dd.tagName.toLowerCase(),
                    type: dd.tagName === 'SELECT' ? 'native' : (dd.tagName === 'SUMMARY' ? 'details' : 'bootstrap'),
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

            // Checkboxes
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                const rect = cb.getBoundingClientRect();
                if (rect.width > 0 || getComputedStyle(cb).display !== 'none') {
                    discovery.checkboxes.push({
                        name: cb.name || '',
                        id: cb.id || '',
                        selector: cb.id ? `#${cb.id}` : `input[type="checkbox"][name="${cb.name}"]`,
                    });
                }
            });

            // Radio buttons
            document.querySelectorAll('input[type="radio"]').forEach(radio => {
                const rect = radio.getBoundingClientRect();
                if (rect.width > 0 || getComputedStyle(radio).display !== 'none') {
                    discovery.radios.push({
                        name: radio.name || '',
                        value: radio.value || '',
                        selector: radio.id ? `#${radio.id}` : `input[type="radio"][name="${radio.name}"]`,
                    });
                }
            });

            // List boxes
            document.querySelectorAll('select[size], select[multiple], [role="listbox"]').forEach(lb => {
                const rect = lb.getBoundingClientRect();
                if (rect.width > 0) {
                    discovery.listBoxes.push({
                        selector: lb.id ? `#${lb.id}` : (lb.name ? `select[name="${lb.name}"]` : '[role="listbox"]'),
                        type: lb.tagName === 'SELECT' ? 'native' : 'custom',
                    });
                }
            });

            // Date inputs
            document.querySelectorAll('input[type="date"], input[type="datetime-local"], input[type="month"], [class*="datepicker"], [class*="date-picker"]').forEach(input => {
                const rect = input.getBoundingClientRect();
                if (rect.width > 0) {
                    discovery.dateInputs.push({
                        type: input.type || 'text',
                        selector: input.id ? `#${input.id}` : (input.name ? `input[name="${input.name}"]` : `input[type="${input.type}"]`),
                    });
                }
            });

            // All links
            document.querySelectorAll('a[href]').forEach(a => {
                const rect = a.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && !a.href.startsWith('javascript:')) {
                    discovery.links.push({
                        href: a.href,
                        text: a.textContent.trim().substring(0, 50),
                    });
                }
            });

            // Images
            document.querySelectorAll('img').forEach(img => {
                const rect = img.getBoundingClientRect();
                if (rect.width > 0 || rect.height > 0) {
                    discovery.images.push({
                        src: img.src.substring(0, 100),
                        alt: img.alt || '',
                        loaded: img.complete && img.naturalWidth > 0,
                    });
                }
            });

            // Tabs
            document.querySelectorAll('[role="tab"], [data-bs-toggle="tab"], [data-toggle="tab"]').forEach(tab => {
                const rect = tab.getBoundingClientRect();
                if (rect.width > 0) {
                    discovery.tabs.push({
                        text: tab.textContent.trim().substring(0, 30),
                        selector: tab.id ? `#${tab.id}` : '[role="tab"]',
                    });
                }
            });

            // Tooltips
            document.querySelectorAll('[title], [data-bs-toggle="tooltip"], [data-tooltip], [data-tippy-content]').forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0) {
                    discovery.tooltips.push({
                        text: el.getAttribute('title') || el.getAttribute('data-tooltip') || '',
                        selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
                    });
                }
            });

            discovery.totalInteractive =
                discovery.forms.length + discovery.navLinks.length +
                discovery.buttons.length + discovery.dropdowns.length +
                discovery.inputs.length + discovery.checkboxes.length +
                discovery.radios.length + discovery.listBoxes.length +
                discovery.dateInputs.length + discovery.links.length +
                discovery.images.length + discovery.tabs.length +
                discovery.tooltips.length;

            return discovery;
        });
    }

    /**
     * Run smart interaction tests — 14 groups orchestration
     * Optimized: skip empty groups + parallel execution in batches
     */
    async _runSmartTests(page, discovery, baseUrl) {
        const allTests = [];
        const groupResults = {};
        const context = page.context();

        // Define all 14 groups with skip conditions — theo PDF order
        const groupDefs = [
            // Batch 1: Navigation, Button, Input (Groups 1-3)
            { key: 'navigation', name: 'Group 1: Header / Navigation', runner: this._navigationTests, skip: discovery.navLinks.length === 0 },
            { key: 'button', name: 'Group 2: Button', runner: this._buttonTests, skip: discovery.buttons.length === 0 },
            { key: 'inputField', name: 'Group 3: Input Field', runner: this._inputFieldTests, skip: discovery.forms.length === 0 && discovery.inputs.length === 0 },
            // Batch 2: Form, Image, Content (Groups 4-6)
            { key: 'formValidation', name: 'Group 4: Form Validation', runner: this._formValidationTests, skip: discovery.forms.length === 0 },
            { key: 'imageMedia', name: 'Group 5: Image / Media', runner: this._imageMediaTests, skip: discovery.images.length === 0 },
            { key: 'contentText', name: 'Group 6: Content / Text', runner: this._contentTextTests, skip: false },
            // Batch 3: Checkbox, Radio, Dropdown, ListBox (Groups 7-10)
            { key: 'checkbox', name: 'Group 7: Checkbox', runner: this._checkboxTests, skip: discovery.checkboxes.length === 0 },
            { key: 'radioButton', name: 'Group 8: Radio Button', runner: this._radioButtonTests, skip: discovery.radios.length === 0 },
            { key: 'dropdown', name: 'Group 9: Dropdown', runner: this._dropdownTests, skip: discovery.dropdowns.length === 0 },
            { key: 'listBox', name: 'Group 10: List Box', runner: this._listBoxTests, skip: discovery.listBoxes.length === 0 && discovery.dropdowns.length === 0 },
            // Batch 4: Calendar, Link, Tab, Tooltip (Groups 11-14)
            { key: 'calendar', name: 'Group 11: Calendar / Date Picker', runner: this._calendarTests, skip: discovery.dateInputs.length === 0 },
            { key: 'link', name: 'Group 12: Link', runner: this._linkTests, skip: discovery.links.length === 0 },
            { key: 'tab', name: 'Group 13: Tab', runner: this._tabTests, skip: discovery.tabs.length === 0 },
            { key: 'hoverTooltip', name: 'Group 14: Hover & Tooltip', runner: this._hoverTooltipTests, skip: discovery.tooltips.length === 0 },
        ];

        // Split into 4 parallel batches
        const batches = [
            groupDefs.slice(0, 3),   // Batch 1: Groups 1-3
            groupDefs.slice(3, 6),   // Batch 2: Groups 4-6
            groupDefs.slice(6, 10),  // Batch 3: Groups 7-10
            groupDefs.slice(10, 14), // Batch 4: Groups 11-14
        ];

        // Run a single batch sequentially on its own page
        const runBatch = async (batch, batchIndex) => {
            const batchResults = { tests: [], groups: {} };
            const activeGroups = batch.filter(g => !g.skip);
            if (activeGroups.length === 0) {
                for (const g of batch) {
                    batchResults.groups[g.key] = { tests: [], count: 0, skipped: true };
                }
                return batchResults;
            }

            const batchPage = batchIndex === 0 ? page : await context.newPage();
            try {
                if (batchIndex !== 0) {
                    await batchPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await batchPage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
                }

                for (let i = 0; i < batch.length; i++) {
                    const g = batch[i];
                    if (g.skip) {
                        console.log(`[InteractionTester] → ${g.name} — SKIPPED (no elements)`);
                        batchResults.groups[g.key] = { tests: [], count: 0, skipped: true };
                        continue;
                    }

                    try {
                        console.log(`[InteractionTester] → ${g.name}...`);
                        const tests = await g.runner.run(batchPage, discovery, baseUrl);
                        batchResults.groups[g.key] = { tests, count: tests.length };
                        batchResults.tests.push(...tests);

                        if (i < batch.length - 1 && batch.slice(i + 1).some(ng => !ng.skip)) {
                            await batchPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                            await batchPage.waitForTimeout(150);
                        }
                    } catch (err) {
                        console.error(`[InteractionTester] ${g.name} error:`, err.message);
                        batchResults.groups[g.key] = { tests: [], error: err.message };
                    }
                }
            } finally {
                if (batchIndex !== 0) {
                    await batchPage.close().catch(() => {});
                }
            }
            return batchResults;
        };

        // Execute all 4 batches in parallel
        console.log('[InteractionTester] Running 14 groups in 4 parallel batches...');
        const batchPromises = batches.map((batch, idx) => runBatch(batch, idx));
        const batchResults = await Promise.all(batchPromises);

        // Merge results from all batches
        for (const br of batchResults) {
            allTests.push(...br.tests);
            Object.assign(groupResults, br.groups);
        }

        const skippedCount = groupDefs.filter(g => g.skip).length;
        console.log(`[InteractionTester] Smart tests complete: ${allTests.length} tests across 14 groups (${skippedCount} skipped)`);
        return { allTests, groupResults };
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
                                const el = getRandomElement();
                                if (el) el.click();
                            } else if (actionType < 0.50) {
                                const pos = getRandomPosition();
                                const el = document.elementFromPoint(
                                    Math.min(pos.x, window.innerWidth - 1),
                                    Math.min(pos.y, window.innerHeight - 1)
                                );
                                if (el) el.click();
                            } else if (actionType < 0.65) {
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
                                window.scrollTo({
                                    top: Math.floor(Math.random() * document.body.scrollHeight),
                                    behavior: 'auto'
                                });
                            } else if (actionType < 0.90) {
                                const el = getRandomElement();
                                if (el) {
                                    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                                    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                                }
                            } else {
                                const el = getRandomElement();
                                if (el) {
                                    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                                }
                            }
                        } catch (e) {
                            errors.push({ action: actionCount, message: e.message });
                        }

                        setTimeout(doRandomAction, 20);
                    }

                    doRandomAction();
                });
            }, maxActions);

            await page.waitForTimeout(500);

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

        // Group-level summaries
        const groupSummaries = {};
        if (results.testGroups) {
            for (const [groupName, groupData] of Object.entries(results.testGroups)) {
                const gTests = groupData.tests || [];
                groupSummaries[groupName] = {
                    total: gTests.length,
                    passed: gTests.filter(t => t.status === 'passed').length,
                    failed: gTests.filter(t => t.status === 'failed').length,
                    warnings: gTests.filter(t => t.status === 'warning').length,
                    skipped: gTests.filter(t => t.status === 'skipped').length,
                    error: groupData.error || null,
                };
            }
        }

        const effectiveTests = tests.length - skipped;
        const summary = {
            totalTests: tests.length,
            passed,
            failed,
            warnings,
            errors,
            skipped,
            passRate: effectiveTests > 0 ? Math.round(passed / effectiveTests * 100) : 0,
            jsErrors: results.errors.length + (results.chaosResult?.jsErrors?.length || 0),
            consoleErrors: results.consoleErrors.length + (results.chaosResult?.consoleErrors?.length || 0),
            groupSummaries,
            discovery: {
                forms: results.discovery.forms.length,
                navLinks: results.discovery.navLinks.length,
                buttons: results.discovery.buttons.length,
                dropdowns: results.discovery.dropdowns.length,
                checkboxes: results.discovery.checkboxes.length,
                radios: results.discovery.radios.length,
                listBoxes: results.discovery.listBoxes.length,
                dateInputs: results.discovery.dateInputs.length,
                links: results.discovery.links.length,
                images: results.discovery.images.length,
                tabs: results.discovery.tabs.length,
                tooltips: results.discovery.tooltips.length,
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
            summary.verdictText = `Passed ${passed}/${effectiveTests} tests với ${warnings} cảnh báo`;
        } else {
            summary.verdict = 'PASS';
            summary.verdictText = `Passed ${passed}/${effectiveTests} tests`;
        }

        return summary;
    }
}

module.exports = InteractionTester;
