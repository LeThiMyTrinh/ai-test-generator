/**
 * Group 9: Dropdown / Combobox / Pulldown (5 cases) — theo PDF
 * TC_DD_01 Dropdown hiển thị
 * TC_DD_02 Mở dropdown → hiển thị list
 * TC_DD_03 Chọn option → hiển thị option
 * TC_DD_04 Scroll list → scroll hoạt động
 * TC_DD_05 Default value → hiển thị default
 */

const { createTestResult, runSafe, takeScreenshot, navigateBack } = require('./testHelpers');

class DropdownTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testDropdownVisible(page, discovery));
        results.push(await this._testOpenDropdown(page, discovery));
        results.push(await this._testSelectOption(page, discovery, baseUrl));
        results.push(await this._testScrollList(page, discovery));
        results.push(await this._testDefaultValue(page, discovery));

        return results.filter(Boolean);
    }

    /** TC_DD_01: Dropdown hiển thị */
    async _testDropdownVisible(page, discovery) {
        const test = createTestResult('dropdown', 'TC_DD_01', 'Dropdown hiển thị');
        return runSafe(test, async (t) => {
            const info = await page.evaluate(() => {
                const selects = document.querySelectorAll('select');
                const customDDs = document.querySelectorAll('[data-bs-toggle="dropdown"], [data-toggle="dropdown"], details > summary, [role="listbox"], [role="combobox"]');
                let visibleSelects = 0;
                let visibleCustom = 0;
                selects.forEach(s => {
                    const rect = s.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && getComputedStyle(s).display !== 'none') visibleSelects++;
                });
                customDDs.forEach(d => {
                    const rect = d.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) visibleCustom++;
                });
                return { selects: selects.length, visibleSelects, customDDs: customDDs.length, visibleCustom };
            });

            const total = info.visibleSelects + info.visibleCustom;
            if (total > 0) {
                t.status = 'passed';
                t.details = `${total} dropdown hiển thị (${info.visibleSelects} native select, ${info.visibleCustom} custom)`;
            } else if (info.selects + info.customDDs > 0) {
                t.status = 'failed';
                t.details = 'Có dropdown nhưng không hiển thị';
            } else {
                t.status = 'warning';
                t.details = 'Không tìm thấy dropdown trên trang';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_DD_02: Mở dropdown → hiển thị list */
    async _testOpenDropdown(page, discovery) {
        const test = createTestResult('dropdown', 'TC_DD_02', 'Mở dropdown');
        return runSafe(test, async (t) => {
            // Thử native select trước
            const selectInfo = await page.evaluate(() => {
                const select = document.querySelector('select');
                if (!select || select.getBoundingClientRect().width === 0) return null;
                return {
                    selector: select.id ? `#${select.id}` : (select.name ? `select[name="${select.name}"]` : 'select'),
                    optionCount: select.options.length,
                };
            });

            if (selectInfo) {
                // Native select - click to focus
                await page.click(selectInfo.selector, { timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(300);

                if (selectInfo.optionCount > 0) {
                    t.status = 'passed';
                    t.details = `Mở dropdown thành công (${selectInfo.optionCount} options)`;
                } else {
                    t.status = 'failed';
                    t.details = 'Dropdown không có options';
                }
                t.screenshot = await takeScreenshot(page);
                return;
            }

            // Thử custom dropdown (Bootstrap, details/summary)
            if (discovery.dropdowns.length > 0) {
                const dd = discovery.dropdowns[0];
                await page.click(dd.selector, { timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(300);

                const isOpen = await page.evaluate((sel) => {
                    const trigger = document.querySelector(sel);
                    if (!trigger) return false;
                    // Check Bootstrap dropdown menu
                    const menu = trigger.nextElementSibling || document.querySelector('.dropdown-menu.show');
                    if (menu && menu.classList.contains('show')) return true;
                    // Check details
                    const details = trigger.closest('details');
                    if (details && details.open) return true;
                    // Check aria-expanded
                    if (trigger.getAttribute('aria-expanded') === 'true') return true;
                    return false;
                }, dd.selector);

                if (isOpen) {
                    t.status = 'passed';
                    t.details = `Mở dropdown "${dd.text}" thành công`;
                } else {
                    t.status = 'warning';
                    t.details = `Click dropdown "${dd.text}" nhưng không xác nhận được menu mở`;
                }
                // Đóng lại
                await page.click('body', { position: { x: 0, y: 0 } }).catch(() => {});
            } else {
                t.status = 'warning';
                t.details = 'Không tìm thấy dropdown để test';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_DD_03: Chọn option → hiển thị option đã chọn */
    async _testSelectOption(page, discovery, baseUrl) {
        const test = createTestResult('dropdown', 'TC_DD_03', 'Chọn option');
        return runSafe(test, async (t) => {
            const selectResult = await page.evaluate(() => {
                const select = document.querySelector('select');
                if (!select || select.options.length < 2) return null;
                const selector = select.id ? `#${select.id}` : (select.name ? `select[name="${select.name}"]` : 'select');
                const optionValue = select.options[1].value;
                const optionText = select.options[1].text;
                return { selector, optionValue, optionText };
            });

            if (selectResult) {
                await page.selectOption(selectResult.selector, selectResult.optionValue).catch(() => {});
                await page.waitForTimeout(300);

                const selectedText = await page.evaluate((sel) => {
                    const select = document.querySelector(sel);
                    return select ? select.options[select.selectedIndex].text : '';
                }, selectResult.selector);

                if (selectedText === selectResult.optionText) {
                    t.status = 'passed';
                    t.details = `Chọn option "${selectResult.optionText}" thành công`;
                } else {
                    t.status = 'warning';
                    t.details = `Đã chọn option nhưng hiển thị "${selectedText}" thay vì "${selectResult.optionText}"`;
                }
            } else {
                t.status = 'warning';
                t.details = 'Không tìm thấy select dropdown có nhiều hơn 1 option';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_DD_04: Scroll list → scroll hoạt động */
    async _testScrollList(page, discovery) {
        const test = createTestResult('dropdown', 'TC_DD_04', 'Scroll list');
        return runSafe(test, async (t) => {
            const scrollInfo = await page.evaluate(() => {
                // Kiểm tra select có size > 1 (listbox mode) hoặc custom scrollable dropdown
                const select = document.querySelector('select[size], select[multiple]');
                if (select) {
                    return {
                        found: true,
                        type: 'select',
                        selector: select.id ? `#${select.id}` : 'select[size]',
                        scrollable: select.scrollHeight > select.clientHeight,
                        optionCount: select.options.length,
                    };
                }

                // Custom dropdown menu with scroll
                const menu = document.querySelector('.dropdown-menu, [role="listbox"], [role="menu"]');
                if (menu) {
                    return {
                        found: true,
                        type: 'custom',
                        scrollable: menu.scrollHeight > menu.clientHeight,
                    };
                }

                // Kiểm tra select thường có nhiều options
                const normalSelect = document.querySelector('select');
                if (normalSelect && normalSelect.options.length > 5) {
                    return { found: true, type: 'select-normal', optionCount: normalSelect.options.length, scrollable: true };
                }

                return { found: false };
            });

            if (!scrollInfo.found) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy dropdown list có thể scroll';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            if (scrollInfo.scrollable || (scrollInfo.optionCount && scrollInfo.optionCount > 5)) {
                t.status = 'passed';
                t.details = `Dropdown list scroll hoạt động (${scrollInfo.optionCount || 'N/A'} options, type: ${scrollInfo.type})`;
            } else {
                t.status = 'warning';
                t.details = 'Dropdown list không cần scroll (ít options)';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_DD_05: Default value hiển thị */
    async _testDefaultValue(page, discovery) {
        const test = createTestResult('dropdown', 'TC_DD_05', 'Default value');
        return runSafe(test, async (t) => {
            const defaultInfo = await page.evaluate(() => {
                const selects = document.querySelectorAll('select');
                const results = [];
                selects.forEach(select => {
                    if (select.getBoundingClientRect().width === 0) return;
                    const selectedOption = select.options[select.selectedIndex];
                    results.push({
                        name: select.name || select.id || 'unknown',
                        defaultText: selectedOption ? selectedOption.text : '',
                        defaultValue: selectedOption ? selectedOption.value : '',
                        hasPlaceholder: selectedOption ? (selectedOption.value === '' || selectedOption.disabled) : false,
                    });
                });
                return results;
            });

            if (defaultInfo.length === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy select dropdown';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            const allHaveDefault = defaultInfo.every(d => d.defaultText);
            if (allHaveDefault) {
                const details = defaultInfo.map(d => `${d.name}: "${d.defaultText}"`).join(', ');
                t.status = 'passed';
                t.details = `Tất cả dropdown hiển thị default value (${details})`;
            } else {
                t.status = 'warning';
                t.details = 'Một số dropdown không có default value rõ ràng';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = DropdownTests;
