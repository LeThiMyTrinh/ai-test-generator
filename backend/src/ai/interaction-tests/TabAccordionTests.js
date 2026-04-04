/**
 * Group 13: Tab (3 cases) — theo PDF
 * TC_TAB_01 Tab hiển thị
 * TC_TAB_02 Click tab → hiển thị content
 * TC_TAB_03 Active tab → highlight
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class TabTests {
    async run(page, discovery, baseUrl) {
        const results = [];

        results.push(await this._testTabVisible(page));
        results.push(await this._testClickTab(page));
        results.push(await this._testActiveTab(page));

        return results.filter(Boolean);
    }

    /** TC_TAB_01: Tab hiển thị */
    async _testTabVisible(page) {
        const test = createTestResult('tab', 'TC_TAB_01', 'Tab hiển thị');
        return runSafe(test, async (t) => {
            const tabInfo = await page.evaluate(() => {
                const tabSelectors = [
                    '[role="tablist"]', '.nav-tabs', '.tabs', '.tab-list',
                    '[data-bs-toggle="tab"]', '[data-toggle="tab"]',
                    '[role="tab"]',
                ];
                let tabList = null;
                let tabs = [];
                for (const sel of tabSelectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        tabList = el;
                        break;
                    }
                }

                if (!tabList) {
                    // Tìm tabs bằng role
                    const roleTabs = document.querySelectorAll('[role="tab"]');
                    if (roleTabs.length > 0) {
                        roleTabs.forEach(tab => {
                            const rect = tab.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) {
                                tabs.push({ text: tab.textContent.trim().substring(0, 30), visible: true });
                            }
                        });
                    }
                } else {
                    const tabItems = tabList.querySelectorAll('[role="tab"], .nav-link, .tab-item, a, button');
                    tabItems.forEach(tab => {
                        const rect = tab.getBoundingClientRect();
                        tabs.push({
                            text: tab.textContent.trim().substring(0, 30),
                            visible: rect.width > 0 && rect.height > 0,
                        });
                    });
                }

                return { found: tabs.length > 0, tabs, count: tabs.length };
            });

            if (tabInfo.found) {
                const visibleTabs = tabInfo.tabs.filter(t => t.visible);
                t.status = 'passed';
                t.details = `${visibleTabs.length} tabs hiển thị: ${visibleTabs.map(t => t.text).join(', ')}`;
            } else {
                t.status = 'warning';
                t.details = 'Không tìm thấy tab component trên trang';
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_TAB_02: Click tab → hiển thị content */
    async _testClickTab(page) {
        const test = createTestResult('tab', 'TC_TAB_02', 'Click tab → hiển thị content');
        return runSafe(test, async (t) => {
            // Tìm tab thứ 2 (non-active) để click
            const tabToClick = await page.evaluate(() => {
                const tabs = document.querySelectorAll('[role="tab"], [data-bs-toggle="tab"], [data-toggle="tab"], .nav-tabs .nav-link, .tabs .tab-item');
                for (const tab of tabs) {
                    const isActive = tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true';
                    const rect = tab.getBoundingClientRect();
                    if (!isActive && rect.width > 0 && rect.height > 0) {
                        return {
                            selector: tab.id ? `#${tab.id}` : `[role="tab"]:not(.active)`,
                            text: tab.textContent.trim().substring(0, 30),
                            target: tab.getAttribute('data-bs-target') || tab.getAttribute('data-target') || tab.getAttribute('href') || tab.getAttribute('aria-controls'),
                        };
                    }
                }
                return null;
            });

            if (!tabToClick) {
                t.status = 'warning';
                t.details = 'Không tìm thấy tab non-active để click';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            await page.click(tabToClick.selector, { timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);

            // Kiểm tra content panel hiển thị
            const contentVisible = await page.evaluate((target) => {
                if (!target) return { visible: false };
                // Xử lý #id hoặc id trực tiếp
                const panelSel = target.startsWith('#') ? target : `#${target}`;
                const panel = document.querySelector(panelSel) || document.querySelector('[role="tabpanel"].active, [role="tabpanel"].show, .tab-pane.active');
                if (!panel) return { visible: false };
                const rect = panel.getBoundingClientRect();
                return { visible: rect.height > 0, hasContent: panel.textContent.trim().length > 0 };
            }, tabToClick.target);

            if (contentVisible.visible) {
                t.status = 'passed';
                t.details = `Click tab "${tabToClick.text}" hiển thị content thành công`;
            } else {
                t.status = 'warning';
                t.details = `Click tab "${tabToClick.text}" nhưng không xác nhận được content panel`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }

    /** TC_TAB_03: Active tab highlight */
    async _testActiveTab(page) {
        const test = createTestResult('tab', 'TC_TAB_03', 'Active tab highlight');
        return runSafe(test, async (t) => {
            const activeInfo = await page.evaluate(() => {
                const tabs = document.querySelectorAll('[role="tab"], [data-bs-toggle="tab"], [data-toggle="tab"], .nav-tabs .nav-link');
                let activeTab = null;
                let otherTab = null;

                for (const tab of tabs) {
                    const isActive = tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true';
                    const rect = tab.getBoundingClientRect();
                    if (rect.width === 0) continue;

                    const style = getComputedStyle(tab);
                    const info = {
                        text: tab.textContent.trim().substring(0, 30),
                        bg: style.backgroundColor,
                        color: style.color,
                        fontWeight: style.fontWeight,
                        borderBottom: style.borderBottomColor,
                    };

                    if (isActive) activeTab = info;
                    else if (!otherTab) otherTab = info;
                }

                return { activeTab, otherTab };
            });

            if (!activeInfo.activeTab) {
                t.status = 'warning';
                t.details = 'Không tìm thấy active tab';
                t.screenshot = await takeScreenshot(page);
                return;
            }

            if (activeInfo.otherTab) {
                const hasDiff = activeInfo.activeTab.bg !== activeInfo.otherTab.bg ||
                    activeInfo.activeTab.color !== activeInfo.otherTab.color ||
                    activeInfo.activeTab.fontWeight !== activeInfo.otherTab.fontWeight ||
                    activeInfo.activeTab.borderBottom !== activeInfo.otherTab.borderBottom;

                if (hasDiff) {
                    t.status = 'passed';
                    t.details = `Active tab "${activeInfo.activeTab.text}" có highlight khác biệt so với tab khác`;
                } else {
                    t.status = 'warning';
                    t.details = `Active tab "${activeInfo.activeTab.text}" không có sự khác biệt visual rõ ràng`;
                }
            } else {
                t.status = 'passed';
                t.details = `Tab "${activeInfo.activeTab.text}" có class active/aria-selected`;
            }
            t.screenshot = await takeScreenshot(page);
        });
    }
}

module.exports = TabTests;
