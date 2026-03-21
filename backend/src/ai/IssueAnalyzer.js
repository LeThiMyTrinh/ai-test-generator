/**
 * IssueAnalyzer - Smart analysis without API
 * Automatically score, classify, and suggest fixes for UI issues
 */

class IssueAnalyzer {
    constructor() {
        // Base severity scores for each issue type
        this.baseScores = {
            // Blocking
            'NAVIGATION_ERROR': 100,
            'BROKEN_IMAGE': 90,
            'JS_ERROR': 85,
            'HORIZONTAL_SCROLLBAR': 80,
            'BROKEN_LINK': 75,
            'OVERFLOW_X': 65,
            'CONSOLE_ERROR': 60,
            // Color & Contrast
            'UNREADABLE_ON_BG': 80,
            'LOW_CONTRAST': 55,
            'COLOR_INCONSISTENCY': 35,
            // Typography
            'FONT_NOT_LOADED': 70,
            'FONT_SIZE_TOO_SMALL': 60,
            'TOO_MANY_FONTS': 35,
            'LINE_HEIGHT_TIGHT': 30,
            // Layout
            'ELEMENT_OVERLAP': 75,
            'EMPTY_CONTAINER': 35,
            'IRREGULAR_SPACING': 20,
            'ALIGNMENT_OFF': 25,
            // SEO
            'MISSING_VIEWPORT_META': 85,
            'MISSING_TITLE': 60,
            'MISSING_META_DESC': 45,
            'MISSING_LANG': 40,
            'MISSING_FAVICON': 35,
            'MULTIPLE_H1': 35,
            'HEADING_SKIP': 20,
            'MISSING_OG_TAGS': 15,
            // Forms
            'INPUT_WITHOUT_LABEL': 60,
            'FORM_NO_SUBMIT': 50,
            'PLACEHOLDER_AS_LABEL': 40,
            'MISSING_AUTOCOMPLETE': 15,
            // Images
            'OVERSIZED_IMAGE': 40,
            'CLS_PRONE': 55,
            'NO_LAZY_LOADING': 20,
            'NO_WEBP_SUPPORT': 15,
            // Original
            'MISSING_ALT': 50,
            'TEXT_TRUNCATED': 45,
            'SMALL_TOUCH_TARGET': 40,
            'OUTSIDE_VIEWPORT': 38,
            'DISTORTED_IMAGE': 30,
            'RESPONSIVE_HIDDEN': 25,
            'ACCESSIBILITY': 50,
            // Performance
            'RENDER_BLOCKING_SCRIPT': 45,
            'TOO_MANY_THIRD_PARTY': 25,
        };

        // Issue type categories
        this.categories = {
            blocking: ['NAVIGATION_ERROR', 'JS_ERROR'],
            critical_ux: ['HORIZONTAL_SCROLLBAR', 'BROKEN_IMAGE', 'BROKEN_LINK'],
            layout: ['OVERFLOW_X', 'OUTSIDE_VIEWPORT', 'RESPONSIVE_HIDDEN', 'ELEMENT_OVERLAP', 'EMPTY_CONTAINER', 'IRREGULAR_SPACING', 'ALIGNMENT_OFF'],
            color_contrast: ['LOW_CONTRAST', 'COLOR_INCONSISTENCY', 'UNREADABLE_ON_BG'],
            typography: ['TOO_MANY_FONTS', 'FONT_SIZE_TOO_SMALL', 'LINE_HEIGHT_TIGHT', 'FONT_NOT_LOADED'],
            seo: ['MISSING_TITLE', 'MISSING_META_DESC', 'MISSING_OG_TAGS', 'MISSING_VIEWPORT_META', 'MULTIPLE_H1', 'HEADING_SKIP', 'MISSING_LANG', 'MISSING_FAVICON'],
            forms: ['INPUT_WITHOUT_LABEL', 'FORM_NO_SUBMIT', 'PLACEHOLDER_AS_LABEL', 'MISSING_AUTOCOMPLETE'],
            accessibility: ['MISSING_ALT', 'SMALL_TOUCH_TARGET', 'ACCESSIBILITY'],
            images: ['DISTORTED_IMAGE', 'OVERSIZED_IMAGE', 'CLS_PRONE', 'NO_LAZY_LOADING', 'NO_WEBP_SUPPORT'],
            visual: ['TEXT_TRUNCATED'],
            performance: ['CONSOLE_ERROR', 'RENDER_BLOCKING_SCRIPT', 'TOO_MANY_THIRD_PARTY']
        };
    }

    /**
     * Analyze all issues and add intelligent scoring
     */
    analyzeIssues(issues, context = {}) {
        const analyzed = issues.map(issue => this.analyzeIssue(issue, context));

        // Detect patterns
        const patterns = this.detectPatterns(analyzed);

        // Apply pattern adjustments
        const adjusted = this.applyPatternAdjustments(analyzed, patterns);

        // Sort by priority
        const sorted = adjusted.sort((a, b) => b.score - a.score);

        return {
            issues: sorted,
            patterns,
            summary: this.generateSummary(sorted, patterns)
        };
    }

    /**
     * Analyze single issue
     */
    analyzeIssue(issue, context) {
        let score = this.baseScores[issue.type] || 50;
        const metadata = {
            category: this.getCategory(issue.type),
            userImpact: 'MEDIUM',
            fixEffort: 'MEDIUM',
            priority: 'SHOULD_FIX'
        };

        // Factor 1: Viewport impact (+0 to +20)
        if (issue.viewport === 'mobile') {
            score += 15;  // Mobile is critical
            metadata.mobileImpact = true;
        } else if (issue.viewport === 'all') {
            score += 20;  // Affects all devices
            metadata.crossDevice = true;
        } else if (issue.viewport === 'cross') {
            score += 10;  // Responsive issue
        }

        // Factor 2: Element importance (+0 to +15)
        const importance = this.assessElementImportance(issue);
        score += importance.bonus;
        metadata.importance = importance.level;

        // Factor 3: User impact estimation (+0 to +25)
        const impact = this.assessUserImpact(issue);
        score += impact.bonus;
        metadata.userImpact = impact.level;

        // Factor 4: Frequency penalty (-5 to -20)
        if (context.similarCount && context.similarCount > 5) {
            score -= Math.min(20, context.similarCount);
            metadata.systematic = true;
        }

        // Factor 5: False positive detection (-30 to 0)
        const falsePositive = this.detectFalsePositive(issue);
        if (falsePositive.likely) {
            score -= falsePositive.penalty;
            metadata.likelyFalsePositive = true;
            metadata.falsePositiveReason = falsePositive.reason;
        }

        // Normalize score
        score = Math.max(0, Math.min(100, score));

        // Determine priority
        metadata.priority = this.scoreToPriority(score);
        metadata.fixEffort = this.estimateFixEffort(issue);

        // Generate auto-fix suggestion
        const autoFix = this.generateAutoFix(issue);

        return {
            ...issue,
            score: Math.round(score),
            metadata,
            autoFix
        };
    }

    /**
     * Assess element importance on page
     */
    assessElementImportance(issue) {
        const selector = issue.selector || '';
        const description = issue.description || '';
        let bonus = 0;
        let level = 'LOW';

        // High importance elements
        if (selector.includes('button') || description.includes('button')) {
            bonus += 10;
            level = 'HIGH';
        } else if (selector.includes('nav') || selector.includes('header')) {
            bonus += 15;
            level = 'CRITICAL';
        } else if (selector.includes('form') || selector.includes('input')) {
            bonus += 12;
            level = 'HIGH';
        } else if (selector.includes('cta') || selector.includes('primary')) {
            bonus += 15;
            level = 'CRITICAL';
        } else if (selector.includes('hero') || selector.includes('banner')) {
            bonus += 8;
            level = 'MEDIUM';
        } else if (selector.includes('footer')) {
            bonus += 3;
            level = 'LOW';
        } else {
            bonus += 5;
            level = 'MEDIUM';
        }

        return { bonus, level };
    }

    /**
     * Assess user impact
     */
    assessUserImpact(issue) {
        const desc = (issue.description || '').toLowerCase();
        let bonus = 0;
        let level = 'LOW';

        // Blocking keywords
        if (desc.includes('không thể') || desc.includes('cannot')) {
            bonus += 25;
            level = 'CRITICAL';
        } else if (desc.includes('bị hỏng') || desc.includes('broken')) {
            bonus += 20;
            level = 'HIGH';
        } else if (desc.includes('lỗi') || desc.includes('error')) {
            bonus += 15;
            level = 'HIGH';
        } else if (desc.includes('thiếu') || desc.includes('missing')) {
            bonus += 10;
            level = 'MEDIUM';
        } else if (desc.includes('quá nhỏ') || desc.includes('too small')) {
            bonus += 8;
            level = 'MEDIUM';
        } else {
            bonus += 5;
            level = 'LOW';
        }

        return { bonus, level };
    }

    /**
     * Detect false positives
     */
    detectFalsePositive(issue) {
        let likely = false;
        let penalty = 0;
        let reason = '';

        const type = issue.type;
        const selector = issue.selector || '';
        const viewport = issue.viewport;

        // Case 1: RESPONSIVE_HIDDEN for nav/menu is often intentional
        if (type === 'RESPONSIVE_HIDDEN' && (selector.includes('nav') || selector.includes('menu'))) {
            likely = true;
            penalty = 30;
            reason = 'Mobile menus are commonly hidden and shown via hamburger icon';
        }

        // Case 2: OVERFLOW_X on code blocks is intentional
        if (type === 'OVERFLOW_X' && (selector.includes('code') || selector.includes('pre'))) {
            likely = true;
            penalty = 25;
            reason = 'Code blocks often have horizontal scroll by design';
        }

        // Case 3: Small elements on desktop that are fine on mobile
        if (type === 'SMALL_TOUCH_TARGET' && viewport === 'desktop') {
            likely = true;
            penalty = 35;
            reason = 'Touch target size only matters on mobile devices';
        }

        // Case 4: Hidden elements that might be for screen readers
        if (type === 'OUTSIDE_VIEWPORT' && selector.includes('sr-only')) {
            likely = true;
            penalty = 40;
            reason = 'Screen reader only elements are intentionally hidden';
        }

        return { likely, penalty, reason };
    }

    /**
     * Convert score to priority label
     */
    scoreToPriority(score) {
        if (score >= 85) return 'CRITICAL';
        if (score >= 70) return 'MUST_FIX';
        if (score >= 50) return 'SHOULD_FIX';
        if (score >= 30) return 'NICE_TO_HAVE';
        return 'MINOR';
    }

    /**
     * Estimate fix effort
     */
    estimateFixEffort(issue) {
        const effortMap = {
            'MISSING_ALT': 'LOW', 'DISTORTED_IMAGE': 'LOW', 'TEXT_TRUNCATED': 'LOW',
            'SMALL_TOUCH_TARGET': 'LOW', 'LOW_CONTRAST': 'MEDIUM', 'OVERFLOW_X': 'MEDIUM',
            'BROKEN_LINK': 'MEDIUM', 'RESPONSIVE_HIDDEN': 'MEDIUM',
            'HORIZONTAL_SCROLLBAR': 'HIGH', 'BROKEN_IMAGE': 'MEDIUM',
            'JS_ERROR': 'HIGH', 'NAVIGATION_ERROR': 'HIGH',
            // New types
            'COLOR_INCONSISTENCY': 'HIGH', 'UNREADABLE_ON_BG': 'LOW',
            'TOO_MANY_FONTS': 'MEDIUM', 'FONT_SIZE_TOO_SMALL': 'LOW',
            'LINE_HEIGHT_TIGHT': 'LOW', 'FONT_NOT_LOADED': 'MEDIUM',
            'ELEMENT_OVERLAP': 'MEDIUM', 'EMPTY_CONTAINER': 'LOW',
            'IRREGULAR_SPACING': 'MEDIUM', 'ALIGNMENT_OFF': 'MEDIUM',
            'MISSING_TITLE': 'LOW', 'MISSING_META_DESC': 'LOW',
            'MISSING_OG_TAGS': 'LOW', 'MISSING_VIEWPORT_META': 'LOW',
            'MULTIPLE_H1': 'LOW', 'HEADING_SKIP': 'LOW', 'MISSING_LANG': 'LOW',
            'MISSING_FAVICON': 'LOW',
            'INPUT_WITHOUT_LABEL': 'LOW', 'FORM_NO_SUBMIT': 'LOW',
            'PLACEHOLDER_AS_LABEL': 'LOW', 'MISSING_AUTOCOMPLETE': 'LOW',
            'OVERSIZED_IMAGE': 'MEDIUM', 'CLS_PRONE': 'LOW',
            'NO_LAZY_LOADING': 'LOW', 'NO_WEBP_SUPPORT': 'MEDIUM',
            'RENDER_BLOCKING_SCRIPT': 'MEDIUM', 'TOO_MANY_THIRD_PARTY': 'MEDIUM',
        };

        return effortMap[issue.type] || 'MEDIUM';
    }

    /**
     * Detect patterns in issues
     */
    detectPatterns(issues) {
        const patterns = {
            systematic: [],
            isolated: [],
            falsePositives: []
        };

        // Group by type
        const byType = {};
        issues.forEach(issue => {
            if (!byType[issue.type]) byType[issue.type] = [];
            byType[issue.type].push(issue);
        });

        // Detect systematic issues (same type appears 5+ times)
        Object.entries(byType).forEach(([type, list]) => {
            if (list.length >= 5) {
                patterns.systematic.push({
                    type,
                    count: list.length,
                    avgScore: Math.round(list.reduce((sum, i) => sum + i.score, 0) / list.length),
                    suggestion: this.getSystematicSuggestion(type, list.length)
                });
            }
        });

        // Detect isolated issues
        Object.entries(byType).forEach(([type, list]) => {
            if (list.length === 1 && list[0].score >= 70) {
                patterns.isolated.push(list[0]);
            }
        });

        // Collect likely false positives
        patterns.falsePositives = issues.filter(i => i.metadata?.likelyFalsePositive);

        return patterns;
    }

    /**
     * Get suggestion for systematic issues
     */
    getSystematicSuggestion(type, count) {
        const suggestions = {
            'MISSING_ALT': `${count} ảnh thiếu alt text → Thêm global alt text policy, dùng linter để check`,
            'OVERFLOW_X': `${count} elements tràn → Kiểm tra CSS global (box-sizing, max-width), có thể do component reuse`,
            'SMALL_TOUCH_TARGET': `${count} touch targets nhỏ → Tăng base button/link padding globally`,
            'TEXT_TRUNCATED': `${count} chữ bị cắt → Review container widths, có thể cần responsive font sizing`,
            'LOW_CONTRAST': `${count} vấn đề tương phản → Review color palette, có thể cần cập nhật design system`
        };

        return suggestions[type] || `${count} lỗi ${type} → Có thể là vấn đề hệ thống, nên fix cùng lúc`;
    }

    /**
     * Apply pattern-based adjustments
     */
    applyPatternAdjustments(issues, patterns) {
        return issues.map(issue => {
            const adjusted = { ...issue };

            // Boost systematic issues
            const systematic = patterns.systematic.find(p => p.type === issue.type);
            if (systematic && systematic.count >= 10) {
                adjusted.score = Math.min(100, adjusted.score + 10);
                adjusted.metadata.systematicBoost = true;
            }

            return adjusted;
        });
    }

    /**
     * Generate summary
     */
    generateSummary(issues, patterns) {
        const summary = {
            total: issues.length,
            byPriority: {
                CRITICAL: issues.filter(i => i.metadata.priority === 'CRITICAL').length,
                MUST_FIX: issues.filter(i => i.metadata.priority === 'MUST_FIX').length,
                SHOULD_FIX: issues.filter(i => i.metadata.priority === 'SHOULD_FIX').length,
                NICE_TO_HAVE: issues.filter(i => i.metadata.priority === 'NICE_TO_HAVE').length,
                MINOR: issues.filter(i => i.metadata.priority === 'MINOR').length
            },
            byCategory: {},
            systematicProblems: patterns.systematic.length,
            likelyFalsePositives: patterns.falsePositives.length,
            topIssues: issues.slice(0, 5).map(i => ({
                type: i.type,
                score: i.score,
                priority: i.metadata.priority,
                description: i.description
            }))
        };

        // Count by category
        Object.keys(this.categories).forEach(cat => {
            summary.byCategory[cat] = issues.filter(i => this.getCategory(i.type) === cat).length;
        });

        return summary;
    }

    /**
     * Get category for issue type
     */
    getCategory(type) {
        for (const [category, types] of Object.entries(this.categories)) {
            if (types.includes(type)) return category;
        }
        return 'other';
    }

    /**
     * Generate auto-fix suggestion
     */
    generateAutoFix(issue) {
        const fixes = {
            'HORIZONTAL_SCROLLBAR': {
                title: 'Khắc phục thanh cuộn ngang',
                description: 'Tìm element có width vượt quá viewport và điều chỉnh',
                code: `/* CSS Fix */\nbody {\n  overflow-x: hidden;\n  max-width: 100vw;\n}\n\n/* Hoặc fix element cụ thể */\n.container {\n  max-width: 100%;\n  overflow-x: auto; /* Nếu cần scroll */\n}`,
                steps: [
                    'Mở DevTools → Elements → Tìm element có scrollWidth > viewport',
                    'Kiểm tra CSS: width, padding, margin của element',
                    'Thêm max-width: 100% hoặc overflow-x: hidden',
                    'Test lại trên mobile'
                ],
                difficulty: 'MEDIUM',
                estimatedTime: '10-20 phút'
            },

            'MISSING_ALT': {
                title: 'Thêm alt text cho ảnh',
                description: 'Ảnh cần có mô tả để hỗ trợ SEO và người khiếm thị',
                code: `<!-- Before -->\n<img src="/image.jpg">\n\n<!-- After -->\n<img src="/image.jpg" alt="Mô tả chi tiết ảnh">`,
                steps: [
                    'Tìm ảnh trong code (HTML/JSX)',
                    'Thêm attribute alt="mô tả ngắn gọn"',
                    'Alt text nên mô tả nội dung ảnh, không phải "image" hoặc "photo"',
                    'Nếu ảnh decorative, dùng alt=""'
                ],
                difficulty: 'LOW',
                estimatedTime: '1-2 phút'
            },

            'BROKEN_IMAGE': {
                title: 'Sửa ảnh bị hỏng',
                description: 'Ảnh không load được do đường dẫn sai hoặc file không tồn tại',
                steps: [
                    'Kiểm tra đường dẫn ảnh có đúng không',
                    'Verify file ảnh có tồn tại trên server',
                    'Check permissions (403 error)',
                    'Thêm fallback image nếu cần: <img src="..." onerror="this.src=\'/fallback.jpg\'">'
                ],
                difficulty: 'MEDIUM',
                estimatedTime: '5-10 phút'
            },

            'SMALL_TOUCH_TARGET': {
                title: 'Tăng kích thước touch target',
                description: 'Button/link quá nhỏ trên mobile, khó bấm',
                code: `/* CSS Fix */\nbutton, a {\n  min-width: 44px;\n  min-height: 44px;\n  padding: 12px 16px;\n}\n\n/* Tăng khoảng cách giữa các targets */\nbutton + button {\n  margin-left: 8px;\n}`,
                steps: [
                    'Mở DevTools trên mobile viewport',
                    'Kiểm tra kích thước button/link (phải >= 44×44px)',
                    'Thêm padding hoặc min-width/min-height',
                    'Đảm bảo khoảng cách giữa các targets >= 8px'
                ],
                difficulty: 'LOW',
                estimatedTime: '5 phút'
            },

            'TEXT_TRUNCATED': {
                title: 'Sửa text bị cắt',
                description: 'Nội dung bị ẩn do container quá nhỏ',
                code: `/* Option 1: Cho phép xuống dòng */\n.text {\n  overflow: visible;\n  white-space: normal;\n}\n\n/* Option 2: Hiện dấu ... */\n.text {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n/* Option 3: Tăng container */\n.container {\n  width: auto;\n  min-width: 200px;\n}`,
                steps: [
                    'Kiểm tra CSS của text và container',
                    'Quyết định: cho phép xuống dòng HOẶC hiện ... HOẶC tăng container',
                    'Test với nội dung dài và ngắn',
                    'Verify trên mobile và desktop'
                ],
                difficulty: 'LOW',
                estimatedTime: '5-10 phút'
            },

            'BROKEN_LINK': {
                title: 'Sửa link bị lỗi',
                description: 'Link trả về 404 hoặc error',
                steps: [
                    'Copy link URL',
                    'Test link trong browser (kiểm tra 404/500)',
                    'Nếu trang đã move → Update link URL',
                    'Nếu trang đã xóa → Xóa link hoặc chuyển hướng',
                    'Thêm rel="nofollow" nếu link external không tin cậy'
                ],
                difficulty: 'MEDIUM',
                estimatedTime: '5-10 phút'
            },

            'OVERFLOW_X': {
                title: 'Sửa element tràn ngang',
                description: 'Element có chiều rộng vượt quá container',
                code: `/* Fix cho element cụ thể */\n.element {\n  max-width: 100%;\n  box-sizing: border-box;\n}\n\n/* Nếu cần scroll */\n.element {\n  overflow-x: auto;\n  -webkit-overflow-scrolling: touch;\n}`,
                steps: [
                    'Inspect element bị overflow',
                    'Kiểm tra width, padding, margin',
                    'Thêm max-width: 100%',
                    'Hoặc wrap trong container có overflow-x: auto'
                ],
                difficulty: 'MEDIUM',
                estimatedTime: '10-15 phút'
            },

            'JS_ERROR': {
                title: 'Debug JavaScript error',
                description: 'Có lỗi JavaScript chặn functionality',
                steps: [
                    'Mở Console trong DevTools',
                    'Copy error message và stack trace',
                    'Tìm file và dòng code gây lỗi',
                    'Debug: kiểm tra biến undefined, API call failed, etc.',
                    'Fix và test lại'
                ],
                difficulty: 'HIGH',
                estimatedTime: '30-60 phút'
            },

            'LOW_CONTRAST': {
                title: 'Cải thiện độ tương phản',
                description: 'Màu chữ và background tương phản thấp, khó đọc',
                code: `/* Ví dụ fix */\n.text {\n  /* Bad: #999 on #ccc = 2:1 */\n  color: #999;\n  background: #ccc;\n}\n\n/* Good: #333 on #fff = 12:1 */\n.text {\n  color: #333;\n  background: #fff;\n}`,
                steps: [
                    'Dùng tool check contrast: https://webaim.org/resources/contrastchecker/',
                    'Đảm bảo tỷ lệ >= 4.5:1 (text thường) hoặc >= 3:1 (text lớn)',
                    'Điều chỉnh màu chữ hoặc background',
                    'Test lại với DevTools'
                ],
                difficulty: 'MEDIUM',
                estimatedTime: '10-20 phút'
            },

            'DISTORTED_IMAGE': {
                title: 'Sửa ảnh bị méo',
                description: 'Ảnh bị kéo giãn không đúng tỉ lệ',
                code: `/* Fix CSS */\nimg {\n  width: auto;\n  height: auto;\n  max-width: 100%;\n  object-fit: cover; /* hoặc contain */\n}`,
                steps: [
                    'Xóa fixed width/height trên img tag',
                    'Dùng CSS max-width: 100%',
                    'Thêm object-fit: cover để giữ tỷ lệ',
                    'Hoặc crop ảnh về đúng tỷ lệ cần thiết'
                ],
                difficulty: 'LOW',
                estimatedTime: '5 phút'
            },

            // ===== NEW ENHANCED CHECKS =====

            'COLOR_INCONSISTENCY': {
                title: 'Giảm số lượng màu sắc',
                description: 'Trang dùng quá nhiều màu khác nhau, thiếu design system',
                code: `/* Dùng CSS custom properties */\n:root {\n  --color-primary: #1a73e8;\n  --color-secondary: #5f6368;\n  --color-text: #202124;\n  --color-bg: #ffffff;\n}\n\n.text { color: var(--color-text); }`,
                steps: ['Xác định 4-6 màu chính cho brand', 'Tạo CSS variables cho color palette', 'Thay thế hardcoded colors bằng variables', 'Review lại trên các trang khác'],
                difficulty: 'MEDIUM', estimatedTime: '30-60 phút'
            },

            'TOO_MANY_FONTS': {
                title: 'Giảm số lượng font',
                description: 'Trang dùng quá nhiều font family, không nhất quán',
                code: `/* Chọn tối đa 2-3 font */\nbody { font-family: 'Inter', sans-serif; }\nh1, h2, h3 { font-family: 'Playfair Display', serif; }\ncode { font-family: 'Fira Code', monospace; }`,
                steps: ['Chọn 1 font cho body text, 1 cho headings', 'Xóa các font không cần thiết khỏi @font-face', 'Update CSS cho tất cả elements', 'Kiểm tra font loading performance'],
                difficulty: 'MEDIUM', estimatedTime: '20-30 phút'
            },

            'FONT_SIZE_TOO_SMALL': {
                title: 'Tăng font size',
                description: 'Font quá nhỏ, khó đọc đặc biệt trên mobile',
                code: `/* Minimum font sizes */\nbody { font-size: 16px; }\nsmall, .caption { font-size: 12px; /* minimum */ }\n\n/* Responsive */\n@media (max-width: 768px) {\n  body { font-size: 14px; }\n}`,
                steps: ['Tìm elements có font-size < 12px', 'Tăng lên tối thiểu 12px', 'Test readability trên mobile', 'Cân nhắc dùng rem/em thay px'],
                difficulty: 'LOW', estimatedTime: '10-15 phút'
            },

            'FONT_NOT_LOADED': {
                title: 'Sửa lỗi font không load',
                description: 'Font chính không tải được, đang hiển thị font fallback',
                code: `/* Preload font */\n<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>\n\n/* Font-display swap */\n@font-face {\n  font-family: 'MyFont';\n  src: url('/fonts/main.woff2') format('woff2');\n  font-display: swap;\n}`,
                steps: ['Kiểm tra font file có tồn tại không', 'Check Network tab xem font request có lỗi không', 'Thêm font-display: swap vào @font-face', 'Preload font quan trọng'],
                difficulty: 'MEDIUM', estimatedTime: '15-20 phút'
            },

            'LINE_HEIGHT_TIGHT': {
                title: 'Tăng line-height',
                description: 'Khoảng cách dòng quá sát, khó đọc',
                code: `/* Recommended line-heights */\np, li, span { line-height: 1.5; }\nh1, h2, h3 { line-height: 1.3; }`,
                steps: ['Tìm elements có line-height < 1.2', 'Tăng lên 1.4-1.6 cho body text', 'Headings có thể dùng 1.2-1.3', 'Test readability'],
                difficulty: 'LOW', estimatedTime: '5-10 phút'
            },

            'ELEMENT_OVERLAP': {
                title: 'Sửa element bị chồng chéo',
                description: 'Hai element đang đè lên nhau',
                steps: ['Inspect cả 2 element trong DevTools', 'Kiểm tra position, z-index, margin', 'Điều chỉnh spacing hoặc z-index', 'Test trên nhiều viewport sizes'],
                difficulty: 'MEDIUM', estimatedTime: '15-30 phút'
            },

            'EMPTY_CONTAINER': {
                title: 'Xử lý container rỗng',
                description: 'Container lớn không có nội dung',
                steps: ['Kiểm tra xem container có nên chứa nội dung không', 'Nếu intentional: thêm min-height phù hợp', 'Nếu bug: thêm nội dung hoặc ẩn container', 'Nếu loading state: thêm skeleton/placeholder'],
                difficulty: 'LOW', estimatedTime: '5-10 phút'
            },

            'IRREGULAR_SPACING': {
                title: 'Chuẩn hóa spacing',
                description: 'Khoảng cách giữa các element không đều',
                code: `/* Dùng spacing scale nhất quán (4px grid) */\n:root {\n  --space-xs: 4px;\n  --space-sm: 8px;\n  --space-md: 16px;\n  --space-lg: 24px;\n  --space-xl: 32px;\n}\n\n.card + .card { margin-top: var(--space-md); }`,
                steps: ['Xác định spacing scale (4px hoặc 8px grid)', 'Tạo CSS variables cho spacing', 'Áp dụng nhất quán', 'Review trên nhiều viewport'],
                difficulty: 'MEDIUM', estimatedTime: '20-30 phút'
            },

            'MISSING_TITLE': {
                title: 'Thêm/sửa page title',
                description: 'Trang thiếu hoặc title không tối ưu',
                code: `<head>\n  <title>Tên trang - Tên website | Mô tả ngắn</title>\n</head>`,
                steps: ['Thêm thẻ <title> trong <head>', 'Title nên 30-60 ký tự', 'Bao gồm keyword chính', 'Mỗi trang cần title riêng biệt'],
                difficulty: 'LOW', estimatedTime: '2-5 phút'
            },

            'MISSING_META_DESC': {
                title: 'Thêm meta description',
                description: 'Thiếu mô tả trang, ảnh hưởng SEO',
                code: `<meta name="description" content="Mô tả ngắn gọn về nội dung trang (120-160 ký tự)">`,
                steps: ['Thêm meta description trong <head>', 'Nên 120-160 ký tự', 'Mô tả chính xác nội dung trang', 'Bao gồm keyword target'],
                difficulty: 'LOW', estimatedTime: '2-5 phút'
            },

            'MISSING_OG_TAGS': {
                title: 'Thêm Open Graph tags',
                description: 'Thiếu OG tags, link share lên MXH sẽ không đẹp',
                code: `<meta property="og:title" content="Tiêu đề trang">\n<meta property="og:description" content="Mô tả">\n<meta property="og:image" content="https://example.com/image.jpg">\n<meta property="og:url" content="https://example.com/page">`,
                steps: ['Thêm og:title, og:description, og:image', 'og:image nên 1200×630px', 'Test với Facebook Debugger', 'Mỗi trang cần OG riêng'],
                difficulty: 'LOW', estimatedTime: '5-10 phút'
            },

            'MISSING_VIEWPORT_META': {
                title: 'Thêm viewport meta tag',
                description: 'Thiếu viewport meta → trang không responsive',
                code: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
                steps: ['Thêm viewport meta tag trong <head>', 'Đây là tag bắt buộc cho responsive design', 'Không dùng maximum-scale=1 (chặn zoom)', 'Test trên mobile sau khi thêm'],
                difficulty: 'LOW', estimatedTime: '1 phút'
            },

            'MULTIPLE_H1': {
                title: 'Sửa heading structure',
                description: 'Trang nên chỉ có 1 thẻ H1',
                steps: ['Xác định H1 chính của trang', 'Đổi các H1 khác thành H2 hoặc thấp hơn', 'Đảm bảo heading hierarchy đúng (H1→H2→H3)', 'Test SEO với Lighthouse'],
                difficulty: 'LOW', estimatedTime: '5-10 phút'
            },

            'HEADING_SKIP': {
                title: 'Sửa heading hierarchy',
                description: 'Heading nhảy cấp (ví dụ H2→H4), ảnh hưởng accessibility',
                steps: ['Review tất cả headings trên trang', 'Đảm bảo thứ tự H1→H2→H3→H4 không bỏ cấp', 'Styling nên dùng CSS class, không phải heading level', 'Test với screen reader'],
                difficulty: 'LOW', estimatedTime: '5-10 phút'
            },

            'MISSING_LANG': {
                title: 'Thêm lang attribute',
                description: 'Thẻ HTML thiếu ngôn ngữ',
                code: `<html lang="vi">\n<!-- hoặc -->\n<html lang="en">`,
                steps: ['Thêm lang="vi" hoặc lang="en" vào thẻ <html>', 'Chọn đúng language code', 'Quan trọng cho screen readers và SEO'],
                difficulty: 'LOW', estimatedTime: '1 phút'
            },

            'MISSING_FAVICON': {
                title: 'Thêm favicon',
                description: 'Trang thiếu icon trên tab trình duyệt',
                code: `<link rel="icon" type="image/png" href="/favicon.png">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
                steps: ['Tạo favicon 32×32px và 180×180px', 'Đặt trong thư mục public/root', 'Thêm link tags trong <head>', 'Test trên nhiều trình duyệt'],
                difficulty: 'LOW', estimatedTime: '5-10 phút'
            },

            'INPUT_WITHOUT_LABEL': {
                title: 'Thêm label cho input',
                description: 'Input không có label, screen reader không đọc được',
                code: `<!-- Option 1: Explicit label -->\n<label for="email">Email</label>\n<input id="email" type="email">\n\n<!-- Option 2: aria-label -->\n<input type="email" aria-label="Email address">`,
                steps: ['Tìm input thiếu label', 'Thêm <label for="id"> hoặc aria-label', 'Không dùng placeholder thay label', 'Test với screen reader'],
                difficulty: 'LOW', estimatedTime: '5-10 phút'
            },

            'FORM_NO_SUBMIT': {
                title: 'Thêm nút Submit cho form',
                description: 'Form không có nút gửi',
                code: `<form>\n  <!-- ... inputs ... -->\n  <button type="submit">Gửi</button>\n</form>`,
                steps: ['Thêm button type="submit" trong form', 'Đảm bảo button có text rõ ràng', 'Test form submission'],
                difficulty: 'LOW', estimatedTime: '2-5 phút'
            },

            'PLACEHOLDER_AS_LABEL': {
                title: 'Thay placeholder bằng label',
                description: 'Placeholder biến mất khi nhập, không phải label thay thế',
                steps: ['Thêm <label> cho input', 'Giữ placeholder làm gợi ý bổ sung', 'Label phải luôn hiển thị', 'Test UX khi nhập dữ liệu'],
                difficulty: 'LOW', estimatedTime: '5-10 phút'
            },

            'OVERSIZED_IMAGE': {
                title: 'Tối ưu kích thước ảnh',
                description: 'Ảnh gốc lớn hơn nhiều so với hiển thị, lãng phí bandwidth',
                code: `<!-- Dùng srcset cho responsive images -->\n<img src="image-800.jpg"\n     srcset="image-400.jpg 400w, image-800.jpg 800w, image-1200.jpg 1200w"\n     sizes="(max-width: 768px) 100vw, 50vw">`,
                steps: ['Resize ảnh về đúng kích thước hiển thị', 'Dùng srcset cho nhiều kích thước', 'Nén ảnh (TinyPNG, Squoosh)', 'Cân nhắc dùng WebP/AVIF'],
                difficulty: 'MEDIUM', estimatedTime: '10-20 phút'
            },

            'CLS_PRONE': {
                title: 'Thêm width/height cho ảnh',
                description: 'Ảnh thiếu kích thước gây layout shift khi load',
                code: `<!-- Thêm width và height attributes -->\n<img src="photo.jpg" width="800" height="600" alt="...">\n\n/* CSS để giữ responsive */\nimg {\n  width: 100%;\n  height: auto;\n}`,
                steps: ['Thêm width và height attributes cho img', 'Hoặc dùng aspect-ratio CSS property', 'Browser sẽ reserve đúng space trước khi ảnh load', 'Kiểm tra CLS score với Lighthouse'],
                difficulty: 'LOW', estimatedTime: '5-10 phút'
            },

            'NO_LAZY_LOADING': {
                title: 'Thêm lazy loading cho ảnh',
                description: 'Ảnh ngoài viewport nên lazy load để tăng tốc trang',
                code: `<img src="photo.jpg" loading="lazy" alt="...">`,
                steps: ['Thêm loading="lazy" cho ảnh below-fold', 'KHÔNG lazy load ảnh above-fold (hero, logo)', 'Test tốc độ tải trang sau khi thêm'],
                difficulty: 'LOW', estimatedTime: '5 phút'
            },

            'RENDER_BLOCKING_SCRIPT': {
                title: 'Sửa render-blocking scripts',
                description: 'Scripts trong <head> chặn render trang',
                code: `<!-- Before (blocking) -->\n<script src="app.js"></script>\n\n<!-- After (non-blocking) -->\n<script src="app.js" defer></script>\n<!-- hoặc -->\n<script src="analytics.js" async></script>`,
                steps: ['Thêm defer cho scripts cần DOM', 'Thêm async cho scripts độc lập (analytics)', 'Di chuyển non-critical scripts xuống cuối body', 'Test trang vẫn hoạt động đúng'],
                difficulty: 'MEDIUM', estimatedTime: '10-15 phút'
            },

            'TOO_MANY_THIRD_PARTY': {
                title: 'Giảm third-party scripts',
                description: 'Quá nhiều scripts bên thứ 3 ảnh hưởng tốc độ',
                steps: ['Audit tất cả third-party scripts', 'Xóa scripts không còn sử dụng', 'Lazy load non-critical scripts', 'Cân nhắc self-host critical scripts'],
                difficulty: 'MEDIUM', estimatedTime: '30-60 phút'
            },

            'MISSING_AUTOCOMPLETE': {
                title: 'Thêm autocomplete cho input',
                description: 'Input thiếu autocomplete, UX không tối ưu',
                code: `<input type="email" name="email" autocomplete="email">\n<input type="tel" name="phone" autocomplete="tel">\n<input type="text" name="name" autocomplete="name">`,
                steps: ['Thêm autocomplete attribute phù hợp', 'email → autocomplete="email"', 'phone → autocomplete="tel"', 'name → autocomplete="name"'],
                difficulty: 'LOW', estimatedTime: '2-5 phút'
            },

            'NO_WEBP_SUPPORT': {
                title: 'Thêm WebP/AVIF support',
                description: 'Chỉ dùng JPG/PNG, thiếu format hiện đại',
                code: `<picture>\n  <source srcset="image.avif" type="image/avif">\n  <source srcset="image.webp" type="image/webp">\n  <img src="image.jpg" alt="...">\n</picture>`,
                steps: ['Convert ảnh sang WebP (giảm 25-35%)', 'Dùng <picture> element cho fallback', 'Hoặc cấu hình CDN tự động convert', 'Test trên Safari và các browser cũ'],
                difficulty: 'MEDIUM', estimatedTime: '20-30 phút'
            }
        };

        const fix = fixes[issue.type];
        if (!fix) {
            return {
                title: `Sửa lỗi ${issue.type}`,
                description: 'Xem chi tiết lỗi và debug thủ công',
                steps: [
                    'Kiểm tra element trong DevTools',
                    'Tìm nguyên nhân gây lỗi',
                    'Áp dụng fix phù hợp',
                    'Test lại trên nhiều viewport'
                ],
                difficulty: 'MEDIUM',
                estimatedTime: '15-30 phút'
            };
        }

        return fix;
    }
}

module.exports = IssueAnalyzer;
