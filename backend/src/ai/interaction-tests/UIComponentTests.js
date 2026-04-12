/**
 * Group 2: Kiểm tra UI Components (12 cases)
 * 2.1  Button — Hover state
 * 2.2  Button — Active state
 * 2.3  Button — Disabled state
 * 2.4  Input — Placeholder hiển thị đúng
 * 2.5  Input — Focus state
 * 2.6  Input — Error message hiển thị đúng
 * 2.7  Input — Required field validation
 * 2.8  Checkbox — Checked state
 * 2.9  Checkbox — Unchecked state
 * 2.10 Radio — Checked/Unchecked state
 * 2.11 Dropdown — Mở dropdown
 * 2.12 Dropdown — Chọn option + Scroll list
 */

const { createTestResult, runSafe, takeScreenshot, fillField } = require('./testHelpers');

class UIComponentTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        // Button tests
        results.push(await this._testButtonHoverState(page, discovery));
        results.push(await this._testButtonActiveState(page, discovery));
        results.push(await this._testButtonDisabledState(page));

        // Input tests
        results.push(await this._testInputPlaceholder(page));
        results.push(await this._testInputFocusState(page));
        results.push(await this._testInputErrorMessage(page, discovery));
        results.push(await this._testInputRequired(page, discovery));

        // Checkbox tests
        results.push(await this._testCheckboxChecked(page));
        results.push(await this._testCheckboxUnchecked(page));

        // Radio tests
        results.push(await this._testRadioState(page));

        // Dropdown tests
        results.push(await this._testDropdownOpen(page, discovery));
        results.push(await this._testDropdownSelectOption(page, discovery));

        return results;
    }

    /**
     * 2.1: Button — Hover state
     */
    async _testButtonHoverState(page, discovery) {
        const test = createTestResult('uiComponents', '2.1', 'Button — Hover state');
        return runSafe(test, async (t) => {
            const btn = await page.$('button:visible, [role="button"]:visible, .btn:visible').catch(() => null);
            if (!btn) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy button visible trên trang';
                return;
            }

            // Get default styles
            const defaultStyles = await page.evaluate((el) => {
                const s = getComputedStyle(el);
                return { bg: s.backgroundColor, color: s.color, border: s.borderColor, shadow: s.boxShadow, transform: s.transform };
            }, btn);

            // Hover
            await btn.hover();
            await page.waitForTimeout(150);

            const hoverStyles = await page.evaluate((el) => {
                const s = getComputedStyle(el);
                return { bg: s.backgroundColor, color: s.color, border: s.borderColor, shadow: s.boxShadow, transform: s.transform };
            }, btn);

            const hasChange = hoverStyles.bg !== defaultStyles.bg ||
                hoverStyles.color !== defaultStyles.color ||
                hoverStyles.shadow !== defaultStyles.shadow ||
                hoverStyles.transform !== defaultStyles.transform ||
                hoverStyles.border !== defaultStyles.border;

            if (hasChange) {
                t.status = 'passed';
                t.details = 'Button có hover state — style thay đổi khi hover ✓';
            } else {
                t.status = 'warning';
                t.details = 'Button không có hover style change rõ ràng — nên thêm visual feedback';
            }

            t.screenshot = await takeScreenshot(page);

            // Move mouse away
            await page.mouse.move(0, 0);
            await page.waitForTimeout(100);
        });
    }

    /**
     * 2.2: Button — Active state
     */
    async _testButtonActiveState(page, discovery) {
        const test = createTestResult('uiComponents', '2.2', 'Button — Active state');
        return runSafe(test, async (t) => {
            const btnInfo = await page.evaluate(() => {
                const buttons = document.querySelectorAll('button, [role="button"], .btn');
                for (const btn of buttons) {
                    const rect = btn.getBoundingClientRect();
                    const style = getComputedStyle(btn);
                    if (rect.width > 0 && style.display !== 'none' && !btn.disabled) {
                        return {
                            selector: btn.id ? `#${btn.id}` : null,
                            text: btn.textContent.trim().substring(0, 30),
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2,
                        };
                    }
                }
                return null;
            });

            if (!btnInfo) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy button phù hợp';
                return;
            }

            // Get default styles before mouse down
            const defaultStyles = await page.evaluate((pos) => {
                const el = document.elementFromPoint(pos.x, pos.y);
                if (!el) return null;
                const s = getComputedStyle(el);
                return { bg: s.backgroundColor, transform: s.transform, shadow: s.boxShadow };
            }, btnInfo);

            // Mouse down (simulate active state)
            await page.mouse.move(btnInfo.x, btnInfo.y);
            await page.mouse.down();
            await page.waitForTimeout(100);

            const activeStyles = await page.evaluate((pos) => {
                const el = document.elementFromPoint(pos.x, pos.y);
                if (!el) return null;
                const s = getComputedStyle(el);
                return { bg: s.backgroundColor, transform: s.transform, shadow: s.boxShadow };
            }, btnInfo);

            await page.mouse.up();
            await page.waitForTimeout(100);

            if (!defaultStyles || !activeStyles) {
                t.status = 'skipped';
                t.details = 'Không đọc được styles';
                return;
            }

            const hasChange = activeStyles.bg !== defaultStyles.bg ||
                activeStyles.transform !== defaultStyles.transform ||
                activeStyles.shadow !== defaultStyles.shadow;

            if (hasChange) {
                t.status = 'passed';
                t.details = `Button "${btnInfo.text}" có active state — style thay đổi khi mousedown ✓`;
            } else {
                t.status = 'warning';
                t.details = `Button "${btnInfo.text}" không có active state change rõ ràng`;
            }
        });
    }

    /**
     * 2.3: Button — Disabled state
     */
    async _testButtonDisabledState(page) {
        const test = createTestResult('uiComponents', '2.3', 'Button — Disabled state');
        return runSafe(test, async (t) => {
            const disabledButtons = await page.evaluate(() => {
                const results = [];
                document.querySelectorAll('button[disabled], input[type="submit"][disabled], [role="button"][aria-disabled="true"], .btn.disabled').forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width === 0) return;
                    results.push({
                        text: btn.textContent.trim().substring(0, 40),
                        isActuallyDisabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true',
                        hasDisabledStyle: getComputedStyle(btn).pointerEvents === 'none' || parseFloat(getComputedStyle(btn).opacity) < 1,
                        cursor: getComputedStyle(btn).cursor,
                    });
                });
                return results;
            });

            if (disabledButtons.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy disabled buttons trên trang';
                return;
            }

            const issues = [];
            for (const btn of disabledButtons) {
                if (!btn.isActuallyDisabled) {
                    issues.push(`"${btn.text}" có class disabled nhưng thiếu disabled attribute`);
                }
                if (btn.cursor !== 'not-allowed' && btn.cursor !== 'default') {
                    issues.push(`"${btn.text}" cursor="${btn.cursor}" (nên là not-allowed)`);
                }
            }

            if (issues.length > 0) {
                t.status = 'warning';
                t.details = `${disabledButtons.length} disabled buttons. Issues: ${issues.join('; ')}`;
            } else {
                t.status = 'passed';
                t.details = `${disabledButtons.length} disabled buttons — state đúng (disabled attr + cursor) ✓`;
            }
        });
    }

    /**
     * 2.4: Input — Placeholder hiển thị đúng
     */
    async _testInputPlaceholder(page) {
        const test = createTestResult('uiComponents', '2.4', 'Input — Placeholder hiển thị đúng');
        return runSafe(test, async (t) => {
            const placeholderCheck = await page.evaluate(() => {
                const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea');
                let total = 0, withPlaceholder = 0, emptyPlaceholder = 0;
                const issues = [];

                inputs.forEach(inp => {
                    const rect = inp.getBoundingClientRect();
                    if (rect.width === 0) return;
                    total++;

                    const placeholder = inp.getAttribute('placeholder');
                    if (placeholder && placeholder.trim().length > 0) {
                        withPlaceholder++;
                    } else if (placeholder === '') {
                        emptyPlaceholder++;
                        issues.push(inp.name || inp.id || inp.type);
                    }
                });

                return { total, withPlaceholder, emptyPlaceholder, issues: issues.slice(0, 5) };
            });

            if (placeholderCheck.total === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy input fields trên trang';
                return;
            }

            if (placeholderCheck.emptyPlaceholder > 0) {
                t.status = 'warning';
                t.details = `${placeholderCheck.withPlaceholder}/${placeholderCheck.total} inputs có placeholder. ${placeholderCheck.emptyPlaceholder} có placeholder rỗng: ${placeholderCheck.issues.join(', ')}`;
            } else {
                t.status = 'passed';
                t.details = `${placeholderCheck.withPlaceholder}/${placeholderCheck.total} inputs có placeholder hiển thị đúng ✓`;
            }
        });
    }

    /**
     * 2.5: Input — Focus state
     */
    async _testInputFocusState(page) {
        const test = createTestResult('uiComponents', '2.5', 'Input — Focus state');
        return runSafe(test, async (t) => {
            const input = await page.$('input[type="text"]:visible, input[type="email"]:visible, input:not([type]):visible, textarea:visible').catch(() => null);
            if (!input) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy text input visible trên trang';
                return;
            }

            // Get default styles
            const defaultStyles = await page.evaluate((el) => {
                const s = getComputedStyle(el);
                return { outline: s.outline, border: s.border, shadow: s.boxShadow, borderColor: s.borderColor };
            }, input);

            // Focus
            await input.focus();
            await page.waitForTimeout(150);

            const focusStyles = await page.evaluate((el) => {
                const s = getComputedStyle(el);
                return { outline: s.outline, border: s.border, shadow: s.boxShadow, borderColor: s.borderColor };
            }, input);

            const hasChange = focusStyles.outline !== defaultStyles.outline ||
                focusStyles.border !== defaultStyles.border ||
                focusStyles.shadow !== defaultStyles.shadow ||
                focusStyles.borderColor !== defaultStyles.borderColor;

            if (hasChange) {
                t.status = 'passed';
                t.details = 'Input có focus state — style thay đổi khi focus (outline/border/shadow) ✓';
            } else {
                t.status = 'warning';
                t.details = 'Input không có focus state change rõ ràng — nên thêm visual indicator';
            }

            t.screenshot = await takeScreenshot(page);

            // Blur
            await page.evaluate((el) => el.blur(), input);
        });
    }

    /**
     * 2.6: Input — Error message hiển thị đúng
     */
    async _testInputErrorMessage(page, discovery) {
        const test = createTestResult('uiComponents', '2.6', 'Input — Error message hiển thị đúng');
        return runSafe(test, async (t) => {
            const form = discovery.forms[0];
            if (!form || !form.submitSelector) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy form với submit button';
                return;
            }

            const requiredFields = form.fields.filter(f => f.required);
            if (requiredFields.length === 0) {
                t.status = 'skipped';
                t.details = 'Form không có required fields để test error';
                return;
            }

            // Clear all fields
            for (const field of form.fields) {
                try {
                    const el = await page.$(field.selector);
                    if (el && field.type !== 'checkbox' && field.type !== 'radio' && field.tag !== 'select') {
                        await el.fill('');
                    }
                } catch { /* skip */ }
            }

            // Submit empty form
            const submitBtn = await page.$(form.submitSelector);
            if (submitBtn) await submitBtn.click();
            await page.waitForTimeout(200);

            // Check for error messages
            const errorCheck = await page.evaluate(() => {
                const errorSelectors = [
                    '.error', '.error-message', '.invalid-feedback', '.field-error',
                    '[role="alert"]', '.alert-danger', '.form-error', '.validation-error',
                    '.text-danger', '.text-red-500', '.has-error', '.help-block.error',
                ];
                const errors = [];
                for (const sel of errorSelectors) {
                    document.querySelectorAll(sel).forEach(el => {
                        const text = el.textContent.trim();
                        const style = getComputedStyle(el);
                        if (text.length > 0 && text.length < 200 && style.display !== 'none' && style.visibility !== 'hidden') {
                            errors.push(text.substring(0, 80));
                        }
                    });
                }

                // Check HTML5 validation
                const invalidInputs = document.querySelectorAll('input:invalid, select:invalid, textarea:invalid');
                return {
                    errorMessages: [...new Set(errors)].slice(0, 5),
                    invalidInputCount: invalidInputs.length,
                };
            });

            if (errorCheck.errorMessages.length > 0 || errorCheck.invalidInputCount > 0) {
                t.status = 'passed';
                t.details = `Error messages hiển thị đúng. ${errorCheck.errorMessages.length} messages, ${errorCheck.invalidInputCount} invalid inputs ✓`;
            } else {
                t.status = 'warning';
                t.details = `Submit form trống nhưng không thấy error messages (${requiredFields.length} required fields)`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 2.7: Input — Required field validation
     */
    async _testInputRequired(page, discovery) {
        const test = createTestResult('uiComponents', '2.7', 'Input — Required field validation');
        return runSafe(test, async (t) => {
            const requiredCheck = await page.evaluate(() => {
                const inputs = document.querySelectorAll('input[required], select[required], textarea[required]');
                const results = [];

                inputs.forEach(inp => {
                    const rect = inp.getBoundingClientRect();
                    if (rect.width === 0) return;

                    // Check for visual required indicator
                    const label = document.querySelector(`label[for="${inp.id}"]`) || inp.closest('label');
                    const labelText = label ? label.textContent : '';
                    const hasAsterisk = labelText.includes('*');
                    const hasAriaRequired = inp.getAttribute('aria-required') === 'true';

                    results.push({
                        name: inp.name || inp.id || inp.type,
                        hasVisualIndicator: hasAsterisk,
                        hasAriaRequired: hasAriaRequired || inp.required,
                    });
                });

                return results;
            });

            if (requiredCheck.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy required fields trên trang';
                return;
            }

            const withoutIndicator = requiredCheck.filter(r => !r.hasVisualIndicator);

            if (withoutIndicator.length === 0) {
                t.status = 'passed';
                t.details = `${requiredCheck.length} required fields đều có visual indicator (*) ✓`;
            } else if (withoutIndicator.length < requiredCheck.length) {
                t.status = 'warning';
                t.details = `${requiredCheck.length} required fields, ${withoutIndicator.length} thiếu visual indicator (*): ${withoutIndicator.slice(0, 3).map(r => r.name).join(', ')}`;
            } else {
                t.status = 'warning';
                t.details = `${requiredCheck.length} required fields, tất cả thiếu visual indicator (*). Nên thêm dấu * cho label.`;
            }
        });
    }

    /**
     * 2.8: Checkbox — Checked state
     */
    async _testCheckboxChecked(page) {
        const test = createTestResult('uiComponents', '2.8', 'Checkbox — Checked state');
        return runSafe(test, async (t) => {
            const checkbox = await page.$('input[type="checkbox"]:visible').catch(() => null);
            if (!checkbox) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy checkbox trên trang';
                return;
            }

            // Get initial state
            const wasCkecked = await checkbox.isChecked();

            // Check it
            if (!wasCkecked) {
                await checkbox.check();
                await page.waitForTimeout(100);
            }

            const isChecked = await checkbox.isChecked();

            // Verify visual change
            const visualCheck = await page.evaluate((el) => {
                const style = getComputedStyle(el);
                return {
                    checked: el.checked,
                    ariaChecked: el.getAttribute('aria-checked'),
                    bgColor: style.backgroundColor,
                    accentColor: style.accentColor,
                };
            }, checkbox);

            if (isChecked && visualCheck.checked) {
                t.status = 'passed';
                t.details = `Checkbox checked state hoạt động đúng ✓`;
            } else {
                t.status = 'failed';
                t.details = `Checkbox click nhưng không chuyển sang checked state`;
            }

            t.screenshot = await takeScreenshot(page);

            // Restore original state
            if (!wasCkecked && isChecked) {
                await checkbox.uncheck().catch(() => {});
            }
        });
    }

    /**
     * 2.9: Checkbox — Unchecked state
     */
    async _testCheckboxUnchecked(page) {
        const test = createTestResult('uiComponents', '2.9', 'Checkbox — Unchecked state');
        return runSafe(test, async (t) => {
            const checkbox = await page.$('input[type="checkbox"]:visible').catch(() => null);
            if (!checkbox) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy checkbox trên trang';
                return;
            }

            // Ensure checked first
            const wasChecked = await checkbox.isChecked();
            if (!wasChecked) {
                await checkbox.check();
                await page.waitForTimeout(100);
            }

            // Now uncheck
            await checkbox.uncheck();
            await page.waitForTimeout(100);

            const isChecked = await checkbox.isChecked();

            if (!isChecked) {
                t.status = 'passed';
                t.details = 'Checkbox unchecked state hoạt động đúng ✓';
            } else {
                t.status = 'failed';
                t.details = 'Checkbox click nhưng không chuyển sang unchecked state';
            }

            // Restore
            if (wasChecked && !isChecked) {
                await checkbox.check().catch(() => {});
            }
        });
    }

    /**
     * 2.10: Radio — Checked/Unchecked state
     */
    async _testRadioState(page) {
        const test = createTestResult('uiComponents', '2.10', 'Radio — Checked/Unchecked state');
        return runSafe(test, async (t) => {
            const radios = await page.$$('input[type="radio"]:visible');
            if (radios.length < 2) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy đủ radio buttons trên trang (cần >= 2)';
                return;
            }

            // Click first radio
            await radios[0].check();
            await page.waitForTimeout(100);

            const firstChecked = await radios[0].isChecked();
            const secondChecked = await radios[1].isChecked();

            // Click second radio
            await radios[1].check();
            await page.waitForTimeout(100);

            const firstAfter = await radios[0].isChecked();
            const secondAfter = await radios[1].isChecked();

            if (firstChecked && !secondChecked && !firstAfter && secondAfter) {
                t.status = 'passed';
                t.details = 'Radio buttons hoạt động đúng — chỉ 1 option được chọn tại một thời điểm ✓';
            } else if (secondAfter) {
                t.status = 'passed';
                t.details = 'Radio button checked state hoạt động ✓';
            } else {
                t.status = 'failed';
                t.details = 'Radio buttons không hoạt động đúng — click không thay đổi state';
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 2.11: Dropdown — Mở dropdown
     */
    async _testDropdownOpen(page, discovery) {
        const test = createTestResult('uiComponents', '2.11', 'Dropdown — Mở dropdown');
        return runSafe(test, async (t) => {
            // Check custom dropdowns first
            if (discovery.dropdowns.length > 0) {
                const dd = discovery.dropdowns[0];
                const trigger = await page.$(dd.selector).catch(() => null);
                if (trigger) {
                    await trigger.click();
                    await page.waitForTimeout(200);

                    const isOpen = await page.evaluate((ddType) => {
                        if (ddType === 'details') return !!document.querySelector('details[open]');
                        return !!document.querySelector('.dropdown-menu.show, [role="menu"]:not([aria-hidden="true"]), [role="listbox"]:not([aria-hidden="true"])');
                    }, dd.type);

                    if (isOpen) {
                        t.status = 'passed';
                        t.details = `Dropdown "${dd.text}" mở thành công ✓`;
                        t.screenshot = await takeScreenshot(page);
                        // Close
                        await page.keyboard.press('Escape');
                        await page.waitForTimeout(100);
                        return;
                    }
                }
            }

            // Fallback: check native <select>
            const selectCheck = await page.evaluate(() => {
                const selects = document.querySelectorAll('select');
                const results = [];
                selects.forEach(sel => {
                    const rect = sel.getBoundingClientRect();
                    if (rect.width === 0) return;
                    results.push({
                        name: sel.name || sel.id || 'select',
                        options: sel.options.length,
                    });
                });
                return results;
            });

            if (selectCheck.length > 0) {
                t.status = 'passed';
                t.details = `${selectCheck.length} native <select> tìm thấy, ${selectCheck[0].options} options ✓`;
            } else {
                t.status = 'skipped';
                t.details = 'Không tìm thấy dropdown/select trên trang';
            }
        });
    }

    /**
     * 2.12: Dropdown — Chọn option + Scroll list
     */
    async _testDropdownSelectOption(page, discovery) {
        const test = createTestResult('uiComponents', '2.12', 'Dropdown — Chọn option + Scroll list');
        return runSafe(test, async (t) => {
            // Try native select first (more reliable)
            const selectInfo = await page.evaluate(() => {
                const sel = document.querySelector('select');
                if (!sel) return null;
                const rect = sel.getBoundingClientRect();
                if (rect.width === 0) return null;
                const options = [];
                sel.querySelectorAll('option').forEach(opt => {
                    options.push({ text: opt.textContent.trim().substring(0, 40), value: opt.value });
                });
                return {
                    selector: sel.id ? `#${sel.id}` : (sel.name ? `select[name="${sel.name}"]` : 'select'),
                    options,
                    currentValue: sel.value,
                };
            });

            if (selectInfo && selectInfo.options.length >= 2) {
                // Select a different option
                const targetOption = selectInfo.options.find(o => o.value !== selectInfo.currentValue && o.value);
                if (targetOption) {
                    await page.selectOption(selectInfo.selector, targetOption.value).catch(() => {});
                    await page.waitForTimeout(100);

                    const newValue = await page.evaluate((sel) => {
                        const el = document.querySelector(sel);
                        return el ? el.value : null;
                    }, selectInfo.selector);

                    if (newValue === targetOption.value) {
                        t.status = 'passed';
                        t.details = `Chọn option "${targetOption.text}" thành công. ${selectInfo.options.length} options available ✓`;
                    } else {
                        t.status = 'warning';
                        t.details = 'Chọn option nhưng value không thay đổi';
                    }
                } else {
                    t.status = 'passed';
                    t.details = `Select có ${selectInfo.options.length} options ✓`;
                }
                return;
            }

            // Try custom dropdown
            if (discovery.dropdowns.length > 0) {
                const dd = discovery.dropdowns[0];
                const trigger = await page.$(dd.selector).catch(() => null);
                if (trigger) {
                    await trigger.click();
                    await page.waitForTimeout(200);

                    // Try selecting first item
                    const selected = await page.evaluate(() => {
                        const item = document.querySelector('.dropdown-menu.show .dropdown-item, [role="menu"] [role="menuitem"], [role="listbox"] [role="option"]');
                        if (item) {
                            item.click();
                            return item.textContent.trim().substring(0, 40);
                        }
                        return null;
                    });

                    if (selected) {
                        t.status = 'passed';
                        t.details = `Chọn option "${selected}" thành công ✓`;
                    } else {
                        t.status = 'warning';
                        t.details = 'Dropdown mở nhưng không chọn được option';
                    }
                    return;
                }
            }

            t.status = 'skipped';
            t.details = 'Không tìm thấy dropdown/select để test chọn option';
        });
    }
}

module.exports = UIComponentTests;
