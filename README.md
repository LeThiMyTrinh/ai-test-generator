# 🤖 AutoTest Tool — Công cụ Kiểm thử Web Tự động

Nền tảng kiểm thử web tự động sử dụng **Playwright**, hỗ trợ tạo test case thủ công hoặc import từ Excel, chạy test trên nhiều trình duyệt, theo dõi tiến độ real-time qua Socket.IO, và xuất báo cáo HTML/PDF.

---

## ✨ Tính năng chính

| Tính năng | Mô tả |
|---|---|
| **Đa trình duyệt** | Chromium, Firefox, WebKit (Safari) |
| **10 Action types** | navigate, click, fill, select, hover, assert_text, assert_visible, assert_url, wait, screenshot |
| **Import Excel** | Upload file `.xlsx` theo mẫu chuẩn, tự động tạo test case hàng loạt |
| **Live Monitor** | Theo dõi từng bước chạy real-time qua Socket.IO |
| **Evidence** | Tự động chụp screenshot mỗi bước + quay video toàn session |
| **Báo cáo** | Xuất HTML/PDF với biểu đồ Chart.js, lightbox xem ảnh |
| **Dashboard** | KPI tổng quan (tổng suite, TC, tỉ lệ pass), biểu đồ Doughnut + Line |

---

## 📋 Yêu cầu hệ thống

- **Node.js** >= 18.x
- **npm** >= 9.x

---

## 🚀 Cài đặt

```bash
# Clone project
git clone <repo-url>
cd Test_21022026

# Cài đặt backend
cd backend
npm install

# Cài Playwright browsers (chỉ cần chạy 1 lần)
npx playwright install

# Tạo file mẫu Excel
npm run create-template

# Cài đặt frontend
cd ../frontend
npm install
```

---

## ▶️ Chạy ứng dụng

### Development (2 terminal riêng)

```bash
# Terminal 1 - Backend
cd backend
npm run dev
# → Server chạy tại http://localhost:3001

# Terminal 2 - Frontend
cd frontend
npm run dev
# → UI chạy tại http://localhost:5173
```

### Production (1 terminal duy nhất)

```bash
# Build frontend + chạy backend
cd backend
npm run start:prod
# → Mở http://localhost:3001
```

Hoặc build frontend riêng:

```bash
cd frontend
npm run build

cd ../backend
npm start
# → Mở http://localhost:3001
```

---

## 📁 Cấu trúc thư mục

```
Test_21022026/
├── backend/
│   ├── src/
│   │   ├── api/              # Express route handlers
│   │   │   ├── suites.js     # CRUD Test Suite
│   │   │   ├── testcases.js  # CRUD Test Case + import Excel
│   │   │   ├── runs.js       # Trigger & quản lý lần chạy
│   │   │   └── reports.js    # Xuất HTML/PDF
│   │   ├── runner/
│   │   │   ├── TestRunner.js       # Thực thi test case
│   │   │   ├── ActionHandler.js    # Xử lý 10 action types
│   │   │   └── EvidenceManager.js  # Screenshot & Video
│   │   ├── importer/
│   │   │   └── ExcelImporter.js    # Đọc file Excel → JSON
│   │   ├── reporter/
│   │   │   └── Reporter.js         # Render HTML + PDF
│   │   ├── db/
│   │   │   └── database.js         # NeDB datastore
│   │   ├── templates/
│   │   │   ├── report.ejs                # Template báo cáo
│   │   │   └── testcase_template.xlsx    # File mẫu Excel
│   │   └── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # KPI + Biểu đồ
│   │   │   ├── Suites.jsx          # Quản lý Test Suite
│   │   │   ├── TestCaseEditor.jsx  # Tạo/sửa TC + upload Excel
│   │   │   ├── Monitor.jsx         # Live Monitor real-time
│   │   │   └── History.jsx         # Lịch sử chạy + evidence
│   │   ├── components/
│   │   │   └── Layout.jsx          # Sidebar + Header layout
│   │   ├── App.jsx
│   │   └── index.css               # Design system
│   └── package.json
│
├── evidence/        # Ảnh & video theo run_id/tc_id/
├── reports/         # File HTML/PDF xuất ra
├── data/            # NeDB database files
└── README.md
```

---

## 📖 Hướng dẫn sử dụng

### Workflow cơ bản

```
1. Tạo Test Suite  →  2. Tạo Test Case  →  3. Chạy Test  →  4. Xem báo cáo
```

### 1. Tạo Test Suite
- Vào **Quản lý Test Suite** → nhấn **"Tạo Test Suite mới"**
- Nhập tên và mô tả → nhấn **"Tạo Suite"**

### 2. Tạo Test Case

**Cách 1: Nhập thủ công**
- Chọn Suite → nhấn **"Thêm TC"**
- Nhập tiêu đề, URL mục tiêu, chọn trình duyệt
- Thêm các bước (step): chọn action, nhập selector, value, expected

**Cách 2: Import từ Excel**
- Tải file mẫu Excel bằng nút **"File mẫu"**
- Điền dữ liệu theo mẫu (xem phần **Cấu trúc Excel** bên dưới)
- Kéo & thả file `.xlsx` vào vùng upload → tự động tạo test case

### 3. Chạy Test
- Vào **Live Monitor** → chọn Suite → nhấn **"Bắt đầu chạy"**
- Theo dõi tiến độ từng bước real-time: Pass ✅ / Fail ❌
- Xem screenshot ngay trong khi chạy

### 4. Xem Báo cáo
- Sau khi chạy xong, nhấn **"Xuất báo cáo HTML"** hoặc **"Xuất PDF"**
- Vào **Lịch sử chạy** để xem lại tất cả các lần chạy trước
- Mở accordion để xem chi tiết từng test case, ảnh evidence, video

---

## 📊 Cấu trúc file Excel mẫu

| Cột | Tên cột | Mô tả | Ví dụ |
|---|---|---|---|
| A | `tc_id` | Mã test case | TC-001 |
| B | `title` | Tiêu đề test case | Đăng nhập thành công |
| C | `url` | URL trang cần test | https://example.com/login |
| D | `browser` | Trình duyệt | chromium |
| E | `step_id` | Số thứ tự bước | 1 |
| F | `action` | Loại hành động | fill |
| G | `selector` | CSS/XPath selector | #email |
| H | `value` | Giá trị nhập | user@test.com |
| I | `expected` | Giá trị kỳ vọng | https://example.com/dashboard |
| J | `description` | Mô tả bước | Nhập email |

> Mỗi **hàng** = 1 bước. Nhiều hàng cùng `tc_id` = các bước của cùng 1 test case.

---

## ⚙️ Cấu hình

| Biến | Mặc định | Mô tả |
|---|---|---|
| `PORT` | `3001` | Port backend server |

---

## 🛠 Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Test Engine | Playwright (Node.js) |
| Backend | Node.js + Express |
| Frontend | React (Vite) + Vanilla CSS |
| Database | NeDB (embedded) |
| Real-time | Socket.IO |
| Excel | SheetJS (xlsx) |
| Báo cáo | EJS + Chart.js + Playwright PDF |

---

## 📄 License

MIT
