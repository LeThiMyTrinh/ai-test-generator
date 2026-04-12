/**
 * EnhancedUIChecker - 35+ algorithmic UI checks, ZERO API dependency
 * Extends the existing UIChecker with deep CSS/DOM/SEO/Performance analysis
 *
 * Check categories:
 * 1. Color & Contrast (WCAG 2.1 formula)
 * 2. Typography Consistency
 * 3. Spacing & Layout
 * 4. SEO & Meta Tags
 * 5. Form Accessibility
 * 6. Image Optimization
 * 7. Performance Indicators
 */

const { chromium, devices } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const AutoLogin = require('./AutoLogin');
const IssueAnalyzer = require('./IssueAnalyzer');

// 8 Checklist Test Groups — theo PDF "Kiểm tra giao diện"
const LayoutUITests = require('./interaction-tests/LayoutUITests');
const UIComponentTests = require('./interaction-tests/UIComponentTests');
const TextContentTests = require('./interaction-tests/TextContentTests');
const ImageIconTests = require('./interaction-tests/ImageIconTests');
const ScrollPositionTests = require('./interaction-tests/ScrollPositionTests');
const LoadingAnimationTests = require('./interaction-tests/LoadingAnimationTests');
const AccessibilityTests = require('./interaction-tests/AccessibilityTests');
const LinkNavigationTests = require('./interaction-tests/LinkNavigationTests');

// Reuse presets from UIChecker
const DESKTOP_PRESETS = {
    '1920x1080': { width: 1920, height: 1080 },
    '1440x900': { width: 1440, height: 900 },
    '1366x768': { width: 1366, height: 768 },
};

const TABLET_PRESETS = {
    'ipad-pro': 'iPad Pro 11',
    'ipad-mini': 'iPad Mini',
    'galaxy-tab': 'Galaxy Tab S4',
};

const MOBILE_PRESETS = {
    'iphone-15': 'iPhone 15',
    'iphone-se': 'iPhone SE',
    'pixel-7': 'Pixel 7',
    'galaxy-s24': 'Galaxy S24',
};

class EnhancedUIChecker {
    constructor() {
        this.analyzer = new IssueAnalyzer();
        // 8 checklist test groups — PDF "Kiểm tra giao diện"
        this._layoutUITests = new LayoutUITests();
        this._uiComponentTests = new UIComponentTests();
        this._textContentTests = new TextContentTests();
        this._imageIconTests = new ImageIconTests();
        this._scrollPositionTests = new ScrollPositionTests();
        this._loadingAnimationTests = new LoadingAnimationTests();
        this._accessibilityTests = new AccessibilityTests();
        this._linkNavigationTests = new LinkNavigationTests();
    }

    /**
     * Run full enhanced UI check
     */
    async check(url, opts = {}) {
        const desktopKey = opts.desktop || '1920x1080';
        const tabletKey = opts.tablet || 'ipad-pro';
        const mobileKey = opts.mobile || 'iphone-15';
        const loginEmail = opts.loginEmail || null;
        const loginPassword = opts.loginPassword || null;

        const startTime = Date.now();
        const browser = await chromium.launch({ headless: true });

        try {
            // Run checks on each viewport + checklist tests in parallel
            const [desktopResult, tabletResult, mobileResult, checklistResult] = await Promise.all([
                this._checkViewport(browser, url, 'desktop', desktopKey, loginEmail, loginPassword),
                this._checkViewport(browser, url, 'tablet', tabletKey, loginEmail, loginPassword),
                this._checkViewport(browser, url, 'mobile', mobileKey, loginEmail, loginPassword),
                this._runChecklistOnDesktop(browser, url, desktopKey, loginEmail, loginPassword),
            ]);

            // Check broken links (once, not per viewport)
            const brokenLinks = await this._checkBrokenLinks(browser, url);

            // Cross-viewport comparison
            const responsiveIssues = this._compareViewports(desktopResult, tabletResult, mobileResult);

            // Merge all issues
            const allIssues = [
                ...desktopResult.issues,
                ...tabletResult.issues,
                ...mobileResult.issues,
                ...brokenLinks,
                ...responsiveIssues,
            ];

            // Smart analysis
            console.log('[EnhancedUIChecker] Running smart analysis on', allIssues.length, 'raw issues...');
            const analysis = this.analyzer.analyzeIssues(allIssues, {
                url,
                viewports: [desktopKey, tabletKey, mobileKey]
            });

            const analyzedIssues = analysis.issues;
            const patterns = analysis.patterns;

            // Build enhanced summary with weighted score
            const summary = {
                ...analysis.summary,
                duration_ms: Date.now() - startTime,
                critical: allIssues.filter(i => i.severity === 'CRITICAL').length,
                high: allIssues.filter(i => i.severity === 'HIGH').length,
                medium: allIssues.filter(i => i.severity === 'MEDIUM').length,
                low: allIssues.filter(i => i.severity === 'LOW').length,
                // Enhanced: weighted quality score
                qualityScore: this._calculateWeightedScore(allIssues),
                checkCategories: this._categorizeChecks(allIssues),
            };

            console.log(`[EnhancedUIChecker] Complete: ${summary.total} issues, quality score: ${summary.qualityScore}/100`);
            console.log(`[EnhancedUIChecker] Checklist: ${checklistResult.summary.passed}/${checklistResult.summary.total} passed (${checklistResult.summary.passRate}%)`);

            await browser.close();

            return {
                url,
                devices: {
                    desktop: desktopResult.deviceLabel,
                    tablet: tabletResult.deviceLabel,
                    mobile: mobileResult.deviceLabel,
                },
                screenshots: {
                    desktop: desktopResult.screenshot,
                    tablet: tabletResult.screenshot,
                    mobile: mobileResult.screenshot,
                },
                issues: analyzedIssues,
                patterns,
                summary,
                checklist: checklistResult.groups,
                checklistSummary: checklistResult.summary,
            };
        } catch (err) {
            await browser.close();
            throw err;
        }
    }

    /**
     * Calculate weighted quality score (replaces naive 100 - total*2)
     */
    _calculateWeightedScore(issues) {
        const weights = { CRITICAL: 10, HIGH: 5, MEDIUM: 2, LOW: 1 };
        let penalty = 0;
        for (const issue of issues) {
            penalty += weights[issue.severity] || 2;
        }
        return Math.max(0, Math.min(100, 100 - penalty));
    }

    /**
     * Categorize check results for summary display
     * 8 groups matching PDF "Kiểm tra giao diện" checklist
     */
    _categorizeChecks(issues) {
        const categories = {
            layoutUI:         { total: 0, passed: true, label: 'Layout & UI hiển thị' },
            uiComponents:     { total: 0, passed: true, label: 'UI Components' },
            textContent:      { total: 0, passed: true, label: 'Text & Content' },
            imageIcon:        { total: 0, passed: true, label: 'Image & Icon' },
            scrollPosition:   { total: 0, passed: true, label: 'Scroll & Position' },
            loadingAnimation: { total: 0, passed: true, label: 'Loading & Animation' },
            accessibility:    { total: 0, passed: true, label: 'Accessibility' },
            linkNavigation:   { total: 0, passed: true, label: 'Link & Navigation' },
        };

        const typeToCategory = {
            // Group 1: Layout & UI hiển thị
            HORIZONTAL_SCROLLBAR: 'layoutUI', OVERFLOW_X: 'layoutUI', OUTSIDE_VIEWPORT: 'layoutUI',
            ELEMENT_OVERLAP: 'layoutUI', EMPTY_CONTAINER: 'layoutUI', IRREGULAR_SPACING: 'layoutUI',
            ALIGNMENT_OFF: 'layoutUI', TOO_MANY_FONTS: 'layoutUI', FONT_NOT_LOADED: 'layoutUI',
            RESPONSIVE_HIDDEN: 'layoutUI',

            // Group 2: UI Components (buttons, inputs, forms, dropdowns)
            INPUT_WITHOUT_LABEL: 'uiComponents', FORM_NO_SUBMIT: 'uiComponents',
            PLACEHOLDER_AS_LABEL: 'uiComponents', MISSING_AUTOCOMPLETE: 'uiComponents',
            SMALL_TOUCH_TARGET: 'uiComponents',

            // Group 3: Text & Content
            FONT_SIZE_TOO_SMALL: 'textContent', LINE_HEIGHT_TIGHT: 'textContent',
            TEXT_TRUNCATED: 'textContent', MISSING_LANG: 'textContent',
            MISSING_TITLE: 'textContent', HEADING_SKIP: 'textContent', MULTIPLE_H1: 'textContent',

            // Group 4: Image & Icon
            BROKEN_IMAGE: 'imageIcon', MISSING_ALT: 'imageIcon', DISTORTED_IMAGE: 'imageIcon',
            OVERSIZED_IMAGE: 'imageIcon', NO_WEBP_SUPPORT: 'imageIcon',

            // Group 5: Scroll & Position
            NO_LAZY_LOADING: 'scrollPosition', CLS_PRONE: 'scrollPosition',

            // Group 6: Loading & Animation
            RENDER_BLOCKING_SCRIPT: 'loadingAnimation', TOO_MANY_THIRD_PARTY: 'loadingAnimation',
            JS_ERROR: 'loadingAnimation', CONSOLE_ERROR: 'loadingAnimation',

            // Group 7: Accessibility
            LOW_CONTRAST: 'accessibility', COLOR_INCONSISTENCY: 'accessibility',
            UNREADABLE_ON_BG: 'accessibility', ACCESSIBILITY: 'accessibility',
            MISSING_VIEWPORT_META: 'accessibility',

            // Group 8: Link & Navigation
            BROKEN_LINK: 'linkNavigation', MISSING_META_DESC: 'linkNavigation',
            MISSING_OG_TAGS: 'linkNavigation', MISSING_FAVICON: 'linkNavigation',
        };

        for (const issue of issues) {
            const cat = typeToCategory[issue.type] || 'layoutUI';
            if (categories[cat]) {
                categories[cat].total++;
                if (issue.severity === 'CRITICAL' || issue.severity === 'HIGH') {
                    categories[cat].passed = false;
                }
            }
        }

        return categories;
    }

    /**
     * Run checks on a single viewport - ENHANCED with 35+ checks
     */
    async _checkViewport(browser, url, viewportType, deviceKey, loginEmail = null, loginPassword = null) {
        let contextOptions = {};
        let deviceLabel = '';

        if (viewportType === 'desktop') {
            const vp = DESKTOP_PRESETS[deviceKey] || DESKTOP_PRESETS['1920x1080'];
            contextOptions = { viewport: vp };
            deviceLabel = `Desktop ${vp.width}×${vp.height}`;
        } else if (viewportType === 'tablet') {
            const pwName = TABLET_PRESETS[deviceKey];
            if (pwName && devices[pwName]) {
                contextOptions = { ...devices[pwName] };
                deviceLabel = pwName;
            } else {
                contextOptions = { viewport: { width: 768, height: 1024 } };
                deviceLabel = 'Tablet 768×1024';
            }
        } else {
            const pwName = MOBILE_PRESETS[deviceKey];
            if (pwName && devices[pwName]) {
                contextOptions = { ...devices[pwName] };
                deviceLabel = pwName;
            } else {
                contextOptions = { viewport: { width: 375, height: 812 } };
                deviceLabel = 'Mobile 375×812';
            }
        }

        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();

        // Collect console errors
        const consoleIssues = [];
        page.on('pageerror', err => {
            consoleIssues.push({
                type: 'JS_ERROR',
                severity: 'CRITICAL',
                description: `JavaScript Error: ${err.message}`,
                viewport: viewportType,
                selector: '',
                details: err.stack || err.message,
            });
        });
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleIssues.push({
                    type: 'CONSOLE_ERROR',
                    severity: 'HIGH',
                    description: `Console Error: ${msg.text().substring(0, 200)}`,
                    viewport: viewportType,
                    selector: '',
                    details: msg.text(),
                });
            }
        });

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(1500);

            // Auto-login if credentials provided
            if (loginEmail && loginPassword) {
                const autoLogin = new AutoLogin();
                const loginSuccess = await autoLogin.attemptLogin(page, loginEmail, loginPassword);
                if (loginSuccess) {
                    console.log(`[EnhancedUIChecker] Auto-login successful for ${viewportType}`);
                    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                    await page.waitForTimeout(2000);
                } else {
                    console.warn(`[EnhancedUIChecker] Auto-login failed for ${viewportType}`);
                }
            }
        } catch (err) {
            await context.close();
            return {
                deviceLabel,
                screenshot: null,
                issues: [{
                    type: 'NAVIGATION_ERROR',
                    severity: 'CRITICAL',
                    description: `Không thể mở URL: ${err.message}`,
                    viewport: viewportType,
                    selector: '',
                    details: err.message,
                }],
                elements: [],
            };
        }

        // Capture screenshot
        const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
        const screenshot = 'data:image/png;base64,' + screenshotBuffer.toString('base64');

        // ========== RUN ALL CHECKS ==========

        // 1. Original DOM checks (overflow, images, text, touch targets)
        const domIssues = await this._runOriginalDOMChecks(page, viewportType);

        // 2. NEW: Color & Contrast checks
        const colorIssues = await this._runColorContrastChecks(page, viewportType);

        // 3. NEW: Typography checks
        const typographyIssues = await this._runTypographyChecks(page, viewportType);

        // 4. NEW: Spacing & Layout checks
        const layoutIssues = await this._runLayoutChecks(page, viewportType);

        // 5. NEW: SEO & Meta checks
        const seoIssues = await this._runSEOChecks(page, viewportType);

        // 6. NEW: Form accessibility checks
        const formIssues = await this._runFormChecks(page, viewportType);

        // 7. NEW: Image optimization checks
        const imageOptIssues = await this._runImageOptChecks(page, viewportType);

        // 8. NEW: Performance indicator checks
        const perfIssues = await this._runPerformanceChecks(page, viewportType);

        // 9. Accessibility check via axe-core
        let axeIssues = [];
        try {
            const axeResults = await new AxeBuilder({ page }).analyze();
            const severityMap = { critical: 'CRITICAL', serious: 'HIGH', moderate: 'MEDIUM', minor: 'LOW' };
            axeIssues = axeResults.violations.slice(0, 20).map(v => ({
                type: 'ACCESSIBILITY',
                severity: severityMap[v.impact] || 'MEDIUM',
                description: `[A11y] ${v.help}`,
                viewport: viewportType,
                selector: v.nodes[0] ? v.nodes[0].target.join(', ') : '',
                details: v.description,
            }));
        } catch (e) {
            console.warn('[EnhancedUIChecker] axe-core error:', e.message);
        }

        // Collect visible elements for cross-viewport comparison
        const elements = await page.evaluate(() => {
            const els = [];
            document.querySelectorAll('nav, header, footer, main, h1, h2, .logo, [role="navigation"], [role="banner"], .sidebar, aside, .hero, .card, .btn, .button').forEach(el => {
                const rect = el.getBoundingClientRect();
                const style = getComputedStyle(el);
                els.push({
                    tag: el.tagName.toLowerCase(),
                    id: el.id || '',
                    className: (el.className || '').toString().split(' ')[0] || '',
                    visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0,
                    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                });
            });
            return els;
        });

        await context.close();

        const allIssues = [
            ...domIssues,
            ...colorIssues,
            ...typographyIssues,
            ...layoutIssues,
            ...seoIssues,
            ...formIssues,
            ...imageOptIssues,
            ...perfIssues,
            ...consoleIssues,
            ...axeIssues,
        ];

        return {
            deviceLabel,
            screenshot,
            issues: allIssues,
            elements,
        };
    }

    // ==========================================
    // ORIGINAL DOM CHECKS (from UIChecker.js)
    // ==========================================

    async _runOriginalDOMChecks(page, viewportType) {
        return await page.evaluate((vType) => {
            const issues = [];
            const vw = window.innerWidth;

            function getElementPosition(el) {
                try {
                    const rect = el.getBoundingClientRect();
                    return { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
                } catch (e) { return null; }
            }

            // Horizontal scrollbar
            if (document.body.scrollWidth > vw + 5) {
                issues.push({
                    type: 'HORIZONTAL_SCROLLBAR', severity: 'CRITICAL',
                    description: `Trang có thanh cuộn ngang (body scrollWidth ${document.body.scrollWidth}px > viewport ${vw}px)`,
                    viewport: vType, selector: 'body',
                    details: `scrollWidth: ${document.body.scrollWidth}, viewportWidth: ${vw}`,
                    position: { x: 0, y: 0, width: vw, height: 100 }
                });
            }

            // Element overflow
            let overflowCount = 0;
            document.querySelectorAll('*').forEach(el => {
                try {
                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return;
                    if (el.scrollWidth > el.clientWidth + 5 && el.clientWidth > 0) {
                        const tag = el.tagName.toLowerCase();
                        if (['html', 'body', 'script', 'style', 'head'].includes(tag)) return;
                        if (overflowCount >= 10) return;
                        overflowCount++;
                        issues.push({
                            type: 'OVERFLOW_X', severity: 'HIGH',
                            description: `Element tràn ngang: <${tag}> (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})`,
                            viewport: vType,
                            selector: el.id ? `#${el.id}` : `${tag}.${(el.className || '').toString().split(' ')[0] || '?'}`,
                            details: el.textContent ? el.textContent.substring(0, 80) : '',
                            position: getElementPosition(el)
                        });
                    }
                } catch (e) { }
            });

            // Elements outside viewport
            document.querySelectorAll('img, button, a, input, select, textarea, h1, h2, h3, p, div > span').forEach(el => {
                try {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    if (rect.right < -50 || rect.left > vw + 50) {
                        const tag = el.tagName.toLowerCase();
                        issues.push({
                            type: 'OUTSIDE_VIEWPORT', severity: 'HIGH',
                            description: `Element nằm ngoài viewport: <${tag}> ở vị trí x=${Math.round(rect.left)}`,
                            viewport: vType, selector: el.id ? `#${el.id}` : tag,
                            details: (el.textContent || '').substring(0, 60),
                            position: getElementPosition(el)
                        });
                    }
                } catch (e) { }
            });

            // Broken images
            document.querySelectorAll('img').forEach(img => {
                if (img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:')) {
                    issues.push({
                        type: 'BROKEN_IMAGE', severity: 'CRITICAL',
                        description: `Ảnh bị hỏng: ${img.src.substring(0, 100)}`,
                        viewport: vType, selector: img.id ? `#${img.id}` : `img[src="${img.src.substring(0, 60)}"]`,
                        details: img.alt || '(no alt)', position: getElementPosition(img)
                    });
                }
            });

            // Missing alt
            document.querySelectorAll('img').forEach(img => {
                if (img.complete && img.naturalWidth > 0 && (!img.alt || img.alt.trim() === '')) {
                    if (img.width < 5 || img.height < 5) return;
                    issues.push({
                        type: 'MISSING_ALT', severity: 'MEDIUM',
                        description: `Ảnh thiếu alt text: ${img.src.substring(0, 80)}`,
                        viewport: vType, selector: img.id ? `#${img.id}` : 'img',
                        details: `${img.naturalWidth}×${img.naturalHeight}`, position: getElementPosition(img)
                    });
                }
            });

            // Distorted images
            document.querySelectorAll('img').forEach(img => {
                if (!img.complete || img.naturalWidth === 0) return;
                if (img.clientWidth < 10 || img.clientHeight < 10) return;
                const naturalRatio = img.naturalWidth / img.naturalHeight;
                const displayRatio = img.clientWidth / img.clientHeight;
                const diff = Math.abs(naturalRatio - displayRatio) / naturalRatio;
                if (diff > 0.15) {
                    issues.push({
                        type: 'DISTORTED_IMAGE', severity: 'LOW',
                        description: `Ảnh bị méo (sai tỉ lệ ${Math.round(diff * 100)}%): ${img.src.substring(0, 80)}`,
                        viewport: vType, selector: img.id ? `#${img.id}` : 'img',
                        details: `Original: ${img.naturalWidth}×${img.naturalHeight}, Display: ${img.clientWidth}×${img.clientHeight}`,
                        position: getElementPosition(img)
                    });
                }
            });

            // Truncated text
            document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,label,td,th,li').forEach(el => {
                try {
                    const style = getComputedStyle(el);
                    if (style.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 20) {
                        issues.push({
                            type: 'TEXT_TRUNCATED', severity: 'MEDIUM',
                            description: `Text bị cắt: "${(el.textContent || '').substring(0, 50)}..."`,
                            viewport: vType, selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
                            details: `scrollWidth: ${el.scrollWidth}, clientWidth: ${el.clientWidth}`,
                            position: getElementPosition(el)
                        });
                    }
                } catch (e) { }
            });

            // Small touch targets (mobile)
            if (vType === 'mobile') {
                let touchCount = 0;
                document.querySelectorAll('a, button, input, select, textarea, [role="button"]').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    if (rect.width < 44 || rect.height < 44) {
                        const style = getComputedStyle(el);
                        if (style.display === 'none' || style.visibility === 'hidden') return;
                        if (touchCount >= 15) return;
                        touchCount++;
                        issues.push({
                            type: 'SMALL_TOUCH_TARGET', severity: 'MEDIUM',
                            description: `Touch target quá nhỏ: <${el.tagName.toLowerCase()}> (${Math.round(rect.width)}×${Math.round(rect.height)}px < 44×44px)`,
                            viewport: vType, selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
                            details: (el.textContent || el.value || '').substring(0, 40),
                            position: getElementPosition(el)
                        });
                    }
                });
            }

            return issues;
        }, viewportType);
    }

    // ==========================================
    // NEW: COLOR & CONTRAST CHECKS
    // ==========================================

    async _runColorContrastChecks(page, viewportType) {
        return await page.evaluate((vType) => {
            const issues = [];

            // WCAG 2.1 contrast ratio calculation
            function hexToRgb(hex) {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16)
                } : null;
            }

            function parseColor(colorStr) {
                if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;
                const rgb = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (rgb) return { r: parseInt(rgb[1]), g: parseInt(rgb[2]), b: parseInt(rgb[3]) };
                return hexToRgb(colorStr);
            }

            function getRelativeLuminance(color) {
                const rsRGB = color.r / 255;
                const gsRGB = color.g / 255;
                const bsRGB = color.b / 255;
                const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
                const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
                const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            }

            function getContrastRatio(fg, bg) {
                const L1 = getRelativeLuminance(fg);
                const L2 = getRelativeLuminance(bg);
                const lighter = Math.max(L1, L2);
                const darker = Math.min(L1, L2);
                return (lighter + 0.05) / (darker + 0.05);
            }

            function getElementPosition(el) {
                try {
                    const rect = el.getBoundingClientRect();
                    return { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
                } catch (e) { return null; }
            }

            // Check contrast on text elements
            const textElements = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,a,button,label,li,td,th,blockquote,figcaption');
            let contrastIssueCount = 0;

            textElements.forEach(el => {
                try {
                    if (contrastIssueCount >= 15) return;
                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return;
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    if (!el.textContent || el.textContent.trim().length === 0) return;

                    const fgColor = parseColor(style.color);
                    const bgColor = parseColor(style.backgroundColor);

                    if (!fgColor || !bgColor) return;

                    const ratio = getContrastRatio(fgColor, bgColor);
                    const fontSize = parseFloat(style.fontSize);
                    const fontWeight = parseInt(style.fontWeight) || 400;
                    const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
                    const requiredRatio = isLargeText ? 3 : 4.5;

                    if (ratio < requiredRatio) {
                        contrastIssueCount++;
                        const severity = ratio < 2 ? 'CRITICAL' : ratio < 3 ? 'HIGH' : 'MEDIUM';
                        issues.push({
                            type: 'LOW_CONTRAST',
                            severity,
                            description: `Tương phản thấp (${ratio.toFixed(1)}:1, cần ≥${requiredRatio}:1): "${el.textContent.substring(0, 40).trim()}"`,
                            viewport: vType,
                            selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
                            details: `Màu chữ: ${style.color}, Màu nền: ${style.backgroundColor}, Font: ${fontSize}px`,
                            position: getElementPosition(el)
                        });
                    }
                } catch (e) { }
            });

            // Check color consistency - too many unique colors
            const allColors = new Set();
            document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,label').forEach(el => {
                try {
                    const style = getComputedStyle(el);
                    if (style.display !== 'none' && style.color) {
                        allColors.add(style.color);
                    }
                } catch (e) { }
            });

            if (allColors.size > 12) {
                issues.push({
                    type: 'COLOR_INCONSISTENCY',
                    severity: 'MEDIUM',
                    description: `Quá nhiều màu chữ khác nhau (${allColors.size} màu) - nên dưới 8-10 màu cho design system nhất quán`,
                    viewport: vType,
                    selector: 'body',
                    details: `Các màu: ${Array.from(allColors).slice(0, 8).join(', ')}...`,
                    position: null
                });
            }

            return issues;
        }, viewportType);
    }

    // ==========================================
    // NEW: TYPOGRAPHY CHECKS
    // ==========================================

    async _runTypographyChecks(page, viewportType) {
        return await page.evaluate((vType) => {
            const issues = [];

            function getElementPosition(el) {
                try {
                    const rect = el.getBoundingClientRect();
                    return { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
                } catch (e) { return null; }
            }

            // Collect all font families
            const fontFamilies = new Set();
            const fontSizes = [];
            let tinyTextCount = 0;
            let tightLineCount = 0;

            document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,a,button,label,li,td,th,div').forEach(el => {
                try {
                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return;
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    if (!el.textContent || el.textContent.trim().length === 0) return;
                    // Only count direct text nodes
                    if (el.children.length > 0 && el.tagName !== 'A' && el.tagName !== 'BUTTON' && el.tagName !== 'LABEL') {
                        const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
                        if (!hasDirectText) return;
                    }

                    const fontFamily = style.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
                    fontFamilies.add(fontFamily);

                    const fontSize = parseFloat(style.fontSize);
                    fontSizes.push(fontSize);

                    // Font too small
                    if (fontSize < 12 && el.tagName !== 'SUP' && el.tagName !== 'SUB') {
                        if (tinyTextCount < 5) {
                            tinyTextCount++;
                            issues.push({
                                type: 'FONT_SIZE_TOO_SMALL',
                                severity: 'HIGH',
                                description: `Font quá nhỏ (${fontSize}px < 12px): "${el.textContent.substring(0, 40).trim()}"`,
                                viewport: vType,
                                selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
                                details: `Font: ${fontFamily}, Size: ${fontSize}px`,
                                position: getElementPosition(el)
                            });
                        }
                    }

                    // Line height too tight
                    const lineHeight = parseFloat(style.lineHeight);
                    if (!isNaN(lineHeight) && fontSize > 0) {
                        const ratio = lineHeight / fontSize;
                        if (ratio < 1.2 && ratio > 0 && fontSize >= 14) {
                            if (tightLineCount < 5) {
                                tightLineCount++;
                                issues.push({
                                    type: 'LINE_HEIGHT_TIGHT',
                                    severity: 'MEDIUM',
                                    description: `Line-height quá sát (${ratio.toFixed(2)}, nên ≥ 1.4): "${el.textContent.substring(0, 30).trim()}"`,
                                    viewport: vType,
                                    selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
                                    details: `fontSize: ${fontSize}px, lineHeight: ${lineHeight}px, ratio: ${ratio.toFixed(2)}`,
                                    position: getElementPosition(el)
                                });
                            }
                        }
                    }
                } catch (e) { }
            });

            // Too many different fonts
            if (fontFamilies.size > 4) {
                issues.push({
                    type: 'TOO_MANY_FONTS',
                    severity: 'MEDIUM',
                    description: `Dùng quá nhiều font (${fontFamilies.size} loại) - nên ≤ 3 font cho design nhất quán`,
                    viewport: vType,
                    selector: 'body',
                    details: `Fonts: ${Array.from(fontFamilies).join(', ')}`,
                    position: null
                });
            }

            // Detect fallback fonts (font not loaded)
            const fallbackFonts = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];
            const bodyFontFamily = getComputedStyle(document.body).fontFamily.split(',')[0].trim().replace(/['"]/g, '');
            if (fallbackFonts.includes(bodyFontFamily.toLowerCase())) {
                issues.push({
                    type: 'FONT_NOT_LOADED',
                    severity: 'HIGH',
                    description: `Font chính không load được - đang dùng fallback "${bodyFontFamily}"`,
                    viewport: vType,
                    selector: 'body',
                    details: `Computed fontFamily: ${getComputedStyle(document.body).fontFamily}`,
                    position: null
                });
            }

            return issues;
        }, viewportType);
    }

    // ==========================================
    // NEW: SPACING & LAYOUT CHECKS
    // ==========================================

    async _runLayoutChecks(page, viewportType) {
        return await page.evaluate((vType) => {
            const issues = [];

            function getElementPosition(el) {
                try {
                    const rect = el.getBoundingClientRect();
                    return { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
                } catch (e) { return null; }
            }

            // Check element overlaps
            const importantElements = document.querySelectorAll('button, a, input, select, textarea, img, h1, h2, h3, nav, header, [role="button"]');
            const rects = [];
            importantElements.forEach(el => {
                const style = getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed' || style.position === 'absolute') return;
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    rects.push({ el, rect, tag: el.tagName.toLowerCase() });
                }
            });

            let overlapCount = 0;
            for (let i = 0; i < rects.length && overlapCount < 5; i++) {
                for (let j = i + 1; j < rects.length && overlapCount < 5; j++) {
                    const r1 = rects[i].rect;
                    const r2 = rects[j].rect;
                    // Check overlap
                    const overlapX = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
                    const overlapY = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
                    const overlapArea = overlapX * overlapY;
                    const minArea = Math.min(r1.width * r1.height, r2.width * r2.height);

                    if (overlapArea > 0 && overlapArea / minArea > 0.3) {
                        overlapCount++;
                        issues.push({
                            type: 'ELEMENT_OVERLAP',
                            severity: 'HIGH',
                            description: `Element bị chồng chéo: <${rects[i].tag}> và <${rects[j].tag}> (${Math.round(overlapArea / minArea * 100)}%)`,
                            viewport: vType,
                            selector: rects[i].el.id ? `#${rects[i].el.id}` : rects[i].tag,
                            details: `Element 1: ${Math.round(r1.left)},${Math.round(r1.top)} ${Math.round(r1.width)}x${Math.round(r1.height)} | Element 2: ${Math.round(r2.left)},${Math.round(r2.top)} ${Math.round(r2.width)}x${Math.round(r2.height)}`,
                            position: getElementPosition(rects[i].el)
                        });
                    }
                }
            }

            // Check empty containers
            document.querySelectorAll('div, section, article, main').forEach(el => {
                try {
                    const rect = el.getBoundingClientRect();
                    const style = getComputedStyle(el);
                    if (style.display === 'none') return;
                    if (rect.height > 150 && rect.width > 200) {
                        const text = el.textContent.trim();
                        const hasVisibleChildren = el.querySelector('img, video, canvas, svg, iframe');
                        if (text.length === 0 && !hasVisibleChildren) {
                            issues.push({
                                type: 'EMPTY_CONTAINER',
                                severity: 'MEDIUM',
                                description: `Container rỗng có kích thước lớn: <${el.tagName.toLowerCase()}> (${Math.round(rect.width)}×${Math.round(rect.height)}px)`,
                                viewport: vType,
                                selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
                                details: `Width: ${Math.round(rect.width)}px, Height: ${Math.round(rect.height)}px`,
                                position: getElementPosition(el)
                            });
                        }
                    }
                } catch (e) { }
            });

            // Check irregular spacing between sibling elements
            const containers = document.querySelectorAll('.container, .row, main, section, article, .content, .wrapper, [class*="grid"], [class*="list"]');
            let spacingIssueCount = 0;

            containers.forEach(container => {
                if (spacingIssueCount >= 3) return;
                const children = Array.from(container.children).filter(c => {
                    const s = getComputedStyle(c);
                    return s.display !== 'none' && s.visibility !== 'hidden';
                });
                if (children.length < 3) return;

                const gaps = [];
                for (let i = 0; i < children.length - 1; i++) {
                    const r1 = children[i].getBoundingClientRect();
                    const r2 = children[i + 1].getBoundingClientRect();
                    const gap = Math.round(r2.top - r1.bottom);
                    if (gap >= 0 && gap < 200) gaps.push(gap);
                }

                if (gaps.length >= 3) {
                    const uniqueGaps = [...new Set(gaps)];
                    if (uniqueGaps.length > 2) {
                        const maxGap = Math.max(...gaps);
                        const minGap = Math.min(...gaps);
                        if (maxGap - minGap > 12) {
                            spacingIssueCount++;
                            issues.push({
                                type: 'IRREGULAR_SPACING',
                                severity: 'LOW',
                                description: `Spacing không đều giữa ${children.length} phần tử con (${minGap}px đến ${maxGap}px)`,
                                viewport: vType,
                                selector: container.id ? `#${container.id}` : container.tagName.toLowerCase(),
                                details: `Gaps: ${gaps.join(', ')}px`,
                                position: getElementPosition(container)
                            });
                        }
                    }
                }
            });

            return issues;
        }, viewportType);
    }

    // ==========================================
    // NEW: SEO & META CHECKS
    // ==========================================

    async _runSEOChecks(page, viewportType) {
        // Only run SEO checks on desktop viewport to avoid duplicates
        if (viewportType !== 'desktop') return [];

        return await page.evaluate((vType) => {
            const issues = [];

            // Title
            const title = document.title;
            if (!title || title.trim().length === 0) {
                issues.push({
                    type: 'MISSING_TITLE', severity: 'HIGH',
                    description: 'Trang thiếu thẻ <title> hoặc title rỗng',
                    viewport: 'all', selector: 'head > title', details: 'Cần title 30-60 ký tự cho SEO tốt', position: null
                });
            } else if (title.length < 10 || title.length > 70) {
                issues.push({
                    type: 'MISSING_TITLE', severity: 'LOW',
                    description: `Title không tối ưu (${title.length} ký tự, nên 30-60): "${title.substring(0, 50)}"`,
                    viewport: 'all', selector: 'head > title', details: `Title hiện tại: "${title}"`, position: null
                });
            }

            // Meta description
            const metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc || !metaDesc.content || metaDesc.content.trim().length === 0) {
                issues.push({
                    type: 'MISSING_META_DESC', severity: 'MEDIUM',
                    description: 'Thiếu meta description - ảnh hưởng SEO và hiển thị trên Google',
                    viewport: 'all', selector: 'meta[name="description"]', details: 'Nên có 120-160 ký tự', position: null
                });
            }

            // Open Graph tags
            const ogTitle = document.querySelector('meta[property="og:title"]');
            const ogImage = document.querySelector('meta[property="og:image"]');
            const ogDesc = document.querySelector('meta[property="og:description"]');
            const missingOG = [];
            if (!ogTitle) missingOG.push('og:title');
            if (!ogImage) missingOG.push('og:image');
            if (!ogDesc) missingOG.push('og:description');
            if (missingOG.length > 0) {
                issues.push({
                    type: 'MISSING_OG_TAGS', severity: 'LOW',
                    description: `Thiếu Open Graph tags: ${missingOG.join(', ')} - ảnh hưởng share lên MXH`,
                    viewport: 'all', selector: 'head', details: `Thiếu: ${missingOG.join(', ')}`, position: null
                });
            }

            // Viewport meta
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            if (!viewportMeta) {
                issues.push({
                    type: 'MISSING_VIEWPORT_META', severity: 'CRITICAL',
                    description: 'Thiếu viewport meta tag - trang sẽ không responsive trên mobile',
                    viewport: 'all', selector: 'meta[name="viewport"]',
                    details: 'Cần: <meta name="viewport" content="width=device-width, initial-scale=1.0">', position: null
                });
            }

            // H1 heading
            const h1s = document.querySelectorAll('h1');
            if (h1s.length === 0) {
                issues.push({
                    type: 'MULTIPLE_H1', severity: 'MEDIUM',
                    description: 'Trang không có thẻ H1 - ảnh hưởng SEO',
                    viewport: 'all', selector: 'h1', details: 'Mỗi trang nên có đúng 1 thẻ H1', position: null
                });
            } else if (h1s.length > 1) {
                issues.push({
                    type: 'MULTIPLE_H1', severity: 'MEDIUM',
                    description: `Trang có ${h1s.length} thẻ H1 - nên chỉ có 1`,
                    viewport: 'all', selector: 'h1', details: `H1 texts: ${Array.from(h1s).map(h => h.textContent.substring(0, 30)).join(' | ')}`, position: null
                });
            }

            // Heading hierarchy
            const headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
            let prevLevel = 0;
            for (const h of headings) {
                const level = parseInt(h.tagName[1]);
                if (prevLevel > 0 && level > prevLevel + 1) {
                    issues.push({
                        type: 'HEADING_SKIP', severity: 'LOW',
                        description: `Heading nhảy cấp: H${prevLevel} → H${level} (bỏ qua H${prevLevel + 1})`,
                        viewport: 'all', selector: h.tagName.toLowerCase(),
                        details: `"${h.textContent.substring(0, 40)}"`, position: null
                    });
                    break; // Only report first skip
                }
                prevLevel = level;
            }

            // Lang attribute
            const lang = document.documentElement.lang;
            if (!lang || lang.trim().length === 0) {
                issues.push({
                    type: 'MISSING_LANG', severity: 'MEDIUM',
                    description: 'Thẻ <html> thiếu thuộc tính lang - ảnh hưởng accessibility và SEO',
                    viewport: 'all', selector: 'html',
                    details: 'Thêm: <html lang="vi"> hoặc <html lang="en">', position: null
                });
            }

            // Favicon
            const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
            if (!favicon) {
                issues.push({
                    type: 'MISSING_FAVICON', severity: 'MEDIUM',
                    description: 'Thiếu favicon - trang không có icon trên tab trình duyệt',
                    viewport: 'all', selector: 'link[rel="icon"]',
                    details: 'Thêm: <link rel="icon" href="/favicon.ico">', position: null
                });
            }

            return issues;
        }, viewportType);
    }

    // ==========================================
    // NEW: FORM ACCESSIBILITY CHECKS
    // ==========================================

    async _runFormChecks(page, viewportType) {
        // Only run on desktop to avoid duplicates
        if (viewportType !== 'desktop') return [];

        return await page.evaluate((vType) => {
            const issues = [];

            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                // Check for submit button
                const submitBtn = form.querySelector('[type="submit"], button:not([type="button"]):not([type="reset"])');
                if (!submitBtn) {
                    issues.push({
                        type: 'FORM_NO_SUBMIT', severity: 'MEDIUM',
                        description: 'Form không có nút Submit',
                        viewport: 'all', selector: form.id ? `#${form.id}` : 'form',
                        details: `Form action: ${form.action || '(none)'}`, position: null
                    });
                }
            });

            // Check all inputs
            const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea');
            let noLabelCount = 0;
            let placeholderOnlyCount = 0;

            inputs.forEach(input => {
                try {
                    const style = getComputedStyle(input);
                    if (style.display === 'none' || style.visibility === 'hidden') return;

                    const id = input.id;
                    const ariaLabel = input.getAttribute('aria-label');
                    const ariaLabelledBy = input.getAttribute('aria-labelledby');
                    const label = id ? document.querySelector(`label[for="${id}"]`) : null;
                    const parentLabel = input.closest('label');

                    const hasLabel = !!(label || parentLabel || ariaLabel || ariaLabelledBy);

                    if (!hasLabel) {
                        if (noLabelCount < 5) {
                            noLabelCount++;
                            issues.push({
                                type: 'INPUT_WITHOUT_LABEL', severity: 'HIGH',
                                description: `Input thiếu label: <${input.tagName.toLowerCase()} type="${input.type || 'text'}" name="${input.name || ''}">`,
                                viewport: 'all',
                                selector: input.id ? `#${input.id}` : `input[name="${input.name}"]`,
                                details: `Placeholder: "${input.placeholder || '(none)'}"`, position: null
                            });
                        }

                        // Check placeholder-as-label anti-pattern
                        if (input.placeholder && input.placeholder.trim().length > 0) {
                            if (placeholderOnlyCount < 3) {
                                placeholderOnlyCount++;
                                issues.push({
                                    type: 'PLACEHOLDER_AS_LABEL', severity: 'MEDIUM',
                                    description: `Placeholder thay label (anti-pattern): "${input.placeholder}"`,
                                    viewport: 'all',
                                    selector: input.id ? `#${input.id}` : `input[name="${input.name}"]`,
                                    details: 'Placeholder biến mất khi nhập, không phải label thay thế hợp lệ', position: null
                                });
                            }
                        }
                    }

                    // Check autocomplete for common fields
                    const name = (input.name || '').toLowerCase();
                    const type = (input.type || '').toLowerCase();
                    const needsAutocomplete = (
                        name.includes('email') || name.includes('name') || name.includes('phone') ||
                        name.includes('tel') || name.includes('address') ||
                        type === 'email' || type === 'tel'
                    );
                    if (needsAutocomplete && !input.autocomplete) {
                        issues.push({
                            type: 'MISSING_AUTOCOMPLETE', severity: 'LOW',
                            description: `Input "${name || type}" thiếu autocomplete attribute`,
                            viewport: 'all',
                            selector: input.id ? `#${input.id}` : `input[name="${input.name}"]`,
                            details: 'Thêm autocomplete="email|name|tel" để cải thiện UX', position: null
                        });
                    }
                } catch (e) { }
            });

            return issues;
        }, viewportType);
    }

    // ==========================================
    // NEW: IMAGE OPTIMIZATION CHECKS
    // ==========================================

    async _runImageOptChecks(page, viewportType) {
        // Only run on desktop to avoid duplicates for global checks
        if (viewportType !== 'desktop') return [];

        return await page.evaluate((vType) => {
            const issues = [];

            document.querySelectorAll('img').forEach(img => {
                try {
                    if (!img.complete || img.naturalWidth === 0) return;
                    if (img.width < 5 || img.height < 5) return;

                    // Oversized images (natural size much larger than display size)
                    const widthRatio = img.naturalWidth / img.clientWidth;
                    const heightRatio = img.naturalHeight / img.clientHeight;
                    const maxRatio = Math.max(widthRatio, heightRatio);

                    if (maxRatio > 3 && img.clientWidth > 50) {
                        const wastedKB = Math.round((img.naturalWidth * img.naturalHeight - img.clientWidth * img.clientHeight) * 4 / 1024);
                        issues.push({
                            type: 'OVERSIZED_IMAGE', severity: 'MEDIUM',
                            description: `Ảnh quá lớn so với hiển thị (${img.naturalWidth}×${img.naturalHeight} → hiển thị ${img.clientWidth}×${img.clientHeight}, ×${maxRatio.toFixed(1)})`,
                            viewport: 'all',
                            selector: img.id ? `#${img.id}` : `img[src="${img.src.substring(0, 60)}"]`,
                            details: `Lãng phí ~${wastedKB}KB pixel data. Nên resize ảnh hoặc dùng srcset`,
                            position: null
                        });
                    }

                    // No lazy loading for below-fold images
                    const rect = img.getBoundingClientRect();
                    if (rect.top > window.innerHeight * 1.5 && img.loading !== 'lazy') {
                        issues.push({
                            type: 'NO_LAZY_LOADING', severity: 'LOW',
                            description: `Ảnh ngoài viewport (y=${Math.round(rect.top)}px) không có lazy loading`,
                            viewport: 'all',
                            selector: img.id ? `#${img.id}` : `img[src="${img.src.substring(0, 60)}"]`,
                            details: 'Thêm loading="lazy" để cải thiện tốc độ tải trang',
                            position: null
                        });
                    }

                    // CLS-prone: img without width/height attributes
                    if (!img.hasAttribute('width') && !img.hasAttribute('height')) {
                        const style = getComputedStyle(img);
                        const hasCSSDimensions = (style.width !== 'auto' && style.width !== '0px') ||
                            (style.height !== 'auto' && style.height !== '0px');
                        if (!hasCSSDimensions && img.clientWidth > 100) {
                            issues.push({
                                type: 'CLS_PRONE', severity: 'HIGH',
                                description: `Ảnh thiếu width/height → gây Layout Shift (CLS): ${img.src.substring(0, 60)}`,
                                viewport: 'all',
                                selector: img.id ? `#${img.id}` : 'img',
                                details: `Thêm width="${img.naturalWidth}" height="${img.naturalHeight}" để browser reserve space`,
                                position: null
                            });
                        }
                    }
                } catch (e) { }
            });

            // Check no webp/avif usage
            const allImgs = document.querySelectorAll('img[src]');
            let legacyFormatCount = 0;
            allImgs.forEach(img => {
                const src = img.src.toLowerCase();
                if ((src.endsWith('.jpg') || src.endsWith('.jpeg') || src.endsWith('.png')) && !src.startsWith('data:')) {
                    legacyFormatCount++;
                }
            });
            const hasPictureSrcset = document.querySelectorAll('picture source[type*="webp"], picture source[type*="avif"]').length > 0;

            if (legacyFormatCount > 3 && !hasPictureSrcset) {
                issues.push({
                    type: 'NO_WEBP_SUPPORT', severity: 'LOW',
                    description: `${legacyFormatCount} ảnh dùng JPG/PNG mà không có WebP/AVIF fallback`,
                    viewport: 'all', selector: 'img',
                    details: 'Dùng <picture> + <source type="image/webp"> để giảm 25-50% dung lượng',
                    position: null
                });
            }

            return issues;
        }, viewportType);
    }

    // ==========================================
    // NEW: PERFORMANCE INDICATOR CHECKS
    // ==========================================

    async _runPerformanceChecks(page, viewportType) {
        // Only run on desktop
        if (viewportType !== 'desktop') return [];

        return await page.evaluate((vType) => {
            const issues = [];

            // Render-blocking scripts in <head>
            const headScripts = document.querySelectorAll('head script[src]:not([async]):not([defer]):not([type="module"])');
            if (headScripts.length > 0) {
                issues.push({
                    type: 'RENDER_BLOCKING_SCRIPT', severity: 'MEDIUM',
                    description: `${headScripts.length} script(s) trong <head> chặn render (thiếu async/defer)`,
                    viewport: 'all', selector: 'head > script',
                    details: `Scripts: ${Array.from(headScripts).map(s => s.src.split('/').pop()).slice(0, 5).join(', ')}`,
                    position: null
                });
            }

            // Too many third-party scripts
            const allScripts = document.querySelectorAll('script[src]');
            const currentDomain = window.location.hostname;
            const thirdPartyDomains = new Set();
            allScripts.forEach(s => {
                try {
                    const url = new URL(s.src);
                    if (url.hostname !== currentDomain && !url.hostname.endsWith('.' + currentDomain)) {
                        thirdPartyDomains.add(url.hostname);
                    }
                } catch (e) { }
            });

            if (thirdPartyDomains.size > 5) {
                issues.push({
                    type: 'TOO_MANY_THIRD_PARTY', severity: 'LOW',
                    description: `${thirdPartyDomains.size} third-party script domains - có thể ảnh hưởng tốc độ`,
                    viewport: 'all', selector: 'script[src]',
                    details: `Domains: ${Array.from(thirdPartyDomains).slice(0, 8).join(', ')}`,
                    position: null
                });
            }

            // Iframes without dimensions (CLS)
            const iframes = document.querySelectorAll('iframe:not([width]):not([height])');
            iframes.forEach(iframe => {
                const style = getComputedStyle(iframe);
                if (style.width === 'auto' || style.height === 'auto') {
                    issues.push({
                        type: 'CLS_PRONE', severity: 'HIGH',
                        description: `Iframe thiếu kích thước cố định → gây Layout Shift: ${(iframe.src || '').substring(0, 60)}`,
                        viewport: 'all',
                        selector: iframe.id ? `#${iframe.id}` : 'iframe',
                        details: 'Thêm width và height attribute cho iframe',
                        position: null
                    });
                }
            });

            return issues;
        }, viewportType);
    }

    // ==========================================
    // BROKEN LINKS CHECK (from UIChecker.js)
    // ==========================================

    async _checkBrokenLinks(browser, url) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const issues = [];

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

            const links = await page.evaluate(() => {
                const anchors = document.querySelectorAll('a[href]');
                const hrefs = new Set();
                anchors.forEach(a => {
                    const h = a.href;
                    if (h && !h.startsWith('javascript:') && !h.startsWith('mailto:') && !h.startsWith('tel:') && !h.startsWith('#')) {
                        hrefs.add(h);
                    }
                });
                return Array.from(hrefs).slice(0, 50); // Increased from 30 to 50
            });

            // Check links in parallel (batches of 5)
            for (let i = 0; i < links.length; i += 5) {
                const batch = links.slice(i, i + 5);
                const results = await Promise.allSettled(
                    batch.map(async link => {
                        try {
                            const resp = await page.request.head(link, { timeout: 8000 });
                            return { link, status: resp.status() };
                        } catch (e) {
                            return { link, status: 0, error: e.message };
                        }
                    })
                );
                for (const r of results) {
                    if (r.status === 'fulfilled') {
                        const { link, status } = r.value;
                        if (status >= 400 || status === 0) {
                            issues.push({
                                type: 'BROKEN_LINK',
                                severity: status === 404 ? 'HIGH' : 'MEDIUM',
                                description: `Link lỗi (HTTP ${status}): ${link.substring(0, 100)}`,
                                viewport: 'all',
                                selector: `a[href="${link.substring(0, 60)}"]`,
                                details: `Status: ${status}`,
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[EnhancedUIChecker] Broken link check error:', e.message);
        }

        await context.close();
        return issues;
    }

    // ==========================================
    // CROSS-VIEWPORT COMPARISON (enhanced)
    // ==========================================

    // ==========================================
    // CHECKLIST TESTS — 8 groups, 46 test cases
    // ==========================================

    /**
     * Run 8 checklist test groups on a separate desktop context
     */
    async _runChecklistOnDesktop(browser, url, desktopKey, loginEmail, loginPassword) {
        const vp = DESKTOP_PRESETS[desktopKey] || DESKTOP_PRESETS['1920x1080'];
        const context = await browser.newContext({ viewport: vp });
        const page = await context.newPage();

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(1500);

            // Auto-login if needed
            if (loginEmail && loginPassword) {
                const autoLogin = new AutoLogin();
                const loginSuccess = await autoLogin.attemptLogin(page, loginEmail, loginPassword);
                if (loginSuccess) {
                    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                    await page.waitForTimeout(2000);
                }
            }

            // Discover interactive elements
            const discovery = await this._discoverElementsForChecklist(page);

            // Run 8 test groups sequentially (they share the same page)
            console.log('[EnhancedUIChecker] Running checklist tests (8 groups)...');
            const layoutResults = await this._layoutUITests.run(page, discovery, url);
            const uiCompResults = await this._uiComponentTests.run(page, discovery, url);
            const textResults = await this._textContentTests.run(page, discovery, url);
            const imageResults = await this._imageIconTests.run(page, discovery, url);
            const scrollResults = await this._scrollPositionTests.run(page, discovery, url);
            const loadingResults = await this._loadingAnimationTests.run(page, discovery, url);
            const a11yResults = await this._accessibilityTests.run(page, discovery, url);
            const linkResults = await this._linkNavigationTests.run(page, discovery, url);

            await context.close();

            const groups = {
                layoutUI: layoutResults,
                uiComponents: uiCompResults,
                textContent: textResults,
                imageIcon: imageResults,
                scrollPosition: scrollResults,
                loadingAnimation: loadingResults,
                accessibility: a11yResults,
                linkNavigation: linkResults,
            };

            return {
                groups,
                summary: this._generateChecklistSummary(groups),
            };
        } catch (err) {
            await context.close();
            console.error('[EnhancedUIChecker] Checklist error:', err.message);
            return {
                groups: {},
                summary: { total: 0, passed: 0, failed: 0, warning: 0, skipped: 0, error: 0, passRate: 0 },
            };
        }
    }

    /**
     * Generate checklist summary from grouped test results
     */
    _generateChecklistSummary(groups) {
        let total = 0, passed = 0, failed = 0, warning = 0, skipped = 0, error = 0;
        for (const tests of Object.values(groups)) {
            for (const t of tests) {
                total++;
                if (t.status === 'passed') passed++;
                else if (t.status === 'failed') failed++;
                else if (t.status === 'warning') warning++;
                else if (t.status === 'skipped') skipped++;
                else if (t.status === 'error') error++;
            }
        }
        return {
            total, passed, failed, warning, skipped, error,
            passRate: total > 0 ? Math.round(passed / total * 100) : 0,
        };
    }

    /**
     * Discover interactive elements for checklist tests
     * (same logic as InteractionTester._discoverElements)
     */
    async _discoverElementsForChecklist(page) {
        return await page.evaluate(() => {
            const discovery = {
                forms: [], navLinks: [], buttons: [], dropdowns: [],
                inputs: [], checkboxes: [], radios: [], listBoxes: [],
                dateInputs: [], links: [], images: [], tabs: [], tooltips: [],
                totalInteractive: 0,
            };

            // Forms
            document.querySelectorAll('form').forEach(form => {
                const fields = [];
                form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea').forEach(input => {
                    fields.push({
                        tag: input.tagName.toLowerCase(), type: input.type || 'text',
                        name: input.name || '', id: input.id || '', required: input.required,
                        placeholder: input.placeholder || '',
                        selector: input.id ? `#${input.id}` : (input.name ? `[name="${input.name}"]` : `${input.tagName.toLowerCase()}[type="${input.type}"]`),
                    });
                });
                const submitBtn = form.querySelector('[type="submit"], button:not([type="button"]):not([type="reset"])');
                discovery.forms.push({
                    id: form.id || '', action: form.action || '', method: form.method || 'get', fields,
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
                    text: a.textContent.trim().substring(0, 50), href,
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
                    text: btn.textContent.trim().substring(0, 50), id: btn.id || '',
                    selector: btn.id ? `#${btn.id}` : (btn.textContent.trim() ? `button:has-text("${btn.textContent.trim().substring(0, 30)}")` : btn.tagName.toLowerCase()),
                });
            });

            // Dropdowns
            document.querySelectorAll('select, [data-toggle="dropdown"], [data-bs-toggle="dropdown"], details > summary').forEach(dd => {
                const rect = dd.getBoundingClientRect();
                if (rect.width === 0) return;
                discovery.dropdowns.push({
                    text: dd.textContent.trim().substring(0, 50),
                    selector: dd.id ? `#${dd.id}` : dd.tagName.toLowerCase(),
                    type: dd.tagName === 'SELECT' ? 'native' : (dd.tagName === 'SUMMARY' ? 'details' : 'bootstrap'),
                });
            });

            // Standalone inputs
            document.querySelectorAll('input:not(form input):not([type="hidden"]), textarea:not(form textarea)').forEach(input => {
                const rect = input.getBoundingClientRect();
                if (rect.width === 0) return;
                discovery.inputs.push({
                    type: input.type || 'text', name: input.name || '',
                    placeholder: input.placeholder || '',
                    selector: input.id ? `#${input.id}` : `input[name="${input.name}"]`,
                });
            });

            // Checkboxes
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                const rect = cb.getBoundingClientRect();
                if (rect.width > 0 || getComputedStyle(cb).display !== 'none') {
                    discovery.checkboxes.push({
                        name: cb.name || '', id: cb.id || '',
                        selector: cb.id ? `#${cb.id}` : `input[type="checkbox"][name="${cb.name}"]`,
                    });
                }
            });

            // Radio buttons
            document.querySelectorAll('input[type="radio"]').forEach(radio => {
                const rect = radio.getBoundingClientRect();
                if (rect.width > 0 || getComputedStyle(radio).display !== 'none') {
                    discovery.radios.push({
                        name: radio.name || '', value: radio.value || '',
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
                    discovery.links.push({ href: a.href, text: a.textContent.trim().substring(0, 50) });
                }
            });

            // Images
            document.querySelectorAll('img').forEach(img => {
                const rect = img.getBoundingClientRect();
                if (rect.width > 0 || rect.height > 0) {
                    discovery.images.push({
                        src: img.src.substring(0, 100), alt: img.alt || '',
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
                discovery.forms.length + discovery.navLinks.length + discovery.buttons.length +
                discovery.dropdowns.length + discovery.inputs.length + discovery.checkboxes.length +
                discovery.radios.length + discovery.listBoxes.length + discovery.dateInputs.length +
                discovery.links.length + discovery.images.length + discovery.tabs.length +
                discovery.tooltips.length;

            return discovery;
        });
    }

    _compareViewports(desktop, tablet, mobile) {
        const issues = [];

        for (const dEl of desktop.elements) {
            if (!dEl.visible) continue;

            // Check mobile
            const mEl = mobile.elements.find(e => e.tag === dEl.tag && (e.id === dEl.id || (!e.id && !dEl.id && e.className === dEl.className)));
            if (mEl && !mEl.visible && dEl.tag !== 'nav' && dEl.tag !== 'aside') {
                issues.push({
                    type: 'RESPONSIVE_HIDDEN',
                    severity: 'MEDIUM',
                    description: `<${dEl.tag}${dEl.id ? '#' + dEl.id : dEl.className ? '.' + dEl.className : ''}> hiển thị ở Desktop nhưng ẩn ở Mobile`,
                    viewport: 'cross',
                    selector: dEl.id ? `#${dEl.id}` : dEl.tag,
                    details: 'Kiểm tra xem việc ẩn có chủ đích không',
                });
            }

            // Check tablet
            const tEl = tablet.elements.find(e => e.tag === dEl.tag && (e.id === dEl.id || (!e.id && !dEl.id && e.className === dEl.className)));
            if (tEl && !tEl.visible && dEl.tag !== 'nav' && dEl.tag !== 'aside') {
                issues.push({
                    type: 'RESPONSIVE_HIDDEN',
                    severity: 'LOW',
                    description: `<${dEl.tag}${dEl.id ? '#' + dEl.id : ''}> hiển thị ở Desktop nhưng ẩn ở Tablet`,
                    viewport: 'cross',
                    selector: dEl.id ? `#${dEl.id}` : dEl.tag,
                    details: 'Kiểm tra responsive design cho tablet',
                });
            }
        }

        return issues;
    }
}

module.exports = EnhancedUIChecker;
module.exports.DESKTOP_PRESETS = DESKTOP_PRESETS;
module.exports.TABLET_PRESETS = TABLET_PRESETS;
module.exports.MOBILE_PRESETS = MOBILE_PRESETS;
