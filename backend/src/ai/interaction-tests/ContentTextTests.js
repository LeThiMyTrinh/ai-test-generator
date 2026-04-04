/**
 * Group 6: Content / Text (3 cases) — theo PDF
 * TC_TXT_01 Text hiển thị → không lỗi chính tả
 * TC_TXT_02 Text overflow → không tràn layout
 * TC_TXT_03 Language → chuyển ngôn ngữ text đúng
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class ContentTextTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testTextDisplay(page));
        results.push(await this._testTextOverflow(page));
        results.push(await this._testLanguage(page));

        return results.filter(Boolean);
    }

    /** TC_TXT_01: Text hiển thị đúng */
    async _testTextDisplay(page) {
        const test = createTestResult('contentText', 'TC_TXT_01', 'Text hiển thị');
        return runSafe(test, async (t) => {
            const textInfo = await page.evaluate(() => {
                const body = document.body;
                const allText = body.innerText || '';
                const textLength = allText.trim().length;

                // Kiểm tra empty text nodes, broken encoding
                const hasContent = textLength > 0;
                const hasBrokenEncoding = allText.includes('�') || allText.includes('â€') || allText.includes('Ã');
                const hasEmptyHeadings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(h => !h.textContent.trim()).length;

                return { hasContent, textLength, hasBrokenEncoding, hasEmptyHeadings };
            });

            if (!textInfo.hasContent) {
                t.status = 'failed';
                t.details = 'Trang không có nội dung text';
            } else if (textInfo.hasBrokenEncoding) {
                t.status = 'failed';
                t.details = 'Phát hiện lỗi encoding text (ký tự bị vỡ)';
            } else if (textInfo.hasEmptyHeadings > 0) {
                t.status = 'warning';
                t.details = `Text hiển thị (${textInfo.textLength} ký tự), nhưng có ${textInfo.hasEmptyHeadings} heading trống`;
            } else {
                t.status = 'passed';
                t.details = `Text hiển thị đúng (${textInfo.textLength} ký tự, không lỗi encoding)`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_TXT_02: Text overflow → không tràn layout */
    async _testTextOverflow(page) {
        const test = createTestResult('contentText', 'TC_TXT_02', 'Text overflow');
        return runSafe(test, async (t) => {
            const overflowInfo = await page.evaluate(() => {
                const viewportWidth = window.innerWidth;
                const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, li, td, th, a, label');
                let overflowCount = 0;
                let checkedCount = 0;
                const overflowElements = [];

                elements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    const style = getComputedStyle(el);
                    if (rect.width === 0 || style.display === 'none' || style.visibility === 'hidden') return;
                    if (!el.textContent.trim()) return;
                    checkedCount++;

                    // Kiểm tra tràn ngang
                    if (rect.right > viewportWidth + 5) {
                        overflowCount++;
                        overflowElements.push({
                            tag: el.tagName.toLowerCase(),
                            text: el.textContent.trim().substring(0, 30),
                            overflow: Math.round(rect.right - viewportWidth),
                        });
                    }

                    // Kiểm tra text bị cắt mà không có ellipsis
                    if (el.scrollWidth > el.clientWidth + 2 && style.overflow !== 'hidden' && style.textOverflow !== 'ellipsis' && style.whiteSpace === 'nowrap') {
                        overflowCount++;
                    }
                });

                return { checkedCount, overflowCount, overflowElements: overflowElements.slice(0, 5) };
            });

            if (overflowInfo.overflowCount === 0) {
                t.status = 'passed';
                t.details = `Kiểm tra ${overflowInfo.checkedCount} elements, không có text tràn layout`;
            } else {
                t.status = 'failed';
                t.details = `${overflowInfo.overflowCount} elements bị tràn: ${overflowInfo.overflowElements.map(e => `<${e.tag}> tràn ${e.overflow}px`).join(', ')}`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_TXT_03: Language → kiểm tra ngôn ngữ */
    async _testLanguage(page) {
        const test = createTestResult('contentText', 'TC_TXT_03', 'Language');
        return runSafe(test, async (t) => {
            const langInfo = await page.evaluate(() => {
                const htmlLang = document.documentElement.lang || '';
                const metaLang = document.querySelector('meta[http-equiv="content-language"]');
                const metaLangValue = metaLang ? metaLang.content : '';

                // Tìm language switcher
                const langSwitcher = document.querySelector('[class*="lang"], [class*="language"], [id*="lang"], select[name*="lang"], .locale-switcher');
                const hasLangSwitcher = !!langSwitcher;

                // Lấy sample text
                const bodyText = document.body.innerText.substring(0, 200);

                return { htmlLang, metaLangValue, hasLangSwitcher, bodyText };
            });

            const hasLangAttr = langInfo.htmlLang.length > 0;
            const issues = [];

            if (!hasLangAttr) {
                issues.push('thiếu lang attribute trên <html>');
            }

            if (issues.length === 0) {
                t.status = 'passed';
                t.details = `Trang có lang="${langInfo.htmlLang}"${langInfo.hasLangSwitcher ? ', có language switcher' : ''}`;
            } else {
                t.status = 'warning';
                t.details = `Vấn đề: ${issues.join(', ')}${langInfo.hasLangSwitcher ? ' (có language switcher)' : ''}`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = ContentTextTests;
