const { GoogleGenAI } = require('@google/genai');
const sharp = require('sharp');

/**
 * AITestGenerator — Sinh test case tự động bằng AI
 *
 * Hỗ trợ:
 * - Multi-provider (Gemini, Groq, Ollama) qua MultiProviderAI
 * - Request queue với rate limiting qua AIRequestQueue
 * - Response cache qua AIResponseCache
 * - Image optimization (resize, giới hạn số ảnh)
 * - Token optimization (compact DOM, giảm maxOutputTokens)
 *
 * Backward compatible: new AITestGenerator() không tham số hoạt động y như cũ
 */
class AITestGenerator {
    /**
     * @param {object} options
     * @param {object} options.queue - AIRequestQueue instance (optional)
     * @param {object} options.cache - AIResponseCache instance (optional)
     * @param {object} options.multiProvider - MultiProviderAI instance (optional)
     */
    constructor(options = {}) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            this.client = null;
        } else {
            this.client = new GoogleGenAI({ apiKey });
        }
        this.model = 'gemini-2.0-flash';

        // Optional integrations
        this.queue = options.queue || null;
        this.cache = options.cache || null;
        this.multiProvider = options.multiProvider || null;
    }

    isConfigured() {
        // Configured nếu có Gemini key HOẶC có multiProvider với ít nhất 1 provider available
        if (this.client) return true;
        if (this.multiProvider) {
            return this.multiProvider.status().some(p => p.available);
        }
        return false;
    }

    /**
     * Build system prompt for test case generation
     */
    buildSystemPrompt() {
        return `Bạn là chuyên gia QA automation, chuyên viết test case cho Playwright.

NHIỆM VỤ: Phân tích UI (ảnh chụp màn hình và/hoặc thông tin DOM) rồi sinh ra các test steps chuẩn Playwright.

QUY TẮC BẮT BUỘC:
1. UI actions (10): navigate, click, fill, select, hover, assert_text, assert_visible, assert_url, wait, screenshot
   Extended UI (6): double_click, right_click, keyboard, scroll_to, drag_drop, upload_file
   API actions (6): api_request, assert_status, assert_body, assert_header, assert_response_time, store_variable
2. Selector ưu tiên theo thứ tự: data-testid > id > name > role > placeholder > CSS class > text
3. Mỗi step PHẢI có description bằng tiếng Việt
4. Selector PHẢI là CSS selector hoặc Playwright selector hợp lệ
5. Với click button: dùng "button:has-text(...)" hoặc selector cụ thể, TUYỆT ĐỐI KHÔNG dùng "text=..." vì dễ match nhiều element
6. Với fill input: ưu tiên input[name="..."], input[type="..."], #id, [placeholder="..."]
7. Luôn thêm step screenshot cuối cùng
8. Nếu có form đăng nhập/đăng ký, luôn thêm assert_url hoặc assert_text để kiểm tra kết quả

CHO API ACTIONS:
- api_request: selector = "GET|POST|PUT|DELETE|PATCH", value = URL, expected = request body (JSON)
- assert_status: expected = status code (200, 201, 404...)
- assert_body: selector = JSONPath ($.data.id), expected = giá trị mong đợi hoặc "not_empty"
- assert_header: selector = header name, expected = giá trị mong đợi
- assert_response_time: expected = max ms (e.g. "2000")
- store_variable: selector = JSONPath ($.data.token), value = tên biến. Dùng {{tên_biến}} ở step sau

CHO EXTENDED UI ACTIONS:
- keyboard: value = phím (e.g. "Enter", "Control+a", "Tab")
- drag_drop: selector = source element, value = target element
- upload_file: selector = input[type=file], value = file path
- scroll_to: selector = element to scroll to
- double_click, right_click: selector = element

OUTPUT FORMAT — Trả về JSON thuần (KHÔNG có markdown, KHÔNG có \`\`\`):
{
  "title": "Tiêu đề test case bằng tiếng Việt",
  "description": "Mô tả ngắn",
  "steps": [
    {
      "step_id": 1,
      "action": "navigate|click|fill|...|api_request|assert_status|...",
      "selector": "CSS selector hoặc HTTP method (cho API) hoặc JSONPath (cho assert_body)",
      "value": "giá trị nhập hoặc URL",
      "expected": "giá trị mong đợi",
      "description": "Mô tả bước bằng tiếng Việt"
    }
  ]
}`;
    }

    // ===== IMAGE OPTIMIZATION =====

    /**
     * Tối ưu ảnh trước khi gửi AI: resize + giới hạn số lượng
     * Giảm ~60-70% token usage
     */
    async optimizeImages(images) {
        if (!images || images.length === 0) return [];

        // Giới hạn 3 ảnh: ưu tiên crawled screenshot (cuối) + 2 uploads đầu
        let selected = images;
        if (images.length > 3) {
            const crawled = images[images.length - 1]; // crawled screenshot luôn ở cuối
            const uploads = images.slice(0, 2);
            selected = [...uploads, crawled];
            console.log(`[AI] Image optimization: ${images.length} → ${selected.length} images`);
        }

        // Resize mỗi ảnh xuống max 800px width
        const optimized = [];
        for (const img of selected) {
            try {
                const resized = await sharp(img.data)
                    .resize({ width: 800, withoutEnlargement: true })
                    .png({ quality: 80 })
                    .toBuffer();

                optimized.push({ data: resized, mimeType: 'image/png' });
            } catch (err) {
                // Nếu resize fail, giữ nguyên ảnh gốc
                console.warn(`[AI] Image resize failed: ${err.message}, using original`);
                optimized.push(img);
            }
        }

        return optimized;
    }

    // ===== PROMPT BUILDING =====

    /**
     * Build multipart content parts từ images + context
     */
    _buildParts(images, context) {
        const parts = [];

        // Add images as inline data
        for (const img of images) {
            parts.push({
                inlineData: {
                    data: img.data.toString('base64'),
                    mimeType: img.mimeType || 'image/png'
                }
            });
        }

        // Build text prompt
        parts.push({ text: this._buildTextPrompt(context) });

        return parts;
    }

    /**
     * Build text prompt từ context — compact format giảm token
     */
    _buildTextPrompt(context) {
        let prompt = 'Phân tích UI và tạo test case tự động.\n\n';

        if (context.url) {
            prompt += `URL: ${context.url}\n`;
        }

        if (context.description) {
            prompt += `Mô tả: ${context.description}\n\n`;
        }

        if (context.metadata) {
            const m = context.metadata;
            prompt += `Trang: ${m.title} | Forms: ${m.forms}, Inputs: ${m.inputs}, Buttons: ${m.buttons}, Links: ${m.links}\n`;
            if (m.headings && m.headings.length > 0) {
                prompt += `Headings: ${m.headings.join(', ')}\n`;
            }
            prompt += '\n';
        }

        // Compact DOM format: 1 dòng/element, giới hạn 20 elements
        if (context.elements && context.elements.length > 0) {
            prompt += `DOM elements (${Math.min(context.elements.length, 20)}/${context.elements.length}):\n`;
            context.elements.slice(0, 20).forEach((el, i) => {
                let line = `${i + 1}. ${el.tag}`;
                if (el.id) line += `#${el.id}`;
                if (el.name) line += `[name=${el.name}]`;
                if (el.type) line += `[type=${el.type}]`;
                if (el.placeholder) line += `[placeholder="${el.placeholder}"]`;
                if (el.text) line += ` "${el.text.substring(0, 30)}"`;
                if (el.selector) line += ` → ${el.selector}`;
                prompt += line + '\n';
            });
            prompt += '\n';
        }

        prompt += 'Tạo test case chi tiết. Trả về JSON thuần túy.';
        return prompt;
    }

    // ===== DIRECT GEMINI CALL (legacy/fallback) =====

    /**
     * Gọi trực tiếp Gemini API với retry logic
     */
    async _directGeminiCall(parts) {
        if (!this.client) {
            throw new Error('GEMINI_API_KEY chưa được cấu hình. Thêm GEMINI_API_KEY vào biến môi trường và restart server.');
        }

        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.client.models.generateContent({
                    model: this.model,
                    contents: [{ role: 'user', parts }],
                    config: {
                        systemInstruction: this.buildSystemPrompt(),
                        temperature: 0.2,
                        maxOutputTokens: 2048
                    }
                });

                return this.parseResponse(response.text || '');

            } catch (err) {
                const msg = err.message || '';
                if ((msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) && attempt < maxRetries) {
                    const waitMs = Math.min(60000, Math.pow(2, attempt) * 5000 + Math.random() * 1000);
                    console.log(`[AI] Rate limited, retrying in ${Math.ceil(waitMs / 1000)}s (attempt ${attempt}/${maxRetries})`);
                    await new Promise(r => setTimeout(r, waitMs));
                    continue;
                }
                if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
                    throw new Error('Vượt giới hạn Gemini API (Free Tier: 15 req/phút). Vui lòng chờ 1-2 phút rồi thử lại.');
                }
                if (msg.includes('API_KEY')) {
                    throw new Error('GEMINI_API_KEY không hợp lệ. Kiểm tra lại key tại aistudio.google.com');
                }
                throw new Error(`Lỗi Gemini API: ${msg}`);
            }
        }
    }

    // ===== MAIN GENERATE METHOD =====

    /**
     * Generate test case from screenshots + context
     * Flow: cache check → optimize images → build parts → queue(callAI) → cache result
     *
     * @param {Array<{data: Buffer, mimeType: string}>} images
     * @param {object} context - { url, description, elements, metadata }
     * @returns {object} { title, description, steps, warnings, source? }
     */
    async generate(images = [], context = {}) {
        // 1. Check cache
        if (this.cache) {
            const cached = this.cache.get(context.url, context.description, images);
            if (cached) {
                console.log('[AI] Cache hit — returning cached result');
                return { ...cached, source: 'cache' };
            }
        }

        // 2. Check configured
        if (!this.isConfigured()) {
            throw new Error('Chưa cấu hình AI provider nào. Thêm GEMINI_API_KEY vào biến môi trường và restart server.');
        }

        // 3. Optimize images
        const optimizedImages = await this.optimizeImages(images);

        // 4. Build prompt parts
        const parts = this._buildParts(optimizedImages, context);

        // 5. Define the AI call function
        const callAI = async () => {
            // Prefer multiProvider if available
            if (this.multiProvider) {
                const textPrompt = this._buildTextPrompt(context);
                const imageParts = parts.filter(p => p.inlineData);
                const { text, provider } = await this.multiProvider.generate(
                    textPrompt,
                    this.buildSystemPrompt(),
                    imageParts
                );
                const result = this.parseResponse(text);
                result.source = provider;
                return result;
            }

            // Fallback: direct Gemini call
            return this._directGeminiCall(parts);
        };

        // 6. Execute through queue or directly
        let result;
        if (this.queue) {
            result = await this.queue.enqueue(callAI, { type: 'generate' });
        } else {
            result = await callAI();
        }

        // 7. Cache the result
        if (this.cache && result) {
            this.cache.set(context.url, context.description, images, result);
        }

        return result;
    }

    // ===== REFINE METHOD =====

    /**
     * Refine existing steps based on user feedback
     * Refine luôn qua queue (nếu có) nhưng KHÔNG cache
     */
    async refine(currentSteps, feedback, context = {}) {
        if (!this.isConfigured()) {
            throw new Error('Chưa cấu hình AI provider nào.');
        }

        const prompt = `Đây là test case hiện tại:
${JSON.stringify(currentSteps, null, 2)}

Yêu cầu chỉnh sửa từ người dùng:
${feedback}

${context.url ? `URL: ${context.url}` : ''}

Hãy chỉnh sửa test case theo yêu cầu. Trả về JSON thuần túy với cùng format.`;

        const callAI = async () => {
            if (this.multiProvider) {
                const { text } = await this.multiProvider.generate(
                    prompt,
                    this.buildSystemPrompt(),
                    [] // no images for refine
                );
                return this.parseResponse(text);
            }

            // Fallback: direct Gemini
            if (!this.client) {
                throw new Error('GEMINI_API_KEY chưa được cấu hình.');
            }
            const response = await this.client.models.generateContent({
                model: this.model,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: this.buildSystemPrompt(),
                    temperature: 0.2,
                    maxOutputTokens: 2048
                }
            });
            return this.parseResponse(response.text || '');
        };

        if (this.queue) {
            return this.queue.enqueue(callAI, { type: 'refine' });
        }
        return callAI();
    }

    // ===== RESPONSE PARSING =====

    /**
     * Parse AI response text into structured format
     */
    parseResponse(text) {
        let clean = text.trim();
        clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

        try {
            const parsed = JSON.parse(clean);

            const steps = (parsed.steps || []).map((s, i) => ({
                step_id: s.step_id || i + 1,
                action: this.normalizeAction(s.action),
                selector: String(s.selector || '').trim(),
                value: String(s.value || '').trim(),
                expected: String(s.expected || '').trim(),
                description: String(s.description || '').trim()
            }));

            const warnings = [];
            const validActions = ['navigate', 'click', 'fill', 'select', 'hover', 'assert_text', 'assert_visible', 'assert_url', 'wait', 'screenshot'];
            steps.forEach(s => {
                if (!validActions.includes(s.action)) {
                    warnings.push(`Step ${s.step_id}: action "${s.action}" không hợp lệ`);
                }
                if (['click', 'fill', 'select', 'hover', 'assert_text', 'assert_visible'].includes(s.action) && !s.selector) {
                    warnings.push(`Step ${s.step_id}: thiếu selector cho action "${s.action}"`);
                }
            });

            return {
                title: parsed.title || 'Test Case từ AI',
                description: parsed.description || '',
                steps: steps.filter(s => validActions.includes(s.action)),
                warnings
            };

        } catch (e) {
            const jsonMatch = text.match(/\{[\s\S]*"steps"[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return this.parseResponse(jsonMatch[0]);
                } catch { /* fall through */ }
            }
            throw new Error(`AI trả về kết quả không hợp lệ. Vui lòng thử lại.\n\nRaw: ${text.substring(0, 200)}`);
        }
    }

    normalizeAction(action) {
        if (!action) return 'click';
        const a = action.toLowerCase().trim().replace(/\s+/g, '_');
        const map = {
            'goto': 'navigate', 'open': 'navigate', 'visit': 'navigate',
            'type': 'fill', 'input': 'fill', 'enter': 'fill',
            'press': 'click', 'tap': 'click', 'submit': 'click',
            'check_text': 'assert_text', 'verify_text': 'assert_text',
            'check_visible': 'assert_visible', 'verify_visible': 'assert_visible',
            'check_url': 'assert_url', 'verify_url': 'assert_url',
            'sleep': 'wait', 'delay': 'wait',
            'capture': 'screenshot', 'snap': 'screenshot'
        };
        return map[a] || a;
    }
}

module.exports = AITestGenerator;
