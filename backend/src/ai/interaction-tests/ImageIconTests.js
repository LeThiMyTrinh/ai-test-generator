/**
 * Group 4: Image & Icon (4 cases)
 * 4.1 Image load đúng (naturalWidth > 0, complete = true)
 * 4.2 Không bị vỡ hình (broken image detection)
 * 4.3 Không bị stretch (aspect ratio check)
 * 4.4 Alt text tồn tại (SEO / accessibility)
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class ImageIconTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testImageLoad(page));
        results.push(await this._testBrokenImages(page));
        results.push(await this._testImageNotStretched(page));
        results.push(await this._testAltText(page));

        return results;
    }

    /**
     * 4.1: Image load đúng
     */
    async _testImageLoad(page) {
        const test = createTestResult('imageIcon', '4.1', 'Image load đúng');
        return runSafe(test, async (t) => {
            await page.waitForTimeout(300);

            const imageCheck = await page.evaluate(() => {
                const images = document.querySelectorAll('img');
                let total = 0, loaded = 0, pending = 0, failed = 0;

                images.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0 && !img.src) return;
                    total++;

                    if (img.complete) {
                        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                            loaded++;
                        } else {
                            failed++;
                        }
                    } else {
                        pending++;
                    }
                });

                return { total, loaded, pending, failed };
            });

            if (imageCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không có images trên trang';
                return;
            }

            if (imageCheck.failed > 0) {
                t.status = 'failed';
                t.details = `${imageCheck.failed}/${imageCheck.total} images không load được. Loaded: ${imageCheck.loaded}, Pending: ${imageCheck.pending}`;
            } else if (imageCheck.pending > 0) {
                t.status = 'warning';
                t.details = `${imageCheck.loaded}/${imageCheck.total} images loaded, ${imageCheck.pending} đang loading`;
            } else {
                t.status = 'passed';
                t.details = `${imageCheck.loaded}/${imageCheck.total} images load thành công ✓`;
            }
        });
    }

    /**
     * 4.2: Không bị vỡ hình (broken image detection)
     */
    async _testBrokenImages(page) {
        const test = createTestResult('imageIcon', '4.2', 'Không bị vỡ hình');
        return runSafe(test, async (t) => {
            await page.waitForTimeout(300);

            const brokenCheck = await page.evaluate(() => {
                const images = document.querySelectorAll('img');
                const broken = [];
                let total = 0;

                images.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0 && !img.src) return;
                    total++;

                    const isBroken = img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0);
                    if (isBroken && img.src) {
                        broken.push({
                            src: img.src.substring(0, 80),
                            alt: img.alt || '(no alt)',
                        });
                    }
                });

                return { total, broken: broken.slice(0, 10) };
            });

            if (brokenCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không có images trên trang';
                return;
            }

            if (brokenCheck.broken.length > 0) {
                t.status = 'failed';
                t.details = `${brokenCheck.broken.length}/${brokenCheck.total} images bị vỡ: ${brokenCheck.broken.slice(0, 3).map(i => `"${i.alt}" (${i.src.substring(0, 40)})`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${brokenCheck.total} images, không có hình bị vỡ ✓`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 4.3: Không bị stretch (aspect ratio check)
     */
    async _testImageNotStretched(page) {
        const test = createTestResult('imageIcon', '4.3', 'Không bị stretch');
        return runSafe(test, async (t) => {
            const stretchCheck = await page.evaluate(() => {
                const images = document.querySelectorAll('img');
                const stretched = [];
                let total = 0;

                images.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return;
                    total++;

                    const naturalRatio = img.naturalWidth / img.naturalHeight;
                    const displayedRatio = rect.width / rect.height;
                    const ratioDiff = Math.abs(naturalRatio - displayedRatio) / naturalRatio;

                    // Check object-fit — if set, stretching is intentionally handled
                    const style = getComputedStyle(img);
                    const objectFit = style.objectFit;
                    const isHandled = objectFit === 'cover' || objectFit === 'contain' || objectFit === 'scale-down';

                    // More than 10% ratio difference = stretched
                    if (ratioDiff > 0.1 && !isHandled) {
                        stretched.push({
                            src: img.src.substring(0, 60),
                            alt: (img.alt || '').substring(0, 30),
                            natural: `${img.naturalWidth}x${img.naturalHeight}`,
                            displayed: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                            ratioDiff: Math.round(ratioDiff * 100),
                        });
                    }
                });

                return { total, stretched: stretched.slice(0, 5) };
            });

            if (stretchCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không có images loaded trên trang';
                return;
            }

            if (stretchCheck.stretched.length > 0) {
                t.status = 'warning';
                t.details = `${stretchCheck.stretched.length}/${stretchCheck.total} images bị stretch: ${stretchCheck.stretched.slice(0, 3).map(s => `"${s.alt}" natural=${s.natural} displayed=${s.displayed} (${s.ratioDiff}% sai lệch)`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${stretchCheck.total} images — tỉ lệ hiển thị đúng, không bị stretch ✓`;
            }
        });
    }

    /**
     * 4.4: Alt text tồn tại (SEO / accessibility)
     */
    async _testAltText(page) {
        const test = createTestResult('imageIcon', '4.4', 'Alt text tồn tại');
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

            if (altCheck.missingAlt.length > 0) {
                t.status = 'failed';
                t.details = `${altCheck.missingAlt.length}/${altCheck.total} images THIẾU alt attribute: ${altCheck.missingAlt.slice(0, 3).map(i => i.src).join(', ')}`;
            } else if (altCheck.emptyAlt.length > 3) {
                t.status = 'warning';
                t.details = `${altCheck.emptyAlt.length} images có alt="" (nên xác nhận là decorative). Tất cả images có alt attribute.`;
            } else {
                t.status = 'passed';
                t.details = `${altCheck.total} images đều có alt text ✓`;
            }
        });
    }
}

module.exports = ImageIconTests;
