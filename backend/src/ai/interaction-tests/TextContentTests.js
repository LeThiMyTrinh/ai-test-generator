/**
 * Group 3: Text & Content (4 cases)
 * 3.1 Không sai chính tả (empty text nodes, suspicious patterns)
 * 3.2 Không bị tràn chữ (text overflow detection)
 * 3.3 Text đúng language (html lang, meta charset)
 * 3.4 Không bị hardcode tiếng Anh / tiếng Việt (mixed language)
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class TextContentTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testSpellingIssues(page));
        results.push(await this._testTextOverflow(page));
        results.push(await this._testLanguageCorrect(page));
        results.push(await this._testNoHardcodedLanguage(page));

        return results;
    }

    /**
     * 3.1: Không sai chính tả — check empty text, lorem ipsum, placeholder text
     */
    async _testSpellingIssues(page) {
        const test = createTestResult('textContent', '3.1', 'Kiểm tra nội dung text');
        return runSafe(test, async (t) => {
            const textCheck = await page.evaluate(() => {
                const issues = [];
                const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, td, th, label, span, a, button');
                let total = 0;

                // Patterns that indicate placeholder/dummy text
                const suspiciousPatterns = [
                    /lorem ipsum/i,
                    /dolor sit amet/i,
                    /placeholder/i,
                    /todo:/i,
                    /fixme:/i,
                    /xxx+/i,
                    /test text/i,
                    /sample text/i,
                    /your text here/i,
                    /insert.*here/i,
                    /undefined/,
                    /null/,
                    /\[object Object\]/,
                    /NaN/,
                ];

                textElements.forEach(el => {
                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return;
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;

                    const text = el.textContent.trim();
                    if (text.length < 2) return;
                    total++;

                    // Check for suspicious patterns
                    for (const pattern of suspiciousPatterns) {
                        if (pattern.test(text)) {
                            issues.push({
                                tag: el.tagName.toLowerCase(),
                                text: text.substring(0, 50),
                                issue: `Matched: ${pattern.source}`,
                            });
                            break;
                        }
                    }
                });

                return { total, issues: issues.slice(0, 8) };
            });

            if (textCheck.issues.length > 0) {
                t.status = 'warning';
                t.details = `${textCheck.issues.length} nội dung nghi ngờ: ${textCheck.issues.slice(0, 3).map(i => `${i.tag} "${i.text}" (${i.issue})`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${textCheck.total} text elements kiểm tra — không phát hiện nội dung bất thường ✓`;
            }
        });
    }

    /**
     * 3.2: Không bị tràn chữ
     */
    async _testTextOverflow(page) {
        const test = createTestResult('textContent', '3.2', 'Không bị tràn chữ');
        return runSafe(test, async (t) => {
            const overflowCheck = await page.evaluate(() => {
                const overflows = [];
                const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, li, td, th, div, label, button');

                elements.forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    const style = getComputedStyle(el);
                    if (style.display === 'none') return;

                    const isHandled = style.overflow === 'hidden' || style.overflowX === 'hidden' ||
                        style.textOverflow === 'ellipsis' || style.whiteSpace === 'nowrap';

                    // Text actually overflows container
                    if (el.scrollWidth > el.clientWidth + 3 && !isHandled) {
                        const text = el.textContent.trim();
                        if (text.length > 10) {
                            overflows.push({
                                tag: el.tagName.toLowerCase(),
                                text: text.substring(0, 40),
                                scrollWidth: el.scrollWidth,
                                clientWidth: el.clientWidth,
                            });
                        }
                    }
                });

                return overflows.slice(0, 5);
            });

            if (overflowCheck.length > 3) {
                t.status = 'failed';
                t.details = `${overflowCheck.length} elements bị tràn chữ: ${overflowCheck.slice(0, 3).map(o => `${o.tag} "${o.text}"`).join('; ')}`;
            } else if (overflowCheck.length > 0) {
                t.status = 'warning';
                t.details = `${overflowCheck.length} elements có thể bị tràn chữ: ${overflowCheck.map(o => `${o.tag} "${o.text}"`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = 'Không phát hiện text bị tràn ✓';
            }
        });
    }

    /**
     * 3.3: Text đúng language — check html lang, meta charset
     */
    async _testLanguageCorrect(page) {
        const test = createTestResult('textContent', '3.3', 'Text đúng language');
        return runSafe(test, async (t) => {
            const langCheck = await page.evaluate(() => {
                const htmlLang = document.documentElement.getAttribute('lang');
                const metaCharset = document.querySelector('meta[charset]');
                const metaContentType = document.querySelector('meta[http-equiv="Content-Type"]');
                const title = document.title;

                // Check content-language meta
                const contentLang = document.querySelector('meta[http-equiv="content-language"]');

                return {
                    htmlLang: htmlLang || null,
                    charset: metaCharset ? metaCharset.getAttribute('charset') : (metaContentType ? metaContentType.getAttribute('content') : null),
                    hasTitle: title && title.trim().length > 0,
                    title: (title || '').substring(0, 60),
                    contentLang: contentLang ? contentLang.getAttribute('content') : null,
                };
            });

            const issues = [];

            if (!langCheck.htmlLang) {
                issues.push('thiếu html lang attribute');
            }
            if (!langCheck.charset) {
                issues.push('thiếu meta charset');
            } else if (!langCheck.charset.toLowerCase().includes('utf')) {
                issues.push(`charset="${langCheck.charset}" (nên là UTF-8)`);
            }
            if (!langCheck.hasTitle) {
                issues.push('thiếu hoặc rỗng <title>');
            }

            if (issues.length > 0) {
                t.status = issues.includes('thiếu html lang attribute') ? 'failed' : 'warning';
                t.details = `Issues: ${issues.join('; ')}. lang="${langCheck.htmlLang}", charset="${langCheck.charset}"`;
            } else {
                t.status = 'passed';
                t.details = `lang="${langCheck.htmlLang}", charset="${langCheck.charset}", title="${langCheck.title}" ✓`;
            }
        });
    }

    /**
     * 3.4: Không bị hardcode tiếng Anh / tiếng Việt (mixed language detection)
     */
    async _testNoHardcodedLanguage(page) {
        const test = createTestResult('textContent', '3.4', 'Không hardcode ngôn ngữ');
        return runSafe(test, async (t) => {
            const langMixCheck = await page.evaluate(() => {
                const htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();

                // Vietnamese detection patterns
                const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
                // Common English-only words that shouldn't appear in Vietnamese UI
                const englishUIWords = /\b(click here|submit|cancel|loading|error|success|warning|close|open|save|delete|edit|search|login|logout|sign in|sign out|sign up|register|forgot password|reset)\b/i;
                // Common Vietnamese-only words that shouldn't appear in English UI
                const vietnameseUIWords = /\b(đăng nhập|đăng ký|đăng xuất|tìm kiếm|lưu|xóa|sửa|hủy|đóng|mở|tải|gửi|xác nhận|quay lại)\b/i;

                const textElements = document.querySelectorAll('button, a, label, h1, h2, h3, p, span, li, th, td');
                let viCount = 0, enCount = 0;
                const mixedElements = [];

                textElements.forEach(el => {
                    const style = getComputedStyle(el);
                    if (style.display === 'none') return;
                    const text = el.textContent.trim();
                    if (text.length < 3 || text.length > 200) return;

                    const hasVi = vietnamesePattern.test(text) || vietnameseUIWords.test(text);
                    const hasEnUI = englishUIWords.test(text);

                    if (hasVi) viCount++;
                    if (hasEnUI) enCount++;

                    // Mixed: element has both Vietnamese chars AND English UI words
                    if (hasVi && hasEnUI) {
                        mixedElements.push({
                            tag: el.tagName.toLowerCase(),
                            text: text.substring(0, 60),
                        });
                    }
                });

                // Determine primary language
                const isVietnameseSite = viCount > enCount;
                const isEnglishSite = enCount > viCount;

                // Look for hardcoded elements in wrong language
                const hardcoded = [];
                if (isVietnameseSite || htmlLang.startsWith('vi')) {
                    // Vietnamese site with English UI elements
                    textElements.forEach(el => {
                        const style = getComputedStyle(el);
                        if (style.display === 'none') return;
                        const text = el.textContent.trim();
                        if (text.length < 3 || text.length > 100) return;
                        if (englishUIWords.test(text) && !vietnamesePattern.test(text)) {
                            hardcoded.push({ tag: el.tagName.toLowerCase(), text: text.substring(0, 50), lang: 'EN' });
                        }
                    });
                } else if (isEnglishSite || htmlLang.startsWith('en')) {
                    // English site with Vietnamese UI elements
                    textElements.forEach(el => {
                        const style = getComputedStyle(el);
                        if (style.display === 'none') return;
                        const text = el.textContent.trim();
                        if (text.length < 3 || text.length > 100) return;
                        if (vietnameseUIWords.test(text) && !englishUIWords.test(text)) {
                            hardcoded.push({ tag: el.tagName.toLowerCase(), text: text.substring(0, 50), lang: 'VI' });
                        }
                    });
                }

                return {
                    htmlLang,
                    viCount,
                    enCount,
                    mixedElements: mixedElements.slice(0, 5),
                    hardcoded: hardcoded.slice(0, 5),
                    primaryLang: isVietnameseSite ? 'vi' : isEnglishSite ? 'en' : 'unknown',
                };
            });

            if (langMixCheck.hardcoded.length > 3) {
                t.status = 'warning';
                t.details = `Phát hiện ${langMixCheck.hardcoded.length} elements hardcode ngôn ngữ khác (site ${langMixCheck.primaryLang}): ${langMixCheck.hardcoded.slice(0, 3).map(h => `${h.tag} "${h.text}" [${h.lang}]`).join('; ')}`;
            } else if (langMixCheck.mixedElements.length > 2) {
                t.status = 'warning';
                t.details = `${langMixCheck.mixedElements.length} elements trộn ngôn ngữ: ${langMixCheck.mixedElements.slice(0, 3).map(m => `${m.tag} "${m.text}"`).join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `Ngôn ngữ chính: ${langMixCheck.primaryLang} (vi:${langMixCheck.viCount}, en:${langMixCheck.enCount}). Không phát hiện hardcode ngôn ngữ ✓`;
            }
        });
    }
}

module.exports = TextContentTests;
