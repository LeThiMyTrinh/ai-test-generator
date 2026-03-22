/**
 * SelectorHealer — Self-healing locator system
 *
 * When a selector fails, tries alternative strategies to find the element:
 * 1. Original selector (CSS/XPath)
 * 2. Text-based: getByText, getByRole with name
 * 3. Attribute-based: data-testid, aria-label, name, placeholder
 * 4. Structural: tag + class partial match, nth-child
 *
 * Logs healed selectors so users can update test cases.
 */
class SelectorHealer {
    constructor() {
        /** @type {Array<{original: string, healed: string, strategy: string, testCaseId: string, stepId: number, timestamp: string}>} */
        this.healingLog = [];
    }

    /**
     * Try to find element using alternative strategies when original selector fails.
     * @param {import('playwright').Page} page
     * @param {string} originalSelector - The failed selector
     * @param {Object} context - { testCaseId, stepId, action, description }
     * @param {number} timeout - Max ms to try
     * @returns {{ locator: import('playwright').Locator, healed: boolean, strategy: string, newSelector: string } | null}
     */
    async heal(page, originalSelector, context = {}, timeout = 10000) {
        const strategies = this._generateStrategies(page, originalSelector);
        const quickTimeout = Math.min(2000, timeout / strategies.length);

        for (const { name, locatorFn, selector } of strategies) {
            try {
                const loc = locatorFn();
                const count = await loc.count();
                if (count === 0) continue;

                const target = count === 1 ? loc : loc.first();
                await target.waitFor({ state: 'visible', timeout: quickTimeout });

                // Found a working alternative!
                this.healingLog.push({
                    original: originalSelector,
                    healed: selector,
                    strategy: name,
                    testCaseId: context.testCaseId || '',
                    stepId: context.stepId || 0,
                    action: context.action || '',
                    timestamp: new Date().toISOString(),
                });

                console.log(`[SelectorHealer] Healed: "${originalSelector}" → "${selector}" (${name})`);
                return { locator: target, healed: true, strategy: name, newSelector: selector };
            } catch {
                // Strategy didn't work, try next
            }
        }

        return null; // All strategies failed
    }

    /**
     * Generate alternative selector strategies from the original selector
     */
    _generateStrategies(page, original) {
        const strategies = [];

        // Strategy 1: Try as XPath if looks like CSS, or CSS if looks like XPath
        if (original.startsWith('//') || original.startsWith('(//')) {
            // Original is XPath — try extracting text/attributes from it
            const textMatch = original.match(/text\(\)\s*[=,]\s*["'](.+?)["']/);
            if (textMatch) {
                const text = textMatch[1];
                strategies.push({
                    name: 'xpath-text-to-getByText',
                    locatorFn: () => page.getByText(text, { exact: false }),
                    selector: `getByText("${text}")`,
                });
            }
            const attrMatch = original.match(/@([\w-]+)\s*=\s*["'](.+?)["']/);
            if (attrMatch) {
                const [, attr, val] = attrMatch;
                strategies.push({
                    name: `xpath-attr-to-css-[${attr}]`,
                    locatorFn: () => page.locator(`[${attr}="${val}"]`),
                    selector: `[${attr}="${val}"]`,
                });
            }
        } else {
            // Original is CSS — extract info from it
            // Try by ID
            const idMatch = original.match(/#([\w-]+)/);
            if (idMatch) {
                strategies.push({
                    name: 'id-attribute',
                    locatorFn: () => page.locator(`[id="${idMatch[1]}"]`),
                    selector: `[id="${idMatch[1]}"]`,
                });
            }

            // Try text content from selector description
            // e.g. button:has-text("Login") → getByRole('button', {name: 'Login'})
            const hasTextMatch = original.match(/:has-text\(["'](.+?)["']\)/);
            if (hasTextMatch) {
                const text = hasTextMatch[1];
                const tagMatch = original.match(/^(\w+)/);
                const tag = tagMatch ? tagMatch[1] : '';
                if (['button', 'a', 'link'].includes(tag)) {
                    strategies.push({
                        name: 'has-text-to-getByRole',
                        locatorFn: () => page.getByRole(tag === 'a' ? 'link' : tag, { name: text }),
                        selector: `getByRole("${tag === 'a' ? 'link' : tag}", {name: "${text}"})`,
                    });
                }
                strategies.push({
                    name: 'has-text-to-getByText',
                    locatorFn: () => page.getByText(text, { exact: false }),
                    selector: `getByText("${text}")`,
                });
            }

            // Try by data-testid from class/id hints
            const classMatch = original.match(/\.([\w-]+)/);
            if (classMatch) {
                strategies.push({
                    name: 'class-to-data-testid',
                    locatorFn: () => page.locator(`[data-testid="${classMatch[1]}"]`),
                    selector: `[data-testid="${classMatch[1]}"]`,
                });
            }
        }

        // Strategy: Try common attribute patterns from original
        // Extract any quoted text from the selector
        const quotedTexts = [...original.matchAll(/["']([^"']{2,50})["']/g)].map(m => m[1]);
        for (const text of quotedTexts) {
            // By placeholder
            strategies.push({
                name: 'text-to-placeholder',
                locatorFn: () => page.getByPlaceholder(text, { exact: false }),
                selector: `getByPlaceholder("${text}")`,
            });
            // By label
            strategies.push({
                name: 'text-to-label',
                locatorFn: () => page.getByLabel(text, { exact: false }),
                selector: `getByLabel("${text}")`,
            });
            // By aria-label
            strategies.push({
                name: 'text-to-aria-label',
                locatorFn: () => page.locator(`[aria-label="${text}"]`),
                selector: `[aria-label="${text}"]`,
            });
            // By title
            strategies.push({
                name: 'text-to-title',
                locatorFn: () => page.getByTitle(text, { exact: false }),
                selector: `getByTitle("${text}")`,
            });
            // By name attribute
            strategies.push({
                name: 'text-to-name-attr',
                locatorFn: () => page.locator(`[name="${text}"]`),
                selector: `[name="${text}"]`,
            });
        }

        // Strategy: Try generic role-based locators for common element types
        const tagHints = original.match(/^(button|input|a|select|textarea|img|h[1-6])/i);
        if (tagHints) {
            const tag = tagHints[1].toLowerCase();
            const roleMap = {
                button: 'button', a: 'link', input: 'textbox',
                select: 'combobox', textarea: 'textbox', img: 'img',
                h1: 'heading', h2: 'heading', h3: 'heading',
            };
            if (roleMap[tag]) {
                strategies.push({
                    name: 'tag-to-role',
                    locatorFn: () => page.getByRole(roleMap[tag]).first(),
                    selector: `getByRole("${roleMap[tag]}")`,
                });
            }
        }

        return strategies;
    }

    /**
     * Get healing suggestions for a test case
     * @returns {Array} Healing events for review
     */
    getHealingLog() {
        return [...this.healingLog];
    }

    /**
     * Get summary of healed selectors grouped by test case
     */
    getSummary() {
        const byTC = {};
        for (const entry of this.healingLog) {
            const key = entry.testCaseId || 'unknown';
            if (!byTC[key]) byTC[key] = [];
            byTC[key].push(entry);
        }
        return {
            totalHealed: this.healingLog.length,
            byTestCase: byTC,
        };
    }

    /**
     * Clear healing log
     */
    clear() {
        this.healingLog = [];
    }
}

module.exports = SelectorHealer;
