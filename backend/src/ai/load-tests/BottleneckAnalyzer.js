/**
 * BottleneckAnalyzer - Heuristic phát hiện bottleneck từ kết quả các test case
 * Phân loại: Network/Socket pool | CPU bound | DB/Upstream | Rate limit | Spike vulnerability | Code baseline
 */

const { formatMs } = require('./loadHelpers');

class BottleneckAnalyzer {
    /**
     * Analyze all test case results
     * @param {Array} testCases - Array of normalized test case results
     * @returns {{ bottlenecks: Array, recommendations: Array }}
     */
    analyze(testCases) {
        const bottlenecks = [];
        const recommendations = [];

        const byId = Object.fromEntries(testCases.map(tc => [tc.id, tc]));
        const smoke = byId['smoke'];
        const light = byId['load-light'];
        const medium = byId['load-medium'];
        const stress = byId['stress'];
        const spike = byId['spike'];

        // === RULE 1: Smoke baseline latency cao ===
        if (smoke && smoke.metrics.latency.p95 > 500) {
            bottlenecks.push({
                type: 'baseline-latency',
                severity: 'HIGH',
                title: 'Latency nền cao ngay cả với 1 user',
                evidence: `Smoke test p95 = ${formatMs(smoke.metrics.latency.p95)} (chỉ 1 user)`,
                cause: 'Code xử lý chậm, query DB thiếu index, hoặc server underprovisioned',
                recommendations: [
                    'Profile code ở endpoint đích, tìm hot path',
                    'Kiểm tra EXPLAIN của các query DB chính',
                    'Thêm index cho các cột WHERE/JOIN thường dùng',
                    'Bật caching cho response không thay đổi thường xuyên (Redis/in-memory)',
                ],
            });
        }

        // === RULE 2: Latency tăng phi tuyến (CPU/DB bound) ===
        if (light && medium && light.metrics.latency.p95 > 0) {
            const p95Ratio = medium.metrics.latency.p95 / light.metrics.latency.p95;
            const rpsRatio = medium.metrics.rps / Math.max(light.metrics.rps, 1);
            if (p95Ratio > 3 && rpsRatio < 4) {
                bottlenecks.push({
                    type: 'non-linear-scaling',
                    severity: 'HIGH',
                    title: 'Hệ thống không scale tuyến tính',
                    evidence: `Từ 10→50 users, p95 tăng ${p95Ratio.toFixed(1)}x (${formatMs(light.metrics.latency.p95)} → ${formatMs(medium.metrics.latency.p95)}) nhưng RPS chỉ tăng ${rpsRatio.toFixed(1)}x`,
                    cause: 'CPU/DB/lock contention — server chậm dần khi tải tăng',
                    recommendations: [
                        'Monitor CPU server dưới tải: nếu > 80% → CPU bound',
                        'Kiểm tra DB query trên mỗi request, tối ưu N+1 queries',
                        'Tăng số worker/process nếu Node.js single-threaded (pm2 cluster)',
                        'Cân nhắc connection pooling cho DB (pg-pool, mongoose pool)',
                    ],
                });
            }
        }

        // === RULE 3: Phân loại theo loại lỗi chiếm ưu thế ===
        const stressErrors = stress?.metrics.errors || {};
        if (stress && !this._passedSLO(stress)) {
            if (stressErrors.timeouts > stressErrors.server5xx && stressErrors.timeouts > 5) {
                bottlenecks.push({
                    type: 'upstream-timeout',
                    severity: 'CRITICAL',
                    title: 'Timeout chiếm ưu thế khi tải cao',
                    evidence: `${stressErrors.timeouts} timeouts trong stress test (150 VU)`,
                    cause: 'Upstream (DB, external API) hoặc thread pool phản hồi quá chậm',
                    recommendations: [
                        'Tăng DB connection pool size (mặc định thường 10, cân nhắc 30-50)',
                        'Thêm timeout hợp lý ở tầng DB query (tránh query treo)',
                        'Kiểm tra slow query log, tối ưu hoặc cache query chậm',
                        'Xem xét circuit breaker nếu gọi external API',
                    ],
                });
            }

            if (stressErrors.resets > stressErrors.timeouts && stressErrors.resets > 5) {
                bottlenecks.push({
                    type: 'socket-exhaustion',
                    severity: 'HIGH',
                    title: 'Nghẽn socket / connection pool',
                    evidence: `${stressErrors.resets} connection resets trong stress test`,
                    cause: 'Hết file descriptor, ulimit thấp, hoặc TCP pool nhỏ',
                    recommendations: [
                        'Tăng ulimit -n (Linux: /etc/security/limits.conf)',
                        'Bật HTTP keep-alive để giảm TCP handshake',
                        'Tăng backlog queue ở server (net.core.somaxconn)',
                        'Nếu dùng reverse proxy (Nginx), tăng worker_connections',
                    ],
                });
            }

            if (stressErrors.server5xx > 10) {
                bottlenecks.push({
                    type: 'server-errors',
                    severity: 'CRITICAL',
                    title: 'Server trả 5xx khi tải cao',
                    evidence: `${stressErrors.server5xx} lỗi 5xx trong stress test`,
                    cause: 'Crash, OOM, unhandled exception, hoặc downstream service chết',
                    recommendations: [
                        'Xem log server tại thời điểm stress test',
                        'Kiểm tra memory usage — có rò rỉ không?',
                        'Bắt đầy đủ error handler cho Promise rejections',
                        'Cân nhắc auto-restart với pm2/systemd',
                    ],
                });
            }

            if (stressErrors.client4xx > 20) {
                bottlenecks.push({
                    type: 'rate-limit',
                    severity: 'MEDIUM',
                    title: 'Bị rate-limit (429) hoặc auth fail (401/403)',
                    evidence: `${stressErrors.client4xx} lỗi 4xx trong stress test`,
                    cause: 'Rate limiter chặn, hoặc session/token hết hạn dưới tải',
                    recommendations: [
                        'Kiểm tra config rate limiter, đảm bảo không chặn nhầm traffic hợp lệ',
                        'Nếu dùng auth token, kiểm tra token còn sống không',
                        'Cân nhắc tách rate limit theo IP vs user',
                    ],
                });
            }
        }

        // === RULE 4: Spike vulnerability ===
        if (spike && medium && !this._passedSLO(spike) && this._passedSLO(medium)) {
            bottlenecks.push({
                type: 'spike-vulnerability',
                severity: 'MEDIUM',
                title: 'Không chịu được đột biến (spike)',
                evidence: `Load TB (50 VU ổn định) PASS nhưng Spike (100 VU đột ngột) FAIL — p95 = ${formatMs(spike.metrics.latency.p95)}`,
                cause: 'Thiếu cơ chế buffer/queue, scale không kịp, hoặc cold cache khi flash traffic',
                recommendations: [
                    'Thêm request queue (Bull/Redis) cho tác vụ nặng',
                    'Warm-up cache trước khi traffic đến',
                    'Bật auto-scaling ở tầng infra nếu dùng cloud',
                    'Cân nhắc CDN cho static content',
                ],
            });
        }

        // === RULE 5: TTFB pattern (nếu có mean vs p95 chênh lệch lớn ở medium) ===
        if (medium && medium.metrics.latency.mean > 0) {
            const spread = medium.metrics.latency.p99 / medium.metrics.latency.mean;
            if (spread > 5) {
                bottlenecks.push({
                    type: 'latency-variance',
                    severity: 'MEDIUM',
                    title: 'Latency không ổn định (variance cao)',
                    evidence: `p99 = ${formatMs(medium.metrics.latency.p99)} cao hơn mean ${spread.toFixed(1)}x (mean = ${formatMs(medium.metrics.latency.mean)})`,
                    cause: 'Một số request bị chậm đáng kể — có thể do GC pause, lock contention, hoặc query outlier',
                    recommendations: [
                        'Bật APM (New Relic, Datadog) để tìm outlier queries',
                        'Kiểm tra GC config nếu dùng Node.js (--max-old-space-size)',
                        'Tìm và fix lock hotspot (database row lock, mutex)',
                    ],
                });
            }
        }

        // === General recommendations luôn có ===
        recommendations.push(...this._generalRecommendations(testCases));

        // Sort by severity
        const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        bottlenecks.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

        return { bottlenecks, recommendations };
    }

    _passedSLO(tc) {
        return tc.sloCheck?.pass === true;
    }

    _generalRecommendations(testCases) {
        const recs = [];
        const allPassed = testCases.every(tc => tc.sloCheck?.pass);

        if (allPassed) {
            recs.push({
                title: 'Hệ thống đạt tất cả SLO — chuẩn bị cho scale tiếp theo',
                description: 'Kết quả tốt với bộ test hiện tại. Để chuẩn bị scale:',
                suggestions: [
                    'Chạy soak test (30-60 phút) để phát hiện memory leak dài hạn',
                    'Thiết lập monitoring production với cùng SLO đã test',
                    'Test với VU cao hơn (200-500) để tìm trần thực sự',
                ],
            });
        } else {
            recs.push({
                title: 'Checklist tối ưu chung',
                description: 'Nên thực hiện theo thứ tự:',
                suggestions: [
                    '1. Bật HTTP/2 và keep-alive ở server',
                    '2. Bật gzip/brotli compression',
                    '3. Cache response tĩnh bằng CDN hoặc reverse proxy',
                    '4. Dùng connection pool cho DB',
                    '5. Profile code, tìm N+1 queries',
                    '6. Horizontal scaling (load balancer + nhiều instance)',
                ],
            });
        }

        return recs;
    }
}

module.exports = BottleneckAnalyzer;
