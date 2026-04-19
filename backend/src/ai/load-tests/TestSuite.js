/**
 * TestSuite - Định nghĩa 5 test case cơ bản cho Load Testing
 *
 * Thời gian ước tính toàn bộ: ~2.5 phút
 * - Smoke: 10s  |  Load nhẹ: 30s  |  Load TB: 45s  |  Stress: 80s  |  Spike: 25s
 * + 5s nghỉ giữa các TC (server hồi) → tổng ~210s
 */

const DEFAULT_TEST_CASES = [
    {
        id: 'smoke',
        name: 'Smoke Test',
        label: 'Kiểm tra baseline',
        description: '1 user duy nhất, xác nhận server sống và đo latency nền',
        required: true,
        order: 1,
        config: {
            connections: 1,
            duration: 10,     // seconds
            pipelining: 1,
            timeout: 10,      // per-request timeout (seconds)
        },
    },
    {
        id: 'load-light',
        name: 'Load nhẹ',
        label: 'Tải nhẹ',
        description: '10 users đồng thời, mô phỏng traffic thông thường',
        required: false,
        order: 2,
        config: {
            connections: 10,
            duration: 30,
            pipelining: 1,
            timeout: 10,
        },
    },
    {
        id: 'load-medium',
        name: 'Load trung bình',
        label: 'Tải cao điểm',
        description: '50 users đồng thời, mô phỏng giờ cao điểm',
        required: false,
        order: 3,
        config: {
            connections: 50,
            duration: 45,
            pipelining: 1,
            timeout: 10,
        },
    },
    {
        id: 'stress',
        name: 'Stress Test',
        label: 'Tìm điểm gãy',
        description: 'Ramp 20 → 150 users trong 60s, giữ 20s để tìm breakpoint',
        required: false,
        order: 4,
        config: {
            // Autocannon không hỗ trợ ramp native → orchestrator sẽ chạy nhiều pha
            mode: 'ramp',
            phases: [
                { connections: 20, duration: 15 },
                { connections: 50, duration: 15 },
                { connections: 100, duration: 15 },
                { connections: 150, duration: 15 },
                { connections: 150, duration: 20 },  // giữ peak
            ],
            maxConnections: 150,
            timeout: 10,
        },
    },
    {
        id: 'spike',
        name: 'Spike Test',
        label: 'Đột biến lưu lượng',
        description: 'Nhảy từ 10 lên 100 users đột ngột trong 3s, giữ 20s',
        required: false,
        order: 5,
        config: {
            mode: 'spike',
            phases: [
                { connections: 10, duration: 5 },   // warm-up
                { connections: 100, duration: 20 }, // spike
            ],
            maxConnections: 100,
            timeout: 10,
        },
    },
];

function getTestCases(selectedIds) {
    if (!selectedIds || selectedIds.length === 0) {
        return DEFAULT_TEST_CASES;
    }
    // Smoke always required
    const ids = new Set(selectedIds);
    ids.add('smoke');
    return DEFAULT_TEST_CASES.filter(tc => ids.has(tc.id));
}

function estimateTotalDuration(testCases) {
    let total = 0;
    for (const tc of testCases) {
        if (tc.config.duration) {
            total += tc.config.duration;
        } else if (tc.config.phases) {
            total += tc.config.phases.reduce((s, p) => s + p.duration, 0);
        }
        total += 5; // rest between TCs
    }
    return total;
}

module.exports = {
    DEFAULT_TEST_CASES,
    getTestCases,
    estimateTotalDuration,
};
