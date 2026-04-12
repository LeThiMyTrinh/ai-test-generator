/**
 * Group 7: Accessibility (5 cases)
 * 7.1 Tab navigation
 * 7.2 Focus outline
 * 7.3 Button có label
 * 7.4 Image có alt
 * 7.5 Contrast màu đạt chuẩn
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class AccessibilityTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testTabNavigation(page));
        results.push(await this._testFocusOutline(page));
        results.push(await this._testButtonLabel(page));
        results.push(await this._testImageAlt(page));
        results.push(await this._testColorContrast(page));

        return results;
    }

    /**
     * 7.1: Tab navigation — tab through interactive elements
     */
    async _testTabNavigation(page) {
        const test = createTestResult('accessibility', '7.1', 'Tab navigation');
        return runSafe(test, async (t) => {
            await page.evaluate(() => {
                window.scrollTo({ top: 0 });
                document.body.focus();
            });
            await page.waitForTimeout(100);

            const focusOrder = [];
            for (let i = 0; i < 15; i++) {
                await page.keyboard.press('Tab');
                await page.waitForTimeout(80);

                const focused = await page.evaluate(() => {
                    const el = document.activeElement;
                    if (!el || el === document.body) return null;
                    const rect = el.getBoundingClientRect();
                    return {
                        tag: el.tagName.toLowerCase(),
                        text: (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().substring(0, 30),
                        id: el.id || '',
                        tabIndex: el.tabIndex,
                        top: Math.round(rect.top),
                        isVisible: rect.width > 0 && rect.height > 0,
                    };
                });

                if (focused) focusOrder.push(focused);
            }

            if (focusOrder.length === 0) {
                t.status = 'failed';
                t.details = 'Không có element nào nhận focus khi Tab — tất cả interactive elements có thể thiếu tabindex';
                return;
            }

            const issues = [];
            const hiddenFocus = focusOrder.filter(el => !el.isVisible);
            if (hiddenFocus.length > 0) {
                issues.push(`${hiddenFocus.length} hidden elements nhận focus`);
            }

            const positiveTabindex = focusOrder.filter(el => el.tabIndex > 0);
            if (positiveTabindex.length > 0) {
                issues.push(`${positiveTabindex.length} elements có tabindex > 0 (anti-pattern)`);
            }

            const focusPath = focusOrder.slice(0, 8).map(el => `${el.tag}${el.id ? '#' + el.id : ''}`).join(' → ');

            if (issues.length === 0) {
                t.status = 'passed';
                t.details = `Tab order OK. ${focusOrder.length} elements nhận focus: ${focusPath} ✓`;
            } else {
                t.status = 'warning';
                t.details = `${focusOrder.length} elements. Issues: ${issues.join('; ')}. Path: ${focusPath}`;
            }
        });
    }

    /**
     * 7.2: Focus outline — focus indicator visible
     */
    async _testFocusOutline(page) {
        const test = createTestResult('accessibility', '7.2', 'Focus outline');
        return runSafe(test, async (t) => {
            await page.evaluate(() => {
                window.scrollTo({ top: 0 });
                document.body.focus();
            });
            await page.waitForTimeout(100);

            const focusResults = [];

            for (let i = 0; i < 8; i++) {
                await page.keyboard.press('Tab');
                await page.waitForTimeout(100);

                const focusStyle = await page.evaluate(() => {
                    const el = document.activeElement;
                    if (!el || el === document.body) return null;
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0) return null;

                    const style = getComputedStyle(el);
                    const outlineWidth = parseFloat(style.outlineWidth) || 0;
                    const outlineStyle = style.outlineStyle;
                    const boxShadow = style.boxShadow;

                    const hasOutline = outlineStyle !== 'none' && outlineWidth > 0;
                    const hasBoxShadow = boxShadow !== 'none' && boxShadow !== '';

                    return {
                        tag: el.tagName.toLowerCase(),
                        text: (el.textContent || '').trim().substring(0, 25),
                        hasFocusIndicator: hasOutline || hasBoxShadow,
                    };
                });

                if (focusStyle) focusResults.push(focusStyle);
            }

            if (focusResults.length === 0) {
                t.status = 'failed';
                t.details = 'Không có elements nhận focus để kiểm tra indicator';
                return;
            }

            const withIndicator = focusResults.filter(r => r.hasFocusIndicator);
            const withoutIndicator = focusResults.filter(r => !r.hasFocusIndicator);

            if (withoutIndicator.length === 0) {
                t.status = 'passed';
                t.details = `${focusResults.length}/${focusResults.length} focused elements có visible indicator ✓`;
            } else if (withoutIndicator.length <= 2) {
                t.status = 'warning';
                t.details = `${withIndicator.length}/${focusResults.length} elements có focus indicator. Thiếu: ${withoutIndicator.map(r => `${r.tag} "${r.text}"`).join(', ')}`;
            } else {
                t.status = 'failed';
                t.details = `${withoutIndicator.length}/${focusResults.length} elements THIẾU focus indicator. Keyboard users không thấy focus.`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 7.3: Button có label — all buttons should have accessible name
     */
    async _testButtonLabel(page) {
        const test = createTestResult('accessibility', '7.3', 'Button có label');
        return runSafe(test, async (t) => {
            const buttonCheck = await page.evaluate(() => {
                const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]');
                let total = 0;
                const withoutLabel = [];

                buttons.forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width === 0) return;
                    const style = getComputedStyle(btn);
                    if (style.display === 'none') return;
                    total++;

                    const text = btn.textContent.trim();
                    const ariaLabel = btn.getAttribute('aria-label');
                    const ariaLabelledby = btn.getAttribute('aria-labelledby');
                    const title = btn.getAttribute('title');
                    const value = btn.value; // for input buttons
                    const hasImg = btn.querySelector('img[alt]');
                    const hasSvg = btn.querySelector('svg[aria-label], svg title');

                    const hasName = !!(text || ariaLabel || ariaLabelledby || title || value || hasImg || hasSvg);

                    if (!hasName) {
                        withoutLabel.push({
                            tag: btn.tagName.toLowerCase(),
                            html: btn.outerHTML.substring(0, 60),
                            classes: btn.className.toString().substring(0, 40),
                        });
                    }
                });

                return { total, withoutLabel: withoutLabel.slice(0, 5) };
            });

            if (buttonCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy buttons trên trang';
                return;
            }

            if (buttonCheck.withoutLabel.length > 0) {
                t.status = 'failed';
                t.details = `${buttonCheck.withoutLabel.length}/${buttonCheck.total} buttons thiếu accessible label: ${buttonCheck.withoutLabel.slice(0, 3).map(b => `${b.tag} (${b.classes})`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${buttonCheck.total} buttons đều có accessible label ✓`;
            }
        });
    }

    /**
     * 7.4: Image có alt
     */
    async _testImageAlt(page) {
        const test = createTestResult('accessibility', '7.4', 'Image có alt');
        return runSafe(test, async (t) => {
            const altCheck = await page.evaluate(() => {
                const images = document.querySelectorAll('img');
                let total = 0, missingAlt = 0;

                images.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;
                    const role = img.getAttribute('role');
                    if (role === 'presentation' || role === 'none') return;
                    total++;

                    if (img.getAttribute('alt') === null) {
                        missingAlt++;
                    }
                });

                return { total, missingAlt };
            });

            if (altCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không có images trên trang';
                return;
            }

            if (altCheck.missingAlt > 0) {
                t.status = 'failed';
                t.details = `${altCheck.missingAlt}/${altCheck.total} images thiếu alt attribute`;
            } else {
                t.status = 'passed';
                t.details = `${altCheck.total} images đều có alt attribute ✓`;
            }
        });
    }

    /**
     * 7.5: Contrast màu đạt chuẩn (WCAG AA)
     */
    async _testColorContrast(page) {
        const test = createTestResult('accessibility', '7.5', 'Contrast màu đạt chuẩn');
        return runSafe(test, async (t) => {
            const contrastCheck = await page.evaluate(() => {
                // Helper: parse color to RGB
                function parseColor(color) {
                    const canvas = document.createElement('canvas');
                    canvas.width = canvas.height = 1;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = color;
                    ctx.fillRect(0, 0, 1, 1);
                    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
                    return { r, g, b, a: a / 255 };
                }

                // Helper: calculate relative luminance
                function luminance(r, g, b) {
                    const sRGB = [r, g, b].map(v => {
                        v /= 255;
                        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
                    });
                    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
                }

                // Helper: calculate contrast ratio
                function contrastRatio(c1, c2) {
                    const l1 = luminance(c1.r, c1.g, c1.b);
                    const l2 = luminance(c2.r, c2.g, c2.b);
                    const lighter = Math.max(l1, l2);
                    const darker = Math.min(l1, l2);
                    return (lighter + 0.05) / (darker + 0.05);
                }

                const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, span, button, label, li, td');
                let total = 0;
                const lowContrast = [];

                textElements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return;
                    const text = el.textContent.trim();
                    if (text.length === 0) return;
                    total++;

                    try {
                        const fgColor = parseColor(style.color);
                        const bgColor = parseColor(style.backgroundColor);

                        // Skip transparent backgrounds
                        if (bgColor.a < 0.1) return;

                        const ratio = contrastRatio(fgColor, bgColor);
                        const fontSize = parseFloat(style.fontSize);
                        const isBold = parseInt(style.fontWeight) >= 700 || style.fontWeight === 'bold';
                        const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold);

                        // WCAG AA: 4.5:1 for normal text, 3:1 for large text
                        const minRatio = isLargeText ? 3 : 4.5;

                        if (ratio < minRatio) {
                            lowContrast.push({
                                tag: el.tagName.toLowerCase(),
                                text: text.substring(0, 30),
                                ratio: ratio.toFixed(2),
                                required: minRatio,
                                fg: style.color,
                                bg: style.backgroundColor,
                            });
                        }
                    } catch { /* skip */ }
                });

                return { total, lowContrast: lowContrast.slice(0, 5) };
            });

            if (contrastCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không có text elements để kiểm tra contrast';
                return;
            }

            if (contrastCheck.lowContrast.length > 3) {
                t.status = 'failed';
                t.details = `${contrastCheck.lowContrast.length} elements không đạt WCAG AA contrast: ${contrastCheck.lowContrast.slice(0, 3).map(c => `${c.tag} "${c.text}" ratio=${c.ratio} (cần ${c.required}:1)`).join('; ')}`;
            } else if (contrastCheck.lowContrast.length > 0) {
                t.status = 'warning';
                t.details = `${contrastCheck.lowContrast.length} elements contrast thấp: ${contrastCheck.lowContrast.map(c => `${c.tag} "${c.text}" ratio=${c.ratio}`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${contrastCheck.total} text elements kiểm tra — contrast đạt chuẩn WCAG AA ✓`;
            }
        });
    }
}

module.exports = AccessibilityTests;
