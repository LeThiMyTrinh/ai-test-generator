/**
 * SmartTemplateEngine — Tự động sinh test case từ DOM analysis, không cần AI
 *
 * Flow: URL → URLCrawler (crawl DOM) → classify elements → match templates → 3 scenarios
 *
 * 16 nhóm test:
 *   1. Login Form        2. Registration Form    3. Search Form
 *   4. Generic Form      5. Navigation & Links   6. Buttons
 *   7. Dropdown/Select   8. Checkbox & Radio     9. File Upload
 *  10. Textarea         11. Table/Data List     12. Modal/Dialog
 *  13. Tab/Accordion    14. Image/Media         15. Page Load & Errors
 *  16. Accessibility
 */

// ===== VALID ACTIONS (synced with ActionHandler) =====
const VALID_ACTIONS = [
    'navigate', 'click', 'fill', 'select', 'hover',
    'assert_text', 'assert_visible', 'assert_url', 'wait', 'screenshot',
    'double_click', 'right_click', 'keyboard', 'scroll_to', 'drag_drop', 'upload_file'
];

// ===== TEST DATA =====
const TEST_DATA = {
    email: { valid: 'testuser@example.com', invalid: 'abc@', xss: '<script>alert(1)</script>', sqli: "' OR 1=1 --", long: 'a'.repeat(256) + '@test.com' },
    password: { valid: 'Test@12345', weak: '123', short: 'ab', long: 'A'.repeat(300) },
    name: { valid: 'Nguyen Van Test', special: "O'Brien <b>bold</b>", long: 'A'.repeat(500), empty: '' },
    phone: { valid: '0901234567', invalid: 'abc-phone', short: '09', long: '0'.repeat(20) },
    text: { valid: 'Test automation value', html: '<h1>Injected</h1><script>alert(1)</script>', long: 'X'.repeat(1000), empty: '' },
    search: { valid: 'test keyword', noResult: 'zzzxxxyyy999', special: '<script>alert(1)</script>', long: 'A'.repeat(500) },
    number: { valid: '100', zero: '0', negative: '-1', text: 'abc', large: '999999999' },
    url: { valid: 'https://example.com' }
};

// ===== ELEMENT CLASSIFIER =====

class ElementClassifier {
    constructor(elements, metadata) {
        this.elements = elements || [];
        this.metadata = metadata || {};
    }

    /** Classify all elements into groups */
    classify() {
        const result = {
            passwordInputs: [],
            emailInputs: [],
            usernameInputs: [],
            textInputs: [],
            numberInputs: [],
            phoneInputs: [],
            searchInputs: [],
            fileInputs: [],
            checkboxes: [],
            radios: [],
            selects: [],
            textareas: [],
            buttons: [],
            submitButtons: [],
            links: [],
            navLinks: [],
            images: [],
            tables: [],
            modals: [],
            tabs: [],
            allInputs: [],
            forms: this.metadata.forms || 0,
            headings: this.metadata.headings || []
        };

        for (const el of this.elements) {
            // CRITICAL: Skip elements without valid selector — prevents locator('undefined') errors
            if (!el.selector || el.selector.trim() === '') continue;

            const tag = (el.tag || '').toLowerCase();
            const type = (el.type || '').toLowerCase();
            const name = (el.name || '').toLowerCase();
            const placeholder = (el.placeholder || '').toLowerCase();
            const role = (el.role || '').toLowerCase();
            const cls = (el.classes || '').toLowerCase();
            const text = (el.text || '').toLowerCase();
            const ariaLabel = (el.ariaLabel || '').toLowerCase();

            // Inputs
            if (tag === 'input' || tag === 'textarea') {
                if (type === 'password') {
                    result.passwordInputs.push(el);
                } else if (type === 'email' || name.includes('email') || placeholder.includes('email')) {
                    result.emailInputs.push(el);
                } else if (type === 'file') {
                    result.fileInputs.push(el);
                } else if (type === 'checkbox') {
                    result.checkboxes.push(el);
                } else if (type === 'radio') {
                    result.radios.push(el);
                } else if (type === 'number' || name.includes('number') || name.includes('amount') || name.includes('price') || name.includes('quantity')) {
                    result.numberInputs.push(el);
                } else if (type === 'tel' || name.includes('phone') || name.includes('tel') || placeholder.includes('phone') || placeholder.includes('điện thoại') || placeholder.includes('số đt')) {
                    result.phoneInputs.push(el);
                } else if (type === 'search' || name.includes('search') || name.includes('query') || name.includes('keyword')
                    || placeholder.includes('search') || placeholder.includes('tìm kiếm') || placeholder.includes('tìm')
                    || ariaLabel.includes('search') || role === 'search' || cls.includes('search')) {
                    result.searchInputs.push(el);
                } else if (name.includes('user') || name.includes('login') || name.includes('account')
                    || placeholder.includes('username') || placeholder.includes('tài khoản') || placeholder.includes('tên đăng nhập')) {
                    result.usernameInputs.push(el);
                } else if (tag === 'textarea') {
                    result.textareas.push(el);
                } else if (type === 'text' || type === '' || type === 'url' || type === 'date' || !type) {
                    result.textInputs.push(el);
                }

                if (tag === 'input' && type !== 'hidden' && type !== 'checkbox' && type !== 'radio' && type !== 'file') {
                    result.allInputs.push(el);
                }
            }

            if (tag === 'textarea') {
                result.textareas.push(el);
                result.allInputs.push(el);
            }

            // Selects
            if (tag === 'select') {
                result.selects.push(el);
                result.allInputs.push(el);
            }

            // Buttons
            if (tag === 'button' || role === 'button' || type === 'submit') {
                if (type === 'submit' || text.includes('submit') || text.includes('đăng') || text.includes('gửi')
                    || text.includes('login') || text.includes('sign') || text.includes('register') || text.includes('tạo')
                    || text.includes('lưu') || text.includes('save') || text.includes('xác nhận') || text.includes('confirm')) {
                    result.submitButtons.push(el);
                }
                result.buttons.push(el);
            }

            // Links
            if (tag === 'a' && el.href) {
                const href = el.href || '';
                // Nav links = internal links in nav/menu area or role menuitem
                if (role === 'menuitem' || role === 'link' || cls.includes('nav') || cls.includes('menu')) {
                    result.navLinks.push(el);
                }
                if (!href.startsWith('javascript:') && !href.startsWith('#') && href !== '') {
                    result.links.push(el);
                }
            }

            // Tabs
            if (role === 'tab' || cls.includes('tab') || (el.ariaLabel || '').toLowerCase().includes('tab')) {
                result.tabs.push(el);
            }

            // Modals
            if (role === 'dialog' || cls.includes('modal') || cls.includes('dialog')
                || text.includes('close') || text.includes('đóng') || ariaLabel.includes('close') || ariaLabel.includes('modal')) {
                result.modals.push(el);
            }
        }

        return result;
    }

    /** Detect page pattern */
    detectPattern(classified) {
        const patterns = [];
        const c = classified;

        // Login form: has password + (email or username) + submit
        const hasConfirmPassword = c.passwordInputs.length >= 2;
        if (c.passwordInputs.length > 0 && (c.emailInputs.length > 0 || c.usernameInputs.length > 0)) {
            if (hasConfirmPassword) {
                patterns.push('registration');
            } else {
                patterns.push('login');
            }
        }

        if (c.searchInputs.length > 0) patterns.push('search');
        if (c.forms > 0 && !patterns.includes('login') && !patterns.includes('registration') && c.allInputs.length > 0) {
            patterns.push('generic_form');
        }
        if (c.links.length > 0 || c.navLinks.length > 0) patterns.push('navigation');
        if (c.buttons.length > 0) patterns.push('buttons');
        if (c.selects.length > 0) patterns.push('dropdown');
        if (c.checkboxes.length > 0 || c.radios.length > 0) patterns.push('checkbox_radio');
        if (c.fileInputs.length > 0) patterns.push('file_upload');
        if (c.textareas.length > 0) patterns.push('textarea');
        if (c.tabs.length > 0) patterns.push('tabs');

        // Always include
        patterns.push('page_load');
        patterns.push('accessibility');

        return patterns;
    }
}

// ===== TEMPLATE GENERATORS =====

function step(action, selector, value, expected, description) {
    return { action, selector: selector || '', value: value || '', expected: expected || '', description };
}

// --- Group 1: Login ---
function generateLoginTests(classified, url) {
    const email = classified.emailInputs[0] || classified.usernameInputs[0];
    const password = classified.passwordInputs[0];
    const submit = classified.submitButtons[0] || classified.buttons[0];
    if (!email || !password) return { happy: [], negative: [], boundary: [] };

    const emailSel = email.selector;
    const pwSel = password.selector;
    const submitSel = submit?.selector || 'button[type="submit"]';
    const isEmail = email.type === 'email' || (email.name || '').includes('email');

    return {
        happy: [
            step('navigate', '', url, '', 'Mở trang đăng nhập'),
            step('fill', emailSel, isEmail ? TEST_DATA.email.valid : 'admin', '', `Nhập ${isEmail ? 'email' : 'tài khoản'} hợp lệ`),
            step('fill', pwSel, TEST_DATA.password.valid, '', 'Nhập mật khẩu hợp lệ'),
            step('click', submitSel, '', '', 'Nhấn nút đăng nhập'),
            step('wait', '', '2000', '', 'Chờ phản hồi'),
            step('screenshot', '', '', '', 'Chụp ảnh kết quả đăng nhập'),
        ],
        negative: [
            step('navigate', '', url, '', 'Mở trang đăng nhập'),
            step('click', submitSel, '', '', 'Nhấn đăng nhập mà không điền gì'),
            step('wait', '', '1000', '', 'Chờ validation hiển thị'),
            step('screenshot', '', '', '', 'Chụp lỗi validation khi bỏ trống'),
            step('fill', emailSel, isEmail ? TEST_DATA.email.valid : 'admin', '', `Nhập ${isEmail ? 'email' : 'tài khoản'} hợp lệ`),
            step('click', submitSel, '', '', 'Nhấn đăng nhập chỉ có email, không có mật khẩu'),
            step('wait', '', '1000', '', 'Chờ validation'),
            step('screenshot', '', '', '', 'Chụp lỗi thiếu mật khẩu'),
            step('navigate', '', url, '', 'Quay lại trang đăng nhập'),
            step('fill', emailSel, isEmail ? TEST_DATA.email.invalid : '', '', `Nhập ${isEmail ? 'email' : 'tài khoản'} sai`),
            step('fill', pwSel, 'wrongpassword123', '', 'Nhập mật khẩu sai'),
            step('click', submitSel, '', '', 'Nhấn đăng nhập với thông tin sai'),
            step('wait', '', '2000', '', 'Chờ phản hồi lỗi'),
            step('screenshot', '', '', '', 'Chụp thông báo lỗi đăng nhập'),
        ],
        boundary: [
            step('navigate', '', url, '', 'Mở trang đăng nhập'),
            step('fill', emailSel, TEST_DATA.email.sqli, '', 'Nhập SQL injection vào email'),
            step('fill', pwSel, TEST_DATA.password.valid, '', 'Nhập mật khẩu'),
            step('click', submitSel, '', '', 'Nhấn đăng nhập'),
            step('wait', '', '2000', '', 'Chờ phản hồi'),
            step('screenshot', '', '', '', 'Chụp kết quả SQL injection'),
            step('navigate', '', url, '', 'Quay lại trang đăng nhập'),
            step('fill', emailSel, TEST_DATA.email.xss, '', 'Nhập XSS vào email'),
            step('fill', pwSel, TEST_DATA.password.valid, '', 'Nhập mật khẩu'),
            step('click', submitSel, '', '', 'Nhấn đăng nhập'),
            step('wait', '', '1000', '', 'Chờ phản hồi'),
            step('screenshot', '', '', '', 'Chụp kết quả XSS'),
            step('navigate', '', url, '', 'Quay lại trang đăng nhập'),
            step('fill', emailSel, TEST_DATA.email.long, '', 'Nhập email dài 256+ ký tự'),
            step('fill', pwSel, TEST_DATA.password.long, '', 'Nhập mật khẩu dài 300 ký tự'),
            step('click', submitSel, '', '', 'Nhấn đăng nhập'),
            step('wait', '', '1000', '', 'Chờ phản hồi'),
            step('screenshot', '', '', '', 'Chụp kết quả max length'),
        ]
    };
}

// --- Group 2: Registration ---
function generateRegistrationTests(classified, url) {
    const email = classified.emailInputs[0];
    const passwords = classified.passwordInputs;
    const pw1 = passwords[0];
    const pw2 = passwords[1]; // confirm password
    const submit = classified.submitButtons[0] || classified.buttons[0];
    const nameInput = classified.textInputs[0];
    const phoneInput = classified.phoneInputs[0];

    if (!email || !pw1) return { happy: [], negative: [], boundary: [] };

    const emailSel = email.selector;
    const pw1Sel = pw1.selector;
    const pw2Sel = pw2?.selector;
    const submitSel = submit?.selector || 'button[type="submit"]';
    const nameSel = nameInput?.selector;
    const phoneSel = phoneInput?.selector;

    const happySteps = [
        step('navigate', '', url, '', 'Mở trang đăng ký'),
    ];
    if (nameSel) happySteps.push(step('fill', nameSel, TEST_DATA.name.valid, '', 'Nhập họ tên'));
    happySteps.push(step('fill', emailSel, TEST_DATA.email.valid, '', 'Nhập email'));
    if (phoneSel) happySteps.push(step('fill', phoneSel, TEST_DATA.phone.valid, '', 'Nhập số điện thoại'));
    happySteps.push(step('fill', pw1Sel, TEST_DATA.password.valid, '', 'Nhập mật khẩu'));
    if (pw2Sel) happySteps.push(step('fill', pw2Sel, TEST_DATA.password.valid, '', 'Nhập xác nhận mật khẩu'));
    happySteps.push(
        step('click', submitSel, '', '', 'Nhấn đăng ký'),
        step('wait', '', '2000', '', 'Chờ phản hồi'),
        step('screenshot', '', '', '', 'Chụp kết quả đăng ký thành công'),
    );

    const negativeSteps = [
        step('navigate', '', url, '', 'Mở trang đăng ký'),
        step('click', submitSel, '', '', 'Nhấn đăng ký mà không điền gì'),
        step('wait', '', '1000', '', 'Chờ hiển thị validation'),
        step('screenshot', '', '', '', 'Chụp lỗi bỏ trống tất cả'),
    ];
    // Test each required field empty one by one
    if (nameSel) {
        negativeSteps.push(
            step('navigate', '', url, '', 'Quay lại trang đăng ký'),
            step('fill', emailSel, TEST_DATA.email.valid, '', 'Nhập email'),
            step('fill', pw1Sel, TEST_DATA.password.valid, '', 'Nhập mật khẩu'),
        );
        if (pw2Sel) negativeSteps.push(step('fill', pw2Sel, TEST_DATA.password.valid, '', 'Nhập xác nhận mật khẩu'));
        negativeSteps.push(
            step('click', submitSel, '', '', 'Nhấn đăng ký — thiếu tên'),
            step('wait', '', '1000', '', 'Chờ validation'),
            step('screenshot', '', '', '', 'Chụp lỗi thiếu tên'),
        );
    }
    if (pw2Sel) {
        negativeSteps.push(
            step('navigate', '', url, '', 'Quay lại trang đăng ký'),
        );
        if (nameSel) negativeSteps.push(step('fill', nameSel, TEST_DATA.name.valid, '', 'Nhập họ tên'));
        negativeSteps.push(
            step('fill', emailSel, TEST_DATA.email.valid, '', 'Nhập email'),
            step('fill', pw1Sel, TEST_DATA.password.valid, '', 'Nhập mật khẩu'),
            step('fill', pw2Sel, 'DifferentPass@999', '', 'Nhập xác nhận mật khẩu KHÁC'),
            step('click', submitSel, '', '', 'Nhấn đăng ký — password không khớp'),
            step('wait', '', '1000', '', 'Chờ validation'),
            step('screenshot', '', '', '', 'Chụp lỗi mật khẩu không khớp'),
        );
    }

    const boundarySteps = [
        step('navigate', '', url, '', 'Mở trang đăng ký'),
        step('fill', emailSel, TEST_DATA.email.valid, '', 'Nhập email'),
        step('fill', pw1Sel, TEST_DATA.password.weak, '', 'Nhập mật khẩu yếu (123)'),
    ];
    if (pw2Sel) boundarySteps.push(step('fill', pw2Sel, TEST_DATA.password.weak, '', 'Xác nhận mật khẩu yếu'));
    boundarySteps.push(
        step('click', submitSel, '', '', 'Nhấn đăng ký với mật khẩu yếu'),
        step('wait', '', '1000', '', 'Chờ validation'),
        step('screenshot', '', '', '', 'Chụp lỗi mật khẩu yếu'),
        step('navigate', '', url, '', 'Quay lại trang đăng ký'),
    );
    if (nameSel) boundarySteps.push(step('fill', nameSel, TEST_DATA.name.special, '', 'Nhập tên có ký tự đặc biệt'));
    boundarySteps.push(
        step('fill', emailSel, TEST_DATA.email.xss, '', 'Nhập XSS vào email'),
        step('fill', pw1Sel, TEST_DATA.password.valid, '', 'Nhập mật khẩu'),
    );
    if (pw2Sel) boundarySteps.push(step('fill', pw2Sel, TEST_DATA.password.valid, '', 'Xác nhận mật khẩu'));
    boundarySteps.push(
        step('click', submitSel, '', '', 'Nhấn đăng ký'),
        step('wait', '', '1000', '', 'Chờ phản hồi'),
        step('screenshot', '', '', '', 'Chụp kết quả XSS/special chars'),
    );

    return { happy: happySteps, negative: negativeSteps, boundary: boundarySteps };
}

// --- Group 3: Search ---
function generateSearchTests(classified, url) {
    const search = classified.searchInputs[0];
    if (!search) return { happy: [], negative: [], boundary: [] };

    const sel = search.selector;

    return {
        happy: [
            step('navigate', '', url, '', 'Mở trang'),
            step('fill', sel, TEST_DATA.search.valid, '', 'Nhập từ khóa tìm kiếm'),
            step('keyboard', '', 'Enter', '', 'Nhấn Enter để tìm'),
            step('wait', '', '2000', '', 'Chờ kết quả'),
            step('screenshot', '', '', '', 'Chụp kết quả tìm kiếm'),
        ],
        negative: [
            step('navigate', '', url, '', 'Mở trang'),
            step('fill', sel, '', '', 'Để trống ô tìm kiếm'),
            step('keyboard', '', 'Enter', '', 'Nhấn Enter mà không nhập gì'),
            step('wait', '', '1000', '', 'Chờ phản hồi'),
            step('screenshot', '', '', '', 'Chụp kết quả tìm kiếm rỗng'),
            step('fill', sel, TEST_DATA.search.noResult, '', 'Nhập từ khóa không có kết quả'),
            step('keyboard', '', 'Enter', '', 'Nhấn Enter'),
            step('wait', '', '2000', '', 'Chờ kết quả'),
            step('screenshot', '', '', '', 'Chụp không tìm thấy kết quả'),
        ],
        boundary: [
            step('navigate', '', url, '', 'Mở trang'),
            step('fill', sel, TEST_DATA.search.special, '', 'Nhập XSS vào ô tìm kiếm'),
            step('keyboard', '', 'Enter', '', 'Nhấn Enter'),
            step('wait', '', '2000', '', 'Chờ phản hồi'),
            step('screenshot', '', '', '', 'Chụp kết quả với XSS'),
            step('navigate', '', url, '', 'Quay lại trang'),
            step('fill', sel, TEST_DATA.search.long, '', 'Nhập chuỗi dài 500 ký tự'),
            step('keyboard', '', 'Enter', '', 'Nhấn Enter'),
            step('wait', '', '2000', '', 'Chờ phản hồi'),
            step('screenshot', '', '', '', 'Chụp kết quả chuỗi dài'),
        ]
    };
}

// --- Group 4: Generic Form ---
function generateGenericFormTests(classified, url) {
    const inputs = classified.allInputs.slice(0, 10);
    const submit = classified.submitButtons[0] || classified.buttons[0];
    if (inputs.length === 0) return { happy: [], negative: [], boundary: [] };

    const submitSel = submit?.selector || 'button[type="submit"]';

    // Build fill steps with smart data per field type
    function fillAllInputs(dataSet) {
        const steps = [];
        for (const input of inputs) {
            const name = (input.name || '').toLowerCase();
            const type = (input.type || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();
            const tag = (input.tag || '').toLowerCase();
            let value;

            if (tag === 'select') {
                steps.push(step('select', input.selector, 'option_value', '', `Chọn giá trị cho ${input.name || input.placeholder || 'dropdown'}`));
                continue;
            }
            if (type === 'email' || name.includes('email')) {
                value = dataSet === 'valid' ? TEST_DATA.email.valid : dataSet === 'xss' ? TEST_DATA.email.xss : '';
            } else if (type === 'password') {
                value = dataSet === 'valid' ? TEST_DATA.password.valid : dataSet === 'xss' ? TEST_DATA.password.long : '';
            } else if (type === 'tel' || name.includes('phone') || name.includes('tel')) {
                value = dataSet === 'valid' ? TEST_DATA.phone.valid : dataSet === 'xss' ? TEST_DATA.phone.invalid : '';
            } else if (type === 'number' || name.includes('number') || name.includes('amount')) {
                value = dataSet === 'valid' ? TEST_DATA.number.valid : dataSet === 'xss' ? TEST_DATA.number.text : '';
            } else {
                value = dataSet === 'valid' ? TEST_DATA.text.valid : dataSet === 'xss' ? TEST_DATA.text.html : '';
            }
            const label = input.name || input.placeholder || input.ariaLabel || `field ${inputs.indexOf(input) + 1}`;
            steps.push(step('fill', input.selector, value, '', `Nhập ${dataSet === 'valid' ? 'dữ liệu hợp lệ' : dataSet === 'xss' ? 'dữ liệu đặc biệt' : 'để trống'} vào ${label}`));
        }
        return steps;
    }

    return {
        happy: [
            step('navigate', '', url, '', 'Mở trang'),
            ...fillAllInputs('valid'),
            step('click', submitSel, '', '', 'Nhấn nút gửi/lưu'),
            step('wait', '', '2000', '', 'Chờ phản hồi'),
            step('screenshot', '', '', '', 'Chụp kết quả submit thành công'),
        ],
        negative: [
            step('navigate', '', url, '', 'Mở trang'),
            step('click', submitSel, '', '', 'Nhấn gửi mà không điền gì'),
            step('wait', '', '1000', '', 'Chờ validation'),
            step('screenshot', '', '', '', 'Chụp lỗi bỏ trống tất cả'),
            // Fill only first field, leave rest empty
            step('navigate', '', url, '', 'Quay lại trang'),
            ...(inputs.length > 0 ? [step('fill', inputs[0].selector, TEST_DATA.text.valid, '', `Chỉ điền ${inputs[0].name || 'field đầu tiên'}`)] : []),
            step('click', submitSel, '', '', 'Nhấn gửi — thiếu các field còn lại'),
            step('wait', '', '1000', '', 'Chờ validation'),
            step('screenshot', '', '', '', 'Chụp lỗi thiếu field'),
        ],
        boundary: [
            step('navigate', '', url, '', 'Mở trang'),
            ...fillAllInputs('xss'),
            step('click', submitSel, '', '', 'Nhấn gửi với dữ liệu đặc biệt/XSS'),
            step('wait', '', '2000', '', 'Chờ phản hồi'),
            step('screenshot', '', '', '', 'Chụp kết quả XSS/HTML injection'),
        ]
    };
}

// --- Group 5: Navigation ---
function generateNavigationTests(classified, url) {
    const links = classified.navLinks.length > 0 ? classified.navLinks : classified.links;
    // Only use links that have a valid selector AND href
    const topLinks = links.filter(l => l.selector && l.href).slice(0, 5);
    if (topLinks.length === 0) return { happy: [], negative: [], boundary: [] };

    /** Generate click or navigate step for a link depending on href */
    function linkStep(link, desc) {
        // If link has absolute href, use navigate (more reliable than click)
        if (link.href && (link.href.startsWith('http://') || link.href.startsWith('https://'))) {
            return step('navigate', '', link.href, '', desc);
        }
        // Relative href: build full URL
        if (link.href && link.href.startsWith('/')) {
            try {
                const base = new URL(url);
                return step('navigate', '', `${base.origin}${link.href}`, '', desc);
            } catch { /* fall through to click */ }
        }
        // Fallback: click with selector
        return step('click', link.selector, '', '', desc);
    }

    const happySteps = [step('navigate', '', url, '', 'Mở trang chính')];
    for (const link of topLinks) {
        const label = link.text?.substring(0, 30) || link.href?.substring(0, 30) || 'link';
        happySteps.push(
            linkStep(link, `Truy cập link "${label}"`),
            step('wait', '', '1500', '', 'Chờ trang tải'),
            step('screenshot', '', '', '', `Chụp trang "${label}"`),
            step('navigate', '', url, '', 'Quay lại trang chính'),
        );
    }

    const negativeSteps = [step('navigate', '', url, '', 'Mở trang chính')];
    for (const link of topLinks.slice(0, 3)) {
        const label = link.text?.substring(0, 30) || 'link';
        negativeSteps.push(
            linkStep(link, `Truy cập link "${label}"`),
            step('wait', '', '2000', '', 'Chờ trang tải'),
            step('screenshot', '', '', '', 'Chụp ảnh kiểm tra không bị lỗi 404/500'),
        );
    }
    negativeSteps.push(step('navigate', '', url, '', 'Quay lại trang chính'));

    const firstLink = topLinks[0];
    return {
        happy: happySteps,
        negative: negativeSteps,
        boundary: [
            step('navigate', '', url, '', 'Mở trang chính'),
            linkStep(firstLink, 'Truy cập link đầu tiên'),
            step('wait', '', '1500', '', 'Chờ trang tải'),
            step('keyboard', '', 'Alt+ArrowLeft', '', 'Nhấn nút Back trình duyệt'),
            step('wait', '', '1500', '', 'Chờ quay lại'),
            step('screenshot', '', '', '', 'Chụp xác nhận quay lại đúng trang'),
            step('keyboard', '', 'Alt+ArrowRight', '', 'Nhấn nút Forward'),
            step('wait', '', '1500', '', 'Chờ tải'),
            step('screenshot', '', '', '', 'Chụp xác nhận forward đúng'),
        ]
    };
}

// --- Group 6: Buttons ---
function generateButtonTests(classified, url) {
    const buttons = classified.buttons.filter(b => !classified.submitButtons.includes(b)).slice(0, 5);
    if (buttons.length === 0) return { happy: [], negative: [], boundary: [] };

    const happySteps = [step('navigate', '', url, '', 'Mở trang')];
    for (const btn of buttons) {
        happySteps.push(
            step('click', btn.selector, '', '', `Click nút "${btn.text?.substring(0, 30) || 'button'}"`),
            step('wait', '', '1000', '', 'Chờ phản hồi'),
        );
    }
    happySteps.push(step('screenshot', '', '', '', 'Chụp kết quả sau khi click các nút'));

    return {
        happy: happySteps,
        negative: [
            step('navigate', '', url, '', 'Mở trang'),
            step('screenshot', '', '', '', 'Chụp trạng thái ban đầu của các nút'),
        ],
        boundary: buttons.length > 0 ? [
            step('navigate', '', url, '', 'Mở trang'),
            step('double_click', buttons[0].selector, '', '', `Double click nút "${buttons[0].text?.substring(0, 30) || 'button'}" — kiểm tra không duplicate action`),
            step('wait', '', '1500', '', 'Chờ phản hồi'),
            step('screenshot', '', '', '', 'Chụp kết quả double click'),
        ] : []
    };
}

// --- Group 7: Dropdown / Select ---
function generateDropdownTests(classified, url) {
    const selects = classified.selects.slice(0, 3);
    if (selects.length === 0) return { happy: [], negative: [], boundary: [] };

    const happySteps = [step('navigate', '', url, '', 'Mở trang')];
    for (const sel of selects) {
        happySteps.push(
            step('click', sel.selector, '', '', `Mở dropdown "${sel.name || sel.placeholder || 'select'}"`),
            step('wait', '', '500', '', 'Chờ dropdown mở'),
            step('screenshot', '', '', '', `Chụp dropdown "${sel.name || 'select'}" đã mở`),
        );
    }

    return {
        happy: happySteps,
        negative: [
            step('navigate', '', url, '', 'Mở trang'),
            step('screenshot', '', '', '', 'Chụp giá trị mặc định của dropdown'),
        ],
        boundary: selects.length > 0 ? [
            step('navigate', '', url, '', 'Mở trang'),
            step('click', selects[0].selector, '', '', 'Mở dropdown đầu tiên'),
            step('wait', '', '500', '', 'Chờ dropdown mở'),
            step('screenshot', '', '', '', 'Chụp dropdown — kiểm tra option đầu và cuối'),
        ] : []
    };
}

// --- Group 8: Checkbox & Radio ---
function generateCheckboxRadioTests(classified, url) {
    const cbs = classified.checkboxes.slice(0, 3);
    const radios = classified.radios.slice(0, 3);
    if (cbs.length === 0 && radios.length === 0) return { happy: [], negative: [], boundary: [] };

    const happySteps = [step('navigate', '', url, '', 'Mở trang')];

    for (const cb of cbs) {
        happySteps.push(
            step('click', cb.selector, '', '', `Check checkbox "${cb.name || cb.ariaLabel || 'checkbox'}"`),
        );
    }
    for (const radio of radios) {
        happySteps.push(
            step('click', radio.selector, '', '', `Chọn radio "${radio.name || radio.ariaLabel || 'radio'}"`),
        );
    }
    happySteps.push(step('screenshot', '', '', '', 'Chụp trạng thái sau khi check/chọn'));

    const negativeSteps = [step('navigate', '', url, '', 'Mở trang')];
    // Uncheck a required checkbox → submit
    const submit = classified.submitButtons[0];
    if (submit && cbs.length > 0) {
        negativeSteps.push(
            step('click', submit.selector, '', '', 'Nhấn gửi mà không check checkbox bắt buộc'),
            step('wait', '', '1000', '', 'Chờ validation'),
            step('screenshot', '', '', '', 'Chụp lỗi không check checkbox required'),
        );
    } else {
        negativeSteps.push(step('screenshot', '', '', '', 'Chụp trạng thái mặc định'));
    }

    const boundarySteps = [step('navigate', '', url, '', 'Mở trang')];
    for (const cb of cbs) {
        boundarySteps.push(
            step('click', cb.selector, '', '', `Check "${cb.name || 'checkbox'}"`),
            step('click', cb.selector, '', '', `Uncheck "${cb.name || 'checkbox'}"`),
        );
    }
    boundarySteps.push(step('screenshot', '', '', '', 'Chụp sau toggle check/uncheck'));

    return { happy: happySteps, negative: negativeSteps, boundary: boundarySteps };
}

// --- Group 9: File Upload ---
function generateFileUploadTests(classified, url) {
    const files = classified.fileInputs.slice(0, 2);
    if (files.length === 0) return { happy: [], negative: [], boundary: [] };
    const submit = classified.submitButtons[0] || classified.buttons[0];
    const submitSel = submit?.selector || 'button[type="submit"]';

    return {
        happy: [
            step('navigate', '', url, '', 'Mở trang upload'),
            step('upload_file', files[0].selector, 'test-file.png', '', 'Upload file hợp lệ (PNG)'),
            step('wait', '', '1000', '', 'Chờ file được chọn'),
            step('screenshot', '', '', '', 'Chụp trạng thái sau upload'),
        ],
        negative: [
            step('navigate', '', url, '', 'Mở trang upload'),
            step('click', submitSel, '', '', 'Nhấn gửi mà không chọn file'),
            step('wait', '', '1000', '', 'Chờ validation'),
            step('screenshot', '', '', '', 'Chụp lỗi khi không upload file'),
        ],
        boundary: [
            step('navigate', '', url, '', 'Mở trang upload'),
            step('upload_file', files[0].selector, 'test-file.exe', '', 'Upload file sai định dạng (.exe)'),
            step('wait', '', '1000', '', 'Chờ validation'),
            step('screenshot', '', '', '', 'Chụp kết quả upload file sai định dạng'),
        ]
    };
}

// --- Group 10: Textarea ---
function generateTextareaTests(classified, url) {
    const textareas = classified.textareas.slice(0, 2);
    if (textareas.length === 0) return { happy: [], negative: [], boundary: [] };
    const ta = textareas[0];
    const submit = classified.submitButtons[0] || classified.buttons[0];
    const submitSel = submit?.selector;

    const happySteps = [
        step('navigate', '', url, '', 'Mở trang'),
        step('fill', ta.selector, TEST_DATA.text.valid, '', `Nhập nội dung vào "${ta.name || ta.placeholder || 'textarea'}"`),
    ];
    if (submitSel) happySteps.push(step('click', submitSel, '', '', 'Nhấn gửi'));
    happySteps.push(step('wait', '', '1500', '', 'Chờ phản hồi'), step('screenshot', '', '', '', 'Chụp kết quả'));

    const negativeSteps = [step('navigate', '', url, '', 'Mở trang')];
    if (submitSel) {
        negativeSteps.push(
            step('click', submitSel, '', '', 'Nhấn gửi mà không nhập nội dung'),
            step('wait', '', '1000', '', 'Chờ validation'),
        );
    }
    negativeSteps.push(step('screenshot', '', '', '', 'Chụp lỗi textarea rỗng'));

    return {
        happy: happySteps,
        negative: negativeSteps,
        boundary: [
            step('navigate', '', url, '', 'Mở trang'),
            step('fill', ta.selector, TEST_DATA.text.long, '', 'Nhập 1000 ký tự vào textarea'),
            step('screenshot', '', '', '', 'Chụp textarea với nội dung dài'),
            step('navigate', '', url, '', 'Quay lại'),
            step('fill', ta.selector, TEST_DATA.text.html, '', 'Nhập HTML/XSS vào textarea'),
            step('screenshot', '', '', '', 'Chụp kết quả HTML injection'),
        ]
    };
}

// --- Group 11: Tabs ---
function generateTabTests(classified, url) {
    const tabs = classified.tabs.slice(0, 5);
    if (tabs.length === 0) return { happy: [], negative: [], boundary: [] };

    const happySteps = [step('navigate', '', url, '', 'Mở trang')];
    for (const tab of tabs) {
        happySteps.push(
            step('click', tab.selector, '', '', `Click tab "${tab.text?.substring(0, 30) || 'tab'}"`),
            step('wait', '', '800', '', 'Chờ nội dung tab tải'),
        );
    }
    happySteps.push(step('screenshot', '', '', '', 'Chụp kết quả chuyển tab'));

    return {
        happy: happySteps,
        negative: [
            step('navigate', '', url, '', 'Mở trang'),
            step('screenshot', '', '', '', 'Chụp trạng thái tab mặc định'),
        ],
        boundary: tabs.length >= 2 ? [
            step('navigate', '', url, '', 'Mở trang'),
            step('click', tabs[0].selector, '', '', 'Click tab đầu tiên'),
            step('wait', '', '500', '', 'Chờ'),
            step('click', tabs[tabs.length - 1].selector, '', '', 'Click tab cuối cùng'),
            step('wait', '', '500', '', 'Chờ'),
            step('click', tabs[0].selector, '', '', 'Quay lại tab đầu tiên'),
            step('wait', '', '500', '', 'Chờ'),
            step('screenshot', '', '', '', 'Chụp kiểm tra chuyển tab qua lại'),
        ] : []
    };
}

// --- Group 15: Page Load ---
function generatePageLoadTests(classified, url) {
    const heading = classified.headings[0];

    return {
        happy: [
            step('navigate', '', url, '', 'Mở trang web'),
            step('wait', '', '2000', '', 'Chờ trang tải hoàn tất'),
            ...(heading ? [step('assert_text', 'h1, h2, h3', '', heading.substring(0, 50), 'Kiểm tra heading hiển thị đúng')] : []),
            step('screenshot', '', '', '', 'Chụp toàn trang đã load'),
        ],
        negative: [],
        boundary: [
            step('navigate', '', url, '', 'Mở trang web'),
            step('wait', '', '3000', '', 'Chờ trang tải hoàn tất'),
            step('screenshot', '', '', '', 'Chụp ảnh trang'),
            step('keyboard', '', 'F5', '', 'Reload trang'),
            step('wait', '', '3000', '', 'Chờ trang reload'),
            step('screenshot', '', '', '', 'Chụp ảnh sau reload — kiểm tra ổn định'),
        ]
    };
}

// --- Group 16: Accessibility ---
function generateAccessibilityTests(classified, url) {
    const inputs = classified.allInputs.slice(0, 5);

    return {
        happy: [],
        negative: [],
        boundary: [
            step('navigate', '', url, '', 'Mở trang web'),
            ...inputs.slice(0, 3).map(input =>
                step('click', input.selector, '', '', `Focus vào "${input.name || input.placeholder || 'input'}"`)
            ),
            step('keyboard', '', 'Tab', '', 'Nhấn Tab để chuyển focus'),
            step('keyboard', '', 'Tab', '', 'Nhấn Tab tiếp'),
            step('keyboard', '', 'Tab', '', 'Nhấn Tab tiếp'),
            step('screenshot', '', '', '', 'Chụp kiểm tra Tab navigation'),
        ]
    };
}

// ===== SCENARIO BUILDER =====

class ScenarioBuilder {
    /**
     * Build 3 scenarios from template results
     * @param {Array<{happy:[], negative:[], boundary:[]}>} templateResults
     * @param {string} url
     * @param {object} metadata
     * @returns {Array} scenarios
     */
    static build(templateResults, url, metadata) {
        const happy = [], negative = [], boundary = [];

        for (const t of templateResults) {
            if (t.happy?.length > 0) happy.push(...t.happy);
            if (t.negative?.length > 0) negative.push(...t.negative);
            if (t.boundary?.length > 0) boundary.push(...t.boundary);
        }

        const pageTitle = metadata?.title || url;
        const scenarios = [];

        if (happy.length > 0) {
            scenarios.push({
                type: 'happy_path',
                title: `Happy Path — ${pageTitle}`,
                description: 'Kiểm tra luồng chính hoạt động đúng với dữ liệu hợp lệ',
                steps: ScenarioBuilder._dedup(happy)
            });
        }

        if (negative.length > 0) {
            scenarios.push({
                type: 'negative',
                title: `Negative Test — ${pageTitle}`,
                description: 'Kiểm tra xử lý lỗi: bỏ trống, dữ liệu sai, thao tác không hợp lệ',
                steps: ScenarioBuilder._dedup(negative)
            });
        }

        if (boundary.length > 0) {
            scenarios.push({
                type: 'boundary',
                title: `Boundary Test — ${pageTitle}`,
                description: 'Kiểm tra giới hạn: XSS, SQL injection, chuỗi dài, ký tự đặc biệt',
                steps: ScenarioBuilder._dedup(boundary)
            });
        }

        // Ensure at least 1 scenario
        if (scenarios.length === 0) {
            scenarios.push({
                type: 'happy_path',
                title: `Page Test — ${pageTitle}`,
                description: 'Kiểm tra cơ bản trang web',
                steps: [
                    step('navigate', '', url, '', 'Mở trang web'),
                    step('wait', '', '2000', '', 'Chờ trang tải'),
                    step('screenshot', '', '', '', 'Chụp ảnh trang'),
                ]
            });
        }

        // Finalize: add step_id, ensure navigate at start & screenshot at end
        for (const sc of scenarios) {
            sc.steps = ScenarioBuilder._finalize(sc.steps, url);
        }

        return scenarios;
    }

    /** Remove duplicate consecutive navigate to same URL */
    static _dedup(steps) {
        const result = [];
        for (let i = 0; i < steps.length; i++) {
            const s = steps[i];
            const prev = result[result.length - 1];
            // Skip consecutive navigate to same URL
            if (prev && prev.action === 'navigate' && s.action === 'navigate' && prev.value === s.value) {
                continue;
            }
            // Skip consecutive screenshots
            if (prev && prev.action === 'screenshot' && s.action === 'screenshot') {
                continue;
            }
            result.push(s);
        }
        return result;
    }

    /** Actions that REQUIRE a non-empty selector to run */
    static SELECTOR_REQUIRED = new Set([
        'click', 'fill', 'select', 'hover', 'assert_text', 'assert_visible',
        'double_click', 'right_click', 'scroll_to', 'drag_drop', 'upload_file'
    ]);

    /** Ensure starts with navigate, ends with screenshot, strip broken steps, assign step_id */
    static _finalize(steps, url) {
        if (steps.length === 0) return steps;

        // SAFETY: Remove steps that need a selector but have empty/undefined selector
        steps = steps.filter(s => {
            if (ScenarioBuilder.SELECTOR_REQUIRED.has(s.action) && (!s.selector || s.selector.trim() === '')) {
                return false; // Drop this broken step
            }
            // Also remove navigate steps with empty URL
            if (s.action === 'navigate' && !s.value) {
                return false;
            }
            return true;
        });

        if (steps.length === 0) {
            steps = [step('navigate', '', url, '', 'Mở trang web'), step('wait', '', '2000', '', 'Chờ trang tải')];
        }

        // Ensure first step is navigate
        if (steps[0].action !== 'navigate') {
            steps.unshift(step('navigate', '', url, '', 'Mở trang web'));
        }

        // Ensure last step is screenshot
        if (steps[steps.length - 1].action !== 'screenshot') {
            steps.push(step('screenshot', '', '', '', 'Chụp ảnh kết quả'));
        }

        // Assign step_id
        steps.forEach((s, i) => { s.step_id = i + 1; });

        return steps;
    }
}

// ===== MAIN ENGINE =====

class SmartTemplateEngine {
    constructor() {
        this.name = 'smart-template';
        this.displayName = 'Smart Template (Miễn phí)';
    }

    /**
     * Generate test cases from crawl data
     * @param {object} crawlData - { elements: [], metadata: {} }
     * @param {object} options - { url, testType, description }
     * @returns {{ scenarios: [], source: string }}
     */
    generate(crawlData, options = {}) {
        const { url = '' } = options;
        const elements = crawlData.elements || [];
        const metadata = crawlData.metadata || {};

        // 1. Classify elements
        const classifier = new ElementClassifier(elements, metadata);
        const classified = classifier.classify();
        const patterns = classifier.detectPattern(classified);

        console.log(`[SmartTemplate] Detected patterns: ${patterns.join(', ')}`);
        console.log(`[SmartTemplate] Elements: ${elements.length} | Inputs: ${classified.allInputs.length} | Buttons: ${classified.buttons.length} | Links: ${classified.links.length}`);

        // 2. Run matching template generators
        const templateResults = [];

        if (patterns.includes('login')) {
            templateResults.push(generateLoginTests(classified, url));
        }
        if (patterns.includes('registration')) {
            templateResults.push(generateRegistrationTests(classified, url));
        }
        if (patterns.includes('search')) {
            templateResults.push(generateSearchTests(classified, url));
        }
        if (patterns.includes('generic_form')) {
            templateResults.push(generateGenericFormTests(classified, url));
        }
        if (patterns.includes('navigation')) {
            templateResults.push(generateNavigationTests(classified, url));
        }
        if (patterns.includes('buttons')) {
            templateResults.push(generateButtonTests(classified, url));
        }
        if (patterns.includes('dropdown')) {
            templateResults.push(generateDropdownTests(classified, url));
        }
        if (patterns.includes('checkbox_radio')) {
            templateResults.push(generateCheckboxRadioTests(classified, url));
        }
        if (patterns.includes('file_upload')) {
            templateResults.push(generateFileUploadTests(classified, url));
        }
        if (patterns.includes('textarea')) {
            templateResults.push(generateTextareaTests(classified, url));
        }
        if (patterns.includes('tabs')) {
            templateResults.push(generateTabTests(classified, url));
        }
        if (patterns.includes('page_load')) {
            templateResults.push(generatePageLoadTests(classified, url));
        }
        if (patterns.includes('accessibility')) {
            templateResults.push(generateAccessibilityTests(classified, url));
        }

        // 3. Build 3 scenarios
        const scenarios = ScenarioBuilder.build(templateResults, url, metadata);

        console.log(`[SmartTemplate] Generated ${scenarios.length} scenarios: ${scenarios.map(s => `${s.type}(${s.steps.length} steps)`).join(', ')}`);

        return {
            scenarios,
            source: 'smart-template',
            detectedPatterns: patterns
        };
    }
}

module.exports = SmartTemplateEngine;
