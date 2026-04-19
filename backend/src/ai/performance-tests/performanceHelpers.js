/**
 * performanceHelpers.js - Scoring, thresholds & recommendation engine
 * Follows Lighthouse scoring methodology (linear interpolation)
 */

// Core Web Vitals thresholds (milliseconds except CLS)
const THRESHOLDS = {
    LCP:  { good: 2500, ni: 4000, unit: 'ms', label: 'Largest Contentful Paint' },
    FCP:  { good: 1800, ni: 3000, unit: 'ms', label: 'First Contentful Paint' },
    CLS:  { good: 0.1,  ni: 0.25, unit: '',   label: 'Cumulative Layout Shift' },
    TBT:  { good: 200,  ni: 600,  unit: 'ms', label: 'Total Blocking Time' },
    TTFB: { good: 800,  ni: 1800, unit: 'ms', label: 'Time to First Byte' },
};

// Weights for overall score calculation
const WEIGHTS = {
    LCP:  0.25,
    TBT:  0.25,
    CLS:  0.25,
    FCP:  0.15,
    TTFB: 0.10,
};

/**
 * Calculate score for a single metric (0-100)
 * Linear interpolation: good=100, NI boundary=50, poor=0
 */
function calculateMetricScore(value, metricKey) {
    const t = THRESHOLDS[metricKey];
    if (!t) return 0;

    if (value <= t.good) return 100;
    if (value >= t.ni) return Math.max(0, Math.round(50 * (1 - (value - t.ni) / t.ni)));
    // Between good and NI: linear interpolation 100→50
    return Math.round(100 - 50 * ((value - t.good) / (t.ni - t.good)));
}

/**
 * Get rating string for a metric value
 */
function getMetricRating(value, metricKey) {
    const t = THRESHOLDS[metricKey];
    if (!t) return 'unknown';
    if (value <= t.good) return 'good';
    if (value <= t.ni) return 'needs-improvement';
    return 'poor';
}

/**
 * Calculate overall performance score (0-100) from Core Web Vitals
 */
function calculateOverallScore(metrics) {
    const { lcp, fcp, cls, tbt, ttfb } = metrics;
    let totalWeight = 0;
    let weightedSum = 0;

    const entries = { LCP: lcp, FCP: fcp, CLS: cls, TBT: tbt, TTFB: ttfb };

    for (const [key, value] of Object.entries(entries)) {
        if (value == null || isNaN(value)) continue;
        const score = calculateMetricScore(value, key);
        weightedSum += score * WEIGHTS[key];
        totalWeight += WEIGHTS[key];
    }

    if (totalWeight === 0) return 0;
    return Math.round(weightedSum / totalWeight);
}

/**
 * Get overall rating from score
 */
function getOverallRating(score) {
    if (score >= 90) return 'good';
    if (score >= 50) return 'needs-improvement';
    return 'poor';
}

/**
 * Format metric value for display
 */
function formatMetricValue(value, metricKey) {
    if (value == null || isNaN(value)) return 'N/A';
    const t = THRESHOLDS[metricKey];
    if (!t) return String(value);

    if (t.unit === 'ms') {
        return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
    }
    return value.toFixed(3);
}

/**
 * Generate recommendations based on all collected metrics
 */
function generateRecommendations(allMetrics) {
    const recs = [];
    const { coreWebVitals = {}, pageLoad = {}, runtime = {}, resources = {}, network = {} } = allMetrics;

    // --- Core Web Vitals recommendations ---
    if (coreWebVitals.lcp > THRESHOLDS.LCP.good) {
        recs.push({
            severity: coreWebVitals.lcp > THRESHOLDS.LCP.ni ? 'CRITICAL' : 'HIGH',
            category: 'web-vitals',
            metric: 'LCP',
            title: 'Tối ưu Largest Contentful Paint (LCP)',
            description: `LCP hiện tại: ${formatMetricValue(coreWebVitals.lcp, 'LCP')} (mục tiêu < 2.5s)`,
            suggestions: [
                'Preload hình ảnh hero/banner chính bằng <link rel="preload">',
                'Tối ưu kích thước hình ảnh (WebP/AVIF, responsive sizes)',
                'Giảm server response time (TTFB)',
                'Loại bỏ render-blocking resources',
                'Sử dụng CDN cho static assets',
            ],
        });
    }

    if (coreWebVitals.fcp > THRESHOLDS.FCP.good) {
        recs.push({
            severity: coreWebVitals.fcp > THRESHOLDS.FCP.ni ? 'CRITICAL' : 'HIGH',
            category: 'web-vitals',
            metric: 'FCP',
            title: 'Tối ưu First Contentful Paint (FCP)',
            description: `FCP hiện tại: ${formatMetricValue(coreWebVitals.fcp, 'FCP')} (mục tiêu < 1.8s)`,
            suggestions: [
                'Loại bỏ render-blocking CSS/JS',
                'Inline critical CSS',
                'Giảm kích thước CSS/JS bundles',
                'Sử dụng font-display: swap cho web fonts',
            ],
        });
    }

    if (coreWebVitals.cls > THRESHOLDS.CLS.good) {
        recs.push({
            severity: coreWebVitals.cls > THRESHOLDS.CLS.ni ? 'CRITICAL' : 'HIGH',
            category: 'web-vitals',
            metric: 'CLS',
            title: 'Giảm Cumulative Layout Shift (CLS)',
            description: `CLS hiện tại: ${coreWebVitals.cls.toFixed(3)} (mục tiêu < 0.1)`,
            suggestions: [
                'Thêm width/height cho tất cả img và video',
                'Sử dụng aspect-ratio CSS property',
                'Tránh chèn nội dung động phía trên fold',
                'Reserve space cho quảng cáo/embeds',
                'Sử dụng font-display: optional để tránh FOIT/FOUT',
            ],
        });
    }

    if (coreWebVitals.tbt > THRESHOLDS.TBT.good) {
        recs.push({
            severity: coreWebVitals.tbt > THRESHOLDS.TBT.ni ? 'CRITICAL' : 'HIGH',
            category: 'web-vitals',
            metric: 'TBT',
            title: 'Giảm Total Blocking Time (TBT)',
            description: `TBT hiện tại: ${formatMetricValue(coreWebVitals.tbt, 'TBT')} (mục tiêu < 200ms)`,
            suggestions: [
                'Chia nhỏ long tasks (> 50ms) bằng setTimeout/requestIdleCallback',
                'Code-split và lazy load JS không cần thiết',
                'Giảm kích thước JavaScript bundles',
                'Tránh forced synchronous layouts',
                'Di chuyển heavy computation sang Web Workers',
            ],
        });
    }

    if (coreWebVitals.ttfb > THRESHOLDS.TTFB.good) {
        recs.push({
            severity: coreWebVitals.ttfb > THRESHOLDS.TTFB.ni ? 'CRITICAL' : 'MEDIUM',
            category: 'web-vitals',
            metric: 'TTFB',
            title: 'Giảm Time to First Byte (TTFB)',
            description: `TTFB hiện tại: ${formatMetricValue(coreWebVitals.ttfb, 'TTFB')} (mục tiêu < 800ms)`,
            suggestions: [
                'Sử dụng CDN để giảm latency',
                'Tối ưu server-side rendering/database queries',
                'Bật HTTP/2 hoặc HTTP/3',
                'Cấu hình caching headers (Cache-Control, ETag)',
                'Giảm redirect chains',
            ],
        });
    }

    // --- Resource recommendations ---
    if (resources.renderBlocking && resources.renderBlocking.length > 0) {
        recs.push({
            severity: resources.renderBlocking.length > 5 ? 'HIGH' : 'MEDIUM',
            category: 'resources',
            title: `Loại bỏ ${resources.renderBlocking.length} render-blocking resources`,
            description: 'Render-blocking CSS/JS ngăn trang hiển thị nội dung',
            suggestions: [
                'Thêm async hoặc defer cho script tags',
                'Sử dụng media queries cho CSS không critical',
                'Inline critical CSS vào <head>',
                'Lazy-load CSS không cần thiết cho above-the-fold',
            ],
        });
    }

    if (resources.large && resources.large.length > 0) {
        const totalLargeSize = resources.large.reduce((s, r) => s + (r.size || 0), 0);
        recs.push({
            severity: totalLargeSize > 5 * 1024 * 1024 ? 'HIGH' : 'MEDIUM',
            category: 'resources',
            title: `${resources.large.length} resources lớn hơn 500KB`,
            description: `Tổng: ${(totalLargeSize / 1024 / 1024).toFixed(1)}MB - cần tối ưu kích thước`,
            suggestions: [
                'Nén hình ảnh (WebP/AVIF, giảm quality)',
                'Minify CSS/JS bundles',
                'Sử dụng tree-shaking để loại bỏ code không dùng',
                'Lazy-load hình ảnh/video ngoài viewport',
            ],
        });
    }

    if (resources.uncompressed && resources.uncompressed.length > 0) {
        recs.push({
            severity: 'MEDIUM',
            category: 'resources',
            title: `${resources.uncompressed.length} resources chưa được nén`,
            description: 'Bật gzip/brotli compression để giảm transfer size',
            suggestions: [
                'Cấu hình gzip/brotli trên web server (Nginx, Apache)',
                'Đảm bảo CDN bật compression',
                'Kiểm tra Content-Encoding header trong response',
            ],
        });
    }

    if (resources.thirdParty && resources.thirdParty.count > 10) {
        recs.push({
            severity: resources.thirdParty.count > 20 ? 'HIGH' : 'MEDIUM',
            category: 'resources',
            title: `${resources.thirdParty.count} third-party resources từ ${resources.thirdParty.domains.length} domains`,
            description: `Tổng: ${(resources.thirdParty.size / 1024 / 1024).toFixed(1)}MB - third-party scripts ảnh hưởng hiệu năng`,
            suggestions: [
                'Audit và loại bỏ third-party scripts không cần thiết',
                'Lazy-load third-party scripts (analytics, chat, ads)',
                'Sử dụng rel="preconnect" cho critical third-party domains',
                'Self-host fonts thay vì dùng Google Fonts CDN',
            ],
        });
    }

    // --- Runtime recommendations ---
    if (runtime.domNodeCount > 1500) {
        recs.push({
            severity: runtime.domNodeCount > 3000 ? 'HIGH' : 'MEDIUM',
            category: 'runtime',
            title: `DOM quá lớn: ${runtime.domNodeCount} nodes`,
            description: 'DOM lớn làm chậm rendering, tăng memory usage',
            suggestions: [
                'Sử dụng virtualized lists cho danh sách dài',
                'Lazy-load nội dung ngoài viewport',
                'Giảm DOM nesting depth',
                'Loại bỏ hidden/unused DOM elements',
            ],
        });
    }

    if (runtime.jsHeapUsed && runtime.jsHeapTotal) {
        const heapPercent = (runtime.jsHeapUsed / runtime.jsHeapTotal) * 100;
        if (heapPercent > 70) {
            recs.push({
                severity: heapPercent > 90 ? 'CRITICAL' : 'HIGH',
                category: 'runtime',
                title: `JS Heap usage cao: ${heapPercent.toFixed(0)}%`,
                description: `${(runtime.jsHeapUsed / 1024 / 1024).toFixed(1)}MB / ${(runtime.jsHeapTotal / 1024 / 1024).toFixed(1)}MB`,
                suggestions: [
                    'Kiểm tra memory leaks (event listeners, closures, DOM references)',
                    'Giải phóng large objects khi không cần thiết',
                    'Sử dụng WeakMap/WeakSet cho caches',
                    'Profile memory bằng Chrome DevTools Memory tab',
                ],
            });
        }
    }

    // --- Network recommendations ---
    if (network.failed && network.failed.length > 0) {
        recs.push({
            severity: 'HIGH',
            category: 'network',
            title: `${network.failed.length} requests thất bại`,
            description: 'Requests lỗi gây ảnh hưởng UX và lãng phí bandwidth',
            suggestions: [
                'Kiểm tra và sửa các URL bị broken',
                'Thêm fallback cho resources quan trọng',
                'Kiểm tra CORS configuration',
            ],
        });
    }

    if (network.cacheHitRate != null && network.cacheHitRate < 30) {
        recs.push({
            severity: 'MEDIUM',
            category: 'network',
            title: `Cache hit rate thấp: ${network.cacheHitRate.toFixed(0)}%`,
            description: 'Caching kém làm tăng load time cho returning visitors',
            suggestions: [
                'Cấu hình Cache-Control headers phù hợp',
                'Sử dụng hashed filenames cho cache busting',
                'Cấu hình Service Worker cho offline caching',
            ],
        });
    }

    // --- Page Load recommendations ---
    if (pageLoad.redirectTime > 500) {
        recs.push({
            severity: 'MEDIUM',
            category: 'page-load',
            title: `Redirect chậm: ${Math.round(pageLoad.redirectTime)}ms`,
            description: 'Redirects thêm latency trước khi trang bắt đầu load',
            suggestions: [
                'Giảm số lượng redirects',
                'Sử dụng HSTS để tránh HTTP→HTTPS redirect',
                'Cập nhật internal links trỏ thẳng đến URL cuối cùng',
            ],
        });
    }

    // Sort by severity
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    recs.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

    return recs;
}

module.exports = {
    THRESHOLDS,
    WEIGHTS,
    calculateMetricScore,
    getMetricRating,
    calculateOverallScore,
    getOverallRating,
    formatMetricValue,
    generateRecommendations,
};
