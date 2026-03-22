const { GoogleGenAI } = require('@google/genai');

/**
 * MultiProviderAI — Multi-provider AI với auto-fallback
 *
 * Hỗ trợ 4 providers:
 *   1. Gemini 2.0 Flash (15 RPM, multimodal)
 *   2. Gemini 2.0 Flash-Lite (30 RPM, multimodal)
 *   3. Groq Llama 3.3 70B (30 RPM, text-only)
 *   4. Ollama local (unlimited, tùy model)
 *
 * Tự động fallback khi provider bị rate limit (cooldown 60s)
 * Không cần dependency mới — dùng @google/genai + native fetch
 */

const COOLDOWN_MS = 60000; // 60s cooldown khi bị rate limit

// ===== PROVIDER IMPLEMENTATIONS =====

class GeminiProvider {
    constructor(model, name, rpm) {
        this.name = name;
        this.model = model;
        this.rpm = rpm;
        this.supportsImages = true;
        this._cooldownUntil = 0;

        const apiKey = process.env.GEMINI_API_KEY;
        this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
    }

    isAvailable() { return !!this.client; }

    isOnCooldown() { return Date.now() < this._cooldownUntil; }

    cooldown() {
        this._cooldownUntil = Date.now() + COOLDOWN_MS;
        console.log(`[MultiAI] ${this.name} on cooldown for ${COOLDOWN_MS / 1000}s`);
    }

    async generate(prompt, systemPrompt, images = []) {
        const parts = [];

        // Add images as inline data
        for (const img of images) {
            if (img.inlineData) {
                parts.push(img);
            } else if (img.data) {
                parts.push({
                    inlineData: {
                        data: img.data.toString('base64'),
                        mimeType: img.mimeType || 'image/png'
                    }
                });
            }
        }

        parts.push({ text: prompt });

        const response = await this.client.models.generateContent({
            model: this.model,
            contents: [{ role: 'user', parts }],
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.2,
                maxOutputTokens: 2048
            }
        });

        return response.text || '';
    }
}

class GroqProvider {
    constructor() {
        this.name = 'groq-llama3.3';
        this.model = 'llama-3.3-70b-versatile';
        this.rpm = 30;
        this.supportsImages = false;
        this._cooldownUntil = 0;
        this.apiKey = process.env.GROQ_API_KEY || null;
    }

    isAvailable() { return !!this.apiKey; }

    isOnCooldown() { return Date.now() < this._cooldownUntil; }

    cooldown() {
        this._cooldownUntil = Date.now() + COOLDOWN_MS;
        console.log(`[MultiAI] ${this.name} on cooldown for ${COOLDOWN_MS / 1000}s`);
    }

    async generate(prompt, systemPrompt) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 429) {
                throw new Error('429 Rate Limited');
            }
            throw new Error(`Groq API error ${response.status}: ${errText.substring(0, 200)}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }
}

class OllamaProvider {
    constructor() {
        this.name = 'ollama-local';
        this.model = process.env.OLLAMA_MODEL || 'llama3.1';
        this.rpm = Infinity;
        this.supportsImages = false; // conservative default
        this._cooldownUntil = 0;
        this._available = null; // lazy check
        this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    }

    isAvailable() {
        // Chỉ available nếu user cấu hình OLLAMA_MODEL
        return !!process.env.OLLAMA_MODEL;
    }

    isOnCooldown() { return Date.now() < this._cooldownUntil; }

    cooldown() {
        this._cooldownUntil = Date.now() + COOLDOWN_MS;
        console.log(`[MultiAI] ${this.name} on cooldown for ${COOLDOWN_MS / 1000}s`);
    }

    /**
     * Check Ollama service đang chạy không
     */
    async ping() {
        try {
            const res = await fetch(`${this.baseUrl}/api/tags`, {
                signal: AbortSignal.timeout(3000)
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    async generate(prompt, systemPrompt) {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                prompt: prompt,
                system: systemPrompt,
                stream: false,
                options: {
                    temperature: 0.2,
                    num_predict: 2048
                }
            }),
            signal: AbortSignal.timeout(120000) // 2 phút timeout cho local model
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Ollama error ${response.status}: ${errText.substring(0, 200)}`);
        }

        const data = await response.json();
        return data.response || '';
    }
}

// ===== MAIN CLASS =====

class MultiProviderAI {
    constructor() {
        this.providers = [
            new GeminiProvider('gemini-2.0-flash', 'gemini-flash', 15),
            new GeminiProvider('gemini-2.0-flash-lite', 'gemini-flash-lite', 30),
            new GroqProvider(),
            new OllamaProvider()
        ];

        // Log available providers
        const available = this.providers.filter(p => p.isAvailable());
        console.log(`[MultiAI] Initialized with ${available.length} providers: ${available.map(p => p.name).join(', ') || 'none'}`);
    }

    /**
     * Chọn provider tốt nhất hiện tại
     * @param {boolean} hasImages - request có ảnh không
     * @returns {object|null} provider hoặc null nếu không có
     */
    selectProvider(hasImages = false) {
        for (const provider of this.providers) {
            if (!provider.isAvailable()) continue;
            if (provider.isOnCooldown()) continue;
            if (hasImages && !provider.supportsImages) continue;
            return provider;
        }
        return null;
    }

    /**
     * Generate với auto-fallback
     * @param {string} prompt - text prompt
     * @param {string} systemPrompt - system instruction
     * @param {Array} images - [{data: Buffer, mimeType}] hoặc [{inlineData: {...}}]
     * @returns {{ text: string, provider: string }}
     */
    async generate(prompt, systemPrompt, images = []) {
        const hasImages = images.length > 0;
        const triedProviders = [];
        let lastError = '';

        for (const provider of this.providers) {
            if (!provider.isAvailable()) continue;
            if (provider.isOnCooldown()) continue;
            if (hasImages && !provider.supportsImages) continue;

            triedProviders.push(provider.name);

            try {
                console.log(`[MultiAI] Trying ${provider.name}...`);
                const text = await provider.generate(prompt, systemPrompt, images);
                console.log(`[MultiAI] ${provider.name} succeeded (${text.length} chars)`);
                return { text, provider: provider.name };
            } catch (err) {
                const msg = err.message || '';
                const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
                const isQuotaExhausted = msg.includes('limit: 0') || msg.includes('quota') || msg.includes('exceeded your current quota');

                if (isRateLimit) {
                    if (isQuotaExhausted) {
                        // Quota hết hẳn — cooldown dài hơn, ghi rõ lỗi
                        provider._cooldownUntil = Date.now() + 3600000; // 1 giờ
                        console.error(`[MultiAI] ${provider.name} QUOTA EXHAUSTED — disabled for 1 hour`);
                        lastError = `${provider.name}: Đã hết quota miễn phí. Cần nâng cấp plan hoặc đổi API key.`;
                    } else {
                        provider.cooldown();
                        console.log(`[MultiAI] ${provider.name} rate limited, trying next...`);
                    }
                    continue;
                }

                // Non-rate-limit error — log and try next
                console.error(`[MultiAI] ${provider.name} error: ${msg}`);
                lastError = `${provider.name}: ${msg.substring(0, 150)}`;
                continue;
            }
        }

        // Tất cả providers đều fail
        let msg;
        if (triedProviders.length === 0) {
            msg = 'Chưa cấu hình AI provider nào. Cần ít nhất GEMINI_API_KEY trong biến môi trường.';
        } else if (lastError) {
            msg = lastError;
        } else {
            msg = `Tất cả AI providers đều bận (đã thử: ${triedProviders.join(', ')}). Vui lòng thử lại sau 1 phút.`;
        }
        throw new Error(msg);
    }

    /**
     * Reload/add provider at runtime (khi user nhập key trên UI)
     */
    reloadProvider(providerName, key) {
        if (providerName === 'gemini') {
            process.env.GEMINI_API_KEY = key;
            this.providers[0] = new GeminiProvider('gemini-2.0-flash', 'gemini-flash', 15);
            this.providers[1] = new GeminiProvider('gemini-2.0-flash-lite', 'gemini-flash-lite', 30);
            console.log(`[MultiAI] Reloaded Gemini providers with new key`);
        } else if (providerName === 'groq') {
            process.env.GROQ_API_KEY = key;
            this.providers[2] = new GroqProvider();
            console.log(`[MultiAI] Reloaded Groq provider with new key`);
        } else if (providerName === 'ollama') {
            process.env.OLLAMA_MODEL = key;
            this.providers[3] = new OllamaProvider();
            console.log(`[MultiAI] Reloaded Ollama provider with model: ${key}`);
        }
    }

    /**
     * Remove provider key at runtime
     */
    removeProvider(providerName) {
        if (providerName === 'gemini') {
            delete process.env.GEMINI_API_KEY;
            this.providers[0] = new GeminiProvider('gemini-2.0-flash', 'gemini-flash', 15);
            this.providers[1] = new GeminiProvider('gemini-2.0-flash-lite', 'gemini-flash-lite', 30);
        } else if (providerName === 'groq') {
            delete process.env.GROQ_API_KEY;
            this.providers[2] = new GroqProvider();
        } else if (providerName === 'ollama') {
            delete process.env.OLLAMA_MODEL;
            this.providers[3] = new OllamaProvider();
        }
        console.log(`[MultiAI] Removed ${providerName} provider`);
    }

    /**
     * Trạng thái tất cả providers
     */
    status() {
        return this.providers.map(p => ({
            name: p.name,
            model: p.model,
            available: p.isAvailable(),
            onCooldown: p.isOnCooldown(),
            cooldownRemaining: p.isOnCooldown() ? Math.ceil((p._cooldownUntil - Date.now()) / 1000) : 0,
            rpm: p.rpm === Infinity ? 'unlimited' : p.rpm,
            supportsImages: p.supportsImages,
            hasKey: p.name.startsWith('gemini') ? !!process.env.GEMINI_API_KEY
                : p.name === 'groq-llama3.3' ? !!process.env.GROQ_API_KEY
                : p.name === 'ollama-local' ? !!process.env.OLLAMA_MODEL : false,
            maskedKey: p.name.startsWith('gemini') && process.env.GEMINI_API_KEY
                ? process.env.GEMINI_API_KEY.substring(0, 4) + '••••' + process.env.GEMINI_API_KEY.slice(-4)
                : p.name === 'groq-llama3.3' && process.env.GROQ_API_KEY
                ? process.env.GROQ_API_KEY.substring(0, 4) + '••••' + process.env.GROQ_API_KEY.slice(-4)
                : p.name === 'ollama-local' && process.env.OLLAMA_MODEL
                ? process.env.OLLAMA_MODEL : null
        }));
    }
}

module.exports = MultiProviderAI;
