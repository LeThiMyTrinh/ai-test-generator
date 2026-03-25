/**
 * Group 9: Broken Resources Tests (5 cases)
 * 9.1 Broken images (naturalWidth === 0)
 * 9.2 Missing alt text
 * 9.3 Empty links (no text/aria-label)
 * 9.4 Missing favicon
 * 9.5 Broken background images
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class BrokenResourceTests {
    /**
     * Run all broken resource tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testBrokenImages(page));
        results.push(await this._testMissingAltText(page));
        results.push(await this._testEmptyLinks(page));
        results.push(await this._testMissingFavicon(page));
        results.push(await this._testBrokenBackgroundImages(page));

        return results;
    }

    /**
     * 9.1: Broken images — check naturalWidth === 0
     */
    async _testBrokenImages(page) {
        const test = createTestResult('broken_resources', '9.1', 'Broken images');
        return runSafe(test, async (t) => {
            // Wait for images to attempt loading
            await page.waitForTimeout(1000);

            const imageCheck = await page.evaluate(() => {
                const images = document.querySelectorAll('img');
                const broken = [];
                let total = 0;

                images.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    // Skip invisible images
                    if (rect.width === 0 && rect.height === 0 && !img.src) return;
                    total++;

                    // Check if image failed to load
                    const isBroken = img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0);
                    if (isBroken && img.src) {
                        broken.push({
                            src: img.src.substring(0, 80),
                            alt: img.alt || '(no alt)',
                            width: img.width,
                            height: img.height,
                        });
                    }
                });

                return { total, broken: broken.slice(0, 10) };
            });

            if (imageCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không có images trên trang';
                return;
            }

            if (imageCheck.broken.length > 0) {
                t.status = 'failed';
                t.details = `${imageCheck.broken.length}/${imageCheck.total} images bị broken: ${imageCheck.broken.slice(0, 3).map(i => `"${i.alt}" (${i.src.substring(0, 40)})`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${imageCheck.total} images, không có broken ✓`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 9.2: Missing alt text — all images should have alt attribute
     */
    async _testMissingAltText(page) {
        const test = createTestResult('broken_resources', '9.2', 'Missing alt text');
        return runSafe(test, async (t) => {
            const altCheck = await page.evaluate(() => {
                const images = document.querySelectorAll('img');
                const missingAlt = [];
                const emptyAlt = [];
                let total = 0;

                images.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;
                    total++;

                    const alt = img.getAttribute('alt');
                    const role = img.getAttribute('role');

                    // Decorative images with role="presentation" or alt="" are OK
                    if (role === 'presentation' || role === 'none') return;

                    if (alt === null) {
                        missingAlt.push({
                            src: (img.src || '').substring(0, 60),
                            classes: img.className.toString().substring(0, 40),
                        });
                    } else if (alt.trim() === '' && !role) {
                        emptyAlt.push({
                            src: (img.src || '').substring(0, 60),
                        });
                    }
                });

                return { total, missingAlt: missingAlt.slice(0, 10), emptyAlt: emptyAlt.slice(0, 5) };
            });

            if (altCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không có images trên trang';
                return;
            }

            const issues = [];
            if (altCheck.missingAlt.length > 0) {
                issues.push(`${altCheck.missingAlt.length} images thiếu alt attribute`);
            }
            if (altCheck.emptyAlt.length > 3) {
                issues.push(`${altCheck.emptyAlt.length} images có alt="" (nên đảm bảo là decorative)`);
            }

            if (altCheck.missingAlt.length > 0) {
                t.status = 'failed';
                t.details = `${altCheck.total} images. ${issues.join('; ')}. Missing: ${altCheck.missingAlt.slice(0, 3).map(i => i.src).join(', ')}`;
            } else if (issues.length > 0) {
                t.status = 'warning';
                t.details = `${altCheck.total} images. ${issues.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${altCheck.total} images đều có alt text ✓`;
            }
        });
    }

    /**
     * 9.3: Empty links — links should have text or aria-label
     */
    async _testEmptyLinks(page) {
        const test = createTestResult('broken_resources', '9.3', 'Empty links');
        return runSafe(test, async (t) => {
            const linkCheck = await page.evaluate(() => {
                const links = document.querySelectorAll('a');
                const empty = [];
                let total = 0;

                links.forEach(a => {
                    const rect = a.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;
                    total++;

                    const text = a.textContent.trim();
                    const ariaLabel = a.getAttribute('aria-label');
                    const title = a.getAttribute('title');
                    const hasImage = a.querySelector('img[alt]');
                    const hasSvg = a.querySelector('svg[aria-label], svg title');
                    const hasIcon = a.querySelector('i[aria-label], span[aria-label]');

                    if (!text && !ariaLabel && !title && !hasImage && !hasSvg && !hasIcon) {
                        empty.push({
                            href: (a.getAttribute('href') || '').substring(0, 50),
                            html: a.innerHTML.substring(0, 60),
                            classes: a.className.toString().substring(0, 40),
                        });
                    }
                });

                return { total, empty: empty.slice(0, 10) };
            });

            if (linkCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không có links trên trang';
                return;
            }

            if (linkCheck.empty.length > 0) {
                t.status = 'failed';
                t.details = `${linkCheck.empty.length}/${linkCheck.total} links rỗng (không có text/aria-label): ${linkCheck.empty.slice(0, 3).map(l => `href="${l.href}" class="${l.classes}"`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${linkCheck.total} links đều có accessible text ✓`;
            }
        });
    }

    /**
     * 9.4: Missing favicon
     */
    async _testMissingFavicon(page) {
        const test = createTestResult('broken_resources', '9.4', 'Missing favicon');
        return runSafe(test, async (t) => {
            const faviconCheck = await page.evaluate(() => {
                const icons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
                const results = [];

                icons.forEach(link => {
                    results.push({
                        rel: link.getAttribute('rel'),
                        href: link.href || link.getAttribute('href') || '',
                        type: link.getAttribute('type') || '',
                        sizes: link.getAttribute('sizes') || '',
                    });
                });

                return {
                    hasAny: results.length > 0,
                    icons: results,
                };
            });

            if (!faviconCheck.hasAny) {
                t.status = 'failed';
                t.details = 'Không tìm thấy <link rel="icon"> — thiếu favicon';
                return;
            }

            // Try to verify favicon loads
            const faviconUrl = faviconCheck.icons[0].href;
            let faviconLoads = false;
            if (faviconUrl) {
                try {
                    const resp = await page.context().request.head(faviconUrl, { timeout: 5000 }).catch(() => null);
                    faviconLoads = resp && resp.status() < 400;
                } catch {
                    // Ignore errors
                }
            }

            if (faviconLoads) {
                t.status = 'passed';
                t.details = `Favicon OK: ${faviconCheck.icons.map(i => `${i.rel} (${i.sizes || i.type || 'default'})`).join(', ')} ✓`;
            } else if (faviconUrl) {
                t.status = 'warning';
                t.details = `Favicon declared nhưng URL có thể broken: ${faviconUrl.substring(0, 60)}`;
            } else {
                t.status = 'warning';
                t.details = `Favicon element tồn tại nhưng href rỗng`;
            }
        });
    }

    /**
     * 9.5: Broken background images — check CSS background-image loads
     */
    async _testBrokenBackgroundImages(page) {
        const test = createTestResult('broken_resources', '9.5', 'Broken background images');
        return runSafe(test, async (t) => {
            // Collect all background-image URLs
            const bgImages = await page.evaluate(() => {
                const results = [];
                const allElements = document.querySelectorAll('*');

                allElements.forEach(el => {
                    const style = getComputedStyle(el);
                    const bg = style.backgroundImage;
                    if (bg && bg !== 'none') {
                        // Extract URL(s) from background-image
                        const urlMatch = bg.match(/url\(["']?([^"')]+)["']?\)/g);
                        if (urlMatch) {
                            urlMatch.forEach(match => {
                                const url = match.replace(/url\(["']?/, '').replace(/["']?\)/, '');
                                if (url && !url.startsWith('data:') && !url.includes('gradient')) {
                                    results.push({
                                        url,
                                        tag: el.tagName.toLowerCase(),
                                        selector: el.id ? `#${el.id}` : el.className ? `.${el.className.toString().split(' ')[0]}` : el.tagName.toLowerCase(),
                                    });
                                }
                            });
                        }
                    }
                });

                // Dedupe by URL
                const seen = new Set();
                return results.filter(r => {
                    if (seen.has(r.url)) return false;
                    seen.add(r.url);
                    return true;
                }).slice(0, 15);
            });

            if (bgImages.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy CSS background-images';
                return;
            }

            const broken = [];
            let checked = 0;

            for (const bg of bgImages.slice(0, 10)) {
                try {
                    const resp = await page.context().request.head(bg.url, { timeout: 5000 }).catch(() => null);
                    const respGet = resp || await page.context().request.get(bg.url, { timeout: 5000 }).catch(() => null);
                    checked++;
                    if (respGet && respGet.status() >= 400) {
                        broken.push({ url: bg.url.substring(0, 60), status: respGet.status(), element: bg.selector });
                    }
                } catch {
                    checked++;
                }
            }

            if (broken.length > 0) {
                t.status = 'failed';
                t.details = `${broken.length}/${checked} background images broken: ${broken.slice(0, 3).map(b => `${b.element} → ${b.status}`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${checked}/${bgImages.length} background images checked, không có broken ✓`;
            }
        });
    }
}

module.exports = BrokenResourceTests;
