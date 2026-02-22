# Kế Hoạch Triển Khai
## Nền Tảng Kiểm Thử Web Tự Động

---

## Tổng Quan Dự Án

Kế hoạch triển khai này phác thảo phương pháp kỹ thuật để xây dựng nền tảng kiểm thử tự động web chấp nhận test case ở định dạng text/Excel, thực thi test trên URL, thu thập bằng chứng và tạo báo cáo toàn diện.

**Stack Công Nghệ:**
- Frontend: React + Next.js + TypeScript + Material-UI
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Redis
- Test Automation: Playwright
- File Storage: AWS S3 / MinIO
- Reporting: Allure Report + Custom PDF Generator

**Timeline Phát Triển:** 12 tuần (3 tháng)

---

## Giai Đoạn 1: Thiết Lập Dự Án & Hạ Tầng (Tuần 1-2)

### 1.1 Thiết Lập Môi Trường Phát Triển

#### [ ] Khởi Tạo Cấu Trúc Dự Án
- [ ] Tạo cấu trúc monorepo với thư mục frontend/backend riêng biệt
- [ ] Thiết lập cấu hình TypeScript cho cả hai dự án
- [ ] Cấu hình ESLint và Prettier cho chất lượng code
- [ ] Thiết lập Git repository với quy tắc bảo vệ nhánh
- [ ] Tạo `.gitignore` cho node_modules, build artifacts, env files

#### [ ] Khởi Tạo Dự Án Backend
- [ ] Khởi tạo dự án Node.js với `npm init`
- [ ] Cài đặt dependencies cốt lõi (Express, TypeScript, ts-node, dotenv)
- [ ] Thiết lập cấu trúc thư mục dự án (config, controllers, models, routes, services, middleware, utils, types)
- [ ] Tạo Express server cơ bản với health check endpoint
- [ ] Cấu hình quy trình build TypeScript

#### [ ] Khởi Tạo Dự Án Frontend
- [ ] Khởi tạo dự án Next.js với template TypeScript
- [ ] Cài đặt UI dependencies (Material-UI, Axios, React Query, Zustand)
- [ ] Thiết lập cấu trúc thư mục dự án (components, pages, services, hooks, store, types, utils)
- [ ] Cấu hình Next.js để proxy API đến backend
- [ ] Thiết lập cấu hình theme Material-UI

#### [ ] Thiết Lập Database
- [ ] Cài đặt PostgreSQL locally hoặc sử dụng Docker container
- [ ] Tạo database và user credentials
- [ ] Cài đặt database client library (pg hoặc Prisma)
- [ ] Thiết lập cấu hình kết nối database
- [ ] Tạo thiết lập công cụ migration schema database ban đầu
- [ ] Cài đặt và cấu hình Redis cho caching

#### [ ] Cấu Hình Docker
- [ ] Tạo Dockerfile cho backend service
- [ ] Tạo Dockerfile cho frontend service
- [ ] Tạo docker-compose.yml cho phát triển local (backend, frontend, PostgreSQL, Redis, MinIO)
- [ ] Test thiết lập docker-compose

#### [ ] Cấu Hình Environment
- [ ] Tạo file `.env.example` cho cả hai dự án
- [ ] Tài liệu hóa tất cả biến môi trường cần thiết
- [ ] Thiết lập configs cho development, staging và production

---

## Giai Đoạn 2: Database Schema & Models (Tuần 2)

### 2.1 Thiết Kế Database Schema

#### [ ] Tạo Các Bảng Cốt Lõi
- [ ] Bảng Users (id, email, password_hash, full_name, role, timestamps)
- [ ] Bảng Projects (id, name, description, created_by, timestamps)
- [ ] Bảng Test Cases (id, project_id, test_id, title, description, priority, tags, prerequisites, steps, postconditions, estimated_duration, version, timestamps)
- [ ] Bảng Test Runs (id, project_id, name, environment, browser, status, started_at, completed_at, test counters, timestamps)
- [ ] Bảng Test Results (id, test_run_id, test_case_id, status, error_message, stack_trace, duration, screenshots, video_url, console_logs, network_logs, executed_at)

#### [ ] Tạo Migration Scripts
- [ ] Thiết lập công cụ migration (node-pg-migrate hoặc Prisma Migrate)
- [ ] Tạo migration ban đầu cho tất cả bảng
- [ ] Tạo script seed data cho development
- [ ] Test chức năng rollback

#### [ ] Tạo Database Models
- [ ] Tạo TypeScript interfaces cho tất cả entities
- [ ] Triển khai data access layer (repository pattern)
- [ ] Tạo CRUD operations cho mỗi model
- [ ] Thêm validation schemas (sử dụng Zod hoặc Joi)
- [ ] Viết unit tests cho model operations

---

## Giai Đoạn 3: Xác Thực & Phân Quyền (Tuần 3)

### 3.1 Hệ Thống Xác Thực Người Dùng

#### [ ] Đăng Ký & Đăng Nhập Người Dùng
- [ ] Tạo endpoint đăng ký người dùng với validation và bcrypt hashing
- [ ] Tạo endpoint đăng nhập với tạo JWT token
- [ ] Tạo endpoint refresh token

#### [ ] JWT Middleware
- [ ] Tạo authentication middleware (extract và verify JWT)
- [ ] Tạo authorization middleware (kiểm tra user roles)
- [ ] Áp dụng middleware cho protected routes

#### [ ] Frontend Authentication
- [ ] Tạo UI trang đăng nhập
- [ ] Tạo UI trang đăng ký
- [ ] Triển khai authentication service (API calls, lưu token, Axios interceptors)
- [ ] Tạo protected route wrapper component
- [ ] Triển khai chức năng logout

---

## Giai Đoạn 4: Quản Lý Test Case (Tuần 4-5)

### 4.1 CRUD Operations Test Case

#### [ ] Backend API Endpoints
- [ ] Tạo endpoint tạo test case với validation
- [ ] Endpoint lấy test cases với pagination, filtering, search, sorting
- [ ] Endpoint lấy single test case
- [ ] Endpoint cập nhật test case
- [ ] Endpoint xóa test case (soft delete)

#### [ ] Frontend Test Case Management UI
- [ ] Tạo trang danh sách test case với table, search, filters, pagination
- [ ] Tạo form/editor test case với step builder
- [ ] Triển khai form validation
- [ ] Kết nối form với API endpoints
- [ ] Thêm success/error notifications

### 4.2 Chức Năng Import Excel

#### [ ] Backend Excel Parser
- [ ] Cài đặt thư viện SheetJS
- [ ] Tạo endpoint upload Excel với validation và parsing
- [ ] Tạo endpoint cấu hình column mapping

#### [ ] Frontend Excel Import UI
- [ ] Tạo trang/modal import với file upload và column mapping
- [ ] Tạo chức năng tải xuống Excel template

#### [ ] Text Format Parser
- [ ] Tạo text parser cho cú pháp key-value và Gherkin
- [ ] Tạo endpoint import text
- [ ] Thêm UI import text

---

## Giai Đoạn 5: Công Cụ Thực Thi Test (Tuần 6-7)

### 5.1 Tích Hợp Playwright

#### [ ] Thiết Lập Playwright
- [ ] Cài đặt Playwright và browser binaries
- [ ] Tạo file cấu hình Playwright

#### [ ] Test Executor Service
- [ ] Tạo test executor class với action handlers (navigate, click, type, select, assert, wait, screenshot)
- [ ] Triển khai element locator resolution với retry logic
- [ ] Capture screenshots, console logs, network requests
- [ ] Xử lý errors và cleanup

#### [ ] Test Execution API
- [ ] Tạo endpoint test run
- [ ] Tạo endpoint batch execution

#### [ ] Job Queue System
- [ ] Cài đặt thư viện Bull queue
- [ ] Cấu hình kết nối Redis
- [ ] Tạo test execution queue và processor
- [ ] Triển khai concurrency control

### 5.2 Thu Thập Bằng Chứng

#### [ ] Quản Lý Screenshot
- [ ] Tạo tiện ích capture screenshot
- [ ] Upload screenshots lên S3/MinIO
- [ ] Lưu screenshot URLs trong test result

#### [ ] Ghi Video
- [ ] Kích hoạt Playwright video recording
- [ ] Upload video lên S3/MinIO
- [ ] Lưu video URL trong test result

#### [ ] Console & Network Logs
- [ ] Capture browser console logs
- [ ] Capture network activity (tùy chọn)

---

## Giai Đoạn 6: Giám Sát Thực Thi Test Real-Time (Tuần 7)

### 6.1 Tích Hợp WebSocket

#### [ ] Backend WebSocket Server
- [ ] Cài đặt Socket.IO
- [ ] Khởi tạo Socket.IO server với authentication
- [ ] Tạo hệ thống test execution room
- [ ] Emit events trong quá trình thực thi test

#### [ ] Frontend WebSocket Client
- [ ] Cài đặt Socket.IO client
- [ ] Tạo WebSocket service
- [ ] Tạo real-time execution view component

---

## Giai Đoạn 7: Báo Cáo Test (Tuần 8-9)

### 7.1 Tạo Báo Cáo

#### [ ] HTML Report Generator
- [ ] Cài đặt Allure Report
- [ ] Tạo Allure adapter cho test results
- [ ] Tạo Allure HTML report
- [ ] Tạo custom HTML report template (thay thế)

#### [ ] PDF Report Generator
- [ ] Cài đặt thư viện PDF (Puppeteer hoặc PDFKit)
- [ ] Tạo PDF generator service
- [ ] Tạo và upload PDF files

#### [ ] JSON & Excel Export
- [ ] Tạo endpoint export JSON
- [ ] Tạo Excel export với SheetJS

#### [ ] Report API Endpoints
- [ ] Endpoint lấy test run report
- [ ] Endpoint tạo report
- [ ] Endpoint tải xuống report

### 7.2 Report Viewer UI

#### [ ] Frontend Report Components
- [ ] Tạo report summary component với stats và charts
- [ ] Tạo test results table component
- [ ] Tạo test detail modal/page với evidence
- [ ] Tạo export controls

### 7.3 Quản Lý Lịch Sử Chạy Test

#### [x] Backend API - Xóa Run
- [x] Tạo helper function `deleteRunData()` xóa run + results + evidence folder
- [x] Tạo endpoint `DELETE /api/runs/:id` - Xóa một run
- [x] Tạo endpoint `POST /api/runs/bulk-delete` - Xóa nhiều run (body: `{ ids: [] }`)
- [x] Tự động xóa thư mục evidence khi xóa run

#### [x] Frontend UI - Xóa Run
- [x] Thêm checkbox chọn từng run và "Chọn tất cả"
- [x] Thêm nút "Xóa đã chọn" trên thanh toolbar (hiện khi có run được chọn)
- [x] Thêm nút xóa (🗑️) trên mỗi run
- [x] Hộp thoại xác nhận trước khi xóa
- [x] Highlight visual cho run đã chọn (viền màu primary)

---

## Giai Đoạn 8: Giao Diện Người Dùng & Dashboard (Tuần 10)

### 8.1 Dashboard

#### [ ] Trang Dashboard
- [ ] Tạo dashboard layout
- [ ] Tạo dashboard widgets (recent runs, stats, trends, failed tests, quick actions)

### 8.2 Quản Lý Dự Án

#### [ ] Trang Projects
- [ ] Tạo projects list view
- [ ] Tạo project form
- [ ] Tạo project detail page

### 8.3 Navigation & Layout

#### [ ] Application Layout
- [ ] Tạo responsive layout component
- [ ] Triển khai routing với guards
- [ ] Tạo loading và error states

---

## Giai Đoạn 9: Kiểm Thử & Đảm Bảo Chất Lượng (Tuần 11)

### 9.1 Backend Testing

#### [ ] Unit Tests
- [ ] Test database models, service layer, utility functions
- [ ] Thiết lập test coverage reporting (mục tiêu 80%)

#### [ ] Integration Tests
- [ ] Test API endpoints và database interactions
- [ ] Test file upload/download và WebSocket events

#### [ ] End-to-End Tests
- [ ] Cài đặt Playwright cho E2E tests
- [ ] Test complete user workflows

### 9.2 Frontend Testing

#### [ ] Component Tests
- [ ] Test UI components với React Testing Library
- [ ] Test user interactions và state management

#### [ ] Integration Tests
- [ ] Test API integration với mocks

---

## Giai Đoạn 10: Triển Khai & DevOps (Tuần 12)

### 10.1 Production Build

#### [ ] Backend Production Setup
- [ ] Cấu hình production environment (database, Redis, S3, CORS, HTTPS, logging, error tracking)

#### [ ] Frontend Production Setup
- [ ] Build Next.js cho production
- [ ] Tối ưu bundle size
- [ ] Thiết lập CDN và CSP headers

### 10.2 Containerization

#### [ ] Docker Images
- [ ] Tạo production Dockerfiles cho backend và frontend
- [ ] Push images lên container registry

### 10.3 Triển Khai

#### [ ] Cloud Deployment
- [ ] Triển khai lên AWS (VPC, RDS, ElastiCache, ECS/EC2, S3, CloudFront, SSL, DNS)

#### [ ] CI/CD Pipeline
- [ ] Thiết lập GitHub Actions hoặc GitLab CI với automated testing và deployment

### 10.4 Monitoring & Observability

#### [ ] Application Monitoring
- [ ] Thiết lập Prometheus, Grafana, log aggregation, uptime monitoring

---

## Giai Đoạn 11: Tài Liệu & Đào Tạo (Tuần 12)

### 11.1 Tài Liệu Kỹ Thuật

#### [ ] API Documentation
- [ ] Tạo tài liệu OpenAPI/Swagger

#### [ ] Developer Documentation
- [ ] Viết README, tài liệu kiến trúc, hướng dẫn đóng góp, quy trình triển khai, hướng dẫn khắc phục sự cố

### 11.2 Tài Liệu Người Dùng

#### [ ] User Guide
- [ ] Viết hướng dẫn bắt đầu và tutorials với screenshots/videos

#### [ ] FAQ & Support
- [ ] Tạo tài liệu FAQ và kênh hỗ trợ

---

## Kế Hoạch Xác Minh

### Automated Tests
- [ ] Backend unit tests (độ phủ 80%)
- [ ] Backend integration tests
- [ ] Frontend component tests (độ phủ 70%)
- [ ] End-to-end tests (Chrome, Firefox, Safari)

### Xác Minh Thủ Công
- [ ] Functional testing (tạo test case, import Excel, thực thi, báo cáo)
- [ ] Performance testing (load test, stress test)
- [ ] Security testing (authentication, authorization, input validation)
- [ ] Browser compatibility testing
- [ ] User acceptance testing (5 beta users, 90% hài lòng)

---

## Giảm Thiểu Rủi Ro

### Rủi Ro Kỹ Thuật
- Playwright browser crashes → Retry logic và error handling
- Database performance → Indexes, pooling, caching
- File storage limits → Giới hạn kích thước và cleanup policies
- WebSocket drops → Reconnection logic
- Report timeout → Async processing

### Rủi Ro Dự Án
- Scope creep → Tuân thủ nghiêm ngặt PRD
- Timeline delays → Weekly reviews
- Resource constraints → Ưu tiên tính năng P0
- Dependencies → Pin versions

---

## Tiêu Chí Thành Công

### MVP Launch Checklist
- [ ] Tất cả tính năng P0 được triển khai và test
- [ ] Import 100 test cases từ Excel
- [ ] Thực thi 50 tests song song trong vòng 10 phút
- [ ] Tạo báo cáo HTML và PDF với screenshots
- [ ] Onboard 5 beta users
- [ ] 90% hài lòng người dùng
- [ ] Hoàn thành security audit
- [ ] Đạt performance benchmarks
- [ ] Hoàn thành tài liệu
- [ ] Triển khai production thành công
- [ ] Zero critical bugs

---

**Phiên Bản Tài Liệu**: 1.0  
**Cập Nhật Lần Cuối**: 2026-02-11  
**Trạng Thái**: Sẵn Sàng Để Triển Khai
