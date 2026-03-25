/**
 * InteractionTester - Auto-discover interactive elements and test them
 * Enhanced with 14 test groups (100 cases) — Phase 1 + Phase 2 + Phase 3 + Phase 4
 *
 * Phase 1 (Core):
 *   1. Navigation & Routing (9 cases)
 *   2. Form Validation (12 cases)
 *   3. Form Boundary Testing (10 cases)
 *   4. Button Interaction (8 cases)
 *   5. Modal & Dialog (10 cases)
 *   6. Dropdown (7 cases)
 *
 * Phase 2 (UX):
 *   7. Hover & Tooltip (5 cases)
 *   8. Scroll & Lazy Load (7 cases)
 *   9. Broken Resources (5 cases)
 *  10. Tab & Accordion (6 cases)
 *
 * Phase 3 (A11y + Responsive):
 *  11. Responsive Menu & Accessibility (9 cases)
 *
 * Phase 4 (Advanced):
 *  12. Cookie Consent / Banner (4 cases)
 *  13. Loading & Error States (5 cases)
 *  14. Media & Video (4 cases)
 *
 * 3 Levels: Static Scan → Smart Interaction → Chaos Test
 * ZERO API dependency
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const AutoLogin = require('./AutoLogin');

// Phase 1 Test Groups
const NavigationTests = require('./interaction-tests/NavigationTests');
const FormValidationTests = require('./interaction-tests/FormValidationTests');
const FormBoundaryTests = require('./interaction-tests/FormBoundaryTests');
const ButtonTests = require('./interaction-tests/ButtonTests');
const ModalTests = require('./interaction-tests/ModalTests');
const DropdownTests = require('./interaction-tests/DropdownTests');

// Phase 2 Test Groups
const HoverTooltipTests = require('./interaction-tests/HoverTooltipTests');
const ScrollLazyLoadTests = require('./interaction-tests/ScrollLazyLoadTests');
const BrokenResourceTests = require('./interaction-tests/BrokenResourceTests');
const TabAccordionTests = require('./interaction-tests/TabAccordionTests');

// Phase 3 Test Groups
const ResponsiveAccessibilityTests = require('./interaction-tests/ResponsiveAccessibilityTests');

// Phase 4 Test Groups
const CookieConsentTests = require('./interaction-tests/CookieConsentTests');
const LoadingErrorStateTests = require('./interaction-tests/LoadingErrorStateTests');
const MediaVideoTests = require('./interaction-tests/MediaVideoTests');

class InteractionTester {
    constructor() {
        // Phase 1 test group runners
        this._navigationTests = new NavigationTests();
        this._formValidationTests = new FormValidationTests();
        this._formBoundaryTests = new FormBoundaryTests();
        this._buttonTests = new ButtonTests();
        this._modalTests = new ModalTests();
        this._dropdownTests = new DropdownTests();

        // Phase 2 test group runners
        this._hoverTooltipTests = new HoverTooltipTests();
        this._scrollLazyLoadTests = new ScrollLazyLoadTests();
        this._brokenResourceTests = new BrokenResourceTests();
        this._tabAccordionTests = new TabAccordionTests();

        // Phase 3 test group runners
        this._responsiveA11yTests = new ResponsiveAccessibilityTests();

        // Phase 4 test group runners
        this._cookieConsentTests = new CookieConsentTests();
        this._loadingErrorTests = new LoadingErrorStateTests();
        this._mediaVideoTests = new MediaVideoTests();
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
                testGroups: {},
                chaosResult: null,
                errors,
                consoleErrors,
                summary: null,
                duration_ms: 0,
            };

            // Step 2: Run smart interaction tests (10 groups)
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
     * Run smart interaction tests — 6 groups orchestration
     */
    async _runSmartTests(page, discovery, baseUrl) {
        const allTests = [];
        const groupResults = {};

        // Group 1: Navigation & Routing
        try {
            console.log('[InteractionTester] → Group 1: Navigation & Routing...');
            const navTests = await this._navigationTests.run(page, discovery, baseUrl);
            groupResults.navigation = { tests: navTests, count: navTests.length };
            allTests.push(...navTests);
            // Navigate back to base URL for next group
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 1 error:', err.message);
            groupResults.navigation = { tests: [], error: err.message };
        }

        // Group 2: Form Validation
        try {
            console.log('[InteractionTester] → Group 2: Form Validation...');
            const formTests = await this._formValidationTests.run(page, discovery, baseUrl);
            groupResults.formValidation = { tests: formTests, count: formTests.length };
            allTests.push(...formTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 2 error:', err.message);
            groupResults.formValidation = { tests: [], error: err.message };
        }

        // Group 3: Form Boundary Testing
        try {
            console.log('[InteractionTester] → Group 3: Form Boundary Testing...');
            const boundaryTests = await this._formBoundaryTests.run(page, discovery, baseUrl);
            groupResults.formBoundary = { tests: boundaryTests, count: boundaryTests.length };
            allTests.push(...boundaryTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 3 error:', err.message);
            groupResults.formBoundary = { tests: [], error: err.message };
        }

        // Group 4: Button Interaction
        try {
            console.log('[InteractionTester] → Group 4: Button Interaction...');
            const btnTests = await this._buttonTests.run(page, discovery, baseUrl);
            groupResults.button = { tests: btnTests, count: btnTests.length };
            allTests.push(...btnTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 4 error:', err.message);
            groupResults.button = { tests: [], error: err.message };
        }

        // Group 5: Modal & Dialog
        try {
            console.log('[InteractionTester] → Group 5: Modal & Dialog...');
            const modalTests = await this._modalTests.run(page, discovery, baseUrl);
            groupResults.modal = { tests: modalTests, count: modalTests.length };
            allTests.push(...modalTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 5 error:', err.message);
            groupResults.modal = { tests: [], error: err.message };
        }

        // Group 6: Dropdown
        try {
            console.log('[InteractionTester] → Group 6: Dropdown...');
            const ddTests = await this._dropdownTests.run(page, discovery, baseUrl);
            groupResults.dropdown = { tests: ddTests, count: ddTests.length };
            allTests.push(...ddTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 6 error:', err.message);
            groupResults.dropdown = { tests: [], error: err.message };
        }

        // ===== Phase 2: UX Groups =====

        // Group 7: Hover & Tooltip
        try {
            console.log('[InteractionTester] → Group 7: Hover & Tooltip...');
            const hoverTests = await this._hoverTooltipTests.run(page, discovery, baseUrl);
            groupResults.hoverTooltip = { tests: hoverTests, count: hoverTests.length };
            allTests.push(...hoverTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 7 error:', err.message);
            groupResults.hoverTooltip = { tests: [], error: err.message };
        }

        // Group 8: Scroll & Lazy Load
        try {
            console.log('[InteractionTester] → Group 8: Scroll & Lazy Load...');
            const scrollTests = await this._scrollLazyLoadTests.run(page, discovery, baseUrl);
            groupResults.scrollLazyLoad = { tests: scrollTests, count: scrollTests.length };
            allTests.push(...scrollTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 8 error:', err.message);
            groupResults.scrollLazyLoad = { tests: [], error: err.message };
        }

        // Group 9: Broken Resources
        try {
            console.log('[InteractionTester] → Group 9: Broken Resources...');
            const resourceTests = await this._brokenResourceTests.run(page, discovery, baseUrl);
            groupResults.brokenResources = { tests: resourceTests, count: resourceTests.length };
            allTests.push(...resourceTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 9 error:', err.message);
            groupResults.brokenResources = { tests: [], error: err.message };
        }

        // Group 10: Tab & Accordion
        try {
            console.log('[InteractionTester] → Group 10: Tab & Accordion...');
            const tabTests = await this._tabAccordionTests.run(page, discovery, baseUrl);
            groupResults.tabAccordion = { tests: tabTests, count: tabTests.length };
            allTests.push(...tabTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 10 error:', err.message);
            groupResults.tabAccordion = { tests: [], error: err.message };
        }

        // ===== Phase 3: A11y + Responsive =====

        // Group 11: Responsive Menu & Accessibility
        try {
            console.log('[InteractionTester] → Group 11: Responsive Menu & Accessibility...');
            const a11yTests = await this._responsiveA11yTests.run(page, discovery, baseUrl);
            groupResults.responsiveA11y = { tests: a11yTests, count: a11yTests.length };
            allTests.push(...a11yTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 11 error:', err.message);
            groupResults.responsiveA11y = { tests: [], error: err.message };
        }

        // ===== Phase 4: Advanced Groups =====

        // Group 12: Cookie Consent / Banner
        try {
            console.log('[InteractionTester] → Group 12: Cookie Consent / Banner...');
            const cookieTests = await this._cookieConsentTests.run(page, discovery, baseUrl);
            groupResults.cookieConsent = { tests: cookieTests, count: cookieTests.length };
            allTests.push(...cookieTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 12 error:', err.message);
            groupResults.cookieConsent = { tests: [], error: err.message };
        }

        // Group 13: Loading & Error States
        try {
            console.log('[InteractionTester] → Group 13: Loading & Error States...');
            const loadingTests = await this._loadingErrorTests.run(page, discovery, baseUrl);
            groupResults.loadingError = { tests: loadingTests, count: loadingTests.length };
            allTests.push(...loadingTests);
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(500);
        } catch (err) {
            console.error('[InteractionTester] Group 13 error:', err.message);
            groupResults.loadingError = { tests: [], error: err.message };
        }

        // Group 14: Media & Video
        try {
            console.log('[InteractionTester] → Group 14: Media & Video...');
            const mediaTests = await this._mediaVideoTests.run(page, discovery, baseUrl);
            groupResults.mediaVideo = { tests: mediaTests, count: mediaTests.length };
            allTests.push(...mediaTests);
        } catch (err) {
            console.error('[InteractionTester] Group 14 error:', err.message);
            groupResults.mediaVideo = { tests: [], error: err.message };
        }

        console.log(`[InteractionTester] Smart tests complete: ${allTests.length} tests across 14 groups`);
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

            await page.waitForTimeout(2000);

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
     * Generate test summary — enhanced for grouped tests
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
            summary.verdictText = `Passed ${passed}/${effectiveTests} tests với ${warnings} cảnh báo`;
        } else {
            summary.verdict = 'PASS';
            summary.verdictText = `Passed ${passed}/${effectiveTests} tests`;
        }

        return summary;
    }
}

module.exports = InteractionTester;
