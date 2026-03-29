/**
 * Group 12: Cookie Consent / Banner Tests (4 cases)
 * 12.1 Cookie banner appears
 * 12.2 Accept/Reject works
 * 12.3 Banner does not block page interaction
 * 12.4 Banner saves preference (doesn't reappear)
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class CookieConsentTests {
    /**
     * Run all cookie consent tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];

        // Discover cookie banner
        const banner = await this._discoverBanner(page);

        // 12.1: Banner appears
        results.push(await this._testBannerAppears(page, banner));

        // 12.2: Accept/Reject works
        results.push(await this._testAcceptReject(page, banner, baseUrl));

        // 12.3: Banner does not block page
        results.push(await this._testBannerNotBlocking(page, banner));

        // 12.4: Banner saves preference
        results.push(await this._testBannerPreference(page, banner, baseUrl));

        return results;
    }

    /**
     * Discover cookie consent banner
     */
    async _discoverBanner(page) {
        return page.evaluate(() => {
            const bannerSelectors = [
                '#cookie-banner', '#cookie-consent', '#cookieConsent', '#cookie-notice',
                '#gdpr-banner', '#gdpr-consent', '#cc-banner',
                '.cookie-banner', '.cookie-consent', '.cookie-notice', '.cookie-popup',
                '.gdpr-banner', '.consent-banner', '.privacy-banner',
                '[class*="cookie-consent"]', '[class*="cookie-banner"]', '[class*="cookie-notice"]',
                '[id*="cookie"]', '[id*="consent"]', '[id*="gdpr"]',
                '[aria-label*="cookie"]', '[aria-label*="consent"]',
                '[role="dialog"][class*="cookie"]', '[role="alertdialog"][class*="cookie"]',
                // Common third-party consent managers
                '#CybotCookiebotDialog', '.cc-window', '#onetrust-banner-sdk',
                '.osano-cm-window', '#usercentrics-root',
            ];

            for (const sel of bannerSelectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const style = getComputedStyle(el);
                    const isVisible = rect.width > 0 && style.display !== 'none' &&
                        style.visibility !== 'hidden' && style.opacity !== '0';

                    // Find action buttons inside
                    const buttons = {};
                    const btnSelectors = el.querySelectorAll('button, a.btn, [role="button"]');
                    btnSelectors.forEach(btn => {
                        const text = btn.textContent.trim().toLowerCase();
                        const btnSel = btn.id ? `#${btn.id}` : null;
                        if (text.includes('accept') || text.includes('chấp nhận') || text.includes('agree') ||
                            text.includes('đồng ý') || text.includes('ok') || text.includes('got it') ||
                            text.includes('allow')) {
                            buttons.accept = btnSel || `${sel} button`;
                            buttons.acceptText = btn.textContent.trim().substring(0, 30);
                        }
                        if (text.includes('reject') || text.includes('từ chối') || text.includes('decline') ||
                            text.includes('deny') || text.includes('refuse')) {
                            buttons.reject = btnSel || null;
                            buttons.rejectText = btn.textContent.trim().substring(0, 30);
                        }
                        if (text.includes('setting') || text.includes('cài đặt') || text.includes('preference') ||
                            text.includes('manage') || text.includes('customize')) {
                            buttons.settings = btnSel || null;
                        }
                    });

                    // Find privacy policy link
                    const privacyLink = el.querySelector('a[href*="privacy"], a[href*="policy"], a[href*="cookie"]');

                    return {
                        found: true,
                        isVisible,
                        selector: sel,
                        text: el.textContent.trim().substring(0, 150),
                        buttons,
                        hasPrivacyLink: !!privacyLink,
                        privacyHref: privacyLink ? privacyLink.href : null,
                        position: rect.top > window.innerHeight / 2 ? 'bottom' : 'top',
                    };
                }
            }

            return { found: false };
        });
    }

    /**
     * 12.1: Cookie banner appears
     */
    async _testBannerAppears(page, banner) {
        const test = createTestResult('cookie_consent', '12.1', 'Cookie banner appears');
        return runSafe(test, async (t) => {
            if (!banner.found) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy cookie consent banner (có thể trang không dùng cookies hoặc đã accepted trước đó)';
                return;
            }

            if (banner.isVisible) {
                const details = [];
                details.push(`Banner tìm thấy (${banner.selector}), vị trí: ${banner.position}`);
                if (banner.buttons.accept) details.push(`Accept: "${banner.buttons.acceptText}"`);
                if (banner.buttons.reject) details.push(`Reject: "${banner.buttons.rejectText}"`);
                if (banner.buttons.settings) details.push('Có settings button');
                if (banner.hasPrivacyLink) details.push('Có privacy link ✓');
                else details.push('⚠ Thiếu privacy policy link');

                t.status = banner.hasPrivacyLink ? 'passed' : 'warning';
                t.details = details.join('. ');
                t.screenshot = await takeScreenshot(page);
            } else {
                t.status = 'warning';
                t.details = `Banner element tồn tại (${banner.selector}) nhưng không visible — có thể đã accepted hoặc bị ẩn`;
            }
        });
    }

    /**
     * 12.2: Accept/Reject works
     */
    async _testAcceptReject(page, banner, baseUrl) {
        const test = createTestResult('cookie_consent', '12.2', 'Cookie accept/reject works');
        return runSafe(test, async (t) => {
            if (!banner.found || !banner.isVisible) {
                t.status = 'skipped';
                t.details = 'Banner không visible';
                return;
            }

            if (!banner.buttons.accept) {
                t.status = 'failed';
                t.details = 'Banner hiển thị nhưng không tìm thấy Accept button';
                return;
            }

            // Click accept
            try {
                await page.click(banner.buttons.accept, { timeout: 3000 });
                await page.waitForTimeout(200);

                // Check if banner disappeared
                const stillVisible = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (!el) return false;
                    const s = getComputedStyle(el);
                    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
                }, banner.selector);

                if (!stillVisible) {
                    t.status = 'passed';
                    t.details = `Accept "${banner.buttons.acceptText}" → banner đóng thành công ✓`;
                } else {
                    t.status = 'failed';
                    t.details = `Click Accept nhưng banner vẫn hiển thị`;
                }
            } catch (err) {
                t.status = 'failed';
                t.details = `Không click được Accept button: ${err.message.substring(0, 100)}`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 12.3: Banner does not block page interaction
     */
    async _testBannerNotBlocking(page, banner) {
        const test = createTestResult('cookie_consent', '12.3', 'Banner not blocking page');
        return runSafe(test, async (t) => {
            if (!banner.found) {
                t.status = 'skipped';
                t.details = 'Banner không tìm thấy';
                return;
            }

            // Re-check if banner is visible (might have been dismissed in 12.2)
            const isVisible = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return false;
                const s = getComputedStyle(el);
                return s.display !== 'none' && s.visibility !== 'hidden';
            }, banner.selector);

            if (!isVisible) {
                t.status = 'passed';
                t.details = 'Banner đã đóng — page không bị chặn';
                return;
            }

            // Check if page content behind banner is still interactable
            const blockCheck = await page.evaluate((bannerSel) => {
                const banner = document.querySelector(bannerSel);
                if (!banner) return { blocking: false };

                const bannerStyle = getComputedStyle(banner);
                const bannerRect = banner.getBoundingClientRect();

                // Check for full-page overlay that blocks clicks
                const isFullScreen = bannerRect.width >= window.innerWidth * 0.9 && bannerRect.height >= window.innerHeight * 0.9;
                const hasOverlay = !!document.querySelector('.cookie-overlay, .consent-overlay, [class*="overlay"]');

                // Check if body has pointer-events: none
                const bodyBlocked = getComputedStyle(document.body).pointerEvents === 'none';

                // Check z-index
                const zIndex = parseInt(bannerStyle.zIndex) || 0;

                return {
                    isFullScreen,
                    hasOverlay,
                    bodyBlocked,
                    zIndex,
                    position: bannerStyle.position,
                };
            }, banner.selector);

            if (blockCheck.bodyBlocked || blockCheck.isFullScreen) {
                t.status = 'failed';
                t.details = `Banner chặn toàn bộ page! ${blockCheck.bodyBlocked ? 'body pointer-events: none' : 'Full-screen overlay'}`;
            } else if (blockCheck.hasOverlay) {
                t.status = 'warning';
                t.details = 'Có overlay element — page có thể bị chặn một phần';
            } else {
                t.status = 'passed';
                t.details = `Banner (z-index: ${blockCheck.zIndex}, position: ${blockCheck.position}) không chặn page interaction ✓`;
            }
        });
    }

    /**
     * 12.4: Banner saves preference — should not reappear after accept
     */
    async _testBannerPreference(page, banner, baseUrl) {
        const test = createTestResult('cookie_consent', '12.4', 'Banner saves preference');
        return runSafe(test, async (t) => {
            if (!banner.found) {
                t.status = 'skipped';
                t.details = 'Banner không tìm thấy';
                return;
            }

            // Check cookies/localStorage for consent storage
            const storage = await page.evaluate(() => {
                const consent = {};
                // Check cookies
                const cookies = document.cookie.split(';').map(c => c.trim());
                consent.cookies = cookies.filter(c =>
                    c.toLowerCase().includes('cookie') || c.toLowerCase().includes('consent') ||
                    c.toLowerCase().includes('gdpr') || c.toLowerCase().includes('cc_')
                ).map(c => c.split('=')[0]);

                // Check localStorage
                consent.localStorage = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.toLowerCase().includes('cookie') || key.toLowerCase().includes('consent') ||
                        key.toLowerCase().includes('gdpr') || key.toLowerCase().includes('cc_')) {
                        consent.localStorage.push(key);
                    }
                }

                return consent;
            });

            const hasStoredPreference = storage.cookies.length > 0 || storage.localStorage.length > 0;

            // Reload page and check if banner reappears
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(500);

            const bannerAfterReload = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (!el) return false;
                const s = getComputedStyle(el);
                return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
            }, banner.selector);

            if (!bannerAfterReload && hasStoredPreference) {
                t.status = 'passed';
                t.details = `Preference lưu thành công. Storage: ${[...storage.cookies, ...storage.localStorage].join(', ')}. Banner không hiện lại sau reload ✓`;
            } else if (!bannerAfterReload) {
                t.status = 'passed';
                t.details = 'Banner không hiện lại sau reload (preference có thể lưu server-side)';
            } else if (hasStoredPreference) {
                t.status = 'warning';
                t.details = `Có consent storage (${[...storage.cookies, ...storage.localStorage].join(', ')}) nhưng banner vẫn hiện sau reload`;
            } else {
                t.status = 'failed';
                t.details = 'Banner hiện lại sau reload và không tìm thấy consent storage — preference không được lưu';
            }
        });
    }
}

module.exports = CookieConsentTests;
