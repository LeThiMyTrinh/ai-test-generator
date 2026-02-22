/**
 * NLStepParser — Chuyển đổi ngôn ngữ tự nhiên (tiếng Việt) thành test steps
 * 
 * Hỗ trợ 10 action types: navigate, click, fill, select, hover,
 * assert_text, assert_visible, assert_url, wait, screenshot
 */

class NLStepParser {
    constructor() {
        // Các pattern nhận diện — ưu tiên từ trên xuống
        this.patterns = [
            // === NAVIGATE ===
            {
                regex: /^(?:mở\s+trang|truy\s+cập|vào\s+trang|đi\s+(?:tới|đến)|go\s+to|open|navigate(?:\s+to)?)\s+(.+)/i,
                action: 'navigate',
                extract: (m) => ({ value: this.cleanUrl(m[1]), description: m[0] })
            },

            // === FILL (nhập vào ô) ===
            // Pattern: Nhập "value" vào ô/trường/input selector
            {
                regex: /^(?:nhập|điền|gõ|ghi|type|enter|input)\s+[""''](.+?)[""'']\s+(?:vào|trong|tại|ở|to|into|in)\s+(?:ô|trường|input|field|textbox|textarea|hộp)?\s*(.+)/i,
                action: 'fill',
                extract: (m) => ({ value: m[1], selector: this.resolveSelector(m[2]), description: m[0] })
            },
            // Pattern: Nhập "value" vào #selector (without ô/trường prefix)
            {
                regex: /^(?:nhập|điền|gõ|ghi|type|enter|input)\s+[""''](.+?)[""'']\s+(?:vào|trong|tại|ở|to|into|in)\s+(.+)/i,
                action: 'fill',
                extract: (m) => ({ value: m[1], selector: this.resolveSelector(m[2]), description: m[0] })
            },
            // Pattern: Tại ô X, nhập "value"
            {
                regex: /^(?:tại|ở|trong)\s+(?:ô|trường|input|field)?\s*(.+?),?\s+(?:nhập|điền|gõ|ghi)\s+[""''](.+?)[""'']/i,
                action: 'fill',
                extract: (m) => ({ value: m[2], selector: this.resolveSelector(m[1]), description: m[0] })
            },

            // === SELECT (chọn dropdown) ===
            {
                regex: /^(?:chọn|select)\s+[""''](.+?)[""'']\s+(?:trong|từ|ở|tại|from|in)\s+(?:dropdown|danh\s*sách|ô|select|menu)?\s*(.+)/i,
                action: 'select',
                extract: (m) => ({ value: m[1], selector: this.resolveSelector(m[2]), description: m[0] })
            },
            // Pattern: Chọn giá trị "X" ở Y
            {
                regex: /^(?:chọn|select)\s+(?:giá\s*trị|option|mục)?\s*[""''](.+?)[""'']\s+(?:ở|tại|trong|from|in)\s+(.+)/i,
                action: 'select',
                extract: (m) => ({ value: m[1], selector: this.resolveSelector(m[2]), description: m[0] })
            },

            // === CLICK ===
            // Pattern: Click/nhấn/bấm (vào) nút/link/ô "X" (with quotes)
            {
                regex: /^(?:click|nhấn|bấm|nhấp|ấn|tap)\s+(?:vào\s+)?(nút|button|link|liên\s*kết|ô|tab|menu|icon|biểu\s*tượng)?\s*[""''](.+?)[""'']/i,
                action: 'click',
                extract: (m) => ({ selector: this.textToClickSelector(m[2], m[1]), description: m[0] })
            },
            // Pattern: Click vào nút/link X (no quotes)  
            {
                regex: /^(?:click|nhấn|bấm|nhấp|ấn|tap)\s+(?:vào\s+)?(nút|button|link|liên\s*kết)\s+(.+)/i,
                action: 'click',
                extract: (m) => ({ selector: this.textToClickSelector(m[2].trim(), m[1]), description: m[0] })
            },
            // Pattern: Click vào phần tử selector
            {
                regex: /^(?:click|nhấn|bấm|nhấp|ấn|tap)\s+(?:vào\s+)?(?:phần\s*tử|element)?\s*(.+)/i,
                action: 'click',
                extract: (m) => ({ selector: this.resolveSelector(m[1].trim()), description: m[0] })
            },

            // === HOVER ===
            {
                regex: /^(?:di\s+chuột|hover|rê\s+chuột|trỏ\s+chuột)\s+(?:vào|qua|lên|tới|over|on)?\s*(.+)/i,
                action: 'hover',
                extract: (m) => ({ selector: this.resolveSelector(m[1].trim()), description: m[0] })
            },

            // === ASSERT_TEXT ===
            // Pattern: Kiểm tra text "X" hiển thị tại/ở Y
            {
                regex: /^(?:kiểm\s*tra|xác\s*nhận|verify|assert|check)\s+(?:text|chữ|nội\s*dung|văn\s*bản)?\s*[""''](.+?)[""'']\s+(?:hiển\s*thị|xuất\s*hiện|có|visible|shown|appear)\s*(?:tại|ở|trong|trên|at|in|on)?\s*(.+)?/i,
                action: 'assert_text',
                extract: (m) => ({
                    expected: m[1],
                    selector: m[2] ? this.resolveSelector(m[2].trim()) : 'body',
                    description: m[0]
                })
            },
            // Pattern: Kiểm tra phần tử Y chứa text "X"
            {
                regex: /^(?:kiểm\s*tra|xác\s*nhận|verify|assert|check)\s+(?:phần\s*tử|element)?\s*(.+?)\s+(?:chứa|có\s+(?:text|chữ|nội\s*dung)|contains)\s+[""''](.+?)[""'']/i,
                action: 'assert_text',
                extract: (m) => ({
                    expected: m[2],
                    selector: this.resolveSelector(m[1].trim()),
                    description: m[0]
                })
            },

            // === ASSERT_URL ===
            {
                regex: /^(?:kiểm\s*tra|xác\s*nhận|verify|assert|check)\s+(?:URL|đường\s*dẫn|địa\s*chỉ|trang)\s+(?:là|chứa|bằng|contains|equals|is)?\s*[""'']?(.+?)[""'']?\s*$/i,
                action: 'assert_url',
                extract: (m) => ({ expected: m[1].trim(), description: m[0] })
            },
            // Pattern: Xác nhận đã chuyển tới/đang ở trang X
            {
                regex: /^(?:xác\s*nhận|kiểm\s*tra|verify)\s+(?:đã\s+)?(?:chuyển\s+(?:tới|đến|sang)|đang\s+ở|ở)\s+(?:trang\s+)?(.+)/i,
                action: 'assert_url',
                extract: (m) => ({ expected: m[1].trim(), description: m[0] })
            },

            // === ASSERT_VISIBLE (with text check) ===
            // Pattern: Kiểm tra hiển thị element "text" → assert_text (text inside a visible element)
            {
                regex: /^(?:kiểm\s*tra|xác\s*nhận|verify|assert|check)\s+(?:hiển\s*thị|xuất\s*hiện|có)\s+(?:phần\s*tử|element)?\s*(.+?)\s+[""''](.+?)[""'']\s*$/i,
                action: 'assert_text',
                extract: (m) => ({
                    expected: m[2],
                    selector: this.resolveSelector(m[1].trim()),
                    description: m[0]
                })
            },

            // === ASSERT_VISIBLE ===
            {
                regex: /^(?:kiểm\s*tra|xác\s*nhận|verify|assert|check)\s+(?:phần\s*tử|element|nút|button|ô|input|text|chữ)?\s*(.+?)\s+(?:hiển\s*thị|xuất\s*hiện|nhìn\s*thấy|visible|shown|appear|exists)/i,
                action: 'assert_visible',
                extract: (m) => ({ selector: this.resolveSelector(m[1].trim()), description: m[0] })
            },
            // Pattern: Kiểm tra hiển thị "text" (no element name → assert_text on body)
            {
                regex: /^(?:kiểm\s*tra|xác\s*nhận|verify)\s+(?:hiển\s*thị|xuất\s*hiện|có)\s+[""''](.+?)[""'']\s*$/i,
                action: 'assert_text',
                extract: (m) => ({ expected: m[1], selector: 'body', description: m[0] })
            },
            // Pattern: Kiểm tra hiển thị phần tử X
            {
                regex: /^(?:kiểm\s*tra|xác\s*nhận|verify)\s+(?:hiển\s*thị|có)\s+(?:phần\s*tử|element)?\s*(.+)/i,
                action: 'assert_visible',
                extract: (m) => ({ selector: this.resolveSelector(m[1].trim()), description: m[0] })
            },

            // === WAIT ===
            {
                regex: /^(?:chờ|đợi|wait)\s+(\d+)\s*(?:giây|s|seconds?|sec)/i,
                action: 'wait',
                extract: (m) => ({ value: String(parseInt(m[1]) * 1000), description: m[0] })
            },
            {
                regex: /^(?:chờ|đợi|wait)\s+(\d+)\s*(?:ms|mili|milliseconds?)/i,
                action: 'wait',
                extract: (m) => ({ value: m[1], description: m[0] })
            },

            // === SCREENSHOT ===
            {
                regex: /^(?:chụp\s+(?:ảnh|hình|màn\s*hình|screenshot)|screenshot|capture)/i,
                action: 'screenshot',
                extract: (m) => ({ description: m[0] })
            }
        ];
    }

    /**
     * Parse multiple lines of natural language into steps array
     * @param {string} text - Multi-line text, each line = 1 step
     * @returns {{ steps: Array, warnings: Array }}
     */
    parse(text) {
        const lines = text.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0)
            // Remove numbering prefixes: "1.", "1)", "1:", "Bước 1:", "Step 1:"
            .map(l => l.replace(/^(?:\d+[\.\)\:]\s*|(?:bước|step)\s+\d+[\.\:\)]\s*)/i, '').trim());

        const steps = [];
        const warnings = [];

        lines.forEach((line, idx) => {
            const result = this.parseLine(line);
            if (result) {
                steps.push({
                    step_id: idx + 1,
                    action: result.action,
                    selector: result.selector || '',
                    value: result.value || '',
                    expected: result.expected || '',
                    description: result.description || line
                });
            } else {
                warnings.push({
                    line: idx + 1,
                    text: line,
                    message: `Không thể nhận diện hành động. Hãy thử diễn đạt lại, ví dụ: "Nhấn nút X", "Nhập 'Y' vào ô Z", "Kiểm tra text 'A' hiển thị"`
                });
            }
        });

        return { steps, warnings };
    }

    /**
     * Parse a single line of natural language
     */
    parseLine(line) {
        for (const pattern of this.patterns) {
            const match = line.match(pattern.regex);
            if (match) {
                const extracted = pattern.extract(match);
                return {
                    action: pattern.action,
                    ...extracted
                };
            }
        }
        return null;
    }

    /**
     * Resolve a selector reference — could be CSS selector, label text, etc.
     */
    resolveSelector(raw) {
        if (!raw) return '';
        let s = raw.trim();

        // Remove surrounding quotes
        s = s.replace(/^[""'']+|[""'']+$/g, '');

        // Already a CSS/XPath selector?
        if (/^[#\.\[\/:@]/.test(s) || /^(\/\/)/.test(s)) return s;

        // Common Vietnamese label → selector mapping
        const labelMap = {
            'email': 'input[type="email"], input[name="email"], #email, [placeholder*="email" i]',
            'mật khẩu': 'input[type="password"], input[name="password"], #password, [placeholder*="mật khẩu" i]',
            'password': 'input[type="password"], input[name="password"], #password',
            'tên đăng nhập': 'input[name="username"], #username, [placeholder*="tên đăng nhập" i]',
            'username': 'input[name="username"], #username',
            'tìm kiếm': 'input[type="search"], input[name="q"], input[name="search"], [placeholder*="tìm" i]',
            'search': 'input[type="search"], input[name="q"], input[name="search"]',
        };

        const lower = s.toLowerCase();
        if (labelMap[lower]) return labelMap[lower];

        // Handle inputs containing embedded quoted text: "toast 'Xin chào'" → .toast:has-text("Xin chào")
        const quotedMatch = s.match(/^(.+?)\s+[""''](.+?)[""'']\s*$/);
        if (quotedMatch) {
            const element = quotedMatch[1].trim();
            const text = quotedMatch[2];
            // Map common Vietnamese element names to selectors
            const elMap = {
                'toast': '.toast, .Toastify, [role="alert"], [class*="toast"], [class*="notification"]',
                'thông báo': '.toast, [role="alert"], .alert, [class*="toast"], [class*="notification"]',
                'popup': '.modal, .popup, [role="dialog"]',
                'modal': '.modal, [role="dialog"]',
                'dialog': '[role="dialog"], .modal',
                'alert': '[role="alert"], .alert',
                'menu': '[role="menu"], .menu, nav',
                'header': 'header, .header, [role="banner"]',
                'footer': 'footer, .footer',
                'sidebar': 'aside, .sidebar',
                'bảng': 'table',
                'table': 'table',
            };
            const elLower = element.toLowerCase();
            if (elMap[elLower]) {
                // Use first selector from map with :has-text filter
                const selectors = elMap[elLower].split(',').map(s => s.trim());
                return selectors.map(sel => `${sel}:has-text("${text}")`).join(', ');
            }
            // If element looks like a CSS selector, use it directly with :has-text
            if (/^[#\.[a-z]/i.test(element)) {
                return `${element}:has-text("${text}")`;
            }
            // Generic: use text= selector as fallback
            return `text="${text}"`;
        }

        // If it looks like a human label, convert to a label/placeholder based selector
        if (/^[a-zA-ZÀ-ỹ\s]+$/.test(s) && s.length < 50) {
            // Try: label-based, placeholder-based, aria-label, text content
            return `[placeholder*="${s}" i], [aria-label*="${s}" i], label:has-text("${s}") + input, label:has-text("${s}") + select, label:has-text("${s}") + textarea`;
        }

        return s;
    }

    /**
     * Convert text content into a click-able selector
     * @param {string} text - The text to match
     * @param {string} elementType - Optional hint: nút/button/link etc.
     */
    textToClickSelector(text, elementType) {
        if (!text) return '';
        let s = text.trim().replace(/^[""'']+|[""'']+$/g, '');

        // Already a selector?
        if (/^[#\.\[\/:@]/.test(s)) return s;

        // Map Vietnamese element types to CSS tags
        const typeStr = (elementType || '').trim().toLowerCase();
        if (typeStr === 'nút' || typeStr === 'button') {
            return `button:has-text("${s}"), input[type="submit"][value="${s}"], [role="button"]:has-text("${s}")`;
        }
        if (typeStr === 'link' || typeStr.startsWith('liên')) {
            return `a:has-text("${s}")`;
        }
        if (typeStr === 'tab') {
            return `[role="tab"]:has-text("${s}")`;
        }
        if (typeStr === 'menu') {
            return `[role="menuitem"]:has-text("${s}"), li:has-text("${s}")`;
        }

        // Default: try button first, then any clickable element
        return `button:has-text("${s}"), a:has-text("${s}"), [role="button"]:has-text("${s}"), text="${s}"`;
    }

    /**
     * Clean and normalize URL
     */
    cleanUrl(raw) {
        let url = raw.trim().replace(/^[""'']+|[""'']+$/g, '');
        if (url && !url.startsWith('http') && !url.startsWith('/')) {
            url = 'https://' + url;
        }
        return url;
    }
}

module.exports = NLStepParser;
