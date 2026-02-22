const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

/**
 * AITestGenerator — Dùng Google Gemini để sinh test case tự động
 * 
 * Input: ảnh UI + mô tả + URL context
 * Output: JSON steps chuẩn Playwright
 */
class AITestGenerator {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            this.client = null;
            return;
        }
        this.client = new GoogleGenAI({ apiKey });
        this.model = 'gemini-2.0-flash';
    }

    isConfigured() {
        return !!this.client;
    }

    /**
     * Build system prompt for test case generation
     */
    buildSystemPrompt() {
        return `Bạn là chuyên gia QA automation, chuyên viết test case cho Playwright.

NHIỆM VỤ: Phân tích UI (ảnh chụp màn hình và/hoặc thông tin DOM) rồi sinh ra các test steps chuẩn Playwright.

QUY TẮC BẮT BUỘC:
1. Chỉ dùng 10 action types: navigate, click, fill, select, hover, assert_text, assert_visible, assert_url, wait, screenshot
2. Selector ưu tiên theo thứ tự: data-testid > id > name > role > placeholder > CSS class > text
3. Mỗi step PHẢI có description bằng tiếng Việt
4. Selector PHẢI là CSS selector hoặc Playwright selector hợp lệ
5. Với click button: dùng "button:has-text(...)" hoặc selector cụ thể, TUYỆT ĐỐI KHÔNG dùng "text=..." vì dễ match nhiều element
6. Với fill input: ưu tiên input[name="..."], input[type="..."], #id, [placeholder="..."]
7. Luôn thêm step screenshot cuối cùng
8. Nếu có form đăng nhập/đăng ký, luôn thêm assert_url hoặc assert_text để kiểm tra kết quả

OUTPUT FORMAT — Trả về JSON thuần (KHÔNG có markdown, KHÔNG có \`\`\`):
{
  "title": "Tiêu đề test case bằng tiếng Việt",
  "description": "Mô tả ngắn",
  "steps": [
    {
      "step_id": 1,
      "action": "navigate|click|fill|select|hover|assert_text|assert_visible|assert_url|wait|screenshot",
      "selector": "CSS selector hoặc để trống",
      "value": "giá trị nhập hoặc URL hoặc thời gian wait (ms)",
      "expected": "giá trị mong đợi (cho assert)",
      "description": "Mô tả bước bằng tiếng Việt"
    }
  ]
}`;
    }

    /**
     * Generate test case from screenshots + context
     * @param {Array<{data: Buffer, mimeType: string}>} images - uploaded images
     * @param {object} context - { url, description, elements, metadata }
     * @returns {object} { title, description, steps, warnings }
     */
    async generate(images = [], context = {}) {
        if (!this.client) {
            throw new Error('GEMINI_API_KEY chưa được cấu hình. Thêm GEMINI_API_KEY vào biến môi trường và restart server.');
        }

        const parts = [];

        // Add images
        for (const img of images) {
            parts.push({
                inlineData: {
                    data: img.data.toString('base64'),
                    mimeType: img.mimeType || 'image/png'
                }
            });
        }

        // Build text prompt with context
        let textPrompt = 'Phân tích UI và tạo test case tự động.\n\n';

        if (context.url) {
            textPrompt += `URL trang: ${context.url}\n`;
        }

        if (context.description) {
            textPrompt += `Mô tả chức năng cần test:\n${context.description}\n\n`;
        }

        if (context.metadata) {
            const m = context.metadata;
            textPrompt += `Thông tin trang:\n- Title: ${m.title}\n- URL: ${m.url}\n- Forms: ${m.forms}, Inputs: ${m.inputs}, Buttons: ${m.buttons}, Links: ${m.links}\n`;
            if (m.headings && m.headings.length > 0) {
                textPrompt += `- Headings: ${m.headings.join(', ')}\n`;
            }
            textPrompt += '\n';
        }

        if (context.elements && context.elements.length > 0) {
            textPrompt += `Các phần tử tương tác trên trang (đã phân tích DOM):\n`;
            context.elements.slice(0, 40).forEach((el, i) => {
                let desc = `  ${i + 1}. <${el.tag}`;
                if (el.type) desc += ` type="${el.type}"`;
                if (el.id) desc += ` id="${el.id}"`;
                if (el.name) desc += ` name="${el.name}"`;
                if (el.placeholder) desc += ` placeholder="${el.placeholder}"`;
                if (el.role) desc += ` role="${el.role}"`;
                desc += `>`;
                if (el.text) desc += ` text: "${el.text.substring(0, 50)}"`;
                if (el.selector) desc += ` → selector: ${el.selector}`;
                textPrompt += desc + '\n';
            });
            textPrompt += '\n';
        }

        textPrompt += `Hãy tạo test case chi tiết, bao gồm mở trang, tương tác với các phần tử, và kiểm tra kết quả. Trả về JSON thuần túy.`;

        parts.push({ text: textPrompt });

        // Retry logic for rate limiting (429)
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.client.models.generateContent({
                    model: this.model,
                    contents: [{ role: 'user', parts }],
                    config: {
                        systemInstruction: this.buildSystemPrompt(),
                        temperature: 0.2,
                        maxOutputTokens: 4096
                    }
                });

                const text = response.text || '';
                return this.parseResponse(text);

            } catch (err) {
                const msg = err.message || '';
                // Rate limit — retry with backoff
                if ((msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) && attempt < maxRetries) {
                    const waitSec = attempt * 5; // 5s, 10s, 15s
                    console.log(`[AI] Rate limited, retrying in ${waitSec}s (attempt ${attempt}/${maxRetries})`);
                    await new Promise(r => setTimeout(r, waitSec * 1000));
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

    /**
     * Refine existing steps based on user feedback
     */
    async refine(currentSteps, feedback, context = {}) {
        if (!this.client) {
            throw new Error('GEMINI_API_KEY chưa được cấu hình.');
        }

        const prompt = `Đây là test case hiện tại:
${JSON.stringify(currentSteps, null, 2)}

Yêu cầu chỉnh sửa từ người dùng:
${feedback}

${context.url ? `URL: ${context.url}` : ''}

Hãy chỉnh sửa test case theo yêu cầu. Trả về JSON thuần túy với cùng format.`;

        try {
            const response = await this.client.models.generateContent({
                model: this.model,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: this.buildSystemPrompt(),
                    temperature: 0.2,
                    maxOutputTokens: 4096
                }
            });

            return this.parseResponse(response.text || '');
        } catch (err) {
            throw new Error(`Lỗi AI refine: ${err.message}`);
        }
    }

    /**
     * Parse AI response text into structured format
     */
    parseResponse(text) {
        // Remove markdown code fences if present
        let clean = text.trim();
        clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

        try {
            const parsed = JSON.parse(clean);

            // Validate and normalize steps
            const steps = (parsed.steps || []).map((s, i) => ({
                step_id: s.step_id || i + 1,
                action: this.normalizeAction(s.action),
                selector: String(s.selector || '').trim(),
                value: String(s.value || '').trim(),
                expected: String(s.expected || '').trim(),
                description: String(s.description || '').trim()
            }));

            // Validate each step
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
            // Try to extract JSON from text
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
