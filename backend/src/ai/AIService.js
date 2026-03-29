const { GoogleGenAI } = require('@google/genai');
const sharp = require('sharp');
const crypto = require('crypto');
const SmartTemplateEngine = require('./SmartTemplateEngine');

/**
 * AIService — Unified AI service cho test case generation
 *
 * 3 Providers (ưu tiên theo thứ tự):
 *   1. OpenAI GPT-4o-mini   (500 RPM, multimodal, ~$0.15/1M token)
 *   2. Google Gemini Flash   (15 RPM, multimodal, miễn phí)
 *   3. Anthropic Claude      (60 RPM, multimodal, ~$3/1M token)
 *
 * Features:
 *   - Auto-fallback khi provider lỗi
 *   - LRU cache inline (100 entries, 1h TTL)
 *   - Validation layer đảm bảo steps chạy được trên ActionHandler
 *   - Sinh 3 kịch bản (happy_path, negative, boundary)
 *   - Test data thực tế (không để trống value)
 */

// ===== PROVIDERS =====

class OpenAIProvider {
    constructor() {
        this.name = 'openai';
        this.displayName = 'OpenAI GPT-4o-mini';
        this.model = 'gpt-4o-mini';
        this.rpm = 500;
        this.supportsImages = true;
        this.apiKey = process.env.OPENAI_API_KEY || null;
    }

    isAvailable() { return !!this.apiKey; }

    async generate(prompt, systemPrompt, images = []) {
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Build user message with images
        if (images.length > 0) {
            const content = [];
            for (const img of images) {
                const base64 = img.inlineData
                    ? img.inlineData.data
                    : img.data.toString('base64');
                const mimeType = img.inlineData
                    ? img.inlineData.mimeType
                    : (img.mimeType || 'image/png');
                content.push({
                    type: 'image_url',
                    image_url: { url: `data:${mimeType};base64,${base64}` }
                });
            }
            content.push({ type: 'text', text: prompt });
            messages.push({ role: 'user', content });
        } else {
            messages.push({ role: 'user', content: prompt });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                temperature: 0.2,
                max_tokens: 4096
            }),
            signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 429) throw new Error('429 Rate Limited');
            if (response.status === 401) throw new Error('OPENAI_API_KEY không hợp lệ. Kiểm tra lại key.');
            throw new Error(`OpenAI error ${response.status}: ${errText.substring(0, 200)}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }
}

class GeminiProvider {
    constructor() {
        this.name = 'gemini';
        this.displayName = 'Google Gemini Flash';
        this.model = 'gemini-2.0-flash';
        this.rpm = 15;
        this.supportsImages = true;
        this.apiKey = process.env.GEMINI_API_KEY || null;
        this.client = this.apiKey ? new GoogleGenAI({ apiKey: this.apiKey }) : null;
    }

    isAvailable() { return !!this.client; }

    async generate(prompt, systemPrompt, images = []) {
        const parts = [];

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
                maxOutputTokens: 4096
            }
        });

        return response.text || '';
    }
}

class ClaudeProvider {
    constructor() {
        this.name = 'claude';
        this.displayName = 'Anthropic Claude Sonnet';
        this.model = 'claude-sonnet-4-20250514';
        this.rpm = 60;
        this.supportsImages = true;
        this.apiKey = process.env.ANTHROPIC_API_KEY || null;
    }

    isAvailable() { return !!this.apiKey; }

    async generate(prompt, systemPrompt, images = []) {
        const content = [];

        for (const img of images) {
            const base64 = img.inlineData
                ? img.inlineData.data
                : img.data.toString('base64');
            const mimeType = img.inlineData
                ? img.inlineData.mimeType
                : (img.mimeType || 'image/png');
            content.push({
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: base64 }
            });
        }
        content.push({ type: 'text', text: prompt });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 4096,
                temperature: 0.2,
                system: systemPrompt,
                messages: [{ role: 'user', content }]
            }),
            signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 429) throw new Error('429 Rate Limited');
            if (response.status === 401) throw new Error('ANTHROPIC_API_KEY không hợp lệ. Kiểm tra lại key.');
            throw new Error(`Claude error ${response.status}: ${errText.substring(0, 200)}`);
        }

        const data = await response.json();
        return data.content?.[0]?.text || '';
    }
}

// ===== INLINE CACHE =====

class ResponseCache {
    constructor(maxEntries = 100, ttlMs = 3600000) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
        this._cache = new Map();
        this._hits = 0;
        this._misses = 0;
    }

    _makeKey(url, testType, description) {
        return crypto.createHash('sha256')
            .update(`${url || ''}|${testType || ''}|${description || ''}`)
            .digest('hex');
    }

    get(url, testType, description) {
        const key = this._makeKey(url, testType, description);
        const entry = this._cache.get(key);
        if (!entry || Date.now() - entry.timestamp > this.ttlMs) {
            if (entry) this._cache.delete(key);
            this._misses++;
            return null;
        }
        this._cache.delete(key);
        this._cache.set(key, entry); // LRU: move to end
        this._hits++;
        return entry.response;
    }

    set(url, testType, description, response) {
        const key = this._makeKey(url, testType, description);
        if (this._cache.has(key)) this._cache.delete(key);
        this._cache.set(key, { response, timestamp: Date.now() });
        while (this._cache.size > this.maxEntries) {
            this._cache.delete(this._cache.keys().next().value);
        }
    }

    stats() {
        const total = this._hits + this._misses;
        return {
            size: this._cache.size,
            maxEntries: this.maxEntries,
            hits: this._hits,
            misses: this._misses,
            hitRate: total > 0 ? Math.round((this._hits / total) * 100) : 0
        };
    }
}

// ===== VALID ACTIONS (mapping ActionHandler) =====

const VALID_ACTIONS = [
    'navigate', 'click', 'fill', 'select', 'hover',
    'assert_text', 'assert_visible', 'assert_url', 'wait', 'screenshot',
    'double_click', 'right_click', 'keyboard', 'scroll_to', 'drag_drop', 'upload_file',
    'api_request', 'assert_status', 'assert_body', 'assert_header', 'assert_response_time', 'store_variable'
];

const ACTIONS_NEED_SELECTOR = [
    'click', 'fill', 'select', 'hover', 'assert_text', 'assert_visible',
    'double_click', 'right_click', 'scroll_to', 'drag_drop', 'upload_file'
];

const ACTIONS_NEED_VALUE = ['navigate', 'fill', 'select', 'wait', 'keyboard'];

const ACTIONS_NEED_EXPECTED = ['assert_text', 'assert_url', 'assert_status', 'assert_body', 'assert_header', 'assert_response_time'];

// ===== TEST TYPES =====

const TEST_TYPES = {
    auto: { label: 'Tự động nhận diện', prompt: 'Tự phân tích trang web và tạo test case phù hợp nhất.' },
    form: { label: 'Form & Validation', prompt: 'Tập trung vào form: nhập liệu, validation, submit, error messages.' },
    navigation: { label: 'Navigation & Routing', prompt: 'Tập trung vào navigation: links, menu, routing, breadcrumb, back/forward.' },
    crud: { label: 'CRUD Operations', prompt: 'Tập trung vào CRUD: tạo, đọc, sửa, xóa dữ liệu.' },
    auth: { label: 'Authentication Flow', prompt: 'Tập trung vào auth: đăng nhập, đăng xuất, đăng ký, quên mật khẩu, session.' }
};

// ===== MAIN SERVICE =====

class AIService {
    constructor() {
        this.providers = [
            new OpenAIProvider(),
            new GeminiProvider(),
            new ClaudeProvider()
        ];
        this.cache = new ResponseCache();
        this.smartTemplate = new SmartTemplateEngine();

        const available = this.providers.filter(p => p.isAvailable());
        console.log(`[AIService] Initialized with ${available.length} providers: ${available.map(p => p.name).join(', ') || 'none'}`);
        console.log(`[AIService] Smart Template Engine: always available (free)`);
    }

    // ===== PUBLIC API =====

    isConfigured() {
        return this.providers.some(p => p.isAvailable());
    }

    status() {
        const aiProviders = this.providers.map(p => ({
            name: p.name,
            displayName: p.displayName,
            model: p.model,
            available: p.isAvailable(),
            rpm: p.rpm,
            supportsImages: p.supportsImages,
            hasKey: p.isAvailable(),
            maskedKey: this._getMaskedKey(p.name)
        }));

        // Smart Template is always available
        aiProviders.unshift({
            name: 'smart-template',
            displayName: 'Smart Template (Miễn phí)',
            model: 'DOM Analysis',
            available: true,
            rpm: Infinity,
            supportsImages: false,
            hasKey: true,
            maskedKey: null
        });

        return aiProviders;
    }

    getTestTypes() {
        return Object.entries(TEST_TYPES).map(([key, val]) => ({
            value: key,
            label: val.label
        }));
    }

    /**
     * Generate test cases from URL crawl data
     * @param {object} crawlData - { screenshot: Buffer, elements: [], metadata: {} }
     * @param {object} options - { url, testType, description, provider }
     * @returns {{ scenarios: [], crawlInfo: {} }}
     */
    async generate(crawlData, options = {}) {
        const { url, testType = 'auto', description = '', provider: preferredProvider } = options;

        // Smart Template mode: no AI needed, instant & free
        if (preferredProvider === 'smart-template') {
            console.log('[AIService] Using Smart Template Engine (free, instant)');
            const result = this.smartTemplate.generate(crawlData, { url, testType, description });
            return result;
        }

        // 1. Check cache
        const cached = this.cache.get(url, testType, description);
        if (cached) {
            console.log('[AIService] Cache hit');
            return { ...cached, source: 'cache' };
        }

        // 2. Try AI providers, fallback to Smart Template if all fail
        try {
            // 2a. Optimize images
            const images = await this._optimizeImages(crawlData.screenshot);

            // 2b. Build prompt
            const systemPrompt = this._buildSystemPrompt();
            const userPrompt = this._buildUserPrompt(crawlData, { url, testType, description });

            // 2c. Call AI with fallback
            const { text, providerName } = await this._callAI(systemPrompt, userPrompt, images, preferredProvider);

            // 2d. Parse & validate
            const scenarios = this._parseResponse(text, crawlData.elements);

            const result = { scenarios, source: providerName };

            // 2e. Cache
            this.cache.set(url, testType, description, result);

            return result;
        } catch (aiError) {
            // All AI providers failed → fallback to Smart Template
            console.warn(`[AIService] AI providers failed: ${aiError.message}`);
            console.log('[AIService] Falling back to Smart Template Engine');
            const result = this.smartTemplate.generate(crawlData, { url, testType, description });
            result.aiError = aiError.message;
            return result;
        }
    }

    /**
     * Refine 1 scenario based on user feedback
     */
    async refine(steps, feedback, options = {}) {
        const { url, provider: preferredProvider } = options;

        const systemPrompt = this._buildSystemPrompt();
        const prompt = `Đây là test case hiện tại:
${JSON.stringify(steps, null, 2)}

Yêu cầu chỉnh sửa từ người dùng:
${feedback}

${url ? `URL: ${url}` : ''}

Chỉnh sửa test case theo yêu cầu. Trả về JSON thuần túy (KHÔNG markdown):
{
  "title": "Tiêu đề đã cập nhật",
  "description": "Mô tả đã cập nhật",
  "steps": [...]
}`;

        const { text } = await this._callAI(systemPrompt, prompt, [], preferredProvider);

        // Parse single scenario
        let clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
        try {
            const parsed = JSON.parse(clean);
            const validated = this._validateSteps(parsed.steps || [], []);
            return {
                title: parsed.title || 'Test Case đã chỉnh sửa',
                description: parsed.description || '',
                steps: validated.steps,
                warnings: validated.warnings
            };
        } catch {
            const jsonMatch = text.match(/\{[\s\S]*"steps"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const validated = this._validateSteps(parsed.steps || [], []);
                return {
                    title: parsed.title || 'Test Case đã chỉnh sửa',
                    description: parsed.description || '',
                    steps: validated.steps,
                    warnings: validated.warnings
                };
            }
            throw new Error('AI trả về kết quả không hợp lệ. Vui lòng thử lại.');
        }
    }

    // ===== PROVIDER MANAGEMENT =====

    reloadProvider(providerName, key) {
        const envKeyMap = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', claude: 'ANTHROPIC_API_KEY' };
        const envKey = envKeyMap[providerName];
        if (!envKey) return;

        process.env[envKey] = key;
        const idx = this.providers.findIndex(p => p.name === providerName);
        if (idx !== -1) {
            if (providerName === 'openai') this.providers[idx] = new OpenAIProvider();
            else if (providerName === 'gemini') this.providers[idx] = new GeminiProvider();
            else if (providerName === 'claude') this.providers[idx] = new ClaudeProvider();
        }
        console.log(`[AIService] Reloaded ${providerName}`);
    }

    removeProvider(providerName) {
        const envKeyMap = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', claude: 'ANTHROPIC_API_KEY' };
        const envKey = envKeyMap[providerName];
        if (!envKey) return;

        delete process.env[envKey];
        const idx = this.providers.findIndex(p => p.name === providerName);
        if (idx !== -1) {
            if (providerName === 'openai') this.providers[idx] = new OpenAIProvider();
            else if (providerName === 'gemini') this.providers[idx] = new GeminiProvider();
            else if (providerName === 'claude') this.providers[idx] = new ClaudeProvider();
        }
        console.log(`[AIService] Removed ${providerName}`);
    }

    getEnvKeyName(providerName) {
        return { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', claude: 'ANTHROPIC_API_KEY' }[providerName];
    }

    // ===== PRIVATE: AI CALL =====

    async _callAI(systemPrompt, userPrompt, images, preferredProvider) {
        // If user picked a specific provider, try it first
        const ordered = [...this.providers];
        if (preferredProvider) {
            const idx = ordered.findIndex(p => p.name === preferredProvider);
            if (idx > 0) {
                const [prov] = ordered.splice(idx, 1);
                ordered.unshift(prov);
            }
        }

        const errors = [];

        for (const provider of ordered) {
            if (!provider.isAvailable()) continue;

            try {
                console.log(`[AIService] Trying ${provider.name}...`);
                const text = await provider.generate(userPrompt, systemPrompt, images);
                console.log(`[AIService] ${provider.name} succeeded (${text.length} chars)`);
                return { text, providerName: provider.name };
            } catch (err) {
                const msg = err.message || '';
                console.error(`[AIService] ${provider.name} failed: ${msg}`);
                errors.push(`${provider.displayName}: ${msg.substring(0, 100)}`);
                continue;
            }
        }

        if (errors.length === 0) {
            throw new Error('Chưa cấu hình AI provider nào. Vui lòng thêm API key (OpenAI, Gemini hoặc Claude).');
        }
        throw new Error(`Tất cả providers đều lỗi:\n${errors.join('\n')}`);
    }

    // ===== PRIVATE: PROMPT BUILDING =====

    _buildSystemPrompt() {
        return `Bạn là chuyên gia QA automation, chuyên viết test case cho Playwright.

NHIỆM VỤ: Phân tích trang web (screenshot + DOM elements) và sinh ra 3 kịch bản test.

QUY TẮC BẮT BUỘC ĐỂ TEST CHẠY ĐƯỢC:

1. ACTIONS HỢP LỆ:
   UI (10): navigate, click, fill, select, hover, assert_text, assert_visible, assert_url, wait, screenshot
   Extended (6): double_click, right_click, keyboard, scroll_to, drag_drop, upload_file

2. FORMAT MỖI STEP — các field PHẢI đúng:
   | Action         | selector          | value                | expected             |
   |----------------|-------------------|----------------------|----------------------|
   | navigate       | để trống ""       | URL đầy đủ           | để trống ""          |
   | click          | CSS selector      | để trống ""          | để trống ""          |
   | fill           | CSS selector      | giá trị THỰC TẾ     | để trống ""          |
   | select         | CSS selector      | option value/label   | để trống ""          |
   | hover          | CSS selector      | để trống ""          | để trống ""          |
   | assert_text    | CSS selector      | để trống ""          | text mong đợi        |
   | assert_visible | CSS selector      | để trống ""          | để trống ""          |
   | assert_url     | để trống ""       | để trống ""          | chỉ path (vd: /dashboard) |
   | wait           | để trống ""       | số milliseconds      | để trống ""          |
   | screenshot     | để trống ""       | để trống ""          | để trống ""          |
   | keyboard       | để trống ""       | phím (Enter, Tab...) | để trống ""          |

3. SELECTOR — BẮT BUỘC:
   - CHỈ dùng selector có trong danh sách "DOM elements" bên dưới
   - KHÔNG BAO GIỜ tự đoán selector
   - Ưu tiên: data-testid > id > name > placeholder > role > button:has-text(...)
   - Với button: dùng "button:has-text(...)" KHÔNG dùng "text=..."

4. VALUE cho fill — BẮT BUỘC có giá trị thực tế:
   - Email: "testuser@example.com"
   - Password: "Test@12345"
   - Tên: "Nguyen Van Test"
   - SĐT: "0901234567"
   - Số: "100"
   - Text ngắn: "Test automation value"
   - Negative test: dùng giá trị sai/trống/quá dài tương ứng

5. EXPECTED cho assert_url: CHỈ dùng path (vd: "/dashboard"), KHÔNG dùng full URL

6. Mỗi kịch bản PHẢI:
   - Bắt đầu bằng step navigate
   - Kết thúc bằng step screenshot
   - Mỗi step có description bằng tiếng Việt

OUTPUT FORMAT — Trả về JSON thuần (KHÔNG có markdown, KHÔNG có \`\`\`):
{
  "scenarios": [
    {
      "type": "happy_path",
      "title": "Tiêu đề bằng tiếng Việt",
      "description": "Mô tả ngắn",
      "steps": [
        { "step_id": 1, "action": "navigate", "selector": "", "value": "URL", "expected": "", "description": "Mô tả" }
      ]
    },
    {
      "type": "negative",
      "title": "...",
      "description": "...",
      "steps": [...]
    },
    {
      "type": "boundary",
      "title": "...",
      "description": "...",
      "steps": [...]
    }
  ]
}`;
    }

    _buildUserPrompt(crawlData, options) {
        const { url, testType, description } = options;
        const testTypeInfo = TEST_TYPES[testType] || TEST_TYPES.auto;

        let prompt = `Phân tích trang web và tạo 3 kịch bản test.\n\n`;
        prompt += `URL: ${url}\n`;
        prompt += `Loại test: ${testTypeInfo.label} — ${testTypeInfo.prompt}\n`;

        if (description) {
            prompt += `Yêu cầu thêm: ${description}\n`;
        }

        // Page metadata
        if (crawlData.metadata) {
            const m = crawlData.metadata;
            prompt += `\nThông tin trang:\n`;
            prompt += `  Title: ${m.title}\n`;
            prompt += `  Forms: ${m.forms} | Inputs: ${m.inputs} | Buttons: ${m.buttons} | Links: ${m.links}\n`;
            if (m.headings?.length > 0) {
                prompt += `  Headings: ${m.headings.join(', ')}\n`;
            }
        }

        // DOM elements with real selectors
        if (crawlData.elements?.length > 0) {
            const maxElements = 30;
            const elements = crawlData.elements.slice(0, maxElements);
            prompt += `\nDOM elements (${elements.length}/${crawlData.elements.length}) — CHỈ dùng selector từ danh sách này:\n`;
            elements.forEach((el, i) => {
                let line = `  ${i + 1}. <${el.tag}>`;
                if (el.type) line += ` type="${el.type}"`;
                if (el.id) line += ` id="${el.id}"`;
                if (el.name) line += ` name="${el.name}"`;
                if (el.placeholder) line += ` placeholder="${el.placeholder}"`;
                if (el.text) line += ` text="${el.text.substring(0, 40)}"`;
                if (el.href) line += ` href="${el.href.substring(0, 60)}"`;
                if (el.selector) line += ` → selector: ${el.selector}`;
                prompt += line + '\n';
            });
        }

        prompt += `\nTạo 3 kịch bản (happy_path, negative, boundary). Trả về JSON thuần túy.`;
        return prompt;
    }

    // ===== PRIVATE: IMAGE OPTIMIZATION =====

    async _optimizeImages(screenshot) {
        if (!screenshot) return [];

        try {
            const resized = await sharp(screenshot)
                .resize({ width: 1024, withoutEnlargement: true })
                .png({ quality: 80 })
                .toBuffer();
            return [{ data: resized, mimeType: 'image/png' }];
        } catch (err) {
            console.warn(`[AIService] Image resize failed: ${err.message}`);
            return [{ data: screenshot, mimeType: 'image/png' }];
        }
    }

    // ===== PRIVATE: RESPONSE PARSING & VALIDATION =====

    _parseResponse(text, crawledElements = []) {
        let clean = text.trim();
        clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

        let parsed;
        try {
            parsed = JSON.parse(clean);
        } catch {
            // Try to extract JSON
            const jsonMatch = text.match(/\{[\s\S]*"scenarios"[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0]);
                } catch {
                    // Try single scenario format
                    const singleMatch = text.match(/\{[\s\S]*"steps"[\s\S]*\}/);
                    if (singleMatch) {
                        const single = JSON.parse(singleMatch[0]);
                        parsed = {
                            scenarios: [{
                                type: 'happy_path',
                                title: single.title || 'Test Case',
                                description: single.description || '',
                                steps: single.steps || []
                            }]
                        };
                    } else {
                        throw new Error('Không thể parse JSON');
                    }
                }
            } else {
                throw new Error(`AI trả về kết quả không hợp lệ. Raw: ${text.substring(0, 300)}`);
            }
        }

        // Parse scenarios
        const rawScenarios = parsed.scenarios || [parsed];
        const scenarios = [];

        for (const raw of rawScenarios) {
            const validated = this._validateSteps(raw.steps || [], crawledElements);
            scenarios.push({
                type: raw.type || 'happy_path',
                title: raw.title || 'Test Case',
                description: raw.description || '',
                steps: validated.steps,
                warnings: validated.warnings
            });
        }

        return scenarios;
    }

    /**
     * Validate & fix steps để đảm bảo chạy được trên ActionHandler
     */
    _validateSteps(steps, crawledElements = []) {
        const warnings = [];
        const crawledSelectors = (crawledElements || []).map(el => el.selector).filter(Boolean);

        const actionMap = {
            'goto': 'navigate', 'open': 'navigate', 'visit': 'navigate',
            'type': 'fill', 'input': 'fill', 'enter': 'fill',
            'press': 'click', 'tap': 'click', 'submit': 'click',
            'check_text': 'assert_text', 'verify_text': 'assert_text',
            'check_visible': 'assert_visible', 'verify_visible': 'assert_visible',
            'check_url': 'assert_url', 'verify_url': 'assert_url',
            'sleep': 'wait', 'delay': 'wait',
            'capture': 'screenshot', 'snap': 'screenshot'
        };

        const validSteps = [];

        for (let i = 0; i < steps.length; i++) {
            const s = steps[i];
            let action = (s.action || 'click').toLowerCase().trim().replace(/\s+/g, '_');
            action = actionMap[action] || action;

            if (!VALID_ACTIONS.includes(action)) {
                warnings.push(`Step ${i + 1}: action "${s.action}" không hợp lệ, đã bỏ qua`);
                continue;
            }

            const step = {
                step_id: validSteps.length + 1,
                action,
                selector: String(s.selector || '').trim(),
                value: String(s.value || '').trim(),
                expected: String(s.expected || s.expected_text || s.expected_url || '').trim(),
                description: String(s.description || '').trim()
            };

            // Validate selector exists
            if (ACTIONS_NEED_SELECTOR.includes(action) && !step.selector) {
                warnings.push(`Step ${step.step_id}: thiếu selector cho "${action}"`);
            }

            // Validate value
            if (action === 'fill' && !step.value) {
                warnings.push(`Step ${step.step_id}: fill thiếu value — test sẽ điền rỗng`);
            }
            if (action === 'navigate' && !step.value) {
                warnings.push(`Step ${step.step_id}: navigate thiếu URL`);
            }

            // Validate expected
            if (ACTIONS_NEED_EXPECTED.includes(action) && !step.expected) {
                warnings.push(`Step ${step.step_id}: "${action}" thiếu expected`);
            }

            // Fix assert_url: full URL → path only
            if (action === 'assert_url' && step.expected) {
                try {
                    const urlObj = new URL(step.expected);
                    step.expected = urlObj.pathname + urlObj.search + urlObj.hash;
                } catch {
                    // Already a path, keep as is
                }
            }

            // Check selector against crawl data
            if (step.selector && crawledSelectors.length > 0) {
                const selectorExists = crawledSelectors.some(cs =>
                    cs === step.selector || step.selector.includes(cs) || cs.includes(step.selector)
                );
                if (!selectorExists) {
                    warnings.push(`Step ${step.step_id}: selector "${step.selector}" không tìm thấy trong crawl data`);
                }
            }

            validSteps.push(step);
        }

        // Auto-fix: đảm bảo có screenshot cuối cùng
        if (validSteps.length > 0 && validSteps[validSteps.length - 1].action !== 'screenshot') {
            validSteps.push({
                step_id: validSteps.length + 1,
                action: 'screenshot',
                selector: '',
                value: '',
                expected: '',
                description: 'Chụp ảnh kết quả'
            });
        }

        return { steps: validSteps, warnings };
    }

    // ===== PRIVATE: UTILS =====

    _getMaskedKey(providerName) {
        const envKeyMap = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', claude: 'ANTHROPIC_API_KEY' };
        const key = process.env[envKeyMap[providerName]];
        if (!key) return null;
        return key.substring(0, 4) + '••••' + key.slice(-4);
    }
}

module.exports = AIService;
