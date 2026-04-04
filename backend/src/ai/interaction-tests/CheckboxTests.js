/**
 * Group 7: Checkbox (4 cases) — theo PDF
 * TC_CB_01 Checkbox hiển thị
 * TC_CB_02 Check checkbox → được chọn
 * TC_CB_03 Uncheck checkbox → bỏ chọn
 * TC_CB_04 Multiple checkbox → cho phép chọn nhiều
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class CheckboxTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testCheckboxVisible(page));
        results.push(await this._testCheckCheckbox(page));
        results.push(await this._testUncheckCheckbox(page));
        results.push(await this._testMultipleCheckbox(page));

        return results.filter(Boolean);
    }

    /** Tìm tất cả checkbox */
    async _findCheckboxes(page) {
        return page.evaluate(() => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            const results = [];
            checkboxes.forEach((cb, i) => {
                const rect = cb.getBoundingClientRect();
                const style = getComputedStyle(cb);
                if (rect.width > 0 || style.display !== 'none') {
                    const label = cb.labels && cb.labels[0] ? cb.labels[0].textContent.trim().substring(0, 30) : '';
                    results.push({
                        selector: cb.id ? `#${cb.id}` : (cb.name ? `input[type="checkbox"][name="${cb.name}"]` : `input[type="checkbox"]:nth-of-type(${i + 1})`),
                        label,
                        checked: cb.checked,
                        name: cb.name || '',
                        id: cb.id || '',
                    });
                }
            });
            return results;
        });
    }

    /** TC_CB_01: Checkbox hiển thị */
    async _testCheckboxVisible(page) {
        const test = createTestResult('checkbox', 'TC_CB_01', 'Checkbox hiển thị');
        return runSafe(test, async (t) => {
            const checkboxes = await this._findCheckboxes(page);

            if (checkboxes.length > 0) {
                t.status = 'passed';
                t.details = `${checkboxes.length} checkbox hiển thị: ${checkboxes.map(c => c.label || c.name).filter(Boolean).join(', ') || 'N/A'}`;
            } else {
                t.status = 'warning';
                t.details = 'Không tìm thấy checkbox trên trang';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_CB_02: Check checkbox → được chọn */
    async _testCheckCheckbox(page) {
        const test = createTestResult('checkbox', 'TC_CB_02', 'Check checkbox');
        return runSafe(test, async (t) => {
            const checkboxes = await this._findCheckboxes(page);
            // Tìm checkbox chưa check
            const unchecked = checkboxes.find(c => !c.checked) || checkboxes[0];

            if (!unchecked) {
                t.status = 'warning';
                t.details = 'Không tìm thấy checkbox để test';
                return;
            }

            // Uncheck trước nếu đang checked
            if (unchecked.checked) {
                await page.evaluate((sel) => {
                    const cb = document.querySelector(sel);
                    if (cb) cb.checked = false;
                }, unchecked.selector);
            }

            // Click để check
            await page.click(unchecked.selector, { timeout: 3000 }).catch(async () => {
                // Fallback: click label
                await page.evaluate((sel) => {
                    const cb = document.querySelector(sel);
                    if (cb && cb.labels && cb.labels[0]) cb.labels[0].click();
                    else if (cb) cb.click();
                }, unchecked.selector);
            });
            await page.waitForTimeout(200);

            const isChecked = await page.evaluate((sel) => {
                const cb = document.querySelector(sel);
                return cb ? cb.checked : false;
            }, unchecked.selector);

            if (isChecked) {
                t.status = 'passed';
                t.details = `Checkbox "${unchecked.label || unchecked.name}" được chọn thành công`;
            } else {
                t.status = 'failed';
                t.details = `Click checkbox "${unchecked.label || unchecked.name}" nhưng không được chọn`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_CB_03: Uncheck checkbox → bỏ chọn */
    async _testUncheckCheckbox(page) {
        const test = createTestResult('checkbox', 'TC_CB_03', 'Uncheck checkbox');
        return runSafe(test, async (t) => {
            const checkboxes = await this._findCheckboxes(page);
            // Tìm checkbox đang checked
            const checked = checkboxes.find(c => c.checked) || checkboxes[0];

            if (!checked) {
                t.status = 'warning';
                t.details = 'Không tìm thấy checkbox để test uncheck';
                return;
            }

            // Check trước nếu chưa checked
            if (!checked.checked) {
                await page.evaluate((sel) => {
                    const cb = document.querySelector(sel);
                    if (cb) cb.checked = true;
                }, checked.selector);
            }

            // Click để uncheck
            await page.click(checked.selector, { timeout: 3000 }).catch(async () => {
                await page.evaluate((sel) => {
                    const cb = document.querySelector(sel);
                    if (cb && cb.labels && cb.labels[0]) cb.labels[0].click();
                    else if (cb) cb.click();
                }, checked.selector);
            });
            await page.waitForTimeout(200);

            const isChecked = await page.evaluate((sel) => {
                const cb = document.querySelector(sel);
                return cb ? cb.checked : true;
            }, checked.selector);

            if (!isChecked) {
                t.status = 'passed';
                t.details = `Checkbox "${checked.label || checked.name}" bỏ chọn thành công`;
            } else {
                t.status = 'failed';
                t.details = `Click lại checkbox "${checked.label || checked.name}" nhưng không bỏ chọn`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_CB_04: Multiple checkbox → cho phép chọn nhiều */
    async _testMultipleCheckbox(page) {
        const test = createTestResult('checkbox', 'TC_CB_04', 'Multiple checkbox');
        return runSafe(test, async (t) => {
            const checkboxes = await this._findCheckboxes(page);

            if (checkboxes.length < 2) {
                t.status = 'skipped';
                t.details = `Chỉ có ${checkboxes.length} checkbox, cần ít nhất 2 để test multiple`;
                t.screenshot = await takeScreenshot(page);
                return;
            }

            // Chọn 2 checkbox đầu tiên
            for (let i = 0; i < Math.min(2, checkboxes.length); i++) {
                const cb = checkboxes[i];
                const isChecked = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    return el ? el.checked : false;
                }, cb.selector);

                if (!isChecked) {
                    await page.click(cb.selector, { timeout: 3000 }).catch(async () => {
                        await page.evaluate((sel) => {
                            const el = document.querySelector(sel);
                            if (el) el.click();
                        }, cb.selector);
                    });
                    await page.waitForTimeout(150);
                }
            }

            // Kiểm tra cả 2 đều checked
            const bothChecked = await page.evaluate((selectors) => {
                return selectors.every(sel => {
                    const cb = document.querySelector(sel);
                    return cb && cb.checked;
                });
            }, checkboxes.slice(0, 2).map(c => c.selector));

            if (bothChecked) {
                t.status = 'passed';
                t.details = 'Cho phép chọn nhiều checkbox cùng lúc';
            } else {
                t.status = 'failed';
                t.details = 'Không thể chọn nhiều checkbox cùng lúc';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = CheckboxTests;
