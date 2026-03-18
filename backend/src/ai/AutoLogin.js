/**
 * AutoLogin Helper - Tự động phát hiện form login và đăng nhập
 */
class AutoLogin {
    /**
     * Attempt to auto-login on a page
     * @param {Page} page - Playwright page instance
     * @param {string} email - Login email
     * @param {string} password - Login password
     * @returns {Promise<boolean>} - true if login successful, false otherwise
     */
    async attemptLogin(page, email, password) {
        try {
            console.log('[AutoLogin] Attempting to detect login form...');

            // Wait for page to load
            await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            await page.waitForTimeout(1500);

            // Try to detect login form elements using multiple strategies
            const loginDetected = await page.evaluate(() => {
                // Strategy 1: Look for email/password input pairs
                const emailInputs = Array.from(document.querySelectorAll('input[type="email"], input[name*="email" i], input[name*="username" i], input[placeholder*="email" i], input[id*="email" i]'));
                const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));

                if (emailInputs.length > 0 && passwordInputs.length > 0) {
                    return {
                        type: 'email-password',
                        emailSelector: emailInputs[0].getAttribute('name') || emailInputs[0].getAttribute('id') || 'input[type="email"]',
                        passwordSelector: passwordInputs[0].getAttribute('name') || passwordInputs[0].getAttribute('id') || 'input[type="password"]'
                    };
                }

                // Strategy 2: Google OAuth button
                const googleBtn = document.querySelector('[aria-label*="Google" i], [data-provider="google"], button:has-text("Google")');
                if (googleBtn) {
                    return { type: 'oauth-google' };
                }

                return null;
            });

            if (!loginDetected) {
                console.log('[AutoLogin] No login form detected on this page');
                return false;
            }

            console.log(`[AutoLogin] Login form detected: ${loginDetected.type}`);

            // Handle different login types
            if (loginDetected.type === 'email-password') {
                return await this._loginEmailPassword(page, email, password, loginDetected);
            } else if (loginDetected.type === 'oauth-google') {
                console.warn('[AutoLogin] OAuth login detected but not yet supported. User must login manually.');
                return false;
            }

            return false;

        } catch (err) {
            console.error(`[AutoLogin] Error during auto-login: ${err.message}`);
            return false;
        }
    }

    /**
     * Login using email and password form
     */
    async _loginEmailPassword(page, email, password, selectors) {
        try {
            console.log('[AutoLogin] Filling email and password...');

            // Find and fill email field
            const emailInput = await page.locator(`input[type="email"], input[name*="email" i], input[placeholder*="email" i]`).first();
            await emailInput.fill(email);
            await page.waitForTimeout(500);

            // Find and fill password field
            const passwordInput = await page.locator('input[type="password"]').first();
            await passwordInput.fill(password);
            await page.waitForTimeout(500);

            // Find and click submit button
            const submitBtn = await this._findSubmitButton(page);
            if (submitBtn) {
                console.log('[AutoLogin] Clicking submit button...');
                await submitBtn.click();

                // Wait for navigation or DOM change (indicating login attempt)
                try {
                    await Promise.race([
                        page.waitForNavigation({ timeout: 15000 }),
                        page.waitForTimeout(15000)
                    ]);
                } catch (navErr) {
                    // Navigation might not happen, that's ok
                }

                // Wait a bit for post-login redirects
                await page.waitForTimeout(3000);

                // Check if login was successful by looking for common indicators
                const loginSuccess = await page.evaluate(() => {
                    // Check if password field is gone (common after successful login)
                    const hasPasswordField = document.querySelector('input[type="password"]') !== null;
                    // Check for common error messages
                    const hasError = document.body.innerText.toLowerCase().includes('incorrect') ||
                        document.body.innerText.toLowerCase().includes('invalid') ||
                        document.body.innerText.toLowerCase().includes('wrong password') ||
                        document.body.innerText.toLowerCase().includes('sai mật khẩu');

                    return !hasPasswordField && !hasError;
                });

                if (loginSuccess) {
                    console.log('[AutoLogin] ✓ Login appears successful!');
                    return true;
                } else {
                    console.warn('[AutoLogin] Login may have failed - password field still present or error detected');
                    return false;
                }
            } else {
                console.warn('[AutoLogin] Could not find submit button');
                return false;
            }

        } catch (err) {
            console.error(`[AutoLogin] Email/password login failed: ${err.message}`);
            return false;
        }
    }

    /**
     * Find submit button using multiple strategies
     */
    async _findSubmitButton(page) {
        try {
            // Strategy 1: Look for submit button by type
            let btn = await page.locator('button[type="submit"], input[type="submit"]').first();
            if (await btn.count() > 0) return btn;

            // Strategy 2: Look for button with login-related text
            btn = await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login"), button:has-text("Đăng nhập"), button:has-text("Submit")').first();
            if (await btn.count() > 0) return btn;

            // Strategy 3: Look for any button inside a form with password field
            btn = await page.locator('form:has(input[type="password"]) button').first();
            if (await btn.count() > 0) return btn;

            return null;
        } catch (err) {
            return null;
        }
    }
}

module.exports = AutoLogin;
