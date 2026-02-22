# Kế hoạch Triển khai (Implementation Plan)
## Công cụ Kiểm thử Web Tự động

> **Phiên bản:** 1.1 (Cập nhật theo PRD v1.1) | **Ngày:** 21/02/2026

---

## 1. Lựa chọn Công nghệ (Tech Stack)

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| **Test Engine** | **Playwright** (Node.js) | Nhanh nhất đa trình duyệt, auto-wait tích hợp, thu thập Video/Screenshot mạnh mẽ |
| **Backend API** | **Node.js + Express** | Cùng hệ sinh thái Playwright, I/O bất đồng bộ, phù hợp chạy test song song |
| **Excel Upload** | **xlsx** (SheetJS) | Đọc file `.xlsx` phía server, parse thành test case JSON |
| **Frontend** | **React (Vite) + Tailwind CSS** | Build nhanh, component hóa giao diện |
| **Database** | **SQLite** (better-sqlite3) | Không cần server DB, đủ mạnh cho quy mô sản phẩm |
| **Real-time** | **Socket.IO** | Đẩy log/progress test về UI real-time |
| **Báo cáo** | **EJS Template + Chart.js** | Tạo HTML report tùy chỉnh, biểu đồ trực quan |
| **Xuất PDF** | **Playwright PDF** (print-to-pdf) | Dùng chính Playwright in trang báo cáo thành PDF |

### 1.2. Kiến trúc hệ thống

```
[Browser / Web UI - React]
       |  (HTTP REST + Socket.IO)
       v
[Node.js Backend - Express]
  |-- /api/test-suites        → CRUD Test Suite
  |-- /api/test-cases         → CRUD Test Case (nhập tay)
  |-- /api/test-cases/import  → Upload & đọc file Excel
  |-- /api/runs               → Trigger & lấy kết quả
  |-- /api/reports            → Xuất HTML / PDF
  |-- /static/template.xlsx   → File mẫu Excel để tải về
       |
       v
[Test Runner - Playwright]
  |-- Thực thi từng Action (navigate, click, fill, ...)
  |-- Thu thập Screenshot & Video
  |-- Ghi kết quả vào SQLite
       |
       v
[SQLite Database]     [File System: evidence/]
```

---

## 2. Cấu trúc Thư mục Dự án

```text
automation-tool/
  ├── backend/
  │   ├── src/
  │   │   ├── api/             # Express route handlers
  │   │   ├── runner/
  │   │   │   ├── TestRunner.js       # Thực thi test case
  │   │   │   ├── ActionHandler.js    # Xử lý 10 action types
  │   │   │   └── EvidenceManager.js  # Screenshot & Video
  │   │   ├── importer/
  │   │   │   └── ExcelImporter.js    # Đọc file Excel → JSON
  │   │   ├── reporter/        # Render HTML/PDF báo cáo
  │   │   ├── db/              # SQLite models & queries
  │   │   ├── templates/
  │   │   │   ├── report.ejs          # Template HTML báo cáo
  │   │   │   └── testcase_template.xlsx  # File mẫu Excel
  │   │   └── server.js
  │   └── package.json
  │
  ├── frontend/
  │   ├── src/
  │   │   ├── pages/           # Dashboard, TestCase, Monitor, Report
  │   │   ├── components/      # StepRow, StatusBadge, EvidenceModal
  │   │   └── App.jsx
  │   └── package.json
  │
  ├── evidence/                # Ảnh & video theo run_id/tc_id/
  ├── reports/                 # File HTML/PDF xuất ra
  └── data/
      └── testdb.sqlite
```

---

## 3. Cấu trúc File Excel Mẫu (template.xlsx)

| Cột | Tên cột | Mô tả | Ví dụ |
|---|---|---|---|
| A | `tc_id` | Mã test case | TC-001 |
| B | `title` | Tiêu đề test case | Đăng nhập thành công |
| C | `url` | URL trang cần test | https://example.com/login |
| D | `browser` | Trình duyệt | chromium |
| E | `step_id` | Số thứ tự bước | 1 |
| F | `action` | Loại hành động | fill |
| G | `selector` | CSS/XPath selector | #email |
| H | `value` | Giá trị nhập (nếu có) | user@test.com |
| I | `expected` | Giá trị kỳ vọng (nếu là assert) | https://example.com/dashboard |
| J | `description` | Mô tả bước | Nhập địa chỉ email |

> Mỗi **hàng** = 1 bước của 1 test case. Nhiều hàng cùng `tc_id` = các bước của cùng 1 test case.

---

## 4. Schema Cơ sở dữ liệu (SQLite)

```sql
CREATE TABLE test_suites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE test_cases (
  id TEXT PRIMARY KEY,
  suite_id TEXT REFERENCES test_suites(id),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  browser TEXT DEFAULT 'chromium',
  steps_json TEXT NOT NULL,  -- JSON array of steps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE test_runs (
  id TEXT PRIMARY KEY,
  suite_id TEXT REFERENCES test_suites(id),
  started_at DATETIME,
  finished_at DATETIME,
  status TEXT,               -- RUNNING / DONE / CANCELLED
  summary_json TEXT          -- { total, passed, failed, skipped }
);

CREATE TABLE test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT REFERENCES test_runs(id),
  test_case_id TEXT,
  status TEXT,               -- PASSED / FAILED / SKIPPED
  duration_ms INTEGER,
  error_message TEXT,
  steps_result_json TEXT,    -- JSON: mỗi bước + trạng thái + screenshot path
  video_path TEXT            -- Đường dẫn file video
);
```

---

## 5. Các Giai đoạn Triển khai

### Giai đoạn 1: Core Engine (Tuần 1-2)
**Mục tiêu:** Chạy được test case từ đầu đến cuối qua CLI.

- [ ] Khởi tạo project Node.js, cài Playwright
- [ ] `ActionHandler.js`: xử lý 10 action types: `navigate`, `click`, `fill`, `select`, `hover`, `assert_text`, `assert_visible`, `assert_url`, `wait`, `screenshot`
- [ ] `TestRunner.js`: đọc JSON steps, gọi ActionHandler tuần tự, bắt lỗi từng bước
- [ ] `EvidenceManager.js`: chụp ảnh sau mỗi bước, quay video toàn session, tổ chức file theo `evidence/{run_id}/{tc_id}/`
- [ ] Test thủ công CLI: `node run.js --case sample.json`

**Output:** Evidence (ảnh + video) được tạo ra sau mỗi lần chạy CLI

---

### Giai đoạn 2: Backend API & Excel Import (Tuần 3-4)
**Mục tiêu:** API CRUD đầy đủ + import test case từ Excel.

- [ ] Express server + SQLite setup, tạo schema
- [ ] REST API: `test-suites`, `test-cases`, `runs`, `reports`
- [ ] `ExcelImporter.js`: dùng thư viện **xlsx (SheetJS)** để đọc file `.xlsx`, nhóm các hàng theo `tc_id`, tạo danh sách test case JSON
- [ ] Tạo và lưu `testcase_template.xlsx` làm file mẫu chuẩn; route `GET /api/template` để tải về
- [ ] Socket.IO: emit progress events (`step_done`, `tc_done`, `run_done`) về client
- [ ] `Reporter.js`: render HTML report từ kết quả DB bằng EJS template

**Output:** API hoàn chỉnh, import được file Excel, tải được file mẫu

---

### Giai đoạn 3: Frontend UI (Tuần 5-7)
**Mục tiêu:** Giao diện web đẹp, đầy đủ flow từ tạo đến xem báo cáo.

- [ ] Tạo dự án React (Vite) + Tailwind, layout sidebar
- [ ] **Dashboard**: KPI cards (Tổng / Pass / Fail / Tỉ lệ) + Chart.js (Pie + Line)
- [ ] **Quản lý Test Suite & Test Case**:
  - Form nhập tay: Label, URL, thêm/xóa/sắp xếp steps
  - Nút "Tải file mẫu Excel" + component upload `.xlsx`
  - Preview danh sách test case sau khi import Excel
- [ ] **Live Monitor**: kết nối Socket.IO, hiển thị từng bước Pass/Fail real-time + progress bar
- [ ] **Trang Báo cáo**: Accordion từng test case + lightbox xem ảnh + nút "Xuất HTML" / "Xuất PDF"

**Output:** Toàn bộ flow hoạt động trên UI

---

### Giai đoạn 4: Tích hợp & Hoàn thiện (Tuần 8)
- [ ] E2E Test toàn hệ thống (import Excel → chạy suite → xem báo cáo)
- [ ] Xử lý edge cases: trang chậm, element không tồn tại, file Excel sai định dạng
- [ ] Hỗ trợ CLI cho CI/CD: `node cli.js run --suite SUITE-001`
- [ ] Viết README hướng dẫn cài đặt và sử dụng

---

## 6. Lịch trình (8 tuần)

```
Tuần 1-2 │ ████████ Core Engine (Playwright Runner + Screenshot/Video)
Tuần 3-4 │ ████████ Backend API + SQLite + Excel Import
Tuần 5-7 │ ████████████ Frontend UI (Dashboard + Monitor + Report)
Tuần 8   │ ████ E2E Testing + CLI + Tài liệu
```

---

## 7. Kế hoạch Xác minh (Verification Plan)

### Kiểm thử tự động
| Test | Mô tả | Lệnh |
|---|---|---|
| Unit: ActionHandler | Kiểm tra từng action xử lý đúng | `npm test unit` |
| Unit: ExcelImporter | Kiểm tra đọc file Excel đúng cấu trúc | `npm test excel` |
| Integration: Runner | Chạy kịch bản mẫu trên trang demo | `node cli.js run --case sample.json` |

### Kiểm thử thủ công
1. **Nhập tay**: Tạo Test Suite, thêm 2 Test Case qua form, click "Run"
2. **Upload Excel**: Tải file mẫu, điền dữ liệu, upload lại, kiểm tra test case được tạo đúng
3. **Live Monitor**: Quan sát tiến độ từng bước real-time trong khi test chạy
4. **Xem Evidence**: Kiểm tra thư mục `evidence/` có đủ ảnh và video
5. **Xuất Báo cáo**: Xuất HTML (mở trình duyệt xem) và PDF (kiểm tra file tải về)

---

## 8. Rủi ro và Giải pháp

| Rủi ro | Mức độ | Giải pháp |
|---|---|---|
| Trang web có Captcha chặn bot | Cao | Dùng `playwright-stealth`; hiển thị cảnh báo trong báo cáo nếu test fail do captcha |
| SPA tải chậm gây flaky test | Trung bình | `page.waitForLoadState('networkidle')`, timeout mặc định 30s |
| File Excel upload sai cột/định dạng | Trung bình | Validate cột bắt buộc khi import, hiển thị thông báo lỗi cụ thể từng hàng |
| Evidence chiếm nhiều dung lượng | Thấp | Chỉ quay video cho test case FAILED; tự xóa evidence cũ hơn 30 ngày |
