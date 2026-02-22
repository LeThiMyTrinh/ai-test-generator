const { chromium } = require('playwright');

/**
 * URLCrawler — Dùng Playwright để truy cập URL và phân tích DOM
 * Trả về: screenshot (base64), danh sách interactive elements, page metadata
 */
class URLCrawler {
    /**
     * Crawl a URL and extract UI analysis data
     * @param {string} url
     * @returns {{ screenshot: Buffer, elements: Array, metadata: object }}
     */
    async analyze(url) {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(1000); // settle animations

            // Capture full screenshot
            const screenshot = await page.screenshot({ fullPage: true, type: 'png' });

            // Extract interactive elements from DOM
            const elements = await page.evaluate(() => {
                const results = [];
                const interactiveSel = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick], [type="submit"]';

                document.querySelectorAll(interactiveSel).forEach((el, idx) => {
                    if (idx > 80) return; // cap
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    if (rect.top > 5000) return; // skip off-screen

                    const tag = el.tagName.toLowerCase();
                    const type = el.getAttribute('type') || '';
                    const id = el.id || '';
                    const name = el.getAttribute('name') || '';
                    const placeholder = el.getAttribute('placeholder') || '';
                    const ariaLabel = el.getAttribute('aria-label') || '';
                    const role = el.getAttribute('role') || '';
                    const text = (el.innerText || el.value || '').trim().substring(0, 100);
                    const classes = el.className ? String(el.className).substring(0, 100) : '';
                    const href = el.getAttribute('href') || '';
                    const dataTestId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || '';

                    // Build best selector
                    let selector = '';
                    if (dataTestId) selector = `[data-testid="${dataTestId}"]`;
                    else if (id) selector = `#${id}`;
                    else if (name && tag === 'input') selector = `input[name="${name}"]`;
                    else if (name && tag === 'select') selector = `select[name="${name}"]`;
                    else if (name) selector = `[name="${name}"]`;
                    else if (placeholder) selector = `[placeholder="${placeholder}"]`;
                    else if (role && text) selector = `[role="${role}"]:has-text("${text.substring(0, 40)}")`;
                    else if (tag === 'button' && text) selector = `button:has-text("${text.substring(0, 40)}")`;
                    else if (tag === 'a' && text) selector = `a:has-text("${text.substring(0, 40)}")`;

                    results.push({
                        tag, type, id, name, placeholder, ariaLabel, role, text,
                        classes, href, dataTestId, selector,
                        position: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
                    });
                });
                return results;
            });

            // Page metadata
            const metadata = await page.evaluate(() => ({
                title: document.title,
                url: window.location.href,
                forms: document.querySelectorAll('form').length,
                inputs: document.querySelectorAll('input').length,
                buttons: document.querySelectorAll('button, [type="submit"], [role="button"]').length,
                links: document.querySelectorAll('a[href]').length,
                headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.innerText.trim().substring(0, 80))
            }));

            await browser.close();

            return {
                screenshot,
                elements,
                metadata
            };

        } catch (err) {
            await browser.close();
            throw new Error(`Không thể truy cập URL "${url}": ${err.message}`);
        }
    }
}

module.exports = URLCrawler;
