/**
 * ActionHandler - xử lý từng loại action trong test step
 *
 * UI Actions (10): navigate, click, fill, select, hover,
 *   assert_text, assert_visible, assert_url, wait, screenshot
 *
 * API Actions (6): api_request, assert_status, assert_body,
 *   assert_header, assert_response_time, store_variable
 *
 * Extended UI Actions (6): drag_drop, upload_file, keyboard,
 *   double_click, right_click, scroll_to
 *
 * Hỗ trợ comma-separated fallback selectors và configurable timeout per step
 */
class ActionHandler {
    /**
     * @param {import('playwright').Page} page
     * @param {Object} options
     * @param {import('./SelectorHealer')} [options.selectorHealer] - Self-healing locator instance
     * @param {Object} [options.stepContext] - { testCaseId, stepId } for healing log
     */
    constructor(page, options = {}) {
        this.page = page;
        this.selectorHealer = options.selectorHealer || null;
        this.stepContext = options.stepContext || {};
        /**
         * Variable store — lưu giá trị giữa các steps
         * Dùng {{variable}} trong value/selector/expected để reference
         */
        this.variables = {};
        /**
         * Last API response — dùng cho assert_status, assert_body, assert_header, assert_response_time
         */
        this._lastApiResponse = null;
        this._lastApiDuration = 0;
        /** Healed selectors in this session */
        this.healedSelectors = [];
    }

    /**
     * Resolve {{variable}} placeholders trong string
     */
    resolveVariables(str) {
        if (!str || typeof str !== 'string') return str;
        return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            return this.variables[key] !== undefined ? this.variables[key] : `{{${key}}}`;
        });
    }

    /**
     * Resolve a selector that may contain comma-separated fallbacks.
     * Tries each selector in order, returns the first one that finds a visible element.
     */
    async resolveLocator(selectorStr, timeout = 15000) {
        const resolved = this.resolveVariables(selectorStr);
        const selectors = resolved.split(',').map(s => s.trim()).filter(Boolean);
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

        // Self-healing: try alternative strategies before final fallback
        if (this.selectorHealer) {
            for (const sel of selectors) {
                const healed = await this.selectorHealer.heal(
                    this.page, sel, this.stepContext, Math.min(timeout, 8000)
                );
                if (healed) {
                    this.healedSelectors.push({
                        original: sel,
                        healed: healed.newSelector,
                        strategy: healed.strategy,
                    });
                    return healed.locator;
                }
            }
        }

        // Final fallback: use the first selector with full timeout (will throw if not found)
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
        const { action } = step;
        // Resolve variables in all step fields
        const selector = this.resolveVariables(step.selector);
        const value = this.resolveVariables(step.value);
        const url = this.resolveVariables(step.url);
        const expected = this.resolveVariables(step.expected);
        const expected_text = this.resolveVariables(step.expected_text);
        const expected_url = this.resolveVariables(step.expected_url);
        const milliseconds = step.milliseconds;

        switch (action) {
            // ===== ORIGINAL UI ACTIONS =====

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

            // ===== EXTENDED UI ACTIONS =====

            case 'double_click': {
                const loc = await this.resolveLocator(selector, timeout);
                await loc.dblclick({ timeout });
                break;
            }

            case 'right_click': {
                const loc = await this.resolveLocator(selector, timeout);
                await loc.click({ button: 'right', timeout });
                break;
            }

            case 'keyboard': {
                // value = key combination, e.g. "Control+a", "Enter", "Tab"
                await this.page.keyboard.press(value || 'Enter');
                break;
            }

            case 'scroll_to': {
                if (selector) {
                    const loc = await this.resolveLocator(selector, timeout);
                    await loc.scrollIntoViewIfNeeded({ timeout });
                } else {
                    // Scroll by pixels: value = "0, 500" (x, y)
                    const [x, y] = (value || '0,500').split(',').map(Number);
                    await this.page.mouse.wheel(x || 0, y || 500);
                }
                break;
            }

            case 'drag_drop': {
                // selector = source, value = target selector
                const source = await this.resolveLocator(selector, timeout);
                const target = await this.resolveLocator(value, timeout);
                await source.dragTo(target);
                break;
            }

            case 'upload_file': {
                // selector = input[type=file], value = file path
                const loc = await this.resolveLocator(selector, timeout);
                await loc.setInputFiles(value || '');
                break;
            }

            // ===== API ACTIONS =====

            case 'api_request': {
                await this._executeApiRequest(step, timeout);
                break;
            }

            case 'assert_status': {
                if (!this._lastApiResponse) {
                    throw new Error('assert_status: chưa có API response. Cần gọi api_request trước.');
                }
                const expectedStatus = parseInt(expected || value);
                const actualStatus = this._lastApiResponse.status;
                if (actualStatus !== expectedStatus) {
                    throw new Error(`API Assertion failed: expected status ${expectedStatus} but got ${actualStatus}`);
                }
                break;
            }

            case 'assert_body': {
                if (!this._lastApiResponse) {
                    throw new Error('assert_body: chưa có API response. Cần gọi api_request trước.');
                }
                this._assertBody(selector, expected || value);
                break;
            }

            case 'assert_header': {
                if (!this._lastApiResponse) {
                    throw new Error('assert_header: chưa có API response. Cần gọi api_request trước.');
                }
                const headerName = (selector || '').toLowerCase();
                const headerValue = this._lastApiResponse.headers[headerName];
                const expectedValue = expected || value;
                if (!headerValue) {
                    throw new Error(`API Assertion failed: header "${headerName}" not found in response`);
                }
                if (expectedValue && !headerValue.includes(expectedValue)) {
                    throw new Error(`API Assertion failed: header "${headerName}" = "${headerValue}", expected to contain "${expectedValue}"`);
                }
                break;
            }

            case 'assert_response_time': {
                if (!this._lastApiResponse) {
                    throw new Error('assert_response_time: chưa có API response. Cần gọi api_request trước.');
                }
                const maxMs = parseInt(expected || value || 5000);
                if (this._lastApiDuration > maxMs) {
                    throw new Error(`API Assertion failed: response time ${this._lastApiDuration}ms exceeded limit ${maxMs}ms`);
                }
                break;
            }

            case 'store_variable': {
                // selector = JSONPath or source (e.g. "$.data.token" or "response.status")
                // value = variable name to store as
                this._storeVariable(selector, value);
                break;
            }

            default:
                throw new Error(`Unknown action type: "${action}"`);
        }
    }

    // ===== API EXECUTION =====

    /**
     * Execute API request via native fetch
     * Step fields:
     *   - value: URL (required)
     *   - selector: HTTP method (GET/POST/PUT/DELETE/PATCH, default: GET)
     *   - expected: Request body (JSON string, optional)
     *   - step.headers: Custom headers (JSON string or object, optional)
     */
    async _executeApiRequest(step, timeout) {
        const apiUrl = this.resolveVariables(step.value || step.url || '');
        const method = (this.resolveVariables(step.selector) || 'GET').toUpperCase();
        const bodyStr = this.resolveVariables(step.expected || '');

        if (!apiUrl) {
            throw new Error('api_request: cần cung cấp URL trong trường value');
        }

        // Parse headers
        let headers = { 'Content-Type': 'application/json' };
        if (step.headers) {
            try {
                const customHeaders = typeof step.headers === 'string'
                    ? JSON.parse(this.resolveVariables(step.headers))
                    : step.headers;
                headers = { ...headers, ...customHeaders };
            } catch (e) {
                // Keep default headers
            }
        }

        // Parse body
        let body = undefined;
        if (bodyStr && ['POST', 'PUT', 'PATCH'].includes(method)) {
            body = bodyStr;
        }

        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(apiUrl, {
                method,
                headers,
                body,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            this._lastApiDuration = Date.now() - startTime;

            // Parse response
            let responseBody;
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                try {
                    responseBody = await response.json();
                } catch {
                    responseBody = await response.text();
                }
            } else {
                responseBody = await response.text();
            }

            // Store response for subsequent assert steps
            this._lastApiResponse = {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseBody,
                duration: this._lastApiDuration,
                url: apiUrl,
                method
            };

            // Auto-store common variables
            this.variables['_api_status'] = String(response.status);
            this.variables['_api_duration'] = String(this._lastApiDuration);
            this.variables['_api_url'] = apiUrl;

            console.log(`[API] ${method} ${apiUrl} → ${response.status} (${this._lastApiDuration}ms)`);

        } catch (err) {
            this._lastApiDuration = Date.now() - startTime;
            if (err.name === 'AbortError') {
                throw new Error(`API request timeout: ${method} ${apiUrl} (>${timeout}ms)`);
            }
            throw new Error(`API request failed: ${method} ${apiUrl} — ${err.message}`);
        }
    }

    // ===== JSONPATH ASSERTION =====

    /**
     * Assert response body using simple JSONPath
     * selector = JSONPath (e.g. "$.data.id", "$.length", "$.items[0].name")
     * expected = expected value or operator expression
     */
    _assertBody(jsonPath, expected) {
        const body = this._lastApiResponse.body;

        // Extract value using simple JSONPath
        const actual = this._jsonPathGet(body, jsonPath);

        if (actual === undefined) {
            throw new Error(`API Assertion failed: path "${jsonPath}" not found in response body`);
        }

        // Parse expected — support operators
        if (!expected || expected === 'not_empty') {
            if (actual === null || actual === undefined || actual === '' || (Array.isArray(actual) && actual.length === 0)) {
                throw new Error(`API Assertion failed: "${jsonPath}" is empty`);
            }
            return;
        }

        if (expected === 'exists') return; // Already confirmed it exists above

        // Numeric comparisons: "> 0", "< 100", ">= 5"
        const compareMatch = expected.match(/^([<>]=?)\s*(\d+(?:\.\d+)?)$/);
        if (compareMatch) {
            const op = compareMatch[1];
            const num = parseFloat(compareMatch[2]);
            const actualNum = typeof actual === 'number' ? actual : parseFloat(actual);
            let pass = false;
            switch (op) {
                case '>': pass = actualNum > num; break;
                case '<': pass = actualNum < num; break;
                case '>=': pass = actualNum >= num; break;
                case '<=': pass = actualNum <= num; break;
            }
            if (!pass) {
                throw new Error(`API Assertion failed: "${jsonPath}" = ${actual}, expected ${expected}`);
            }
            return;
        }

        // String/value equality
        const actualStr = typeof actual === 'object' ? JSON.stringify(actual) : String(actual);
        if (actualStr !== expected && !actualStr.includes(expected)) {
            throw new Error(`API Assertion failed: "${jsonPath}" = "${actualStr}", expected "${expected}"`);
        }
    }

    /**
     * Simple JSONPath getter — supports:
     *   $.field, $.nested.field, $.array[0], $.array[0].field, $.length
     */
    _jsonPathGet(obj, pathStr) {
        if (!pathStr || !obj) return undefined;

        // Remove leading $. or $
        let path = pathStr.replace(/^\$\.?/, '');
        if (!path) return obj;

        const parts = path.match(/(\w+|\[\d+\])/g);
        if (!parts) return undefined;

        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined) return undefined;

            const indexMatch = part.match(/^\[(\d+)\]$/);
            if (indexMatch) {
                current = Array.isArray(current) ? current[parseInt(indexMatch[1])] : undefined;
            } else if (part === 'length' && (Array.isArray(current) || typeof current === 'string')) {
                current = current.length;
            } else {
                current = typeof current === 'object' ? current[part] : undefined;
            }
        }

        return current;
    }

    // ===== VARIABLE STORE =====

    /**
     * Store a value from API response or page into a variable
     * source = JSONPath (e.g. "$.data.token") or special:
     *   - "response.status" → HTTP status
     *   - "response.body" → entire body
     *   - element selector → extract text from DOM element
     * varName = variable name to store as
     */
    _storeVariable(source, varName) {
        if (!varName) {
            throw new Error('store_variable: cần cung cấp tên biến trong trường value');
        }

        // From API response
        if (this._lastApiResponse) {
            if (source === 'response.status') {
                this.variables[varName] = String(this._lastApiResponse.status);
                return;
            }
            if (source === 'response.body') {
                this.variables[varName] = typeof this._lastApiResponse.body === 'object'
                    ? JSON.stringify(this._lastApiResponse.body)
                    : String(this._lastApiResponse.body);
                return;
            }
            if (source && source.startsWith('$')) {
                const val = this._jsonPathGet(this._lastApiResponse.body, source);
                this.variables[varName] = val !== undefined ? String(val) : '';
                console.log(`[Variable] ${varName} = "${this.variables[varName]}" (from ${source})`);
                return;
            }
        }

        // Fallback: treat source as a value to store directly
        this.variables[varName] = this.resolveVariables(source) || '';
    }
}

module.exports = ActionHandler;
