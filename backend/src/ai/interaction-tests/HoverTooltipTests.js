/**
 * Group 7: Hover & Tooltip Tests (5 cases)
 * 7.1 Hover show tooltip
 * 7.2 Hover leave hide tooltip
 * 7.3 Title attribute check
 * 7.4 Hover on disabled element
 * 7.5 Tooltip position (not overflowing viewport)
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class HoverTooltipTests {
    /**
     * Run all hover & tooltip tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];

        // Discover tooltip triggers
        const tooltipElements = await this._discoverTooltips(page);

        // 7.1 + 7.2: Hover show/hide tooltip
        if (tooltipElements.customTooltips.length > 0) {
            for (const el of tooltipElements.customTooltips.slice(0, 3)) {
                results.push(await this._testHoverShowTooltip(page, el));
                results.push(await this._testHoverLeaveHide(page, el));
            }
        } else {
            results.push(createTestResult('hover_tooltip', '7.1', 'Hover show tooltip', {
                status: 'skipped', details: 'Không tìm thấy custom tooltip triggers (data-tooltip, [data-bs-toggle="tooltip"], [aria-describedby])',
            }));
        }

        // 7.3: Title attribute check
        results.push(await this._testTitleAttributes(page));

        // 7.4: Hover on disabled element
        results.push(await this._testHoverDisabled(page));

        // 7.5: Tooltip position
        if (tooltipElements.customTooltips.length > 0) {
            results.push(await this._testTooltipPosition(page, tooltipElements.customTooltips[0]));
        } else {
            results.push(createTestResult('hover_tooltip', '7.5', 'Tooltip position', {
                status: 'skipped', details: 'Không có custom tooltips để test position',
            }));
        }

        return results;
    }

    /**
     * Discover elements with tooltips
     */
    async _discoverTooltips(page) {
        return page.evaluate(() => {
            const customTooltips = [];
            const titleElements = [];

            // Custom tooltip triggers (Bootstrap, Tippy, custom data attributes)
            const tooltipSelectors = [
                '[data-bs-toggle="tooltip"]',
                '[data-toggle="tooltip"]',
                '[data-tooltip]',
                '[data-tippy-content]',
                '[aria-describedby]',
                '[data-tip]',
            ];

            for (const sel of tooltipSelectors) {
                document.querySelectorAll(sel).forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    customTooltips.push({
                        selector: el.id ? `#${el.id}` : sel,
                        text: el.textContent.trim().substring(0, 40),
                        tooltipText: el.getAttribute('title') || el.getAttribute('data-tooltip') ||
                            el.getAttribute('data-tippy-content') || el.getAttribute('data-bs-original-title') ||
                            el.getAttribute('data-tip') || '',
                        type: sel,
                    });
                });
            }

            // Elements with title attribute (native tooltips)
            document.querySelectorAll('[title]').forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0) return;
                titleElements.push({
                    tag: el.tagName.toLowerCase(),
                    title: el.getAttribute('title').substring(0, 60),
                    selector: el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}[title="${el.getAttribute('title').substring(0, 30)}"]`,
                });
            });

            return {
                customTooltips: customTooltips.slice(0, 5),
                titleElements: titleElements.slice(0, 10),
            };
        });
    }

    /**
     * 7.1: Hover show tooltip
     */
    async _testHoverShowTooltip(page, element) {
        const test = createTestResult('hover_tooltip', '7.1', `Hover tooltip: "${element.text}"`);
        return runSafe(test, async (t) => {
            const el = await page.$(element.selector).catch(() => null);
            if (!el) {
                t.status = 'skipped';
                t.details = 'Element không tìm thấy';
                return;
            }

            // Record DOM before hover
            const beforeTooltips = await page.evaluate(() => {
                return document.querySelectorAll('.tooltip, .tippy-box, [role="tooltip"], .tooltip-inner, [class*="tooltip"]').length;
            });

            // Hover
            await el.hover();
            await page.waitForTimeout(600);

            // Check for tooltip appearance
            const afterHover = await page.evaluate(() => {
                const tooltipEls = document.querySelectorAll('.tooltip, .tippy-box, [role="tooltip"], .tooltip-inner, [class*="tooltip"]:not([data-bs-toggle])');
                const visible = [];
                tooltipEls.forEach(tip => {
                    const style = getComputedStyle(tip);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                        visible.push({
                            text: tip.textContent.trim().substring(0, 80),
                            tag: tip.tagName,
                            classes: tip.className.toString().substring(0, 60),
                        });
                    }
                });
                return { count: tooltipEls.length, visible };
            });

            if (afterHover.visible.length > 0) {
                t.status = 'passed';
                t.details = `Tooltip xuất hiện: "${afterHover.visible[0].text}" ✓`;
                t.screenshot = await takeScreenshot(page);
            } else if (afterHover.count > beforeTooltips) {
                t.status = 'passed';
                t.details = 'Tooltip element tạo ra khi hover (có thể bị ẩn bởi animation)';
            } else if (element.tooltipText) {
                t.status = 'warning';
                t.details = `Có tooltip text="${element.tooltipText}" nhưng không detect được tooltip element sau hover`;
            } else {
                t.status = 'warning';
                t.details = 'Hover không tạo ra tooltip element rõ ràng';
            }
        });
    }

    /**
     * 7.2: Hover leave hide tooltip
     */
    async _testHoverLeaveHide(page, element) {
        const test = createTestResult('hover_tooltip', '7.2', `Hover leave hide: "${element.text}"`);
        return runSafe(test, async (t) => {
            const el = await page.$(element.selector).catch(() => null);
            if (!el) {
                t.status = 'skipped';
                t.details = 'Element không tìm thấy';
                return;
            }

            // Hover to show
            await el.hover();
            await page.waitForTimeout(500);

            const tooltipsBefore = await page.evaluate(() => {
                const tips = document.querySelectorAll('.tooltip, .tippy-box, [role="tooltip"], .tooltip-inner');
                let visibleCount = 0;
                tips.forEach(tip => {
                    const s = getComputedStyle(tip);
                    if (s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0') visibleCount++;
                });
                return visibleCount;
            });

            // Move mouse away
            await page.mouse.move(0, 0);
            await page.waitForTimeout(600);

            const tooltipsAfter = await page.evaluate(() => {
                const tips = document.querySelectorAll('.tooltip, .tippy-box, [role="tooltip"], .tooltip-inner');
                let visibleCount = 0;
                tips.forEach(tip => {
                    const s = getComputedStyle(tip);
                    if (s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0') visibleCount++;
                });
                return visibleCount;
            });

            if (tooltipsBefore > 0 && tooltipsAfter === 0) {
                t.status = 'passed';
                t.details = 'Tooltip biến mất khi mouse leave ✓';
            } else if (tooltipsBefore === 0) {
                t.status = 'skipped';
                t.details = 'Tooltip không hiển thị khi hover — không thể test hide';
            } else if (tooltipsAfter > 0) {
                t.status = 'warning';
                t.details = `Tooltip vẫn hiển thị sau mouse leave (${tooltipsAfter} visible). Có thể bị sticky.`;
            } else {
                t.status = 'passed';
                t.details = 'Hover leave xử lý đúng';
            }
        });
    }

    /**
     * 7.3: Title attribute check — elements should have title for accessibility
     */
    async _testTitleAttributes(page) {
        const test = createTestResult('hover_tooltip', '7.3', 'Title/tooltip attribute audit');
        return runSafe(test, async (t) => {
            const audit = await page.evaluate(() => {
                const results = {
                    iconsWithoutTitle: 0,
                    abbrWithoutTitle: 0,
                    imagesWithTitle: 0,
                    linksWithTitle: 0,
                    totalWithTitle: 0,
                    issues: [],
                };

                // Icons without title/aria-label
                document.querySelectorAll('i, svg, [class*="icon"]').forEach(icon => {
                    const rect = icon.getBoundingClientRect();
                    if (rect.width === 0) return;
                    const hasLabel = icon.getAttribute('title') || icon.getAttribute('aria-label') ||
                        icon.closest('[title]') || icon.closest('[aria-label]');
                    if (!hasLabel && !icon.closest('button') && !icon.closest('a')) {
                        results.iconsWithoutTitle++;
                    }
                });

                // <abbr> without title
                document.querySelectorAll('abbr:not([title])').forEach(() => {
                    results.abbrWithoutTitle++;
                });

                // Count elements with title
                document.querySelectorAll('[title]').forEach(() => results.totalWithTitle++);
                document.querySelectorAll('img[title]').forEach(() => results.imagesWithTitle++);
                document.querySelectorAll('a[title]').forEach(() => results.linksWithTitle++);

                if (results.iconsWithoutTitle > 3) {
                    results.issues.push(`${results.iconsWithoutTitle} icons thiếu title/aria-label`);
                }
                if (results.abbrWithoutTitle > 0) {
                    results.issues.push(`${results.abbrWithoutTitle} <abbr> thiếu title`);
                }

                return results;
            });

            if (audit.issues.length > 0) {
                t.status = 'warning';
                t.details = `${audit.totalWithTitle} elements có title. Issues: ${audit.issues.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${audit.totalWithTitle} elements có title attribute. ${audit.imagesWithTitle} images, ${audit.linksWithTitle} links ✓`;
            }
        });
    }

    /**
     * 7.4: Hover on disabled element — should not crash, cursor should be correct
     */
    async _testHoverDisabled(page) {
        const test = createTestResult('hover_tooltip', '7.4', 'Hover on disabled element');
        return runSafe(test, async (t) => {
            const disabledElements = await page.evaluate(() => {
                const results = [];
                document.querySelectorAll('[disabled], [aria-disabled="true"], .disabled').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0) return;
                    results.push({
                        tag: el.tagName.toLowerCase(),
                        text: el.textContent.trim().substring(0, 30),
                        selector: el.id ? `#${el.id}` : null,
                        cursor: getComputedStyle(el).cursor,
                    });
                });
                return results.slice(0, 5);
            });

            if (disabledElements.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy disabled elements trên trang';
                return;
            }

            const results = [];
            for (const disEl of disabledElements) {
                if (!disEl.selector) continue;
                try {
                    const el = await page.$(disEl.selector);
                    if (!el) continue;

                    await el.hover();
                    await page.waitForTimeout(300);

                    // Page should still be OK
                    const pageOk = await page.evaluate(() => !!document.body).catch(() => false);
                    const cursorOk = disEl.cursor === 'not-allowed' || disEl.cursor === 'default';

                    results.push(`${disEl.tag} "${disEl.text}": ${pageOk ? '✓ no crash' : '✗ crash'}, cursor: ${disEl.cursor} ${cursorOk ? '✓' : '⚠'}`);
                } catch {
                    results.push(`${disEl.tag} "${disEl.text}": ✗ hover error`);
                }
            }

            const crashCount = results.filter(r => r.includes('crash') && r.includes('✗')).length;
            t.status = crashCount > 0 ? 'failed' : results.some(r => r.includes('⚠')) ? 'warning' : 'passed';
            t.details = `Disabled elements: ${results.join('; ')}`;
        });
    }

    /**
     * 7.5: Tooltip position — should not overflow viewport
     */
    async _testTooltipPosition(page, element) {
        const test = createTestResult('hover_tooltip', '7.5', `Tooltip position: "${element.text}"`);
        return runSafe(test, async (t) => {
            const el = await page.$(element.selector).catch(() => null);
            if (!el) {
                t.status = 'skipped';
                t.details = 'Element không tìm thấy';
                return;
            }

            // Hover to show tooltip
            await el.hover();
            await page.waitForTimeout(600);

            const positionCheck = await page.evaluate(() => {
                const tooltips = document.querySelectorAll('.tooltip, .tippy-box, [role="tooltip"], .tooltip-inner');
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const issues = [];

                tooltips.forEach(tip => {
                    const style = getComputedStyle(tip);
                    if (style.display === 'none' || style.visibility === 'hidden') return;

                    const rect = tip.getBoundingClientRect();
                    if (rect.width === 0) return;

                    if (rect.right > vw) issues.push(`Tràn phải: ${Math.round(rect.right - vw)}px`);
                    if (rect.left < 0) issues.push(`Tràn trái: ${Math.round(Math.abs(rect.left))}px`);
                    if (rect.bottom > vh) issues.push(`Tràn dưới: ${Math.round(rect.bottom - vh)}px`);
                    if (rect.top < 0) issues.push(`Tràn trên: ${Math.round(Math.abs(rect.top))}px`);
                });

                return { found: tooltips.length > 0, issues };
            });

            // Move mouse away
            await page.mouse.move(0, 0);
            await page.waitForTimeout(300);

            if (!positionCheck.found) {
                t.status = 'skipped';
                t.details = 'Tooltip không hiển thị — không thể check position';
            } else if (positionCheck.issues.length > 0) {
                t.status = 'failed';
                t.details = `Tooltip bị tràn viewport: ${positionCheck.issues.join(', ')}`;
            } else {
                t.status = 'passed';
                t.details = 'Tooltip nằm hoàn toàn trong viewport ✓';
            }

            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = HoverTooltipTests;
