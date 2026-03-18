/**
 * IssueAnalyzer - Smart analysis without API
 * Automatically score, classify, and suggest fixes for UI issues
 */

class IssueAnalyzer {
    constructor() {
        // Base severity scores for each issue type
        this.baseScores = {
            'NAVIGATION_ERROR': 100,      // Blocking - cannot access page
            'BROKEN_IMAGE': 90,           // Very visible, professional issue
            'JS_ERROR': 85,               // Functionality broken
            'HORIZONTAL_SCROLLBAR': 80,   // Major UX issue on mobile
            'BROKEN_LINK': 75,            // User cannot navigate
            'OVERFLOW_X': 65,             // Layout broken
            'CONSOLE_ERROR': 60,          // Potential functionality issue
            'LOW_CONTRAST': 55,           // Accessibility + readability
            'MISSING_ALT': 50,            // Accessibility + SEO
            'TEXT_TRUNCATED': 45,         // Content not visible
            'SMALL_TOUCH_TARGET': 40,     // Mobile usability
            'OUTSIDE_VIEWPORT': 38,       // Element not visible
            'DISTORTED_IMAGE': 30,        // Visual quality
            'RESPONSIVE_HIDDEN': 25,      // Often intentional
            'ACCESSIBILITY': 50           // Varies by impact
        };

        // Issue type categories
        this.categories = {
            blocking: ['NAVIGATION_ERROR', 'JS_ERROR'],
            critical_ux: ['HORIZONTAL_SCROLLBAR', 'BROKEN_IMAGE', 'BROKEN_LINK'],
            layout: ['OVERFLOW_X', 'OUTSIDE_VIEWPORT', 'RESPONSIVE_HIDDEN'],
            accessibility: ['MISSING_ALT', 'LOW_CONTRAST', 'SMALL_TOUCH_TARGET', 'ACCESSIBILITY'],
            visual: ['DISTORTED_IMAGE', 'TEXT_TRUNCATED'],
            performance: ['CONSOLE_ERROR']
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
            'MISSING_ALT': 'LOW',           // Just add alt attribute
            'DISTORTED_IMAGE': 'LOW',       // Fix CSS width/height
            'TEXT_TRUNCATED': 'LOW',        // Adjust container size
            'SMALL_TOUCH_TARGET': 'LOW',    // Increase padding
            'LOW_CONTRAST': 'MEDIUM',       // Change colors
            'OVERFLOW_X': 'MEDIUM',         // Find and fix overflowing element
            'BROKEN_LINK': 'MEDIUM',        // Update URL
            'RESPONSIVE_HIDDEN': 'MEDIUM',  // Adjust responsive CSS
            'HORIZONTAL_SCROLLBAR': 'HIGH', // Debug complex layout issue
            'BROKEN_IMAGE': 'MEDIUM',       // Fix image path or upload
            'JS_ERROR': 'HIGH',             // Debug JavaScript
            'NAVIGATION_ERROR': 'HIGH'      // Server/routing issue
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
