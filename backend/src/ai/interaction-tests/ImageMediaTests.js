/**
 * Group 5: Image / Media (4 cases) — theo PDF
 * TC_IMG_01 Image load → hiển thị
 * TC_IMG_02 Image size → không bị vỡ
 * TC_IMG_03 Image alt text → có alt text
 * TC_IMG_04 Lazy load image → scroll trang image load đúng
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class ImageMediaTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testImageLoad(page));
        results.push(await this._testImageSize(page));
        results.push(await this._testImageAltText(page));
        results.push(await this._testLazyLoadImage(page));

        return results.filter(Boolean);
    }

    /** TC_IMG_01: Image load → hiển thị */
    async _testImageLoad(page) {
        const test = createTestResult('imageMedia', 'TC_IMG_01', 'Image load');
        return runSafe(test, async (t) => {
            const imgInfo = await page.evaluate(() => {
                const imgs = document.querySelectorAll('img');
                let total = 0;
                let loaded = 0;
                let broken = 0;
                imgs.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;
                    total++;
                    if (img.complete && img.naturalWidth > 0) loaded++;
                    else if (img.complete && img.naturalWidth === 0) broken++;
                });
                return { total, loaded, broken };
            });

            if (imgInfo.total === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy image trên trang';
            } else if (imgInfo.broken === 0) {
                t.status = 'passed';
                t.details = `${imgInfo.loaded}/${imgInfo.total} images load thành công`;
            } else {
                t.status = 'failed';
                t.details = `${imgInfo.broken}/${imgInfo.total} images bị lỗi load`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_IMG_02: Image size → không bị vỡ layout */
    async _testImageSize(page) {
        const test = createTestResult('imageMedia', 'TC_IMG_02', 'Image size');
        return runSafe(test, async (t) => {
            const sizeInfo = await page.evaluate(() => {
                const imgs = document.querySelectorAll('img');
                const viewportWidth = window.innerWidth;
                let total = 0;
                let overflow = 0;
                let distorted = [];

                imgs.forEach(img => {
                    if (!img.complete || img.naturalWidth === 0) return;
                    const rect = img.getBoundingClientRect();
                    if (rect.width === 0) return;
                    total++;

                    // Kiểm tra tràn viewport
                    if (rect.right > viewportWidth + 5) {
                        overflow++;
                    }

                    // Kiểm tra tỷ lệ bị méo quá nhiều (>20%)
                    const naturalRatio = img.naturalWidth / img.naturalHeight;
                    const displayRatio = rect.width / rect.height;
                    const ratioDiff = Math.abs(naturalRatio - displayRatio) / naturalRatio;
                    if (ratioDiff > 0.2) {
                        distorted.push({
                            src: img.src.substring(img.src.lastIndexOf('/') + 1).substring(0, 30),
                            natural: `${img.naturalWidth}x${img.naturalHeight}`,
                            display: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                        });
                    }
                });

                return { total, overflow, distorted };
            });

            if (sizeInfo.total === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy image để kiểm tra';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            const issues = [];
            if (sizeInfo.overflow > 0) issues.push(`${sizeInfo.overflow} ảnh tràn viewport`);
            if (sizeInfo.distorted.length > 0) issues.push(`${sizeInfo.distorted.length} ảnh bị méo`);

            if (issues.length === 0) {
                t.status = 'passed';
                t.details = `${sizeInfo.total} images hiển thị đúng kích thước, không bị vỡ`;
            } else {
                t.status = 'failed';
                t.details = `Vấn đề: ${issues.join(', ')}`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_IMG_03: Image alt text → có alt text */
    async _testImageAltText(page) {
        const test = createTestResult('imageMedia', 'TC_IMG_03', 'Image alt text');
        return runSafe(test, async (t) => {
            const altInfo = await page.evaluate(() => {
                const imgs = document.querySelectorAll('img');
                let total = 0;
                let withAlt = 0;
                let missingAlt = [];

                imgs.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;
                    total++;
                    const alt = img.getAttribute('alt');
                    if (alt !== null && alt.trim().length > 0) {
                        withAlt++;
                    } else {
                        missingAlt.push(img.src.substring(img.src.lastIndexOf('/') + 1).substring(0, 30));
                    }
                });

                return { total, withAlt, missingAlt };
            });

            if (altInfo.total === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy image trên trang';
            } else if (altInfo.withAlt === altInfo.total) {
                t.status = 'passed';
                t.details = `Tất cả ${altInfo.total} images có alt text`;
            } else {
                t.status = 'failed';
                t.details = `${altInfo.total - altInfo.withAlt}/${altInfo.total} images thiếu alt text: ${altInfo.missingAlt.slice(0, 3).join(', ')}`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_IMG_04: Lazy load image → scroll trang image load đúng */
    async _testLazyLoadImage(page) {
        const test = createTestResult('imageMedia', 'TC_IMG_04', 'Lazy load image');
        return runSafe(test, async (t) => {
            // Kiểm tra có lazy load images không
            const lazyInfo = await page.evaluate(() => {
                const lazyImgs = document.querySelectorAll('img[loading="lazy"], img[data-src], img[data-lazy], img.lazyload, img.lazy');
                return { count: lazyImgs.length };
            });

            if (lazyInfo.count === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy lazy load images';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            // Scroll xuống cuối trang
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(1500);

            // Kiểm tra images đã load
            const afterScroll = await page.evaluate(() => {
                const imgs = document.querySelectorAll('img');
                let loaded = 0;
                let total = 0;
                imgs.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) return;
                    total++;
                    if (img.complete && img.naturalWidth > 0) loaded++;
                });
                return { total, loaded };
            });

            // Scroll về đầu
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(300);

            if (afterScroll.loaded === afterScroll.total) {
                t.status = 'passed';
                t.details = `Lazy load hoạt động: ${afterScroll.loaded}/${afterScroll.total} images load đúng sau scroll`;
            } else {
                t.status = 'warning';
                t.details = `Sau scroll: ${afterScroll.loaded}/${afterScroll.total} images loaded`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = ImageMediaTests;
