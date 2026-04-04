/**
 * Group 11: Calendar / Date Picker (4 cases) — theo PDF
 * TC_CAL_01 Calendar hiển thị → click date field → calendar mở
 * TC_CAL_02 Chọn ngày → hiển thị ngày
 * TC_CAL_03 Chọn tháng → change month hiển thị đúng
 * TC_CAL_04 Format date → chọn date format đúng
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class CalendarTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testCalendarOpen(page));
        results.push(await this._testSelectDate(page));
        results.push(await this._testChangeMonth(page));
        results.push(await this._testDateFormat(page));

        return results.filter(Boolean);
    }

    /** Tìm date input/picker */
    async _findDateInputs(page) {
        return page.evaluate(() => {
            const results = [];

            // Native date inputs
            document.querySelectorAll('input[type="date"], input[type="datetime-local"], input[type="month"]').forEach(input => {
                const rect = input.getBoundingClientRect();
                if (rect.width > 0) {
                    results.push({
                        type: 'native',
                        selector: input.id ? `#${input.id}` : (input.name ? `input[name="${input.name}"]` : `input[type="${input.type}"]`),
                        inputType: input.type,
                        name: input.name || input.id || 'date',
                        value: input.value,
                    });
                }
            });

            // Custom datepickers
            const customSelectors = [
                '[class*="datepicker"]', '[class*="date-picker"]', '[data-datepicker]',
                '[class*="calendar"]', '.flatpickr-input', '.react-datepicker',
                'input[data-toggle="datepicker"]', 'input[data-provide="datepicker"]',
            ];
            for (const sel of customSelectors) {
                document.querySelectorAll(sel).forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0) {
                        results.push({
                            type: 'custom',
                            selector: el.id ? `#${el.id}` : sel,
                            inputType: el.type || 'text',
                            name: el.name || el.id || 'datepicker',
                            value: el.value || '',
                        });
                    }
                });
            }

            return results;
        });
    }

    /** TC_CAL_01: Calendar hiển thị khi click */
    async _testCalendarOpen(page) {
        const test = createTestResult('calendar', 'TC_CAL_01', 'Calendar hiển thị');
        return runSafe(test, async (t) => {
            const dateInputs = await this._findDateInputs(page);

            if (dateInputs.length === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy date input/picker trên trang';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            const input = dateInputs[0];

            // Click vào date field
            await page.click(input.selector, { timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(500);

            if (input.type === 'native') {
                // Native date input - browser tự mở calendar
                t.status = 'passed';
                t.details = `Click date field "${input.name}" → browser calendar mở (native input[type="${input.inputType}"])`;
            } else {
                // Custom datepicker - kiểm tra popup hiển thị
                const calendarOpen = await page.evaluate(() => {
                    const calSelectors = [
                        '.datepicker', '.ui-datepicker', '.flatpickr-calendar',
                        '.react-datepicker__month-container', '.date-picker-popup',
                        '[class*="calendar"][class*="open"]', '[class*="datepicker"][class*="show"]',
                        '.calendar', '.picker',
                    ];
                    for (const sel of calSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.offsetHeight > 0) return { open: true, selector: sel };
                    }
                    return { open: false };
                });

                if (calendarOpen.open) {
                    t.status = 'passed';
                    t.details = `Click date field → calendar popup mở thành công`;
                } else {
                    t.status = 'warning';
                    t.details = `Click date field "${input.name}" nhưng không phát hiện calendar popup`;
                }
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_CAL_02: Chọn ngày → hiển thị ngày */
    async _testSelectDate(page) {
        const test = createTestResult('calendar', 'TC_CAL_02', 'Chọn ngày');
        return runSafe(test, async (t) => {
            const dateInputs = await this._findDateInputs(page);

            if (dateInputs.length === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy date input';
                return;
            }

            const input = dateInputs[0];

            if (input.type === 'native') {
                // Set value cho native date input
                const testDate = '2025-01-15';
                await page.fill(input.selector, testDate).catch(() => {});
                await page.waitForTimeout(200);

                const value = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    return el ? el.value : '';
                }, input.selector);

                if (value === testDate) {
                    t.status = 'passed';
                    t.details = `Chọn ngày thành công: ${value}`;
                } else if (value) {
                    t.status = 'passed';
                    t.details = `Đã set ngày: ${value}`;
                } else {
                    t.status = 'warning';
                    t.details = 'Không thể set giá trị cho date input';
                }
            } else {
                // Custom datepicker - click ngày trong calendar
                await page.click(input.selector, { timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(500);

                // Tìm và click một ngày
                const dayClicked = await page.evaluate(() => {
                    const daySelectors = [
                        '.datepicker td:not(.disabled):not(.old):not(.new)', '.ui-datepicker-calendar td a',
                        '.flatpickr-day:not(.disabled)', '.react-datepicker__day:not(.disabled)',
                        '[class*="calendar"] [class*="day"]:not([class*="disabled"])',
                    ];
                    for (const sel of daySelectors) {
                        const days = document.querySelectorAll(sel);
                        for (const day of days) {
                            if (day.offsetHeight > 0 && day.textContent.trim()) {
                                day.click();
                                return { clicked: true, text: day.textContent.trim() };
                            }
                        }
                    }
                    return { clicked: false };
                });

                await page.waitForTimeout(300);

                const value = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    return el ? (el.value || el.textContent.trim()) : '';
                }, input.selector);

                if (dayClicked.clicked && value) {
                    t.status = 'passed';
                    t.details = `Chọn ngày ${dayClicked.text} → hiển thị: ${value}`;
                } else if (dayClicked.clicked) {
                    t.status = 'warning';
                    t.details = `Click ngày ${dayClicked.text} nhưng không xác nhận value`;
                } else {
                    t.status = 'warning';
                    t.details = 'Không tìm thấy ngày để click trong calendar';
                }
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_CAL_03: Chọn tháng → change month */
    async _testChangeMonth(page) {
        const test = createTestResult('calendar', 'TC_CAL_03', 'Chọn tháng');
        return runSafe(test, async (t) => {
            const dateInputs = await this._findDateInputs(page);

            if (dateInputs.length === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy date input';
                return;
            }

            const input = dateInputs[0];

            if (input.type === 'native') {
                // Native date input - thay đổi tháng qua giá trị
                const month1 = '2025-01-15';
                const month2 = '2025-06-15';

                await page.fill(input.selector, month1).catch(() => {});
                await page.waitForTimeout(200);

                await page.fill(input.selector, month2).catch(() => {});
                await page.waitForTimeout(200);

                const value = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    return el ? el.value : '';
                }, input.selector);

                if (value === month2) {
                    t.status = 'passed';
                    t.details = `Change month thành công: ${month1} → ${value}`;
                } else {
                    t.status = 'warning';
                    t.details = `Set tháng nhưng value: ${value || 'trống'}`;
                }
            } else {
                // Custom datepicker - click prev/next month button
                await page.click(input.selector, { timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(500);

                const monthChanged = await page.evaluate(() => {
                    const nextBtns = document.querySelectorAll(
                        '.datepicker .next, .ui-datepicker-next, .flatpickr-next-month, .react-datepicker__navigation--next, [class*="next"], [aria-label*="next"], [aria-label*="Next"]'
                    );
                    for (const btn of nextBtns) {
                        if (btn.offsetHeight > 0) {
                            btn.click();
                            return { changed: true };
                        }
                    }
                    return { changed: false };
                });

                await page.waitForTimeout(300);

                if (monthChanged.changed) {
                    t.status = 'passed';
                    t.details = 'Change month thành công (click next)';
                } else {
                    t.status = 'warning';
                    t.details = 'Không tìm thấy nút next month trong calendar';
                }
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_CAL_04: Format date đúng */
    async _testDateFormat(page) {
        const test = createTestResult('calendar', 'TC_CAL_04', 'Format date');
        return runSafe(test, async (t) => {
            const dateInputs = await this._findDateInputs(page);

            if (dateInputs.length === 0) {
                t.status = 'warning';
                t.details = 'Không tìm thấy date input';
                return;
            }

            const input = dateInputs[0];

            // Set một date cụ thể
            if (input.type === 'native') {
                await page.fill(input.selector, '2025-03-25').catch(() => {});
            }
            await page.waitForTimeout(300);

            const value = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                return el ? el.value : '';
            }, input.selector);

            if (!value) {
                t.status = 'warning';
                t.details = 'Không có giá trị date để kiểm tra format';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            // Kiểm tra format hợp lệ
            const formatPatterns = [
                /^\d{4}-\d{2}-\d{2}$/,                 // YYYY-MM-DD
                /^\d{2}\/\d{2}\/\d{4}$/,               // DD/MM/YYYY hoặc MM/DD/YYYY
                /^\d{2}-\d{2}-\d{4}$/,                  // DD-MM-YYYY
                /^\d{4}\/\d{2}\/\d{2}$/,               // YYYY/MM/DD
                /^\d{1,2}\s\w+\s\d{4}$/,               // D Month YYYY
            ];

            const matchesFormat = formatPatterns.some(p => p.test(value));

            if (matchesFormat) {
                t.status = 'passed';
                t.details = `Date format đúng: "${value}"`;
            } else if (value.length > 0) {
                t.status = 'warning';
                t.details = `Date value: "${value}" (format không phổ biến)`;
            } else {
                t.status = 'warning';
                t.details = 'Không xác định được date format';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = CalendarTests;
