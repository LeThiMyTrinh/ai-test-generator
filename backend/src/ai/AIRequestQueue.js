/**
 * AIRequestQueue — FIFO queue với sliding window RPM tracking
 * Ngăn chặn rate limit 429 bằng cách kiểm soát số request/phút
 *
 * Features:
 * - Sliding window 60s tracking
 * - Exponential backoff on 429 errors
 * - Socket.IO notifications cho queue position
 * - Singleton pattern để share giữa tất cả routes
 */
class AIRequestQueue {
    /**
     * @param {object} opts
     * @param {number} opts.maxRPM - Requests tối đa/phút (default: 14, buffer 1 cho safety)
     * @param {object} opts.io - Socket.IO instance (optional, inject later via .io = io)
     */
    constructor({ maxRPM = 14, io = null } = {}) {
        this.maxRPM = maxRPM;
        this.io = io;
        this._queue = [];          // { taskFn, meta, resolve, reject, retryCount }
        this._timestamps = [];     // Date.now() of sent requests
        this._processing = false;  // prevent concurrent _processQueue
        this._globalCooldownUntil = 0; // timestamp for global cooldown after 429
    }

    /**
     * Enqueue một AI request
     * @param {Function} taskFn - async function thực hiện AI call
     * @param {object} meta - { requestId, type } cho Socket.IO notifications
     * @returns {Promise} resolve với kết quả từ taskFn
     */
    enqueue(taskFn, meta = {}) {
        return new Promise((resolve, reject) => {
            const item = { taskFn, meta, resolve, reject, retryCount: 0 };
            this._queue.push(item);

            // Notify queue position
            this._notifyPositions();

            // Trigger processing
            this._processQueue();
        });
    }

    /**
     * Xử lý queue — gọi khi có slot available
     */
    async _processQueue() {
        if (this._processing) return;
        this._processing = true;

        try {
            while (this._queue.length > 0) {
                // Check global cooldown (after 429)
                const now = Date.now();
                if (now < this._globalCooldownUntil) {
                    const waitMs = this._globalCooldownUntil - now;
                    console.log(`[AIQueue] Global cooldown, waiting ${Math.ceil(waitMs / 1000)}s`);
                    await this._sleep(waitMs);
                    continue;
                }

                // Check RPM limit
                this._cleanTimestamps();
                if (this._currentRPM() >= this.maxRPM) {
                    const waitMs = this._msUntilNextSlot();
                    if (waitMs > 0) {
                        console.log(`[AIQueue] RPM limit reached (${this._currentRPM()}/${this.maxRPM}), waiting ${Math.ceil(waitMs / 1000)}s`);
                        await this._sleep(waitMs + 500); // +500ms buffer
                        continue;
                    }
                }

                // Dequeue and execute
                const item = this._queue.shift();
                this._notifyPositions();

                // Notify processing start
                if (this.io && item.meta.requestId) {
                    this.io.emit('ai:queue_processing', { requestId: item.meta.requestId });
                }

                this._recordRequest();

                try {
                    const result = await item.taskFn();

                    // Notify done
                    if (this.io && item.meta.requestId) {
                        this.io.emit('ai:queue_done', { requestId: item.meta.requestId });
                    }

                    item.resolve(result);
                } catch (err) {
                    const msg = err.message || '';
                    const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');

                    if (isRateLimit && item.retryCount < 4) {
                        // Exponential backoff: 10s, 20s, 40s, 60s + jitter
                        const baseDelay = 10000;
                        const delay = Math.min(60000, baseDelay * Math.pow(2, item.retryCount)) + Math.random() * 1000;
                        console.log(`[AIQueue] Rate limited, retry #${item.retryCount + 1} in ${Math.ceil(delay / 1000)}s`);

                        // Set global cooldown
                        this._globalCooldownUntil = Date.now() + delay;

                        // Re-enqueue at front with incremented retry
                        item.retryCount++;
                        this._queue.unshift(item);
                        this._notifyPositions();

                        await this._sleep(delay);
                        continue;
                    }

                    // Non-retryable error or max retries exceeded
                    item.reject(err);
                }
            }
        } finally {
            this._processing = false;
        }
    }

    /**
     * Đếm requests trong sliding window 60s
     */
    _currentRPM() {
        this._cleanTimestamps();
        return this._timestamps.length;
    }

    /**
     * Tính ms cho đến khi slot tiếp theo available
     */
    _msUntilNextSlot() {
        if (this._timestamps.length < this.maxRPM) return 0;
        const oldest = this._timestamps[0];
        return Math.max(0, oldest + 60000 - Date.now());
    }

    /**
     * Record timestamp cho request vừa gửi
     */
    _recordRequest() {
        this._timestamps.push(Date.now());
    }

    /**
     * Xóa timestamps ngoài sliding window 60s
     */
    _cleanTimestamps() {
        const cutoff = Date.now() - 60000;
        this._timestamps = this._timestamps.filter(t => t > cutoff);
    }

    /**
     * Notify tất cả items trong queue về vị trí hiện tại
     */
    _notifyPositions() {
        if (!this.io) return;
        this._queue.forEach((item, index) => {
            if (item.meta.requestId) {
                const estimatedWaitMs = (index + 1) * (60000 / this.maxRPM);
                this.io.emit('ai:queue_position', {
                    requestId: item.meta.requestId,
                    position: index + 1,
                    total: this._queue.length,
                    estimatedWaitSec: Math.ceil(estimatedWaitMs / 1000)
                });
            }
        });
    }

    /**
     * Queue status
     */
    status() {
        this._cleanTimestamps();
        return {
            queueLength: this._queue.length,
            currentRPM: this._timestamps.length,
            maxRPM: this.maxRPM,
            globalCooldown: this._globalCooldownUntil > Date.now()
                ? Math.ceil((this._globalCooldownUntil - Date.now()) / 1000)
                : 0
        };
    }

    _sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

module.exports = AIRequestQueue;
