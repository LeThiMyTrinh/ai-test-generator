/**
 * NLStepParser — Chuyển đổi ngôn ngữ tự nhiên (tiếng Việt + English) thành test steps
 *
 * UI Actions (10): navigate, click, fill, select, hover,
 *   assert_text, assert_visible, assert_url, wait, screenshot
 * Extended UI (6): double_click, right_click, keyboard, scroll_to, drag_drop, upload_file
 * API Actions (6): api_request, assert_status, assert_body,
 *   assert_header, assert_response_time, store_variable
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
            },

            // === API ACTIONS ===
            // Pattern: Gọi API GET/POST/PUT/DELETE URL với body {...}
            {
                regex: /^(?:gọi|call|send|gửi)\s+(?:API\s+)?(GET|POST|PUT|DELETE|PATCH)\s+(.+?)\s+(?:với|with)\s+(?:body|dữ\s*liệu)\s+(.+)/i,
                action: 'api_request',
                extract: (m) => ({
                    selector: m[1].toUpperCase(),
                    value: this.cleanUrl(m[2].trim()),
                    expected: m[3].trim(),
                    description: m[0]
                })
            },
            // Pattern: Gọi API GET/POST/PUT/DELETE URL
            {
                regex: /^(?:gọi|call|send|gửi)\s+(?:API\s+)?(GET|POST|PUT|DELETE|PATCH)\s+(.+)/i,
                action: 'api_request',
                extract: (m) => ({
                    selector: m[1].toUpperCase(),
                    value: this.cleanUrl(m[2].trim()),
                    description: m[0]
                })
            },
            // Pattern: API GET/POST URL
            {
                regex: /^API\s+(GET|POST|PUT|DELETE|PATCH)\s+(.+)/i,
                action: 'api_request',
                extract: (m) => ({
                    selector: m[1].toUpperCase(),
                    value: this.cleanUrl(m[2].trim()),
                    description: m[0]
                })
            },
            // Pattern: GET/POST URL (bare HTTP method)
            {
                regex: /^(GET|POST|PUT|DELETE|PATCH)\s+(https?:\/\/.+)/i,
                action: 'api_request',
                extract: (m) => ({
                    selector: m[1].toUpperCase(),
                    value: m[2].trim(),
                    description: m[0]
                })
            },

            // Pattern: Kiểm tra status/mã 200
            {
                regex: /^(?:kiểm\s*tra|check|verify|assert|expect)\s+(?:status|mã\s*(?:trạng\s*thái)?|HTTP|response\s*code)\s+(?:(?:là|=|bằng|equals?|is|to\s+be)\s*)?(\d{3})/i,
                action: 'assert_status',
                extract: (m) => ({ expected: m[1], description: m[0] })
            },
            // Pattern: Status 200 / status code 201
            {
                regex: /^status\s*(?:code)?\s*(?:is|=|là)?\s*(\d{3})/i,
                action: 'assert_status',
                extract: (m) => ({ expected: m[1], description: m[0] })
            },

            // Pattern: Kiểm tra body/response $.path = value
            {
                regex: /^(?:kiểm\s*tra|check|verify|assert|expect)\s+(?:body|response|kết\s*quả)\s+(\$[\.\w\[\]]+)\s+(?:là|=|bằng|equals?|chứa|contains?|not_empty|không\s*rỗng)?\s*[""'']?(.+?)?[""'']?\s*$/i,
                action: 'assert_body',
                extract: (m) => ({
                    selector: m[1],
                    expected: m[2]?.trim() || 'not_empty',
                    description: m[0]
                })
            },
            // Pattern: Kiểm tra $.path không rỗng
            {
                regex: /^(?:kiểm\s*tra|check|verify)\s+(\$[\.\w\[\]]+)\s+(?:không\s*rỗng|not\s*empty|exists?|tồn\s*tại)/i,
                action: 'assert_body',
                extract: (m) => ({ selector: m[1], expected: 'not_empty', description: m[0] })
            },

            // Pattern: Kiểm tra header Content-Type chứa application/json
            {
                regex: /^(?:kiểm\s*tra|check|verify|assert)\s+header\s+[""'']?(.+?)[""'']?\s+(?:là|=|chứa|contains?)?\s*[""'']?(.+?)?[""'']?\s*$/i,
                action: 'assert_header',
                extract: (m) => ({
                    selector: m[1].trim().toLowerCase(),
                    expected: m[2]?.trim() || '',
                    description: m[0]
                })
            },

            // Pattern: Kiểm tra response time < 2000ms
            {
                regex: /^(?:kiểm\s*tra|check|verify|assert|expect)\s+(?:response\s*time|thời\s*gian\s*(?:phản\s*hồi)?)\s*[<≤]\s*(\d+)\s*(?:ms)?/i,
                action: 'assert_response_time',
                extract: (m) => ({ expected: m[1], description: m[0] })
            },
            // Pattern: Response time < 5000
            {
                regex: /^response\s*time\s*[<≤]\s*(\d+)\s*(?:ms)?/i,
                action: 'assert_response_time',
                extract: (m) => ({ expected: m[1], description: m[0] })
            },

            // Pattern: Lưu $.data.token vào biến token_var
            {
                regex: /^(?:lưu|store|save|gán|extract)\s+(\$[\.\w\[\]]+)\s+(?:vào|thành|as|to|into)\s+(?:biến\s*)?(\w+)/i,
                action: 'store_variable',
                extract: (m) => ({ selector: m[1], value: m[2], description: m[0] })
            },
            // Pattern: Set variable token = $.data.token
            {
                regex: /^(?:set|đặt)\s+(?:variable|biến)\s+(\w+)\s*=\s*(\$[\.\w\[\]]+)/i,
                action: 'store_variable',
                extract: (m) => ({ selector: m[2], value: m[1], description: m[0] })
            },

            // === EXTENDED UI ACTIONS ===
            // Pattern: Nhấn đúp/double click
            {
                regex: /^(?:nhấn\s*đúp|double\s*click|nháy\s*đúp)\s+(?:vào\s+)?(.+)/i,
                action: 'double_click',
                extract: (m) => ({ selector: this.resolveSelector(m[1].trim()), description: m[0] })
            },
            // Pattern: Chuột phải / right click
            {
                regex: /^(?:chuột\s*phải|right\s*click|nhấn\s*phải)\s+(?:vào\s+)?(.+)/i,
                action: 'right_click',
                extract: (m) => ({ selector: this.resolveSelector(m[1].trim()), description: m[0] })
            },
            // Pattern: Nhấn phím Ctrl+A / Enter / Tab
            {
                regex: /^(?:nhấn\s*phím|press|bấm\s*phím|keyboard)\s+(.+)/i,
                action: 'keyboard',
                extract: (m) => ({ value: m[1].trim(), description: m[0] })
            },
            // Pattern: Cuộn đến / scroll to
            {
                regex: /^(?:cuộn\s*(?:đến|tới)|scroll\s*(?:to|đến))\s+(.+)/i,
                action: 'scroll_to',
                extract: (m) => ({ selector: this.resolveSelector(m[1].trim()), description: m[0] })
            },
            // Pattern: Kéo thả / drag drop
            {
                regex: /^(?:kéo\s*thả|kéo|drag)\s+(.+?)\s+(?:thả\s+(?:vào|tới)|(?:and\s+)?drop\s+(?:to|into)?)\s+(.+)/i,
                action: 'drag_drop',
                extract: (m) => ({
                    selector: this.resolveSelector(m[1].trim()),
                    value: this.resolveSelector(m[2].trim()),
                    description: m[0]
                })
            },
            // Pattern: Upload file
            {
                regex: /^(?:upload|tải\s*lên|đăng\s*tải)\s+(?:file|tệp|tập\s*tin)?\s*(.+?)(?:\s+(?:vào|tại|to)\s+(.+))?$/i,
                action: 'upload_file',
                extract: (m) => ({
                    value: m[1].trim().replace(/^[""'']+|[""'']+$/g, ''),
                    selector: m[2] ? this.resolveSelector(m[2].trim()) : 'input[type="file"]',
                    description: m[0]
                })
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
     * Suggest completions based on partial input
     * @param {string} partial - Partial text input
     * @returns {string[]} Suggested completions
     */
    suggest(partial) {
        if (!partial || partial.length < 2) return [];
        const lower = partial.toLowerCase();
        const suggestions = [
            { prefix: 'mở', template: 'Mở trang https://' },
            { prefix: 'nhập', template: 'Nhập "giá trị" vào ô Tên trường' },
            { prefix: 'nhấn', template: 'Nhấn nút "Tên nút"' },
            { prefix: 'click', template: 'Click vào nút "Tên nút"' },
            { prefix: 'kiểm tra text', template: 'Kiểm tra text "nội dung" hiển thị' },
            { prefix: 'kiểm tra url', template: 'Kiểm tra URL chứa /path' },
            { prefix: 'kiểm tra hiển thị', template: 'Kiểm tra hiển thị phần tử #selector' },
            { prefix: 'chờ', template: 'Chờ 2 giây' },
            { prefix: 'chụp', template: 'Chụp ảnh màn hình' },
            { prefix: 'chọn', template: 'Chọn "giá trị" trong dropdown Tên' },
            { prefix: 'di chuột', template: 'Di chuột vào phần tử #selector' },
            { prefix: 'gọi api', template: 'Gọi API POST https://api.example.com/endpoint với body {"key":"value"}' },
            { prefix: 'api', template: 'API GET https://api.example.com/endpoint' },
            { prefix: 'kiểm tra status', template: 'Kiểm tra status 200' },
            { prefix: 'kiểm tra body', template: 'Kiểm tra body $.data.field = "giá trị"' },
            { prefix: 'kiểm tra header', template: 'Kiểm tra header content-type chứa application/json' },
            { prefix: 'kiểm tra response', template: 'Kiểm tra response time < 5000ms' },
            { prefix: 'lưu', template: 'Lưu $.data.token vào biến token' },
            { prefix: 'nhấn đúp', template: 'Nhấn đúp vào phần tử #selector' },
            { prefix: 'chuột phải', template: 'Chuột phải vào phần tử #selector' },
            { prefix: 'nhấn phím', template: 'Nhấn phím Enter' },
            { prefix: 'cuộn', template: 'Cuộn đến phần tử #selector' },
            { prefix: 'kéo', template: 'Kéo #source thả vào #target' },
            { prefix: 'upload', template: 'Upload file "/path/to/file"' },
        ];
        return suggestions
            .filter(s => s.prefix.startsWith(lower) || lower.startsWith(s.prefix))
            .map(s => s.template)
            .slice(0, 5);
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
