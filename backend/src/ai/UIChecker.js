const { chromium, devices } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const AutoLogin = require('./AutoLogin');
const IssueAnalyzer = require('./IssueAnalyzer');

// Desktop viewport presets
const DESKTOP_PRESETS = {
    '1920x1080': { width: 1920, height: 1080 },
    '1440x900': { width: 1440, height: 900 },
    '1366x768': { width: 1366, height: 768 },
};

// Tablet presets (Playwright device names)
const TABLET_PRESETS = {
    'ipad-pro': 'iPad Pro 11',
    'ipad-mini': 'iPad Mini',
    'galaxy-tab': 'Galaxy Tab S4',
};

// Mobile presets (Playwright device names)
const MOBILE_PRESETS = {
    'iphone-15': 'iPhone 15',
    'iphone-se': 'iPhone SE',
    'pixel-7': 'Pixel 7',
    'galaxy-s24': 'Galaxy S24',
};

class UIChecker {
    /**
     * Run full UI check on a URL across 3 viewports
     * @param {string} url
     * @param {object} opts - { desktop, tablet, mobile, loginEmail, loginPassword }
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
            // Run checks on each viewport
            const [desktopResult, tabletResult, mobileResult] = await Promise.all([
                this._checkViewport(browser, url, 'desktop', desktopKey, loginEmail, loginPassword),
                this._checkViewport(browser, url, 'tablet', tabletKey, loginEmail, loginPassword),
                this._checkViewport(browser, url, 'mobile', mobileKey, loginEmail, loginPassword),
            ]);

            // Check broken links (only once, not per viewport)
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

            // === SMART ANALYSIS ===
            console.log('[UIChecker] Running smart analysis...');
            const analyzer = new IssueAnalyzer();
            const analysis = analyzer.analyzeIssues(allIssues, {
                url,
                viewports: [desktopKey, tabletKey, mobileKey]
            });

            // Use analyzed issues instead of raw issues
            const analyzedIssues = analysis.issues;
            const patterns = analysis.patterns;
            const summary = {
                ...analysis.summary,
                duration_ms: Date.now() - startTime,
                // Keep old severity counts for backward compatibility
                critical: allIssues.filter(i => i.severity === 'CRITICAL').length,
                high: allIssues.filter(i => i.severity === 'HIGH').length,
                medium: allIssues.filter(i => i.severity === 'MEDIUM').length,
                low: allIssues.filter(i => i.severity === 'LOW').length,
            };

            console.log(`[UIChecker] Analysis complete: ${summary.total} issues, ${summary.byPriority.MUST_FIX} must-fix, ${patterns.systematicProblems} systematic problems`);

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
                issues: analyzedIssues,  // Now includes score, priority, autoFix
                patterns,                 // Systematic issues, false positives
                summary,
            };
        } catch (err) {
            await browser.close();
            throw err;
        }
    }

    /**
     * Run checks on a single viewport
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
            await page.waitForTimeout(1500); // settle animations

            // If loginEmail and loginPassword are provided, attempt auto-login
            if (loginEmail && loginPassword) {
                const autoLogin = new AutoLogin();
                const loginSuccess = await autoLogin.attemptLogin(page, loginEmail, loginPassword);

                if (loginSuccess) {
                    console.log(`[UIChecker] Auto-login successful for ${viewportType}, re-navigating...`);
                    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                    await page.waitForTimeout(2000);
                } else {
                    console.warn(`[UIChecker] Auto-login failed for ${viewportType}, continuing with current state`);
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

        // Run all DOM checks via JS injection
        const domIssues = await page.evaluate((vType) => {
            const issues = [];
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            // --- #1 & #5: Horizontal overflow ---
            if (document.body.scrollWidth > vw + 5) {
                issues.push({
                    type: 'HORIZONTAL_SCROLLBAR',
                    severity: 'CRITICAL',
                    description: `Trang có thanh cuộn ngang (body scrollWidth ${document.body.scrollWidth}px > viewport ${vw}px)`,
                    viewport: vType,
                    selector: 'body',
                    details: `scrollWidth: ${document.body.scrollWidth}, viewportWidth: ${vw}`,
                });
            }

            // --- #1: Element horizontal overflow ---
            document.querySelectorAll('*').forEach(el => {
                try {
                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return;
                    if (el.scrollWidth > el.clientWidth + 5 && el.clientWidth > 0) {
                        const tag = el.tagName.toLowerCase();
                        if (['html', 'body', 'script', 'style', 'head'].includes(tag)) return;
                        issues.push({
                            type: 'OVERFLOW_X',
                            severity: 'HIGH',
                            description: `Element tràn ngang: <${tag}> (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})`,
                            viewport: vType,
                            selector: el.id ? `#${el.id}` : `${tag}.${(el.className || '').toString().split(' ')[0] || '?'}`,
                            details: el.textContent ? el.textContent.substring(0, 80) : '',
                        });
                    }
                } catch (e) { /* skip */ }
            });

            // Cap overflow issues
            const overflowIssues = issues.filter(i => i.type === 'OVERFLOW_X');
            if (overflowIssues.length > 10) {
                const excess = overflowIssues.length - 10;
                for (let i = 0; i < excess; i++) {
                    const idx = issues.indexOf(overflowIssues[10 + i]);
                    if (idx > -1) issues.splice(idx, 1);
                }
                issues.push({
                    type: 'OVERFLOW_X',
                    severity: 'MEDIUM',
                    description: `... và ${excess} element khác cũng bị tràn`,
                    viewport: vType, selector: '', details: '',
                });
            }

            // --- #4: Elements outside viewport ---
            document.querySelectorAll('img, button, a, input, select, textarea, h1, h2, h3, p, div > span').forEach(el => {
                try {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    if (rect.right < -50 || rect.left > vw + 50) {
                        const tag = el.tagName.toLowerCase();
                        issues.push({
                            type: 'OUTSIDE_VIEWPORT',
                            severity: 'HIGH',
                            description: `Element nằm ngoài viewport: <${tag}> ở vị trí x=${Math.round(rect.left)}`,
                            viewport: vType,
                            selector: el.id ? `#${el.id}` : tag,
                            details: (el.textContent || '').substring(0, 60),
                        });
                    }
                } catch (e) { /* skip */ }
            });

            // --- #6: Broken images ---
            document.querySelectorAll('img').forEach(img => {
                if (img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:')) {
                    issues.push({
                        type: 'BROKEN_IMAGE',
                        severity: 'CRITICAL',
                        description: `Ảnh bị hỏng: ${img.src.substring(0, 100)}`,
                        viewport: vType,
                        selector: img.id ? `#${img.id}` : `img[src="${img.src.substring(0, 60)}"]`,
                        details: img.alt || '(no alt)',
                    });
                }
            });

            // --- #7: Images missing alt ---
            document.querySelectorAll('img').forEach(img => {
                if (img.complete && img.naturalWidth > 0 && (!img.alt || img.alt.trim() === '')) {
                    if (img.width < 5 || img.height < 5) return; // skip tracking pixels
                    issues.push({
                        type: 'MISSING_ALT',
                        severity: 'MEDIUM',
                        description: `Ảnh thiếu alt text: ${img.src.substring(0, 80)}`,
                        viewport: vType,
                        selector: img.id ? `#${img.id}` : 'img',
                        details: `${img.naturalWidth}×${img.naturalHeight}`,
                    });
                }
            });

            // --- #8: Distorted images ---
            document.querySelectorAll('img').forEach(img => {
                if (!img.complete || img.naturalWidth === 0) return;
                if (img.clientWidth < 10 || img.clientHeight < 10) return;
                const naturalRatio = img.naturalWidth / img.naturalHeight;
                const displayRatio = img.clientWidth / img.clientHeight;
                const diff = Math.abs(naturalRatio - displayRatio) / naturalRatio;
                if (diff > 0.15) {
                    issues.push({
                        type: 'DISTORTED_IMAGE',
                        severity: 'LOW',
                        description: `Ảnh bị méo (sai tỉ lệ ${Math.round(diff * 100)}%): ${img.src.substring(0, 80)}`,
                        viewport: vType,
                        selector: img.id ? `#${img.id}` : 'img',
                        details: `Original: ${img.naturalWidth}×${img.naturalHeight}, Display: ${img.clientWidth}×${img.clientHeight}`,
                    });
                }
            });

            // --- #13: Truncated text ---
            document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,label,td,th,li').forEach(el => {
                try {
                    const style = getComputedStyle(el);
                    if (style.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 20) {
                        issues.push({
                            type: 'TEXT_TRUNCATED',
                            severity: 'MEDIUM',
                            description: `Text bị cắt: "${(el.textContent || '').substring(0, 50)}..."`,
                            viewport: vType,
                            selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
                            details: `scrollWidth: ${el.scrollWidth}, clientWidth: ${el.clientWidth}`,
                        });
                    }
                } catch (e) { /* skip */ }
            });

            // --- #14: Touch targets too small (mobile only) ---
            if (vType === 'mobile') {
                document.querySelectorAll('a, button, input, select, textarea, [role="button"]').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    if (rect.width < 44 || rect.height < 44) {
                        const style = getComputedStyle(el);
                        if (style.display === 'none' || style.visibility === 'hidden') return;
                        issues.push({
                            type: 'SMALL_TOUCH_TARGET',
                            severity: 'MEDIUM',
                            description: `Touch target quá nhỏ: <${el.tagName.toLowerCase()}> (${Math.round(rect.width)}×${Math.round(rect.height)}px < 44×44px)`,
                            viewport: vType,
                            selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
                            details: (el.textContent || el.value || '').substring(0, 40),
                        });
                    }
                });
                // Cap touch target issues
                const touchIssues = issues.filter(i => i.type === 'SMALL_TOUCH_TARGET');
                if (touchIssues.length > 15) {
                    const excess = touchIssues.length - 15;
                    for (let i = 0; i < excess; i++) {
                        const idx = issues.indexOf(touchIssues[15 + i]);
                        if (idx > -1) issues.splice(idx, 1);
                    }
                    issues.push({
                        type: 'SMALL_TOUCH_TARGET',
                        severity: 'LOW',
                        description: `... và ${excess} element khác cũng có touch target nhỏ`,
                        viewport: vType, selector: '', details: '',
                    });
                }
            }

            return issues;
        }, viewportType);

        // Accessibility check via axe-core
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
            console.warn('[UIChecker] axe-core error:', e.message);
        }

        // Collect visible element info for cross-viewport comparison
        const elements = await page.evaluate(() => {
            const els = [];
            document.querySelectorAll('nav, header, footer, main, h1, h2, .logo, [role="navigation"], [role="banner"]').forEach(el => {
                const rect = el.getBoundingClientRect();
                const style = getComputedStyle(el);
                els.push({
                    tag: el.tagName.toLowerCase(),
                    id: el.id || '',
                    visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0,
                    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                });
            });
            return els;
        });

        await context.close();

        return {
            deviceLabel,
            screenshot,
            issues: [...domIssues, ...consoleIssues, ...axeIssues],
            elements,
        };
    }

    /**
     * Check broken links
     */
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
                return Array.from(hrefs).slice(0, 30); // cap at 30
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
            console.warn('[UIChecker] Broken link check error:', e.message);
        }

        await context.close();
        return issues;
    }

    /**
     * Compare elements across viewports for responsive issues
     */
    _compareViewports(desktop, tablet, mobile) {
        const issues = [];

        // Find elements visible on desktop but hidden on mobile/tablet (potential responsive issue)
        for (const dEl of desktop.elements) {
            if (!dEl.visible) continue;
            const mEl = mobile.elements.find(e => e.tag === dEl.tag && e.id === dEl.id);
            if (mEl && !mEl.visible && dEl.tag !== 'nav') {
                // nav is commonly hidden on mobile, skip
                issues.push({
                    type: 'RESPONSIVE_HIDDEN',
                    severity: 'MEDIUM',
                    description: `<${dEl.tag}${dEl.id ? '#' + dEl.id : ''}> hiển thị ở Desktop nhưng ẩn ở Mobile`,
                    viewport: 'cross',
                    selector: dEl.id ? `#${dEl.id}` : dEl.tag,
                    details: 'Kiểm tra xem việc ẩn có chủ đích không',
                });
            }
        }

        return issues;
    }
}

module.exports = UIChecker;
module.exports.DESKTOP_PRESETS = DESKTOP_PRESETS;
module.exports.TABLET_PRESETS = TABLET_PRESETS;
module.exports.MOBILE_PRESETS = MOBILE_PRESETS;
