# 🤖 AI Test Case Generator — Agent trên Microsoft 365 Copilot

Tạo agent trên nền tảng **m365.cloud.microsoft** giúp QC/BA sinh test case tự động.

---

## Tổng quan

Thay vì xây dựng sản phẩm riêng, ta sẽ tạo **Copilot Agent** trực tiếp trên Microsoft 365 với:

| Thành phần | Mô tả |
|---|---|
| **Agent Name** | AI Test Case Generator |
| **Platform** | Microsoft 365 Copilot (m365.cloud.microsoft) |
| **Builder** | Agent Builder / Copilot Studio |
| **Capabilities** | Image input (phân tích ảnh UI), Code interpreter |

---

## Những gì cần chuẩn bị

### 1. Agent Instructions (Prompt hệ thống)
Nội dung hướng dẫn agent cách hoạt động — đã soạn sẵn trong file `agent_instructions.md`

### 2. Knowledge Documents (Tài liệu kiến thức)
Upload lên agent để nó hiểu format chuẩn:
- `playwright_test_template_guide.md` — Hướng dẫn format test case chuẩn Playwright
- `excel_template_guide.md` — Hướng dẫn cấu trúc Excel xuất ra

### 3. Excel Template mẫu
- `test_case_template.xlsx` — File Excel mẫu chuẩn Playwright để agent tham chiếu

---

## Proposed Changes

### [NEW] [agent_instructions.md](file:///e:/Test_22022026/agent_instructions.md)
Agent system prompt — copy vào phần "Instructions" khi tạo agent trên M365

### [NEW] [playwright_test_template_guide.md](file:///e:/Test_22022026/knowledge/playwright_test_template_guide.md)
Knowledge document — upload vào phần "Knowledge" của agent

### [NEW] [excel_template_guide.md](file:///e:/Test_22022026/knowledge/excel_template_guide.md)
Knowledge document — hướng dẫn cấu trúc Excel template chuẩn

### [NEW] [sample_prompts.md](file:///e:/Test_22022026/sample_prompts.md)
Các prompt mẫu (Starter prompts) để gợi ý người dùng

---

## Hướng dẫn tạo Agent trên M365

### Bước 1: Truy cập m365.cloud.microsoft
- Đăng nhập bằng tài khoản Microsoft 365
- Tìm mục **"Agents"** hoặc **"Create agent"** ở thanh bên trái

### Bước 2: Tạo Agent mới
- Chọn **"Create agent"** → chọn tab **"Configure"**
- **Name:** `AI Test Case Generator`
- **Description:** `Agent AI giúp QC/BA tự động phân tích UI và sinh test case chuẩn Playwright từ ảnh, URL, Figma, và mô tả nghiệp vụ`
- **Icon:** Upload icon hoặc generate bằng AI

### Bước 3: Nhập Instructions
- Copy toàn bộ nội dung file `agent_instructions.md` → paste vào ô **Instructions**

### Bước 4: Thêm Knowledge
- Upload các file trong thư mục `knowledge/`:
  - `playwright_test_template_guide.md`
  - `excel_template_guide.md`

### Bước 5: Bật Capabilities
- ✅ **Image input** — để agent phân tích ảnh UI
- ✅ **Code interpreter** — để agent xử lý dữ liệu và format output

### Bước 6: Thêm Starter Prompts
- Copy các prompt mẫu từ `sample_prompts.md` → paste vào **Suggested prompts**

### Bước 7: Test & Publish
- Test agent với ảnh UI thực tế
- Publish cho team QC/BA sử dụng

---

## Verification Plan

### Manual Verification (trên M365 Copilot)
1. Gửi ảnh UI login page → kiểm tra agent sinh đúng test case
2. Gửi URL trang web → kiểm tra agent phân tích
3. Gửi mô tả nghiệp vụ → kiểm tra agent sinh steps
4. Yêu cầu xuất Excel → kiểm tra agent tạo bảng chuẩn format
5. Yêu cầu chỉnh sửa test case → kiểm tra agent sửa đúng
