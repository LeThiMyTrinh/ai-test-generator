/**
 * ActionHandler - xử lý từng loại action trong test step
 * Hỗ trợ comma-separated fallback selectors và configurable timeout per step
 */
class ActionHandler {
    constructor(page) {
        this.page = page;
    }

    /**
     * Resolve a selector that may contain comma-separated fallbacks.
     * Tries each selector in order, returns the first one that finds a visible element.
     */
    async resolveLocator(selectorStr, timeout = 15000) {
        const selectors = selectorStr.split(',').map(s => s.trim()).filter(Boolean);
        const quickTimeout = Math.min(3000, timeout);

        for (const sel of selectors) {
            try {
                const loc = this.page.locator(sel);
                const count = await loc.count();
                if (count === 1) {
                    await loc.waitFor({ state: 'visible', timeout: quickTimeout });
                    return loc;
                } else if (count > 1) {
                    const first = loc.first();
                    try {
                        await first.waitFor({ state: 'visible', timeout: quickTimeout });
                        return first;
                    } catch { /* try next selector */ }
                }
            } catch {
                // Selector not found or invalid, try next
            }
        }

        // Fallback: use the first selector with full timeout
        const fallback = this.page.locator(selectors[0]).first();
        await fallback.waitFor({ state: 'visible', timeout });
        return fallback;
    }

    /**
     * Execute a step action with configurable timeout
     * @param {Object} step - Step definition
     * @param {number} timeout - Timeout in ms (from TestRunner action timeouts)
     */
    async execute(step, timeout = 15000) {
        const { action, selector, value, url, expected, expected_text, expected_url, milliseconds } = step;

        switch (action) {
            case 'navigate':
                await this.page.goto(url || value, { waitUntil: 'domcontentloaded', timeout });
                break;

            case 'click': {
                const loc = await this.resolveLocator(selector, timeout);
                await loc.click({ timeout });
                break;
            }

            case 'fill': {
                const loc = await this.resolveLocator(selector, timeout);
                await loc.fill(value || '');
                break;
            }

            case 'select': {
                const loc = await this.resolveLocator(selector, timeout);
                await loc.selectOption(value || '');
                break;
            }

            case 'hover': {
                const loc = await this.resolveLocator(selector, timeout);
                await loc.hover({ timeout });
                break;
            }

            case 'assert_text': {
                const expectedText = expected_text || expected || value;
                const loc = await this.resolveLocator(selector, timeout);
                const actualText = await loc.innerText();
                if (!actualText.includes(expectedText)) {
                    throw new Error(`Assertion failed: expected text "${expectedText}" but got "${actualText.substring(0, 200)}"`);
                }
                break;
            }

            case 'assert_visible': {
                const loc = await this.resolveLocator(selector, timeout);
                const isVisible = await loc.isVisible();
                if (!isVisible) {
                    throw new Error(`Assertion failed: element "${selector}" is not visible`);
                }
                break;
            }

            case 'assert_url': {
                const expectedUrl = expected_url || expected || value;
                await this.page.waitForURL(expectedUrl, { timeout });
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
                // screenshot sẽ được xử lý bởi EvidenceManager
                break;

            default:
                throw new Error(`Unknown action type: "${action}"`);
        }
    }
}

module.exports = ActionHandler;
