/**
 * Group 14: Hover & Tooltip (3 cases) — theo PDF
 * TC_TOOLTIP_01 Tooltip hiển thị khi hover icon
 * TC_TOOLTIP_02 Tooltip nội dung đúng
 * TC_TOOLTIP_03 Tooltip ẩn khi rời chuột
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class HoverTooltipTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testTooltipShow(page));
        results.push(await this._testTooltipContent(page));
        results.push(await this._testTooltipHide(page));

        return results.filter(Boolean);
    }

    /** Tìm element có tooltip */
    async _findTooltipElement(page) {
        return page.evaluate(() => {
            const selectors = [
                '[data-bs-toggle="tooltip"]', '[data-tooltip]', '[data-tippy-content]',
                '[aria-describedby]', '[title]', '[data-original-title]',
            ];
            for (const sel of selectors) {
                const els = document.querySelectorAll(sel);
                for (const el of els) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        const tooltip = el.getAttribute('title') || el.getAttribute('data-tooltip') ||
                            el.getAttribute('data-tippy-content') || el.getAttribute('data-original-title') || el.getAttribute('data-bs-title') || '';
                        return {
                            found: true,
                            selector: el.id ? `#${el.id}` : sel,
                            tooltipText: tooltip,
                            text: el.textContent.trim().substring(0, 30),
                        };
                    }
                }
            }
            return { found: false };
        });
    }

    /** TC_TOOLTIP_01: Tooltip hiển thị khi hover */
    async _testTooltipShow(page) {
        const test = createTestResult('hoverTooltip', 'TC_TOOLTIP_01', 'Tooltip hiển thị');
        return runSafe(test, async (t) => {
            const el = await this._findTooltipElement(page);

            if (!el.found) {
                t.status = 'warning';
                t.details = 'Không tìm thấy element có tooltip trên trang';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            // Hover vào element
            await page.hover(el.selector, { timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(500);

            // Kiểm tra tooltip hiển thị
            const tooltipVisible = await page.evaluate(() => {
                const tooltipSelectors = [
                    '.tooltip.show', '.tooltip.in', '[role="tooltip"]',
                    '.tippy-box', '.tippy-content', '.popover.show',
                    '.bs-tooltip-top', '.bs-tooltip-bottom',
                ];
                for (const sel of tooltipSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.offsetHeight > 0) {
                        return { visible: true, text: el.textContent.trim().substring(0, 100) };
                    }
                }
                return { visible: false };
            });

            if (tooltipVisible.visible) {
                t.status = 'passed';
                t.details = `Tooltip hiển thị khi hover: "${tooltipVisible.text}"`;
            } else if (el.tooltipText) {
                t.status = 'passed';
                t.details = `Element có title/tooltip attribute: "${el.tooltipText}" (browser native tooltip)`;
            } else {
                t.status = 'warning';
                t.details = 'Hover vào element nhưng không phát hiện tooltip hiển thị';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_TOOLTIP_02: Tooltip nội dung đúng */
    async _testTooltipContent(page) {
        const test = createTestResult('hoverTooltip', 'TC_TOOLTIP_02', 'Tooltip nội dung');
        return runSafe(test, async (t) => {
            const el = await this._findTooltipElement(page);

            if (!el.found) {
                t.status = 'warning';
                t.details = 'Không tìm thấy element có tooltip';
                return;
            }

            await page.hover(el.selector, { timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(500);

            const tooltipContent = await page.evaluate(() => {
                const tooltipSelectors = ['.tooltip.show', '.tooltip.in', '[role="tooltip"]', '.tippy-box', '.tippy-content'];
                for (const sel of tooltipSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.offsetHeight > 0) {
                        return { found: true, text: el.textContent.trim() };
                    }
                }
                return { found: false };
            });

            if (tooltipContent.found && tooltipContent.text.length > 0) {
                t.status = 'passed';
                t.details = `Tooltip có nội dung: "${tooltipContent.text}"`;
            } else if (el.tooltipText && el.tooltipText.length > 0) {
                t.status = 'passed';
                t.details = `Tooltip text (title attribute): "${el.tooltipText}"`;
            } else {
                t.status = 'warning';
                t.details = 'Tooltip không có nội dung text rõ ràng';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_TOOLTIP_03: Tooltip ẩn khi rời chuột */
    async _testTooltipHide(page) {
        const test = createTestResult('hoverTooltip', 'TC_TOOLTIP_03', 'Tooltip ẩn');
        return runSafe(test, async (t) => {
            const el = await this._findTooltipElement(page);

            if (!el.found) {
                t.status = 'warning';
                t.details = 'Không tìm thấy element có tooltip';
                return;
            }

            // Hover vào
            await page.hover(el.selector, { timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(500);

            // Rời chuột (di chuột ra vùng khác)
            await page.mouse.move(0, 0);
            await page.waitForTimeout(500);

            // Kiểm tra tooltip đã ẩn
            const tooltipHidden = await page.evaluate(() => {
                const tooltipSelectors = ['.tooltip.show', '.tooltip.in', '[role="tooltip"]', '.tippy-box'];
                for (const sel of tooltipSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.offsetHeight > 0) return { hidden: false };
                }
                return { hidden: true };
            });

            if (tooltipHidden.hidden) {
                t.status = 'passed';
                t.details = 'Tooltip ẩn thành công khi rời chuột';
            } else {
                t.status = 'failed';
                t.details = 'Tooltip vẫn hiển thị sau khi rời chuột';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = HoverTooltipTests;
