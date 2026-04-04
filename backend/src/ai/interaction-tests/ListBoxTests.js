/**
 * Group 10: List Box (3 cases) — theo PDF
 * TC_LIST_01 List hiển thị
 * TC_LIST_02 Chọn item → item được chọn
 * TC_LIST_03 Multi select → cho phép multi select
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class ListBoxTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testListVisible(page));
        results.push(await this._testSelectItem(page));
        results.push(await this._testMultiSelect(page));

        return results.filter(Boolean);
    }

    /** Tìm listbox elements */
    async _findListBoxes(page) {
        return page.evaluate(() => {
            const results = [];

            // Native select[size] hoặc select[multiple] = listbox mode
            document.querySelectorAll('select[size], select[multiple]').forEach(select => {
                const rect = select.getBoundingClientRect();
                if (rect.width > 0) {
                    results.push({
                        type: 'native',
                        selector: select.id ? `#${select.id}` : (select.name ? `select[name="${select.name}"]` : 'select[size]'),
                        multiple: select.multiple,
                        optionCount: select.options.length,
                        name: select.name || select.id || 'listbox',
                    });
                }
            });

            // Custom listbox (role="listbox")
            document.querySelectorAll('[role="listbox"]').forEach(list => {
                const rect = list.getBoundingClientRect();
                if (rect.width > 0) {
                    const items = list.querySelectorAll('[role="option"], li');
                    results.push({
                        type: 'custom',
                        selector: list.id ? `#${list.id}` : '[role="listbox"]',
                        multiple: list.getAttribute('aria-multiselectable') === 'true',
                        optionCount: items.length,
                        name: list.getAttribute('aria-label') || 'custom listbox',
                    });
                }
            });

            // Fallback: regular select with many options
            if (results.length === 0) {
                document.querySelectorAll('select').forEach(select => {
                    const rect = select.getBoundingClientRect();
                    if (rect.width > 0 && select.options.length > 1) {
                        results.push({
                            type: 'select',
                            selector: select.id ? `#${select.id}` : (select.name ? `select[name="${select.name}"]` : 'select'),
                            multiple: select.multiple,
                            optionCount: select.options.length,
                            name: select.name || select.id || 'select',
                        });
                    }
                });
            }

            return results;
        });
    }

    /** TC_LIST_01: List hiển thị */
    async _testListVisible(page) {
        const test = createTestResult('listBox', 'TC_LIST_01', 'List hiển thị');
        return runSafe(test, async (t) => {
            const listBoxes = await this._findListBoxes(page);

            if (listBoxes.length > 0) {
                const details = listBoxes.map(l => `${l.name} (${l.optionCount} items, ${l.type})`).join(', ');
                t.status = 'passed';
                t.details = `${listBoxes.length} list hiển thị: ${details}`;
            } else {
                t.status = 'warning';
                t.details = 'Không tìm thấy listbox trên trang';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_LIST_02: Chọn item → item được chọn */
    async _testSelectItem(page) {
        const test = createTestResult('listBox', 'TC_LIST_02', 'Chọn item');
        return runSafe(test, async (t) => {
            const listBoxes = await this._findListBoxes(page);
            const lb = listBoxes[0];

            if (!lb || lb.optionCount < 2) {
                t.status = 'warning';
                t.details = 'Không tìm thấy listbox có đủ options để test';
                return;
            }

            if (lb.type === 'native' || lb.type === 'select') {
                // Native select
                const optionValue = await page.evaluate((sel) => {
                    const select = document.querySelector(sel);
                    return select && select.options[1] ? select.options[1].value : null;
                }, lb.selector);

                if (!optionValue) {
                    t.status = 'warning';
                    t.details = 'Không thể lấy option value';
                    t.screenshot = await takeScreenshot(page);
                    return;
                }

                await page.selectOption(lb.selector, optionValue).catch(() => {});
                await page.waitForTimeout(200);

                const isSelected = await page.evaluate((sel, val) => {
                    const select = document.querySelector(sel);
                    if (!select) return false;
                    return [...select.selectedOptions].some(o => o.value === val);
                }, lb.selector, optionValue);

                if (isSelected) {
                    t.status = 'passed';
                    t.details = `Chọn item trong "${lb.name}" thành công`;
                } else {
                    t.status = 'failed';
                    t.details = 'Chọn item nhưng không được select';
                }
            } else {
                // Custom listbox - click option
                await page.evaluate((sel) => {
                    const list = document.querySelector(sel);
                    const items = list.querySelectorAll('[role="option"], li');
                    if (items[0]) items[0].click();
                }, lb.selector);
                await page.waitForTimeout(200);

                t.status = 'passed';
                t.details = `Click item trong custom listbox "${lb.name}"`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_LIST_03: Multi select → cho phép multi select */
    async _testMultiSelect(page) {
        const test = createTestResult('listBox', 'TC_LIST_03', 'Multi select');
        return runSafe(test, async (t) => {
            const listBoxes = await this._findListBoxes(page);
            const multiLb = listBoxes.find(l => l.multiple);

            if (!multiLb) {
                // Kiểm tra có select[multiple] nào không
                const hasMultiple = await page.evaluate(() => {
                    return !!document.querySelector('select[multiple]');
                });

                if (!hasMultiple) {
                    t.status = 'skipped';
                    t.details = 'Không tìm thấy listbox multi-select trên trang';
                    t.screenshot = await takeScreenshot(page);
                    return;
                }
            }

            const lb = multiLb || listBoxes[0];
            if (!lb || lb.optionCount < 2) {
                t.status = 'skipped';
                t.details = 'Listbox không đủ options để test multi-select';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            if (lb.type === 'native' || lb.type === 'select') {
                // Chọn 2 options
                const options = await page.evaluate((sel) => {
                    const select = document.querySelector(sel);
                    if (!select) return [];
                    return [...select.options].slice(0, 2).map(o => o.value);
                }, lb.selector);

                if (options.length >= 2) {
                    await page.selectOption(lb.selector, options).catch(() => {});
                    await page.waitForTimeout(200);

                    const selectedCount = await page.evaluate((sel) => {
                        const select = document.querySelector(sel);
                        return select ? select.selectedOptions.length : 0;
                    }, lb.selector);

                    if (selectedCount >= 2) {
                        t.status = 'passed';
                        t.details = `Multi-select hoạt động: ${selectedCount} items được chọn`;
                    } else if (lb.multiple) {
                        t.status = 'warning';
                        t.details = `Listbox có attribute multiple nhưng chỉ select được ${selectedCount} items`;
                    } else {
                        t.status = 'warning';
                        t.details = 'Listbox không hỗ trợ multi-select (không có attribute multiple)';
                    }
                }
            } else {
                t.status = 'warning';
                t.details = `Custom listbox "${lb.name}" - multiselectable: ${lb.multiple}`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = ListBoxTests;
