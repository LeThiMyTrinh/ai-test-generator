/**
 * Group 6: Dropdown Tests (7 cases)
 * 6.1 Click open
 * 6.2 Click outside close
 * 6.3 Select option
 * 6.4 Keyboard Arrow Down
 * 6.5 Keyboard Arrow Up
 * 6.6 Keyboard Enter select
 * 6.7 ESC close
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class DropdownTests {
    /**
     * Run all dropdown tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];
        const dropdowns = discovery.dropdowns.slice(0, 5);

        if (dropdowns.length === 0) {
            // Also check for native <select> elements
            results.push(await this._testNativeSelects(page));
            if (results[0].status === 'skipped') {
                results[0].details = 'Không tìm thấy dropdowns hoặc select trên trang';
            }
            return results;
        }

        for (const dd of dropdowns) {
            const ddResults = await this._testDropdownFull(page, dd);
            results.push(...ddResults);
        }

        return results;
    }

    /**
     * Run all 7 tests for a single dropdown
     */
    async _testDropdownFull(page, dd) {
        const results = [];
        const label = dd.text.substring(0, 25);

        // 6.1: Click open
        const openResult = await this._testClickOpen(page, dd, label);
        results.push(openResult);

        if (openResult.status !== 'passed') {
            return results;
        }

        // 6.3: Select option (while menu is open)
        results.push(await this._testSelectOption(page, dd, label));

        // 6.1 again: Re-open for remaining tests
        await this._openDropdown(page, dd);

        // 6.2: Click outside close
        results.push(await this._testClickOutside(page, dd, label));

        // Re-open for keyboard tests
        await this._openDropdown(page, dd);

        // 6.4: Arrow Down
        results.push(await this._testArrowDown(page, dd, label));

        // 6.5: Arrow Up
        results.push(await this._testArrowUp(page, dd, label));

        // 6.6: Enter select
        results.push(await this._testEnterSelect(page, dd, label));

        // 6.7: ESC close
        await this._openDropdown(page, dd);
        results.push(await this._testESCClose(page, dd, label));

        return results;
    }

    /**
     * Open dropdown
     */
    async _openDropdown(page, dd) {
        try {
            const trigger = await page.$(dd.selector);
            if (trigger) {
                await trigger.click();
                await page.waitForTimeout(500);
            }
        } catch { /* ignore */ }
    }

    /**
     * Check if dropdown menu is visible
     */
    async _isMenuVisible(page, dd) {
        return page.evaluate((ddType) => {
            if (ddType === 'details') {
                const details = document.querySelector('details[open]');
                return !!details;
            }
            const menu = document.querySelector('.dropdown-menu.show, .dropdown-menu[style*="display: block"], [role="menu"]:not([aria-hidden="true"]), [role="listbox"]:not([aria-hidden="true"])');
            return !!menu;
        }, dd.type);
    }

    /**
     * Get dropdown menu items
     */
    async _getMenuItems(page, dd) {
        return page.evaluate((ddType) => {
            let items = [];
            if (ddType === 'details') {
                const details = document.querySelector('details[open]');
                if (details) {
                    details.querySelectorAll('a, button, li').forEach(item => {
                        items.push({
                            text: item.textContent.trim().substring(0, 40),
                            selector: item.id ? `#${item.id}` : null,
                        });
                    });
                }
            } else {
                const menu = document.querySelector('.dropdown-menu.show, [role="menu"], [role="listbox"]');
                if (menu) {
                    menu.querySelectorAll('.dropdown-item, a, button, [role="menuitem"], [role="option"], li').forEach(item => {
                        const rect = item.getBoundingClientRect();
                        if (rect.width > 0) {
                            items.push({
                                text: item.textContent.trim().substring(0, 40),
                                selector: item.id ? `#${item.id}` : null,
                            });
                        }
                    });
                }
            }
            return items.slice(0, 10);
        }, dd.type);
    }

    /**
     * 6.1: Click open
     */
    async _testClickOpen(page, dd, label) {
        const test = createTestResult('dropdown', '6.1', `Dropdown open: "${label}"`);
        return runSafe(test, async (t) => {
            const trigger = await page.$(dd.selector);
            if (!trigger) {
                t.status = 'skipped';
                t.details = 'Dropdown trigger không tìm thấy';
                return;
            }

            await trigger.click();
            await page.waitForTimeout(500);

            const isOpen = await this._isMenuVisible(page, dd);
            const items = await this._getMenuItems(page, dd);

            if (isOpen) {
                t.status = 'passed';
                t.details = `Dropdown mở thành công. ${items.length} items: ${items.slice(0, 3).map(i => `"${i.text}"`).join(', ')}`;
                t.screenshot = await takeScreenshot(page);
            } else {
                t.status = 'failed';
                t.details = 'Click trigger nhưng menu không xuất hiện';
            }
        });
    }

    /**
     * 6.2: Click outside close
     */
    async _testClickOutside(page, dd, label) {
        const test = createTestResult('dropdown', '6.2', `Dropdown click outside: "${label}"`);
        return runSafe(test, async (t) => {
            const wasOpen = await this._isMenuVisible(page, dd);
            if (!wasOpen) {
                t.status = 'skipped';
                t.details = 'Menu không mở';
                return;
            }

            // Click outside
            await page.click('body', { position: { x: 10, y: 10 } }).catch(() => {
                return page.mouse.click(10, 10);
            });
            await page.waitForTimeout(500);

            const isStillOpen = await this._isMenuVisible(page, dd);
            if (!isStillOpen) {
                t.status = 'passed';
                t.details = 'Click outside đóng dropdown thành công ✓';
            } else {
                t.status = 'failed';
                t.details = 'Dropdown không đóng khi click outside';
            }
        });
    }

    /**
     * 6.3: Select option
     */
    async _testSelectOption(page, dd, label) {
        const test = createTestResult('dropdown', '6.3', `Dropdown select option: "${label}"`);
        return runSafe(test, async (t) => {
            const items = await this._getMenuItems(page, dd);
            if (items.length === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy menu items';
                return;
            }

            // Click first option
            const firstItem = items[0];
            try {
                if (firstItem.selector) {
                    await page.click(firstItem.selector);
                } else {
                    // Try clicking by text
                    await page.evaluate((text) => {
                        const menu = document.querySelector('.dropdown-menu.show, [role="menu"], [role="listbox"], details[open]');
                        if (!menu) return;
                        const items = menu.querySelectorAll('.dropdown-item, a, button, [role="menuitem"], [role="option"], li');
                        for (const item of items) {
                            if (item.textContent.trim().startsWith(text)) {
                                item.click();
                                return;
                            }
                        }
                    }, firstItem.text.substring(0, 20));
                }
                await page.waitForTimeout(500);

                const menuClosed = !(await this._isMenuVisible(page, dd));
                t.status = 'passed';
                t.details = `Selected "${firstItem.text}". Menu ${menuClosed ? 'đóng sau select ✓' : 'vẫn mở (có thể multi-select)'}`;
            } catch (err) {
                t.status = 'warning';
                t.details = `Không click được option: ${err.message.substring(0, 100)}`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 6.4: Keyboard Arrow Down
     */
    async _testArrowDown(page, dd, label) {
        const test = createTestResult('dropdown', '6.4', `Dropdown Arrow Down: "${label}"`);
        return runSafe(test, async (t) => {
            const isOpen = await this._isMenuVisible(page, dd);
            if (!isOpen) {
                t.status = 'skipped';
                t.details = 'Menu không mở';
                return;
            }

            // Press ArrowDown
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(300);

            const focusedItem = await page.evaluate(() => {
                const active = document.activeElement;
                if (!active) return null;
                return {
                    tag: active.tagName,
                    text: active.textContent?.trim().substring(0, 40),
                    isinMenu: !!active.closest('.dropdown-menu, [role="menu"], [role="listbox"], details'),
                    hasActiveClass: active.classList.contains('active') || active.classList.contains('focused') || active.getAttribute('aria-selected') === 'true',
                };
            });

            if (focusedItem && focusedItem.isinMenu) {
                t.status = 'passed';
                t.details = `ArrowDown: focus di chuyển tới "${focusedItem.text}" ✓`;
            } else {
                // Also check for highlighted/active item via CSS
                const hasHighlight = await page.evaluate(() => {
                    const menu = document.querySelector('.dropdown-menu.show, [role="menu"], [role="listbox"]');
                    if (!menu) return false;
                    const active = menu.querySelector('.active, .highlighted, [aria-selected="true"], :focus');
                    return !!active;
                });

                if (hasHighlight) {
                    t.status = 'passed';
                    t.details = 'ArrowDown: có item highlighted trong menu ✓';
                } else {
                    t.status = 'warning';
                    t.details = 'ArrowDown: không phát hiện focus/highlight change trong menu';
                }
            }
        });
    }

    /**
     * 6.5: Keyboard Arrow Up
     */
    async _testArrowUp(page, dd, label) {
        const test = createTestResult('dropdown', '6.5', `Dropdown Arrow Up: "${label}"`);
        return runSafe(test, async (t) => {
            // ArrowDown first to have a starting position
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(200);
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(200);

            // Now ArrowUp
            await page.keyboard.press('ArrowUp');
            await page.waitForTimeout(300);

            const focusedItem = await page.evaluate(() => {
                const active = document.activeElement;
                if (!active) return null;
                return {
                    text: active.textContent?.trim().substring(0, 40),
                    inMenu: !!active.closest('.dropdown-menu, [role="menu"], [role="listbox"], details'),
                };
            });

            if (focusedItem && focusedItem.inMenu) {
                t.status = 'passed';
                t.details = `ArrowUp: focus di chuyển lên "${focusedItem.text}" ✓`;
            } else {
                t.status = 'warning';
                t.details = 'ArrowUp: không phát hiện focus change rõ ràng';
            }
        });
    }

    /**
     * 6.6: Enter select
     */
    async _testEnterSelect(page, dd, label) {
        const test = createTestResult('dropdown', '6.6', `Dropdown Enter select: "${label}"`);
        return runSafe(test, async (t) => {
            // Navigate to an item first
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(200);

            const focusedBefore = await page.evaluate(() => {
                return document.activeElement?.textContent?.trim().substring(0, 40) || '';
            });

            // Press Enter
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);

            const menuClosed = !(await this._isMenuVisible(page, dd));

            if (menuClosed) {
                t.status = 'passed';
                t.details = `Enter selected "${focusedBefore}" và đóng menu ✓`;
            } else {
                t.status = 'warning';
                t.details = `Enter pressed (focused: "${focusedBefore}") nhưng menu vẫn mở`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 6.7: ESC close
     */
    async _testESCClose(page, dd, label) {
        const test = createTestResult('dropdown', '6.7', `Dropdown ESC close: "${label}"`);
        return runSafe(test, async (t) => {
            const wasOpen = await this._isMenuVisible(page, dd);
            if (!wasOpen) {
                t.status = 'skipped';
                t.details = 'Menu không mở';
                return;
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);

            const isStillOpen = await this._isMenuVisible(page, dd);
            if (!isStillOpen) {
                t.status = 'passed';
                t.details = 'ESC đóng dropdown thành công ✓';
            } else {
                t.status = 'failed';
                t.details = 'Dropdown không đóng bằng ESC';
            }
        });
    }

    /**
     * Test native <select> elements when no custom dropdowns found
     */
    async _testNativeSelects(page) {
        const test = createTestResult('dropdown', '6.0', 'Native select elements');
        return runSafe(test, async (t) => {
            const selects = await page.evaluate(() => {
                const results = [];
                document.querySelectorAll('select').forEach(sel => {
                    const rect = sel.getBoundingClientRect();
                    if (rect.width === 0) return;
                    const options = [];
                    sel.querySelectorAll('option').forEach(opt => {
                        options.push({ text: opt.textContent.trim().substring(0, 30), value: opt.value });
                    });
                    results.push({
                        name: sel.name || sel.id || 'unknown',
                        selector: sel.id ? `#${sel.id}` : (sel.name ? `select[name="${sel.name}"]` : 'select'),
                        optionCount: options.length,
                        hasEmptyOption: options.some(o => !o.value),
                        hasLabel: !!document.querySelector(`label[for="${sel.id}"]`) || !!sel.closest('label'),
                    });
                });
                return results;
            });

            if (selects.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy dropdown/select trên trang';
                return;
            }

            const issues = [];
            for (const sel of selects) {
                if (sel.optionCount <= 1) issues.push(`"${sel.name}" chỉ có ${sel.optionCount} options`);
                if (!sel.hasLabel) issues.push(`"${sel.name}" thiếu label`);
            }

            t.status = issues.length > 0 ? 'warning' : 'passed';
            t.details = `${selects.length} native selects. ${issues.length > 0 ? 'Issues: ' + issues.join('; ') : 'Tất cả OK ✓'}`;
        });
    }
}

module.exports = DropdownTests;
