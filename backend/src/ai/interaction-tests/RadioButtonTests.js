/**
 * Group 8: Radio Button (3 cases) — theo PDF
 * TC_RAD_01 Radio hiển thị
 * TC_RAD_02 Chọn radio → được chọn
 * TC_RAD_03 Chọn radio khác → radio trước bị bỏ
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class RadioButtonTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testRadioVisible(page));
        results.push(await this._testSelectRadio(page));
        results.push(await this._testSelectOtherRadio(page));

        return results.filter(Boolean);
    }

    /** Tìm tất cả radio buttons */
    async _findRadios(page) {
        return page.evaluate(() => {
            const radios = document.querySelectorAll('input[type="radio"]');
            const results = [];
            radios.forEach((radio, i) => {
                const rect = radio.getBoundingClientRect();
                const style = getComputedStyle(radio);
                if (rect.width > 0 || style.display !== 'none') {
                    const label = radio.labels && radio.labels[0] ? radio.labels[0].textContent.trim().substring(0, 30) : '';
                    results.push({
                        selector: radio.id ? `#${radio.id}` : `input[type="radio"][name="${radio.name}"][value="${radio.value}"]`,
                        label,
                        checked: radio.checked,
                        name: radio.name || '',
                        value: radio.value || '',
                    });
                }
            });
            return results;
        });
    }

    /** TC_RAD_01: Radio hiển thị */
    async _testRadioVisible(page) {
        const test = createTestResult('radioButton', 'TC_RAD_01', 'Radio hiển thị');
        return runSafe(test, async (t) => {
            const radios = await this._findRadios(page);

            if (radios.length > 0) {
                t.status = 'passed';
                t.details = `${radios.length} radio buttons hiển thị: ${radios.map(r => r.label || r.value).filter(Boolean).join(', ') || 'N/A'}`;
            } else {
                t.status = 'warning';
                t.details = 'Không tìm thấy radio button trên trang';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_RAD_02: Chọn radio → được chọn */
    async _testSelectRadio(page) {
        const test = createTestResult('radioButton', 'TC_RAD_02', 'Chọn radio');
        return runSafe(test, async (t) => {
            const radios = await this._findRadios(page);
            if (radios.length === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy radio button để test';
                return;
            }

            const radio = radios[0];
            await page.click(radio.selector, { timeout: 3000 }).catch(async () => {
                await page.evaluate((sel) => {
                    const r = document.querySelector(sel);
                    if (r && r.labels && r.labels[0]) r.labels[0].click();
                    else if (r) r.click();
                }, radio.selector);
            });
            await page.waitForTimeout(200);

            const isChecked = await page.evaluate((sel) => {
                const r = document.querySelector(sel);
                return r ? r.checked : false;
            }, radio.selector);

            if (isChecked) {
                t.status = 'passed';
                t.details = `Radio "${radio.label || radio.value}" được chọn thành công`;
            } else {
                t.status = 'failed';
                t.details = `Click radio "${radio.label || radio.value}" nhưng không được chọn`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_RAD_03: Chọn radio khác → radio trước bị bỏ (mutual exclusion) */
    async _testSelectOtherRadio(page) {
        const test = createTestResult('radioButton', 'TC_RAD_03', 'Chọn radio khác');
        return runSafe(test, async (t) => {
            const radios = await this._findRadios(page);

            // Tìm group có ít nhất 2 radio cùng name
            const groups = {};
            radios.forEach(r => {
                if (r.name) {
                    if (!groups[r.name]) groups[r.name] = [];
                    groups[r.name].push(r);
                }
            });

            const groupWithMultiple = Object.values(groups).find(g => g.length >= 2);

            if (!groupWithMultiple) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy radio group có 2+ options để test mutual exclusion';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            const radio1 = groupWithMultiple[0];
            const radio2 = groupWithMultiple[1];

            // Chọn radio đầu tiên
            await page.click(radio1.selector, { timeout: 3000 }).catch(async () => {
                await page.evaluate((sel) => {
                    const r = document.querySelector(sel);
                    if (r) r.click();
                }, radio1.selector);
            });
            await page.waitForTimeout(200);

            // Chọn radio thứ hai
            await page.click(radio2.selector, { timeout: 3000 }).catch(async () => {
                await page.evaluate((sel) => {
                    const r = document.querySelector(sel);
                    if (r) r.click();
                }, radio2.selector);
            });
            await page.waitForTimeout(200);

            // Kiểm tra radio1 bị bỏ, radio2 được chọn
            const result = await page.evaluate((sel1, sel2) => {
                const r1 = document.querySelector(sel1);
                const r2 = document.querySelector(sel2);
                return {
                    radio1Checked: r1 ? r1.checked : false,
                    radio2Checked: r2 ? r2.checked : false,
                };
            }, radio1.selector, radio2.selector);

            if (!result.radio1Checked && result.radio2Checked) {
                t.status = 'passed';
                t.details = `Chọn "${radio2.label || radio2.value}" → "${radio1.label || radio1.value}" tự động bỏ chọn (mutual exclusion đúng)`;
            } else if (result.radio1Checked && result.radio2Checked) {
                t.status = 'failed';
                t.details = 'Cả 2 radio đều checked (mutual exclusion không hoạt động)';
            } else {
                t.status = 'warning';
                t.details = `Radio 1: ${result.radio1Checked}, Radio 2: ${result.radio2Checked}`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = RadioButtonTests;
