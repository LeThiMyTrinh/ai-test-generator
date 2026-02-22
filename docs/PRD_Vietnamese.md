# Tài Liệu Yêu Cầu Sản Phẩm (PRD)
## Nền Tảng Kiểm Thử Web Tự Động

---

## 1. Tóm Tắt Tổng Quan

### 1.1 Tầm Nhìn Sản Phẩm
Xây dựng một nền tảng kiểm thử tự động toàn diện dựa trên web, cho phép các đội ngũ QA và lập trình viên tạo, thực thi và quản lý test case thông qua giao diện trực quan. Nền tảng sẽ chấp nhận test case ở nhiều định dạng (text, Excel), tự động thực thi test trên các URL mục tiêu, thu thập bằng chứng trực quan và tạo báo cáo chi tiết.

### 1.2 Vấn Đề Cần Giải Quyết
Quy trình kiểm thử hiện tại bị phân mảnh, đòi hỏi nhiều công cụ khác nhau cho quản lý test case, thực thi, thu thập bằng chứng và báo cáo. Các đội ngũ gặp khó khăn với:
- Thực thi test và thu thập bằng chứng thủ công
- Tài liệu test không nhất quán giữa các định dạng khác nhau
- Tạo và phân phối báo cáo tốn thời gian
- Thiếu quản lý test tập trung và theo dõi lịch sử
- Khó khăn trong việc tái hiện lỗi test khi không có bằng chứng phù hợp

### 1.3 Người Dùng Mục Tiêu
- **Kỹ Sư QA**: Người dùng chính tạo và thực thi test case
- **Quản Lý Test**: Giám sát tiến độ kiểm thử và xem xét báo cáo
- **Lập Trình Viên**: Xem xét lỗi test và bằng chứng để debug
- **Phân Tích Nghiệp Vụ**: Xác thực hành vi tính năng so với yêu cầu

---

## 2. Mục Tiêu Sản Phẩm & Chỉ Số Thành Công

### 2.1 Mục Tiêu Chính
1. **Giảm thời gian kiểm thử** 60% thông qua tự động hóa
2. **Cải thiện độ phủ test** với quản lý test case tập trung
3. **Tăng tốc debug** với thu thập bằng chứng toàn diện
4. **Kích hoạt cộng tác** thông qua báo cáo và artifacts có thể chia sẻ

### 2.2 Chỉ Số Hiệu Suất Chính (KPIs)
- Thời gian thực thi bộ test (mục tiêu: < 5 phút cho 100 test case)
- Tỷ lệ import test case thành công (mục tiêu: > 95%)
- Thời gian tạo báo cáo (mục tiêu: < 30 giây)
- Tỷ lệ người dùng chấp nhận (mục tiêu: 80% đội QA trong 3 tháng)
- Tỷ lệ chụp screenshot thành công (mục tiêu: > 99%)

---

## 3. Tính Năng Cốt Lõi & Yêu Cầu

### 3.1 Quản Lý Test Case

#### 3.1.1 Định Dạng Đầu Vào Test Case
**Ưu tiên: P0 (Bắt buộc có)**

Hỗ trợ nhiều định dạng đầu vào để linh hoạt tối đa:

**Định Dạng Text:**
- Text thuần với cú pháp có cấu trúc
- Hỗ trợ kịch bản kiểu BDD/Gherkin (Given-When-Then)
- Định dạng key-value đơn giản cho test case cơ bản
- Định dạng Markdown cho tài liệu phong phú

**Định Dạng Excel:**
- File Excel chuẩn (.xlsx, .xls) và CSV
- Ánh xạ cột cho các thuộc tính test case:
  - Test Case ID (mã định danh duy nhất)
  - Test Scenario/Title (Kịch bản/Tiêu đề test)
  - Prerequisites/Preconditions (Điều kiện tiên quyết)
  - Test Steps (Các bước test tuần tự)
  - Test Data (Dữ liệu đầu vào)
  - Expected Results (Kết quả mong đợi)
  - Priority (Độ ưu tiên P0-P3)
  - Tags/Categories (Nhãn/Danh mục)
  - Assigned To (Người được giao)
- Hỗ trợ nhiều sheet (tổ chức theo tính năng/module)
- Import hàng loạt với xác thực và báo lỗi
- Tải xuống template để chuẩn hóa định dạng

#### 3.1.2 Cấu Trúc Dữ Liệu Test Case
**Ưu tiên: P0 (Bắt buộc có)**

Mỗi test case nên chứa:
```json
{
  "id": "TC-001",
  "title": "Đăng nhập người dùng với thông tin hợp lệ",
  "description": "Xác minh người dùng có thể đăng nhập thành công",
  "priority": "P0",
  "tags": ["authentication", "smoke"],
  "prerequisites": [
    "Tài khoản người dùng tồn tại",
    "Trình duyệt đã mở"
  ],
  "steps": [
    {
      "stepNumber": 1,
      "action": "Điều hướng đến trang đăng nhập",
      "data": "https://example.com/login",
      "expectedResult": "Trang đăng nhập hiển thị"
    },
    {
      "stepNumber": 2,
      "action": "Nhập tên người dùng",
      "data": "testuser@example.com",
      "expectedResult": "Trường username được điền"
    },
    {
      "stepNumber": 3,
      "action": "Nhập mật khẩu",
      "data": "********",
      "expectedResult": "Trường password được điền"
    },
    {
      "stepNumber": 4,
      "action": "Click nút đăng nhập",
      "data": null,
      "expectedResult": "Người dùng được chuyển đến dashboard"
    }
  ],
  "postconditions": ["Người dùng đã đăng nhập"],
  "estimatedDuration": 30,
  "createdBy": "user@example.com",
  "createdAt": "2026-02-11T10:00:00Z",
  "updatedAt": "2026-02-11T10:00:00Z",
  "version": 1
}
```

#### 3.1.3 Tổ Chức Test Case
**Ưu tiên: P1 (Nên có)**

- Cấu trúc thư mục phân cấp (Project > Module > Feature)
- Hệ thống tag để phân loại linh hoạt
- Khả năng tìm kiếm và lọc
- Yêu thích và test case gần đây
- Tạo test suite (nhóm các test case liên quan)

### 3.2 Công Cụ Thực Thi Test

#### 3.2.1 Tự Động Hóa Trình Duyệt
**Ưu tiên: P0 (Bắt buộc có)**

**Kiến Trúc Đề Xuất: Dựa trên Playwright**

Dựa trên nghiên cứu, Playwright cung cấp sự cân bằng tốt nhất về tính năng:
- Hỗ trợ native cho Chromium, Firefox và WebKit
- Giao tiếp WebSocket trực tiếp để thực thi nhanh hơn
- Ghi hình screenshot và video tích hợp sẵn
- Khả năng chặn network
- Browser context độc lập cho thực thi song song

**Khả Năng Cốt Lõi:**
- Hỗ trợ đa trình duyệt (Chrome, Firefox, Safari/WebKit)
- Chế độ thực thi headless và headed
- Mô phỏng viewport di động
- Mô phỏng geolocation và timezone
- Điều chỉnh network để test hiệu năng

#### 3.2.2 Diễn Giải Bước Test
**Ưu tiên: P0 (Bắt buộc có)**

**Các Loại Hành Động:**
- **Điều hướng**: Điều hướng đến URL, quay lại, tiến tới, tải lại
- **Nhập liệu**: Gõ text, xóa trường, upload file
- **Click**: Click element, double-click, right-click
- **Lựa chọn**: Chọn dropdown, check/uncheck checkbox, chọn radio button
- **Xác thực**: Assert text, assert element visible, assert URL, assert attribute
- **Chờ**: Chờ element, chờ navigation, chờ timeout
- **Cuộn**: Cuộn đến element, cuộn theo pixel
- **JavaScript**: Thực thi JavaScript tùy chỉnh

**Chiến Lược Định Vị Element:**
- CSS Selectors (chính)
- XPath (dự phòng)
- Khớp nội dung text
- ARIA labels và roles
- Data attributes (data-testid)
- Smart locator với auto-healing (thử lại với selector thay thế)

#### 3.2.3 Thực Thi Song Song
**Ưu tiên: P1 (Nên có)**

- Thực thi nhiều test case đồng thời
- Mức độ đồng thời có thể cấu hình (mặc định: 5 test song song)
- Quản lý tài nguyên để tránh quá tải hệ thống
- Cô lập test (browser context riêng biệt)
- Quản lý hàng đợi cho bộ test lớn

#### 3.2.4 Quản Lý Dữ Liệu Test
**Ưu tiên: P1 (Nên có)**

- Hỗ trợ data-driven testing (chạy cùng test với nhiều dataset)
- Cấu hình theo môi trường (URL dev, staging, production)
- Lưu trữ thông tin xác thực an toàn (mật khẩu mã hóa, API keys)
- Tiện ích tạo dữ liệu test (chuỗi ngẫu nhiên, ngày tháng, email)

### 3.3 Thu Thập Bằng Chứng

#### 3.3.1 Chụp Screenshot
**Ưu tiên: P0 (Bắt buộc có)**

**Tự Động Chụp:**
- Trước và sau mỗi hành động quan trọng
- Khi test thất bại (screenshot toàn trang)
- Khi xác thực assertion
- Trạng thái cuối cùng sau khi test hoàn thành

**Tính Năng Screenshot:**
- Screenshot toàn trang (toàn bộ vùng có thể cuộn)
- Screenshot viewport (chỉ vùng hiển thị)
- Screenshot element cụ thể
- Overlay timestamp và metadata
- Định dạng ảnh có thể cấu hình (PNG, JPEG) và chất lượng
- Tự động che dữ liệu nhạy cảm (mật khẩu, thẻ tín dụng)

#### 3.3.2 Ghi Video
**Ưu tiên: P1 (Nên có)**

- Ghi toàn bộ quá trình thực thi test dưới dạng video
- Frame rate và độ phân giải có thể cấu hình
- Video chỉ khi thất bại (để tiết kiệm lưu trữ)
- Phát video trong trình xem báo cáo
- Tải xuống file video

#### 3.3.3 Ghi Log Hoạt Động Network
**Ưu tiên: P2 (Tốt nếu có)**

- Capture HTTP requests và responses
- Log API calls với headers và payloads
- Xác định network requests thất bại
- Chỉ số hiệu năng (thời gian phản hồi, kích thước payload)

#### 3.3.4 Console Logs & Lỗi
**Ưu tiên: P1 (Nên có)**

- Capture browser console logs (info, warn, error)
- Lỗi JavaScript và stack traces
- Lỗi network
- Tương quan timestamp với các bước test

### 3.4 Báo Cáo Test

#### 3.4.1 Tạo Báo Cáo
**Ưu tiên: P0 (Bắt buộc có)**

**Các Loại Báo Cáo:**
- **Báo Cáo Tóm Tắt**: Tổng quan cấp cao (số lượng pass/fail, thời lượng, xu hướng)
- **Báo Cáo Chi Tiết**: Kết quả test case riêng lẻ với bằng chứng
- **Báo Cáo So Sánh**: So sánh kết quả giữa các lần chạy test
- **Báo Cáo Xu Hướng**: Phân tích lịch sử theo thời gian

**Nội Dung Báo Cáo:**
- Metadata thực thi (ngày, giờ, môi trường, trình duyệt, người dùng)
- Thống kê tổng thể (tổng, passed, failed, skipped, tỷ lệ pass)
- Kết quả test case với trạng thái (passed, failed, skipped, blocked)
- Đính kèm bằng chứng (screenshots, videos, logs)
- Phân tích lỗi (thông báo lỗi, stack traces, screenshots)
- Timeline thực thi
- Chỉ số hiệu năng (thời gian thực thi mỗi test)

#### 3.4.2 Định Dạng Xuất
**Ưu tiên: P0 (Bắt buộc có)**

- **HTML**: Báo cáo web tương tác với media nhúng
- **PDF**: Báo cáo có thể in cho tài liệu và tuân thủ
- **JSON**: Định dạng machine-readable để tích hợp
- **Excel**: Định dạng bảng để phân tích dữ liệu

**Triển Khai Best Practices:**
- Framework Allure Report cho báo cáo HTML phong phú
- Tạo PDF với screenshots nhúng
- Template báo cáo có thể tùy chỉnh
- Hỗ trợ branding (logo công ty, màu sắc)

#### 3.4.3 Chia Sẻ & Phân Phối Báo Cáo
**Ưu tiên: P1 (Nên có)**

- URL báo cáo có thể chia sẻ (công khai hoặc xác thực)
- Phân phối email với đính kèm PDF
- Tích hợp Slack/Teams cho thông báo
- Chính sách lưu trữ và giữ báo cáo
- Xuất sang cloud storage (AWS S3, Google Drive)

### 3.5 Giao Diện Người Dùng

#### 3.5.1 Dashboard
**Ưu tiên: P0 (Bắt buộc có)**

- Các lần chạy test gần đây với trạng thái
- Thống kê nhanh (tỷ lệ pass, tổng test, lỗi gần đây)
- Xu hướng thực thi test (biểu đồ và đồ thị)
- Hành động nhanh (chạy test, tạo test case, xem báo cáo)
- Thông báo và cảnh báo

#### 3.5.2 Trình Soạn Thảo Test Case
**Ưu tiên: P0 (Bắt buộc có)**

- Trình soạn thảo trực quan để tạo/chỉnh sửa test case
- Trình xây dựng từng bước với lựa chọn hành động
- Xem trước test case trực tiếp
- Xác thực và kiểm tra cú pháp
- Lịch sử phiên bản và rollback
- Nhân bản và tạo template

#### 3.5.3 Giao Diện Thực Thi Test
**Ưu tiên: P0 (Bắt buộc có)**

- Tiến trình thực thi real-time
- Xem trước screenshot trực tiếp
- Streaming console output
- Điều khiển pause/resume/stop
- Quản lý hàng đợi thực thi

#### 3.5.4 Trình Xem Báo Cáo
**Ưu tiên: P0 (Bắt buộc có)**

- Hiển thị báo cáo HTML tương tác
- Thư viện screenshot với zoom
- Phát video
- Lọc và tìm kiếm kết quả
- Tùy chọn xuất
- Chia sẻ và tải xuống

#### 3.5.5 Quản Lý Lịch Sử Chạy Test
**Ưu tiên: P1 (Nên có)**

- Xóa từng lần chạy (run) riêng lẻ với nút xóa trên mỗi dòng
- Chọn nhiều run bằng checkbox và xóa hàng loạt
- Hộp thoại xác nhận trước khi xóa để tránh xóa nhầm
- Tự động dọn dẹp dữ liệu liên quan khi xóa:
  - Kết quả test (test results) trong database
  - Thư mục evidence (screenshots, videos)
- Checkbox "Chọn tất cả" để thao tác nhanh
- Highlight visual cho các run đã được chọn

---

## 4. Kiến Trúc Kỹ Thuật

### 4.1 Kiến Trúc Hệ Thống

**Stack Đề Xuất:**

**Frontend:**
- **Framework**: React với Next.js (cho SSR và hiệu năng)
- **UI Library**: Material-UI hoặc Ant Design (thư viện component phong phú)
- **State Management**: Redux Toolkit hoặc Zustand
- **File Upload**: React Dropzone
- **Charts**: Recharts hoặc Chart.js
- **Code Editor**: Monaco Editor (để soạn thảo test case)

**Backend:**
- **Runtime**: Node.js với Express hoặc Fastify
- **Language**: TypeScript (type safety)
- **API**: RESTful API với tài liệu OpenAPI/Swagger
- **Authentication**: JWT với refresh tokens
- **File Processing**: SheetJS (xlsx) để parse Excel

**Test Execution:**
- **Automation Framework**: Playwright
- **Test Runner**: Công cụ thực thi tùy chỉnh với quản lý hàng đợi
- **Reporting**: Tích hợp Allure Report

**Database:**
- **Primary DB**: PostgreSQL (dữ liệu quan hệ, test cases, users)
- **Cache**: Redis (quản lý session, quản lý hàng đợi)
- **File Storage**: AWS S3 hoặc MinIO (screenshots, videos, reports)

**Infrastructure:**
- **Containerization**: Docker
- **Orchestration**: Kubernetes (để mở rộng)
- **CI/CD**: GitHub Actions hoặc GitLab CI
- **Monitoring**: Prometheus + Grafana

### 4.2 Mô Hình Dữ Liệu

#### 4.2.1 Các Entity Cốt Lõi

**User (Người dùng):**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50), -- admin, tester, viewer
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Project (Dự án):**
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**TestCase (Test Case):**
```sql
CREATE TABLE test_cases (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  test_id VARCHAR(100) UNIQUE, -- TC-001
  title VARCHAR(500) NOT NULL,
  description TEXT,
  priority VARCHAR(10), -- P0, P1, P2, P3
  tags TEXT[], -- mảng tags
  prerequisites JSONB,
  steps JSONB, -- mảng step objects
  postconditions JSONB,
  estimated_duration INTEGER, -- giây
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  version INTEGER DEFAULT 1
);
```

**TestRun (Lần Chạy Test):**
```sql
CREATE TABLE test_runs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name VARCHAR(255),
  environment VARCHAR(50), -- dev, staging, production
  browser VARCHAR(50), -- chrome, firefox, webkit
  status VARCHAR(50), -- queued, running, completed, failed
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  total_tests INTEGER,
  passed_tests INTEGER,
  failed_tests INTEGER,
  skipped_tests INTEGER,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**TestResult (Kết Quả Test):**
```sql
CREATE TABLE test_results (
  id UUID PRIMARY KEY,
  test_run_id UUID REFERENCES test_runs(id),
  test_case_id UUID REFERENCES test_cases(id),
  status VARCHAR(50), -- passed, failed, skipped
  error_message TEXT,
  stack_trace TEXT,
  duration INTEGER, -- milliseconds
  screenshots JSONB, -- mảng screenshot URLs
  video_url VARCHAR(500),
  console_logs JSONB,
  network_logs JSONB,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

### 4.3 Bảo Mật & Xác Thực

**Ưu tiên: P0 (Bắt buộc có)**

- **Xác thực**: Email/password với JWT tokens
- **Phân quyền**: Kiểm soát truy cập dựa trên vai trò (RBAC)
  - Admin: Toàn quyền truy cập
  - Tester: Tạo/sửa/chạy test, xem báo cáo
  - Viewer: Chỉ xem test và báo cáo
- **Mã Hóa Dữ Liệu**: 
  - Mật khẩu: bcrypt hashing
  - Dữ liệu test nhạy cảm: mã hóa AES-256
  - HTTPS/TLS cho mọi giao tiếp
- **Bảo Mật API**:
  - Rate limiting
  - Cấu hình CORS
  - Xác thực và sanitize input
  - Phòng chống SQL injection (parameterized queries)
  - Bảo vệ XSS

### 4.4 Khả Năng Mở Rộng & Hiệu Năng

**Ưu tiên: P1 (Nên có)**

- **Horizontal Scaling**: API servers stateless đằng sau load balancer
- **Tối Ưu Database**: Indexing, connection pooling, read replicas
- **Chiến Lược Caching**: Redis cho session data, kết quả test, báo cáo
- **Async Processing**: Thực thi test dựa trên hàng đợi (Bull hoặc BullMQ)
- **CDN**: Phục vụ static assets và báo cáo qua CDN
- **Giới Hạn Tài Nguyên**: Số lượng test đồng thời tối đa, giới hạn kích thước file

---

## 5. Quy Trình Người Dùng

### 5.1 Quy Trình Tạo Test Case

1. Người dùng đăng nhập vào nền tảng
2. Điều hướng đến dự án
3. Click "Tạo Test Case" hoặc "Import Test Cases"
4. **Tùy chọn A - Tạo Thủ Công:**
   - Điền chi tiết test case (tiêu đề, mô tả, độ ưu tiên)
   - Thêm các bước test bằng trình xây dựng trực quan
   - Lưu test case
5. **Tùy chọn B - Import Excel:**
   - Upload file Excel
   - Ánh xạ cột với các trường test case
   - Xem xét lỗi xác thực (nếu có)
   - Xác nhận import
6. Test case xuất hiện trong thư viện test case của dự án

### 5.2 Quy Trình Thực Thi Test

1. Người dùng chọn test case hoặc test suite
2. Cấu hình cài đặt thực thi:
   - URL/môi trường mục tiêu
   - Chọn trình duyệt
   - Chế độ thực thi (song song/tuần tự)
3. Click "Chạy Tests"
4. Hệ thống xếp hàng đợi thực thi test
5. Tiến trình real-time được hiển thị:
   - Test hiện tại đang được thực thi
   - Screenshots trực tiếp
   - Cập nhật trạng thái pass/fail
6. Khi hoàn thành, người dùng được chuyển đến báo cáo

### 5.3 Quy Trình Xem Xét Báo Cáo

1. Người dùng mở báo cáo test run
2. Xem xét thống kê tóm tắt
3. Lọc các test thất bại
4. Click vào test case thất bại
5. Xem xét:
   - Thông báo lỗi
   - Screenshots tại điểm thất bại
   - Video ghi hình (nếu có)
   - Console logs
6. Tải xuống bằng chứng hoặc chia sẻ link báo cáo
7. Xuất báo cáo dưới dạng PDF để lưu trữ

---

## 6. Yêu Cầu Phi Chức Năng

### 6.1 Hiệu Năng
- Thời gian tải trang: < 2 giây
- Thời gian bắt đầu thực thi test: < 5 giây sau khi kích hoạt
- Tạo báo cáo: < 30 giây cho 100 test case
- Thời gian phản hồi API: < 500ms (95th percentile)
- Hỗ trợ 50 người dùng đồng thời
- Hỗ trợ 100 test thực thi song song

### 6.2 Độ Tin Cậy
- Uptime hệ thống: 99.5%
- Tỷ lệ thành công thực thi test: > 95%
- Sao lưu dữ liệu: Tự động hàng ngày
- Khôi phục thảm họa: < 4 giờ RTO, < 1 giờ RPO

### 6.3 Khả Năng Sử Dụng
- UI trực quan chỉ cần < 30 phút đào tạo
- Thiết kế responsive (desktop, tablet)
- Khả năng tiếp cận: Tuân thủ WCAG 2.1 Level AA
- Hỗ trợ đa ngôn ngữ (Tiếng Anh, Tiếng Việt)

### 6.4 Khả Năng Bảo Trì
- Kiến trúc modular với phân tách rõ ràng các mối quan tâm
- Tài liệu API toàn diện
- Độ phủ unit test: > 80%
- Độ phủ integration test: > 60%
- Tài liệu code và comment inline

### 6.5 Tương Thích
- **Trình duyệt**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Trình duyệt Test Target**: Chrome, Firefox, Safari/WebKit
- **Định dạng File**: .xlsx, .xls, .csv, .txt, .md
- **Định dạng Xuất**: HTML, PDF, JSON, Excel

---

## 7. Cải Tiến Tương Lai (Ngoài Phạm Vi V1)

### 7.1 Tính Năng Phase 2
- **Tạo Test Bằng AI**: Tạo test case từ user stories
- **Visual Regression Testing**: So sánh screenshot tự động
- **API Testing**: Hỗ trợ test REST/GraphQL API
- **Mobile App Testing**: Tự động hóa iOS và Android
- **Tích Hợp CI/CD**: Plugins Jenkins, GitHub Actions, GitLab CI
- **Đề Xuất Test Case**: Gợi ý dựa trên ML cho độ phủ test

### 7.2 Tính Năng Phase 3
- **Collaborative Editing**: Soạn thảo test case đa người dùng real-time
- **Quản Lý Dữ Liệu Test**: Tạo và che dữ liệu test nâng cao
- **Performance Testing**: Tích hợp load testing
- **Accessibility Testing**: Kiểm tra tuân thủ WCAG tự động
- **Self-Healing Tests**: Tự động cập nhật selector khi UI thay đổi
- **Tạo Test Ngôn Ngữ Tự Nhiên**: Viết test bằng tiếng Anh thuần túy

---

## 8. Ràng Buộc & Giả Định

### 8.1 Ràng Buộc
- Ngân sách: Giới hạn công cụ open-source và AWS free tier ban đầu
- Timeline: Giao MVP trong 12 tuần
- Đội ngũ: 2 full-stack developers, 1 QA engineer
- Hạ tầng: Chỉ triển khai dựa trên cloud

### 8.2 Giả Định
- Người dùng có hiểu biết cơ bản về khái niệm kiểm thử phần mềm
- Website mục tiêu có thể truy cập qua internet công cộng
- Người dùng có trình duyệt web hiện đại
- Thời gian thực thi test mỗi test case: trung bình 30-120 giây
- Kích thước test suite trung bình: 50-200 test case

---

## 9. Tiêu Chí Thành Công

### 9.1 Tiêu Chí Thành Công MVP
- ✅ Import thành công 100 test case từ Excel
- ✅ Thực thi 50 test case song song trong vòng 10 phút
- ✅ Chụp screenshots cho tất cả các bước test
- ✅ Tạo báo cáo HTML và PDF
- ✅ 5 người dùng tích cực test nền tảng
- ✅ Điểm hài lòng người dùng 90%

### 9.2 Tiêu Chí Ra Mắt
- Tất cả tính năng P0 được triển khai và test
- Hoàn thành kiểm toán bảo mật
- Đạt được các benchmark hiệu năng
- Hoàn thành tài liệu người dùng
- Onboard thành công 10 beta users

---

## 10. Thuật Ngữ

- **Test Case**: Tập hợp các điều kiện và bước để xác minh chức năng cụ thể
- **Test Suite**: Tập hợp các test case liên quan
- **Test Run**: Instance thực thi của một hoặc nhiều test case
- **Evidence (Bằng chứng)**: Screenshots, videos và logs được thu thập trong quá trình thực thi test
- **BDD**: Behavior-Driven Development - phương pháp test sử dụng ngôn ngữ tự nhiên
- **Gherkin**: Cú pháp để viết kịch bản BDD (Given-When-Then)
- **Headless Browser**: Trình duyệt chạy không có GUI (thực thi nhanh hơn)
- **Selector**: Mẫu để định vị elements trên trang web (CSS, XPath)
- **Assertion**: Kiểm tra xác thực để so sánh kết quả mong đợi vs thực tế

---

## Phụ Lục A: Phân Tích Đối Thủ Cạnh Tranh

### Giải Pháp Hiện Có
1. **TestRail + Selenium**: Công cụ riêng biệt, cần tích hợp thủ công
2. **Katalon Studio**: Ứng dụng desktop, tính năng cloud hạn chế
3. **TestProject**: Dựa trên cloud nhưng tùy chỉnh hạn chế
4. **Cypress Dashboard**: Chỉ tập trung vào test Cypress

### Điểm Khác Biệt Của Chúng Ta
- **Nền tảng all-in-one**: Quản lý test + thực thi + báo cáo
- **Nhiều định dạng đầu vào**: Hỗ trợ Text và Excel
- **Tech stack hiện đại**: Playwright cho hiệu năng tốt hơn
- **Kiến trúc mở**: Có thể mở rộng và tùy chỉnh
- **Chi phí hiệu quả**: Giải pháp dựa trên open-source

---

**Phiên Bản Tài Liệu**: 1.0  
**Cập Nhật Lần Cuối**: 2026-02-11  
**Tác Giả**: Đội Sản Phẩm  
**Trạng Thái**: Bản Nháp Để Xem Xét
