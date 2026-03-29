/**
 * Shared helpers for interaction test modules
 */

/**
 * Create a standardized test result object
 */
function createTestResult(group, caseId, name, overrides = {}) {
    return {
        group,
        caseId,
        name,
        type: group,
        status: 'pending',
        details: '',
        screenshot: null,
        duration_ms: 0,
        ...overrides,
    };
}

/**
 * Run a test safely with error handling and timing
 */
async function runSafe(testResult, fn) {
    const start = Date.now();
    try {
        await fn(testResult);
    } catch (err) {
        testResult.status = 'error';
        testResult.details = `Error: ${err.message.substring(0, 300)}`;
    }
    testResult.duration_ms = Date.now() - start;
    return testResult;
}

/**
 * Take a screenshot and encode as base64
 */
async function takeScreenshot(page) {
    try {
        const buf = await page.screenshot({ type: 'png' });
        return 'data:image/png;base64,' + buf.toString('base64');
    } catch {
        return null;
    }
}

/**
 * Navigate back to the base URL safely
 */
async function navigateBack(page, baseUrl) {
    try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(150);
    } catch {
        // ignore
    }
}

/**
 * Get sample data for a form field based on its attributes
 */
function getSampleValue(field) {
    const name = (field.name || '').toLowerCase();
    const type = (field.type || 'text').toLowerCase();
    const placeholder = (field.placeholder || '').toLowerCase();

    if (type === 'email' || name.includes('email')) return 'test@example.com';
    if (type === 'password' || name.includes('password') || name.includes('pass')) return 'TestPass123!';
    if (type === 'tel' || name.includes('phone') || name.includes('tel')) return '0901234567';
    if (type === 'url') return 'https://example.com';
    if (type === 'number' || name.includes('age') || name.includes('quantity') || name.includes('amount')) return '25';
    if (type === 'date') return '2025-01-15';
    if (name.includes('name') || name.includes('user') || name.includes('first') || name.includes('last')) return 'Test User';
    if (name.includes('address') || name.includes('street')) return '123 Test Street';
    if (name.includes('city')) return 'Ho Chi Minh City';
    if (name.includes('zip') || name.includes('postal')) return '700000';
    if (name.includes('search') || placeholder.includes('search') || placeholder.includes('tìm')) return 'test search query';
    if (name.includes('message') || name.includes('comment') || name.includes('content') || name.includes('note')) return 'This is a test message for automated testing.';
    if (type === 'text') return 'Test Input';
    if (type === 'checkbox' || type === 'radio') return null;
    if (field.tag === 'textarea') return 'This is test content for the textarea field.';
    if (field.tag === 'select') return null;
    return 'test';
}

/**
 * Get invalid sample data for boundary testing
 */
function getInvalidEmail() {
    return ['abc', '@.com', 'test@', 'test@.', '@test.com', 'test test@email.com'];
}

function getInvalidPhone() {
    return ['abcdef', '12-ab-34', 'phone!!!', '++123', '0.0.0.0'];
}

function getXSSPayloads() {
    return [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '"><script>alert(1)</script>',
        "javascript:alert('XSS')",
        '<svg onload=alert(1)>',
    ];
}

function getHTMLPayloads() {
    return [
        '<img src=x onerror=alert(1)>',
        '<iframe src="javascript:alert(1)">',
        '<div onmouseover="alert(1)">test</div>',
        '<b>bold</b><i>italic</i>',
    ];
}

function getSQLPayloads() {
    return [
        "' OR 1=1 --",
        "'; DROP TABLE users; --",
        "1' UNION SELECT * FROM users --",
        '" OR ""="',
    ];
}

/**
 * Fill a form field safely
 */
async function fillField(page, selector, value) {
    try {
        const el = await page.$(selector);
        if (!el) return false;
        await el.fill('');
        await el.fill(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if an element is visible on the page
 */
async function isElementVisible(page, selector) {
    try {
        const el = await page.$(selector);
        if (!el) return false;
        return await el.isVisible();
    } catch {
        return false;
    }
}

/**
 * Find the first text input field in a form for boundary testing
 */
async function findFirstTextField(page, formSelector) {
    return await page.evaluate((fSel) => {
        const form = document.querySelector(fSel);
        if (!form) return null;
        const input = form.querySelector('input[type="text"], input:not([type]), textarea');
        if (!input) return null;
        return {
            selector: input.id ? `#${input.id}` : (input.name ? `${fSel} [name="${input.name}"]` : `${fSel} input[type="text"]`),
            type: input.type || 'text',
            name: input.name || '',
            maxLength: input.maxLength > 0 ? input.maxLength : null,
            minLength: input.minLength > 0 ? input.minLength : null,
        };
    }, formSelector);
}

module.exports = {
    createTestResult,
    runSafe,
    takeScreenshot,
    navigateBack,
    getSampleValue,
    getInvalidEmail,
    getInvalidPhone,
    getXSSPayloads,
    getHTMLPayloads,
    getSQLPayloads,
    fillField,
    isElementVisible,
    findFirstTextField,
};
