const path = require('path');

/**
 * ActionHandler - xử lý từng loại action trong test step
 * Hỗ trợ comma-separated fallback selectors từ NL parser
 */
class ActionHandler {
    constructor(page) {
        this.page = page;
    }

    /**
     * Resolve a selector that may contain comma-separated fallbacks.
     * Tries each selector in order, returns the first one that finds a visible element.
     * Falls back to .first() if a single selector matches multiple elements.
     */
    async resolveLocator(selectorStr, timeout = 15000) {
        const selectors = selectorStr.split(',').map(s => s.trim()).filter(Boolean);

        for (const sel of selectors) {
            try {
                const loc = this.page.locator(sel);
                const count = await loc.count();
                if (count === 1) {
                    await loc.waitFor({ state: 'visible', timeout: 3000 });
                    return loc;
                } else if (count > 1) {
                    const first = loc.first();
                    try {
                        await first.waitFor({ state: 'visible', timeout: 3000 });
                        return first;
                    } catch { /* try next selector */ }
                }
            } catch {
                // Selector not found or invalid, try next
            }
        }

        // Fallback: use the first selector with .first()
        const fallback = this.page.locator(selectors[0]).first();
        await fallback.waitFor({ state: 'visible', timeout });
        return fallback;
    }

    async execute(step) {
        const { action, selector, value, url, expected, expected_text, expected_url, milliseconds } = step;

        switch (action) {
            case 'navigate':
                await this.page.goto(url || value, { waitUntil: 'domcontentloaded', timeout: 30000 });
                break;

            case 'click': {
                const loc = await this.resolveLocator(selector);
                await loc.click();
                break;
            }

            case 'fill': {
                const loc = await this.resolveLocator(selector);
                await loc.fill(value || '');
                break;
            }

            case 'select': {
                const loc = await this.resolveLocator(selector);
                await loc.selectOption(value || '');
                break;
            }

            case 'hover': {
                const loc = await this.resolveLocator(selector);
                await loc.hover();
                break;
            }

            case 'assert_text': {
                const expectedText = expected_text || expected || value;
                const loc = await this.resolveLocator(selector);
                const actualText = await loc.innerText();
                if (!actualText.includes(expectedText)) {
                    throw new Error(`Assertion failed: expected text "${expectedText}" but got "${actualText}"`);
                }
                break;
            }

            case 'assert_visible': {
                const loc = await this.resolveLocator(selector);
                const isVisible = await loc.isVisible();
                if (!isVisible) {
                    throw new Error(`Assertion failed: element "${selector}" is not visible`);
                }
                break;
            }

            case 'assert_url': {
                const expectedUrl = expected_url || expected || value;
                await this.page.waitForURL(expectedUrl, { timeout: 15000 });
                const currentUrl = this.page.url();
                if (!currentUrl.includes(expectedUrl.replace(/https?:\/\//, ''))) {
                    throw new Error(`Assertion failed: expected URL to contain "${expectedUrl}" but current is "${currentUrl}"`);
                }
                break;
            }

            case 'wait': {
                const ms = parseInt(milliseconds || value || 1000);
                await this.page.waitForTimeout(ms);
                break;
            }

            case 'screenshot':
                // screenshot sẽ được xử lý bởi EvidenceManager, không cần làm gì
                break;

            default:
                throw new Error(`Unknown action type: "${action}"`);
        }
    }
}

module.exports = ActionHandler;
