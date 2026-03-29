/**
 * Group 10: Tab & Accordion Tests (6 cases)
 * 10.1 Tab click switch
 * 10.2 Active tab state (visual)
 * 10.3 Tab keyboard navigation (ArrowLeft/Right)
 * 10.4 Accordion expand
 * 10.5 Accordion collapse
 * 10.6 Accordion ARIA (aria-expanded)
 */

const { createTestResult, runSafe, takeScreenshot } = require('./testHelpers');

class TabAccordionTests {
    /**
     * Run all tab & accordion tests
     */
    async run(page, discovery, baseUrl) {
        const results = [];

        // Discover tabs and accordions
        const elements = await this._discoverTabsAccordions(page);

        // Tab tests (10.1 - 10.3)
        if (elements.tabs.length > 0) {
            results.push(await this._testTabClickSwitch(page, elements.tabs));
            results.push(await this._testActiveTabState(page, elements.tabs));
            results.push(await this._testTabKeyboardNav(page, elements.tabs));
        } else {
            results.push(createTestResult('tab_accordion', '10.1', 'Tab click switch', {
                status: 'skipped', details: 'Không tìm thấy tab components trên trang',
            }));
        }

        // Accordion tests (10.4 - 10.6)
        if (elements.accordions.length > 0) {
            results.push(await this._testAccordionExpand(page, elements.accordions));
            results.push(await this._testAccordionCollapse(page, elements.accordions));
            results.push(await this._testAccordionAria(page, elements.accordions));
        } else {
            results.push(createTestResult('tab_accordion', '10.4', 'Accordion expand', {
                status: 'skipped', details: 'Không tìm thấy accordion components trên trang',
            }));
        }

        return results;
    }

    /**
     * Discover tab and accordion elements
     */
    async _discoverTabsAccordions(page) {
        return page.evaluate(() => {
            const tabs = [];
            const accordions = [];

            // Bootstrap / generic tabs
            const tabSelectors = [
                '.nav-tabs .nav-link',
                '.nav-pills .nav-link',
                '[role="tablist"] [role="tab"]',
                '.tabs .tab',
                '.tab-nav a',
                '.tab-nav button',
                '[data-toggle="tab"]',
                '[data-bs-toggle="tab"]',
            ];

            for (const sel of tabSelectors) {
                const found = document.querySelectorAll(sel);
                if (found.length >= 2) {
                    found.forEach(tab => {
                        const rect = tab.getBoundingClientRect();
                        if (rect.width === 0) return;
                        tabs.push({
                            text: tab.textContent.trim().substring(0, 40),
                            selector: tab.id ? `#${tab.id}` : null,
                            target: tab.getAttribute('data-bs-target') || tab.getAttribute('data-target') || tab.getAttribute('href') || '',
                            isActive: tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true',
                            role: tab.getAttribute('role'),
                            ariaSelected: tab.getAttribute('aria-selected'),
                        });
                    });
                    break; // Use first matching tab group
                }
            }

            // Accordion selectors
            const accSelectors = [
                '.accordion-button',
                '.accordion-header button',
                '[data-toggle="collapse"]',
                '[data-bs-toggle="collapse"]',
                'details > summary',
                '.collapse-trigger',
                '.panel-heading [data-toggle]',
            ];

            for (const sel of accSelectors) {
                document.querySelectorAll(sel).forEach(header => {
                    const rect = header.getBoundingClientRect();
                    if (rect.width === 0) return;

                    const target = header.getAttribute('data-bs-target') || header.getAttribute('data-target') || header.getAttribute('href') || '';
                    const isExpanded = header.getAttribute('aria-expanded') === 'true' ||
                        header.closest('details')?.hasAttribute('open') ||
                        !header.classList.contains('collapsed');

                    accordions.push({
                        text: header.textContent.trim().substring(0, 50),
                        selector: header.id ? `#${header.id}` : null,
                        target,
                        isExpanded,
                        hasAriaExpanded: header.hasAttribute('aria-expanded'),
                        tag: header.tagName.toLowerCase(),
                        isDetails: header.tagName === 'SUMMARY',
                    });
                });
            }

            // Generate CSS selectors for items without IDs
            tabs.forEach((tab, i) => {
                if (!tab.selector) {
                    tab.selector = `[role="tab"]:nth-child(${i + 1})`;
                }
            });
            accordions.forEach((acc, i) => {
                if (!acc.selector) {
                    if (acc.isDetails) {
                        acc.selector = `details:nth-of-type(${i + 1}) > summary`;
                    } else {
                        acc.selector = `.accordion-button:nth-of-type(${i + 1})`;
                    }
                }
            });

            return {
                tabs: tabs.slice(0, 10),
                accordions: accordions.slice(0, 10),
            };
        });
    }

    /**
     * 10.1: Tab click switch — click tab should change content
     */
    async _testTabClickSwitch(page, tabs) {
        const test = createTestResult('tab_accordion', '10.1', 'Tab click switch');
        return runSafe(test, async (t) => {
            // Find a non-active tab to click
            const inactiveTab = tabs.find(tab => !tab.isActive);
            if (!inactiveTab) {
                t.status = 'skipped';
                t.details = 'Tất cả tabs đều active — không có inactive tab để test';
                return;
            }

            const el = await page.$(inactiveTab.selector).catch(() => null);
            if (!el) {
                t.status = 'skipped';
                t.details = `Tab "${inactiveTab.text}" không tìm thấy trong DOM`;
                return;
            }

            // Record content before click
            const beforeContent = await page.evaluate((targetSel) => {
                if (!targetSel) return null;
                const panel = document.querySelector(targetSel);
                return panel ? panel.textContent.trim().substring(0, 100) : null;
            }, inactiveTab.target);

            await el.click();
            await page.waitForTimeout(150);

            // Check if tab became active
            const afterClick = await page.evaluate((sel, targetSel) => {
                const tab = document.querySelector(sel);
                if (!tab) return null;
                const isActive = tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true';

                let contentChanged = false;
                if (targetSel) {
                    const panel = document.querySelector(targetSel);
                    if (panel) {
                        const style = getComputedStyle(panel);
                        contentChanged = style.display !== 'none' && style.visibility !== 'hidden';
                    }
                }

                return { isActive, contentChanged };
            }, inactiveTab.selector, inactiveTab.target);

            if (afterClick && afterClick.isActive) {
                t.status = 'passed';
                t.details = `Click tab "${inactiveTab.text}" → became active ✓. ${afterClick.contentChanged ? 'Content panel visible ✓' : ''}`;
            } else if (afterClick && afterClick.contentChanged) {
                t.status = 'passed';
                t.details = `Content changed sau click tab "${inactiveTab.text}" ✓ (tab active state không rõ ràng)`;
            } else {
                t.status = 'failed';
                t.details = `Click tab "${inactiveTab.text}" nhưng tab không active và content không thay đổi`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 10.2: Active tab state — active tab should have different visual style
     */
    async _testActiveTabState(page, tabs) {
        const test = createTestResult('tab_accordion', '10.2', 'Active tab visual state');
        return runSafe(test, async (t) => {
            const activeTab = tabs.find(tab => tab.isActive);
            const inactiveTab = tabs.find(tab => !tab.isActive);

            if (!activeTab || !inactiveTab) {
                t.status = 'skipped';
                t.details = 'Cần cả active và inactive tab để so sánh style';
                return;
            }

            const styles = await page.evaluate((activeSel, inactiveSel) => {
                const a = document.querySelector(activeSel);
                const i = document.querySelector(inactiveSel);
                if (!a || !i) return null;

                const as = getComputedStyle(a);
                const is_ = getComputedStyle(i);

                return {
                    active: {
                        bg: as.backgroundColor,
                        color: as.color,
                        borderBottom: as.borderBottomColor,
                        fontWeight: as.fontWeight,
                    },
                    inactive: {
                        bg: is_.backgroundColor,
                        color: is_.color,
                        borderBottom: is_.borderBottomColor,
                        fontWeight: is_.fontWeight,
                    },
                };
            }, activeTab.selector, inactiveTab.selector);

            if (!styles) {
                t.status = 'skipped';
                t.details = 'Không đọc được styles';
                return;
            }

            const diffs = [];
            if (styles.active.bg !== styles.inactive.bg) diffs.push('background');
            if (styles.active.color !== styles.inactive.color) diffs.push('color');
            if (styles.active.borderBottom !== styles.inactive.borderBottom) diffs.push('border');
            if (styles.active.fontWeight !== styles.inactive.fontWeight) diffs.push('font-weight');

            if (diffs.length > 0) {
                t.status = 'passed';
                t.details = `Active tab có style khác: ${diffs.join(', ')} ✓`;
            } else {
                t.status = 'failed';
                t.details = 'Active tab và inactive tab có cùng visual style — user không phân biệt được';
            }
        });
    }

    /**
     * 10.3: Tab keyboard navigation — ArrowLeft/Right should switch tabs
     */
    async _testTabKeyboardNav(page, tabs) {
        const test = createTestResult('tab_accordion', '10.3', 'Tab keyboard navigation');
        return runSafe(test, async (t) => {
            if (tabs.length < 2) {
                t.status = 'skipped';
                t.details = 'Cần ít nhất 2 tabs để test keyboard nav';
                return;
            }

            // Focus first tab
            const firstTab = await page.$(tabs[0].selector).catch(() => null);
            if (!firstTab) {
                t.status = 'skipped';
                t.details = 'Tab element không tìm thấy';
                return;
            }

            await firstTab.focus();
            await page.waitForTimeout(100);

            // Press ArrowRight
            await page.keyboard.press('ArrowRight');
            await page.waitForTimeout(100);

            const afterRight = await page.evaluate(() => {
                const active = document.activeElement;
                return {
                    tag: active?.tagName,
                    text: active?.textContent?.trim().substring(0, 40),
                    role: active?.getAttribute('role'),
                    isTab: active?.getAttribute('role') === 'tab' || active?.closest('[role="tablist"]') !== null,
                };
            });

            // Press ArrowLeft
            await page.keyboard.press('ArrowLeft');
            await page.waitForTimeout(100);

            const afterLeft = await page.evaluate(() => {
                const active = document.activeElement;
                return {
                    text: active?.textContent?.trim().substring(0, 40),
                    isTab: active?.getAttribute('role') === 'tab' || active?.closest('[role="tablist"]') !== null,
                };
            });

            if (afterRight.isTab && afterLeft.isTab) {
                t.status = 'passed';
                t.details = `ArrowRight → "${afterRight.text}", ArrowLeft → "${afterLeft.text}" ✓`;
            } else if (afterRight.isTab || afterLeft.isTab) {
                t.status = 'warning';
                t.details = `Keyboard nav một phần: Right=${afterRight.isTab ? '✓' : '✗'} ("${afterRight.text}"), Left=${afterLeft.isTab ? '✓' : '✗'} ("${afterLeft.text}")`;
            } else {
                t.status = 'failed';
                t.details = `Arrow keys không navigate giữa tabs. Focus sau ArrowRight: ${afterRight.tag} "${afterRight.text}"`;
            }
        });
    }

    /**
     * 10.4: Accordion expand — click header should show content
     */
    async _testAccordionExpand(page, accordions) {
        const test = createTestResult('tab_accordion', '10.4', 'Accordion expand');
        return runSafe(test, async (t) => {
            // Find a collapsed accordion
            const collapsed = accordions.find(a => !a.isExpanded);
            if (!collapsed) {
                t.status = 'skipped';
                t.details = 'Tất cả accordions đều đang expanded';
                return;
            }

            const header = await page.$(collapsed.selector).catch(() => null);
            if (!header) {
                t.status = 'skipped';
                t.details = `Accordion header "${collapsed.text}" không tìm thấy`;
                return;
            }

            await header.click();
            await page.waitForTimeout(150);

            // Check if content expanded
            const afterClick = await page.evaluate((sel, targetSel, isDetails) => {
                const h = document.querySelector(sel);
                if (!h) return null;

                if (isDetails) {
                    const details = h.closest('details');
                    return { expanded: details ? details.hasAttribute('open') : false };
                }

                const ariaExpanded = h.getAttribute('aria-expanded');
                let contentVisible = false;
                if (targetSel) {
                    const panel = document.querySelector(targetSel);
                    if (panel) {
                        const s = getComputedStyle(panel);
                        contentVisible = s.display !== 'none' && s.visibility !== 'hidden' && panel.offsetHeight > 0;
                    }
                }

                return {
                    expanded: ariaExpanded === 'true' || contentVisible,
                    ariaExpanded,
                    contentVisible,
                };
            }, collapsed.selector, collapsed.target, collapsed.isDetails);

            if (afterClick && afterClick.expanded) {
                t.status = 'passed';
                t.details = `Accordion "${collapsed.text}" expanded thành công ✓`;
            } else {
                t.status = 'failed';
                t.details = `Click accordion "${collapsed.text}" nhưng content không mở. aria-expanded=${afterClick?.ariaExpanded}`;
            }

            t.screenshot = await takeScreenshot(page);
        });
    }

    /**
     * 10.5: Accordion collapse — click again should hide content
     */
    async _testAccordionCollapse(page, accordions) {
        const test = createTestResult('tab_accordion', '10.5', 'Accordion collapse');
        return runSafe(test, async (t) => {
            // Find an expanded accordion (might be from our previous test)
            const expanded = await page.evaluate((accList) => {
                for (const acc of accList) {
                    const h = document.querySelector(acc.selector);
                    if (!h) continue;

                    if (acc.isDetails) {
                        const details = h.closest('details');
                        if (details && details.hasAttribute('open')) return acc;
                    } else {
                        if (h.getAttribute('aria-expanded') === 'true' || !h.classList.contains('collapsed')) return acc;
                    }
                }
                return null;
            }, accordions);

            if (!expanded) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy expanded accordion để test collapse';
                return;
            }

            const header = await page.$(expanded.selector).catch(() => null);
            if (!header) {
                t.status = 'skipped';
                t.details = 'Header không tìm thấy';
                return;
            }

            await header.click();
            await page.waitForTimeout(150);

            const afterCollapse = await page.evaluate((sel, isDetails) => {
                const h = document.querySelector(sel);
                if (!h) return null;

                if (isDetails) {
                    const details = h.closest('details');
                    return { collapsed: details ? !details.hasAttribute('open') : true };
                }

                return {
                    collapsed: h.getAttribute('aria-expanded') === 'false' || h.classList.contains('collapsed'),
                    ariaExpanded: h.getAttribute('aria-expanded'),
                };
            }, expanded.selector, expanded.isDetails);

            if (afterCollapse && afterCollapse.collapsed) {
                t.status = 'passed';
                t.details = `Accordion "${expanded.text}" collapsed thành công ✓`;
            } else {
                t.status = 'warning';
                t.details = `Click lần 2 nhưng accordion vẫn expanded. aria-expanded=${afterCollapse?.ariaExpanded}. (Có thể chỉ 1 accordion mở cùng lúc)`;
            }
        });
    }

    /**
     * 10.6: Accordion ARIA — check aria-expanded updates correctly
     */
    async _testAccordionAria(page, accordions) {
        const test = createTestResult('tab_accordion', '10.6', 'Accordion ARIA attributes');
        return runSafe(test, async (t) => {
            const ariaAudit = await page.evaluate((accList) => {
                const results = [];

                for (const acc of accList) {
                    const h = document.querySelector(acc.selector);
                    if (!h) continue;

                    const hasAriaExpanded = h.hasAttribute('aria-expanded');
                    const ariaExpandedValue = h.getAttribute('aria-expanded');
                    const hasAriaControls = h.hasAttribute('aria-controls');
                    const ariaControls = h.getAttribute('aria-controls');

                    // Check if controlled panel has proper attributes
                    let panelHasRole = false;
                    let panelHasAriaLabelledby = false;
                    if (ariaControls) {
                        const panel = document.getElementById(ariaControls);
                        if (panel) {
                            panelHasRole = panel.getAttribute('role') === 'region';
                            panelHasAriaLabelledby = !!panel.getAttribute('aria-labelledby');
                        }
                    }

                    results.push({
                        text: acc.text,
                        hasAriaExpanded,
                        ariaExpandedValue,
                        hasAriaControls,
                        panelHasRole,
                        panelHasAriaLabelledby,
                        isDetails: acc.isDetails,
                    });
                }

                return results;
            }, accordions);

            if (ariaAudit.length === 0) {
                t.status = 'skipped';
                t.details = 'Không tìm thấy accordion headers';
                return;
            }

            const issues = [];
            let withAria = 0;
            let withoutAria = 0;

            for (const acc of ariaAudit) {
                if (acc.isDetails) {
                    withAria++; // <details> has native semantics
                    continue;
                }

                if (!acc.hasAriaExpanded) {
                    withoutAria++;
                    issues.push(`"${acc.text}" thiếu aria-expanded`);
                } else {
                    withAria++;
                }

                if (!acc.hasAriaControls) {
                    issues.push(`"${acc.text}" thiếu aria-controls`);
                }
            }

            if (issues.length === 0) {
                t.status = 'passed';
                t.details = `${ariaAudit.length} accordions có ARIA attributes đúng ✓ (${withAria} có aria-expanded)`;
            } else if (withoutAria > withAria) {
                t.status = 'failed';
                t.details = `${issues.length} ARIA issues: ${issues.slice(0, 3).join('; ')}`;
            } else {
                t.status = 'warning';
                t.details = `${withAria}/${ariaAudit.length} accordions có aria-expanded. Issues: ${issues.slice(0, 2).join('; ')}`;
            }
        });
    }
}

module.exports = TabAccordionTests;
