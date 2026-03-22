# Hướng dẫn sử dụng AutoTest Tool

> Web Automation Testing Platform — Nền tảng kiểm thử tự động giao diện web & API

---

## Mục lục

1. [Đăng nhập / Đăng ký](#1-đăng-nhập--đăng-ký)
2. [Dashboard — Tổng quan](#2-dashboard--tổng-quan)
3. [Quản lý Dự án](#3-quản-lý-dự-án)
4. [Quản lý Test Suite](#4-quản-lý-test-suite)
5. [Tạo / Chỉnh sửa Test Case](#5-tạo--chỉnh-sửa-test-case)
6. [API Testing — Kiểm thử API](#6-api-testing--kiểm-thử-api)
7. [Data-Driven Testing — Kiểm thử theo dữ liệu](#7-data-driven-testing--kiểm-thử-theo-dữ-liệu)
8. [Live Monitor — Theo dõi thực thi](#8-live-monitor--theo-dõi-thực-thi)
9. [Lịch sử các lần chạy](#9-lịch-sử-các-lần-chạy)
10. [Visual Regression — So sánh giao diện](#10-visual-regression--so-sánh-giao-diện)
11. [Tạo Test Case bằng AI](#11-tạo-test-case-bằng-ai)
12. [Record & Replay — Ghi và phát lại](#12-record--replay--ghi-và-phát-lại)
13. [Kiểm tra UI (UI Checker V3)](#13-kiểm-tra-ui-ui-checker-v3)
14. [Smart Analytics — Phân tích thông minh](#14-smart-analytics--phân-tích-thông-minh)
15. [Cài đặt](#15-cài-đặt)
16. [Xuất báo cáo](#16-xuất-báo-cáo)

---

## 1. Đăng nhập / Đăng ký

### Đăng ký tài khoản mới
1. Tại màn hình đăng nhập, chọn tab **Đăng ký**
2. Nhập **Email** và **Mật khẩu** (tối thiểu 6 ký tự)
3. Nhấn **Đăng ký**

### Đăng nhập
1. Nhập **Email** và **Mật khẩu** đã đăng ký
2. Nhấn **Đăng nhập**
3. Hệ thống sẽ chuyển đến Dashboard

> **Tài khoản mặc định:** `admin@matbao.com` / `admin123`

---

## 2. Dashboard — Tổng quan

Dashboard hiển thị cái nhìn tổng quan về toàn bộ dự án kiểm thử:

### KPI Cards (6 thẻ chính)

| Thẻ | Mô tả | Ghi chú |
|-----|--------|---------|
| **Dự án** | Tổng số dự án đang quản lý | Click để chuyển trang Projects |
| **Test Suites** | Tổng số bộ test | Click để chuyển trang Suites |
| **Test Cases** | Tổng số kịch bản test | Click để chuyển trang Editor |
| **Tỉ lệ Pass** | Phần trăm test case đã pass + xu hướng so với trước | Hiển thị mũi tên tăng/giảm |
| **Self-Healed** | Số lần hệ thống tự sửa selector bị hỏng | Tính năng Self-Healing |
| **Thời gian TB** | Thời gian trung bình chạy test case | Tính bằng giây |

### Quick Actions
- **Chạy test nhanh:** Nút tắt để chuyển sang Live Monitor
- **Tạo TC bằng AI:** Chuyển nhanh tới AI Generator
- **Kiểm tra UI:** Mở UI Checker

### Biểu đồ & Hoạt động
- **Biểu đồ Pass/Fail:** Tỉ lệ tổng thể và xu hướng
- **Hoạt động gần đây:** Danh sách các lần chạy test mới nhất với trạng thái

---

## 3. Quản lý Dự án

**Menu:** Sidebar → **Quản lý Dự án**

### Tạo dự án mới
1. Nhấn nút **+ Thêm Dự án**
2. Nhập **Tên dự án** (bắt buộc) và **Mô tả** (tùy chọn)
3. Nhấn **Lưu**

### Quản lý dự án
- **Tìm kiếm:** Gõ tên dự án vào ô tìm kiếm để lọc nhanh
- **Sửa:** Nhấn nút ✏️ để chỉnh sửa tên hoặc mô tả
- **Xóa:** Nhấn nút 🗑️ để xóa dự án

> **Lưu ý:** Xóa dự án sẽ xóa toàn bộ Test Suite và Test Case bên trong.

### Thông tin hiển thị
- Tên dự án
- Số lượng Suite
- Tổng số Test Case
- Trạng thái lần chạy cuối
- Ngày tạo

---

## 4. Quản lý Test Suite

**Menu:** Sidebar → **Test Suites**

Test Suite là bộ chứa nhóm các Test Case có liên quan.

### Tạo Test Suite
1. Chọn **Dự án** từ dropdown
2. Nhấn **+ Thêm Suite**
3. Nhập **Tên Suite** (bắt buộc) và **Mô tả**
4. Nhấn **Lưu**

### Thao tác trên Suite
| Nút | Chức năng |
|-----|-----------|
| **Test Cases** | Mở trình chỉnh sửa Test Case cho Suite này |
| **▶ Chạy** | Chuyển sang Live Monitor để chạy Suite |
| **✏️ Sửa** | Chỉnh sửa thông tin Suite |
| **🗑️ Xóa** | Xóa Suite (sẽ xóa tất cả Test Case bên trong) |

---

## 5. Tạo / Chỉnh sửa Test Case

**Menu:** Sidebar → **Tạo Test Case**

### Chọn vị trí lưu
1. Chọn **Dự án** từ dropdown
2. Chọn **Test Suite** cần thêm Test Case

### Cách 1: Nhập bằng ngôn ngữ tự nhiên (khuyến nghị)

1. Nhấn **+ Thêm TC**
2. Nhập **Tiêu đề** và **URL mục tiêu**
3. Chọn tab **Nhập ngôn ngữ tự nhiên**
4. Viết các bước kiểm thử bằng tiếng Việt, mỗi dòng = 1 bước

**Ví dụ — Kiểm thử giao diện:**
```
Mở trang https://example.com/login
Nhập "admin@test.com" vào ô Email
Nhập "123456" vào ô Mật khẩu
Nhấn nút "Đăng nhập"
Kiểm tra URL chứa /dashboard
Kiểm tra text "Xin chào" hiển thị
Chờ 2 giây
Chụp ảnh màn hình
```

**Ví dụ — Kiểm thử API:**
```
Gọi API POST https://api.example.com/login với body {"email":"admin@test.com","password":"123456"}
Kiểm tra status code 200
Kiểm tra $.message = "Thành công"
Lưu biến token = $.data.token
Gọi API GET https://api.example.com/profile với header Authorization: Bearer {{token}}
Kiểm tra response time < 2000ms
```

5. Trong khi nhập, hệ thống sẽ **gợi ý tự động** (autocomplete):
   - Gõ ít nhất 2 ký tự → danh sách gợi ý hiện ra phía dưới ô nhập
   - Dùng **Arrow Up/Down** để chọn gợi ý
   - Nhấn **Tab** hoặc **Enter** để áp dụng gợi ý vào dòng hiện tại
   - Nhấn **Esc** để đóng danh sách gợi ý
   - Hỗ trợ 24 mẫu gợi ý cho cả UI và API (ví dụ: gõ "mở" → `Mở trang https://`, gõ "gọi api" → `Gọi API POST https://...`)
6. Nhấn **Chuyển đổi ✨** — hệ thống tự động phân tích và tạo các bước kỹ thuật
7. Xem lại kết quả chuyển đổi
8. Nhấn **Lưu Test Case**

### Cách 2: Nhập kỹ thuật (thủ công)

1. Chọn tab **Chỉnh sửa kỹ thuật**
2. Thêm từng bước với các trường:

| Trường | Mô tả | Ví dụ |
|--------|--------|-------|
| **Action** | Hành động thực hiện | `click`, `fill`, `navigate`... |
| **Selector** | CSS/XPath selector | `#login-btn`, `.email-input` |
| **Value** | Giá trị nhập | `admin@test.com` |
| **Expected** | Giá trị kỳ vọng | `Dashboard` |
| **Mô tả** | Diễn giải bước | `Nhấn nút Đăng nhập` |

**Danh sách Action — 22 hành động:**

Action được chia thành 4 nhóm:

#### UI cơ bản

| Action | Mô tả | Cần Selector | Cần Value |
|--------|--------|:---:|:---:|
| `navigate` | Mở trang web | ❌ | ✅ (URL) |
| `click` | Click vào phần tử | ✅ | ❌ |
| `fill` | Nhập text vào ô input | ✅ | ✅ |
| `select` | Chọn giá trị dropdown | ✅ | ✅ |
| `hover` | Di chuột qua phần tử | ✅ | ❌ |
| `wait` | Chờ (milliseconds) | ❌ | ✅ (ms) |
| `screenshot` | Chụp ảnh màn hình | ❌ | ❌ |

#### UI nâng cao

| Action | Mô tả | Cần Selector | Cần Value |
|--------|--------|:---:|:---:|
| `double_click` | Double click vào phần tử | ✅ | ❌ |
| `right_click` | Click chuột phải | ✅ | ❌ |
| `keyboard` | Nhấn phím (Enter, Tab, Escape...) | ❌ | ✅ (tên phím) |
| `scroll_to` | Cuộn trang đến phần tử | ✅ | ❌ |
| `drag_drop` | Kéo thả phần tử | ✅ (nguồn) | ✅ (đích) |
| `upload_file` | Upload file | ✅ | ✅ (đường dẫn file) |

#### Kiểm tra UI

| Action | Mô tả | Cần Selector | Cần Expected |
|--------|--------|:---:|:---:|
| `assert_text` | Kiểm tra text hiển thị | ✅ | ✅ |
| `assert_visible` | Kiểm tra phần tử hiển thị | ✅ | ❌ |
| `assert_url` | Kiểm tra URL hiện tại | ❌ | ✅ |

#### API Testing

| Action | Mô tả | Cấu hình |
|--------|--------|----------|
| `api_request` | Gọi API (GET/POST/PUT/DELETE/PATCH) | Method, URL, Headers, Body |
| `assert_status` | Kiểm tra HTTP status code | Expected: `200`, `201`... |
| `assert_body` | Kiểm tra nội dung response (JSONPath) | Expected: `$.data.id = 123` |
| `assert_header` | Kiểm tra response header | Expected: `Content-Type = application/json` |
| `assert_response_time` | Kiểm tra thời gian phản hồi | Expected: `< 2000` (ms) |
| `store_variable` | Lưu giá trị từ response vào biến | Value: `token = $.data.token` |

### Cách 3: Import từ Excel

1. Tải file mẫu bằng nút **File mẫu**
2. Điền test case theo mẫu trong file Excel (.xlsx)
3. Kéo thả file vào vùng upload hoặc nhấn để chọn file
4. Hệ thống tự động import tất cả test case

### Cách 4: Import từ Postman Collection

1. Nhấn nút **Import Postman**
2. Chọn file **Postman Collection** (.json — hỗ trợ v2.1)
3. Hệ thống tự động:
   - Parse các request trong collection (bao gồm thư mục lồng nhau)
   - Chuyển đổi thành test case với action `api_request`
   - Trích xuất assertions từ test scripts (`pm.response.to.have.status(200)`)
   - Trích xuất biến từ `pm.environment.set()`
   - Thay thế biến Postman `{{variable}}` thành cú pháp hệ thống
4. Xem lại và lưu các test case đã import

### Tùy chọn bổ sung
- **Trình duyệt:** Chromium (mặc định), Firefox, WebKit (Safari)
- **Thiết bị:** Desktop, iPhone 15/14/SE, Pixel 7/5, Galaxy S24/S9, iPad Pro/Mini...
- **Clone:** Nhấn nút **Clone** để tạo bản sao test case
- **Xuất Excel:** Nhấn **Xuất Excel** để tải tất cả test case về file .xlsx

---

## 6. API Testing — Kiểm thử API

AutoTest Tool hỗ trợ kiểm thử API trực tiếp trong test case, kết hợp cùng kiểm thử giao diện.

### API Request Builder

Khi chọn action `api_request` trong trình chỉnh sửa kỹ thuật, một form chuyên dụng hiện ra:

| Trường | Mô tả | Ví dụ |
|--------|--------|-------|
| **Method** | Phương thức HTTP | GET, POST, PUT, DELETE, PATCH |
| **URL** | Địa chỉ API | `https://api.example.com/users` |
| **Headers** | Các header (JSON) | `{"Authorization": "Bearer {{token}}"}` |
| **Body** | Nội dung request (JSON) | `{"name": "Test User", "email": "test@example.com"}` |

### Kiểm tra kết quả API

Sau action `api_request`, sử dụng các action kiểm tra:

```
api_request POST https://api.example.com/login  (với body JSON)
assert_status 200                                (kiểm tra status code)
assert_body $.data.token != null                 (kiểm tra response body bằng JSONPath)
assert_header Content-Type = application/json    (kiểm tra header)
assert_response_time < 2000                      (kiểm tra thời gian < 2 giây)
store_variable token = $.data.token              (lưu giá trị vào biến)
```

### Biến (Variable Store)

- **Lưu biến:** Dùng action `store_variable` với cú pháp `tên_biến = $.jsonpath`
- **Sử dụng biến:** Dùng `{{tên_biến}}` trong URL, Headers, Body, Value, Expected của các bước tiếp theo
- **JSONPath hỗ trợ:** `$.data.id`, `$.items[0].name`, `$.users[*].email`

### Kết hợp UI + API Testing

Trong cùng một test case, bạn có thể kết hợp:
```
1. navigate → https://example.com/login        (mở trang)
2. api_request POST /api/login                  (gọi API đăng nhập)
3. store_variable token = $.data.token          (lưu token)
4. assert_status 200                            (kiểm tra API thành công)
5. fill #token-input → {{token}}                (điền token vào giao diện)
6. click #submit                                (nhấn nút)
7. assert_url → /dashboard                      (kiểm tra chuyển trang)
```

---

## 7. Data-Driven Testing — Kiểm thử theo dữ liệu

Chạy cùng 1 test case với nhiều bộ dữ liệu khác nhau (ví dụ: test đăng nhập với 100 tài khoản).

### Chuẩn bị Test Case
Trong các bước test case, sử dụng cú pháp `{{tên_cột}}` để đánh dấu biến:

```
Bước 1: Mở trang https://example.com/login
Bước 2: Nhập "{{email}}" vào ô Email         ← biến
Bước 3: Nhập "{{password}}" vào ô Mật khẩu   ← biến
Bước 4: Nhấn nút "Đăng nhập"
Bước 5: Kiểm tra text "{{expected_text}}"     ← biến
```

### Tạo Data Set
1. Trong bảng Test Case, nhấn nút **📊 Data** ở cột Data
2. Trong modal Data Sets, nhấn **+ Thêm Data Set**
3. Nhập **Tên Data Set**
4. Upload file **CSV** hoặc nhập dữ liệu thủ công

**Ví dụ file CSV:**
```csv
email,password,expected_text
admin@test.com,123456,Xin chào Admin
user@test.com,abc123,Xin chào User
wrong@test.com,sai_mk,Sai mật khẩu
```

5. Xem trước dữ liệu đã parse → Nhấn **Lưu Data Set**

### Chạy Data-Driven Test
1. Mở Data Sets của test case
2. Nhấn nút **▶ Chạy** bên cạnh data set cần chạy
3. Hệ thống tự tạo bản sao test case cho mỗi dòng dữ liệu, thay `{{biến}}` bằng giá trị tương ứng
4. Kết quả hiển thị trong **Lịch sử chạy**

---

## 8. Live Monitor — Theo dõi thực thi

**Menu:** Sidebar → **Live Monitor**

### Bắt đầu chạy test
1. Chọn **Dự án** (tùy chọn — để lọc)
2. Chọn **Test Suite** cần chạy
3. **Tick chọn** các Test Case muốn chạy (mặc định chọn tất cả)
4. Cấu hình tùy chọn chạy:

| Tùy chọn | Mô tả | Giá trị |
|-----------|--------|---------|
| **Chạy tiếp khi fail** | Không dừng khi gặp test case fail | Bật/Tắt |
| **Retry** | Số lần thử lại khi fail | 0 - 3 |
| **Song song** | Số test case chạy đồng thời | 1 - 10 |
| **Self-Healing** | Tự động sửa selector bị hỏng | Bật (mặc định) / Tắt |
| **Smart Priority** | Sắp xếp thông minh thứ tự chạy | Bật / Tắt (mặc định) |

#### Self-Healing (Tự phục hồi selector)

Khi bật, hệ thống tự động thử các chiến lược thay thế nếu selector gốc không tìm thấy phần tử:

| Chiến lược | Mô tả |
|------------|--------|
| `xpath-text-to-getByText` | Chuyển XPath chứa text thành getByText |
| `xpath-attr-to-css` | Chuyển XPath đơn giản thành CSS selector |
| `id-attribute` | Tìm phần tử bằng thuộc tính id |
| `has-text-to-getByRole` | Tìm button/link chứa text tương ứng |
| `class-to-data-testid` | Chuyển class selector thành data-testid |
| `text-to-placeholder` | Tìm ô input bằng placeholder |
| `text-to-label` | Tìm ô input bằng label |
| `text-to-aria-label` | Tìm phần tử bằng aria-label |
| `text-to-title` | Tìm phần tử bằng thuộc tính title |

Khi self-healing thành công, kết quả hiển thị selector đã được chữa trị cùng chiến lược sử dụng.

#### Smart Priority (Sắp xếp thông minh)

Khi bật, test case được sắp xếp theo 5 yếu tố:

| Yếu tố | Trọng số | Mô tả |
|---------|----------|--------|
| Recent Failure | 40% | Test case fail gần đây chạy trước |
| Flaky Score | 20% | Test case hay flaky được ưu tiên |
| Duration | 15% | Test case chạy nhanh ưu tiên trước |
| Staleness | 15% | Test case lâu chưa chạy được ưu tiên |
| Change | 10% | Test case mới thay đổi ưu tiên hơn |

### Trong khi chạy
- **Thanh tiến độ:** Hiển thị số test case đã xong / tổng
- **Kết quả real-time:** Từng test case hiển thị kết quả ngay khi chạy xong
- **Chi tiết từng bước:** Action, selector, thời gian, ảnh chụp
- **Selector đã chữa trị:** Nếu self-healing hoạt động, hiển thị chi tiết
- **Nút điều khiển:**
  - ⏸️ **Tạm dừng** — dừng tạm, giữ trạng thái
  - ▶ **Tiếp tục** — chạy lại sau khi tạm dừng
  - ⏹️ **Hủy** — dừng hoàn toàn

### Tối ưu hiệu suất — Shared Browser

Khi chạy song song nhiều test case, hệ thống tự động tối ưu:
- **Chỉ mở 1 trình duyệt** dùng chung cho toàn bộ suite
- Mỗi test case chạy trong **context riêng biệt** (isolated cookies/storage)
- Tiết kiệm RAM và thời gian khởi động trình duyệt
- Tự động fallback về chế độ cũ (1 browser/test case) nếu suite có nhiều loại trình duyệt khác nhau

### Sau khi chạy xong
- **Bảng tổng kết:** Tổng / Passed / Failed / Tỉ lệ Pass
- **Xuất báo cáo:** HTML, PDF, JSON, JUnit XML
- **Xem ảnh chụp:** Click vào thumbnail để phóng to
- **Xem video:** Click link 🎬 Video để xem quá trình chạy

---

## 9. Lịch sử các lần chạy

**Menu:** Sidebar → **Lịch sử chạy**

### Lọc và tìm kiếm
- Lọc theo **Dự án** và/hoặc **Suite**
- Mỗi lần chạy hiển thị: ID, trạng thái, suite, thời gian, tỉ lệ pass/fail

### Xem chi tiết
- Click vào một lần chạy để mở rộng xem chi tiết
- Hiển thị từng test case: trạng thái, thời gian, ảnh chụp, video
- Test case FAILED có thể gán **Mức ưu tiên sửa lỗi:**
  - 🔴 Critical
  - 🟠 High
  - 🟡 Medium
  - 🟢 Low

### Thao tác trên lần chạy

| Nút | Chức năng |
|-----|-----------|
| **HTML** | Xuất báo cáo HTML |
| **PDF** | Xuất báo cáo PDF |
| **JSON** | Xuất báo cáo JSON (cấu trúc đầy đủ) |
| **JUnit XML** | Xuất JUnit XML (cho CI/CD) |
| **Export Failed** | Chỉ xuất các test case fail (HTML) |
| **Rerun Failed** | Chạy lại chỉ các test case đã fail |
| **📐 Lưu Baseline** | Lưu ảnh chụp làm baseline (xem phần Visual Regression) |
| **🔍 So sánh Visual** | So sánh ảnh chụp với baseline |
| **🗑️ Xóa** | Xóa lần chạy |

### Chạy lại test case FAILED
1. Nhấn **Rerun Failed** trên một lần chạy có case fail
2. Hệ thống tạo lần chạy mới chỉ với các case fail
3. Sau khi chạy xong, hiển thị bảng so sánh **Before / After:**
   - Trạng thái trước và sau
   - Kết quả: ✅ Fixed hoặc ❌ Still Failed

### Xóa hàng loạt
1. Tick chọn các lần chạy cần xóa
2. Nhấn **Xóa đã chọn**

---

## 10. Visual Regression — So sánh giao diện

Phát hiện thay đổi giao diện bằng cách so sánh ảnh chụp giữa các lần chạy.

### Bước 1: Lưu Baseline
1. Chạy test suite một lần (kết quả chuẩn, giao diện đúng)
2. Vào **Lịch sử chạy**, tìm lần chạy đó
3. Nhấn **📐 Lưu Baseline**
4. Hệ thống lưu tất cả ảnh chụp từ các bước làm ảnh gốc để so sánh

### Bước 2: So sánh Visual
1. Chạy test suite lại (sau khi có thay đổi code/giao diện)
2. Vào **Lịch sử chạy**, tìm lần chạy mới
3. Nhấn **🔍 So sánh Visual**
4. Hệ thống so sánh từng ảnh chụp với baseline

### Xem kết quả
Bảng Visual Regression hiển thị:

| Cột | Mô tả |
|-----|--------|
| **Test Case** | Tên test case |
| **Step** | Bước nào có ảnh chụp |
| **Diff %** | Phần trăm khác biệt (0% = giống hoàn toàn) |
| **Trạng thái** | ✅ Match hoặc ❌ Changed |

### Xem chi tiết Diff
- Nhấn **🔍 Xem Diff** để xem overlay 3 ảnh:
  - **BASELINE** — Ảnh gốc (viền xanh)
  - **HIỆN TẠI** — Ảnh lần chạy mới (viền vàng)
  - **DIFF** — Vùng khác biệt được highlight (viền đỏ)

### Chấp nhận thay đổi
- Nếu thay đổi giao diện là **đúng ý** (do cập nhật UI), nhấn **✅ Chấp nhận**
- Hệ thống cập nhật baseline bằng ảnh mới

---

## 11. Tạo Test Case bằng AI

**Menu:** Sidebar → **Tạo TC bằng AI**

### Hệ thống AI đa nhà cung cấp

Hệ thống hỗ trợ nhiều nhà cung cấp AI với tự động chuyển đổi khi gặp rate limit:

| Provider | Model | Tốc độ | Multimodal | Cấu hình |
|----------|-------|--------|:---:|----------|
| **Gemini Flash** | gemini-2.0-flash | 15 RPM | ✅ | `GEMINI_API_KEY` |
| **Gemini Flash Lite** | gemini-2.0-flash-lite | 30 RPM | ✅ | `GEMINI_API_KEY` |
| **Groq** | llama-3.3-70b-versatile | 30 RPM | ❌ | `GROQ_API_KEY` |
| **Ollama** | Tùy chọn | Không giới hạn | Tùy model | `OLLAMA_MODEL` |

- **Tự động fallback:** Khi bị rate limit, hệ thống tự chuyển sang provider tiếp theo
- **Cooldown 60 giây:** Provider bị rate limit tự phục hồi sau 60 giây
- **Chỉ cần ít nhất 1 provider:** Không có API key → provider đó tắt, không lỗi

### Bộ nhớ đệm & Hàng đợi

- **AI Response Cache:** Cache kết quả (LRU, 100 entries, TTL 1 giờ) — gọi lại cùng request sẽ trả về tức thì
- **AI Request Queue:** Hàng đợi thông minh giới hạn 14 RPM, tự chờ khi gần limit
- **Tối ưu token:** Ảnh tự động resize (max 800px), giới hạn 3 ảnh, compact DOM format

### Quy trình 3 bước

**Bước 1: Nhập thông tin**
1. Upload **ảnh chụp giao diện** (kéo thả hoặc click — hỗ trợ nhiều ảnh)
2. Nhập **URL trang web** (AI sẽ tự truy cập và phân tích)
3. Viết **mô tả** chức năng cần kiểm thử
4. Chọn **Test Suite** để lưu kết quả
5. Nhấn **Tạo Test Case bằng AI**

> **Mẹo:** Nếu mô tả đủ chi tiết (≥ 3 bước, viết bằng ngôn ngữ tự nhiên), hệ thống sẽ dùng NL Parser trả về kết quả **tức thì** mà không cần gọi AI. Trường `source: 'nl-parser'` cho biết kết quả từ NL Parser.

**Bước 2: AI xử lý**
- Hệ thống phân tích ảnh, truy cập URL, gửi đến AI
- Thời gian: 15-60 giây tùy độ phức tạp
- Nếu đang có nhiều request, bạn sẽ thấy vị trí trong hàng đợi

**Bước 3: Xem lại và lưu**
1. Chỉnh sửa **tiêu đề** test case
2. Xem danh sách các bước AI đã tạo
3. Có thể **sửa / xóa / thêm / sắp xếp** bước
4. Nếu cần thay đổi, nhập yêu cầu vào ô **AI Refinement** và nhấn gửi
5. Nhấn **Lưu Test Case**

---

## 12. Record & Replay — Ghi và phát lại

**Menu:** Sidebar → **Record & Replay**

Ghi lại thao tác trên trình duyệt và tự động chuyển thành test case.

### Ghi hành động
1. Nhập **URL** trang web cần ghi
2. Nhấn **🔴 Bắt đầu ghi**
3. Trình duyệt mở ra — **thao tác bình thường** trên trang web:
   - Click các nút, link
   - Nhập text vào ô input
   - Chọn dropdown
   - Điều hướng giữa các trang
4. Hệ thống tự động ghi nhận mọi thao tác
5. **Danh sách bước** cập nhật real-time trên giao diện
6. Khi hoàn tất, nhấn **⬛ Dừng ghi**

### Xem lại và chỉnh sửa
Sau khi dừng ghi, hệ thống hiển thị danh sách các bước đã ghi:
- Mỗi bước hiển thị: Action, Selector, Value, Mô tả
- Có thể **sửa** từng trường
- Có thể **xóa** bước không cần thiết
- Có thể **di chuyển** thứ tự bước (lên/xuống)

### Lưu thành Test Case
1. Nhập **Tiêu đề** cho test case
2. Chọn **Trình duyệt** (Chromium / Firefox / WebKit)
3. Chọn **Thiết bị** (Desktop / Mobile / Tablet)
4. Chọn **Test Suite** để lưu
5. Nhấn **💾 Lưu thành Test Case**

### Quản lý phiên ghi
- Phần **Phiên ghi đang hoạt động** hiển thị các phiên đang mở
- Có thể dừng bất kỳ phiên nào
- Tối đa 3 phiên ghi đồng thời
- Phiên tự động hết hạn sau 10 phút

---

## 13. Kiểm tra UI (UI Checker V3)

**Menu:** Sidebar → **Kiểm tra UI**

Công cụ kiểm tra chất lượng giao diện tự động với 35+ quy tắc kiểm tra.

### Tab 1: Kiểm tra UI nâng cao

1. Nhập **URL** trang web cần kiểm tra
2. Chọn **thiết bị** để kiểm tra responsive (Desktop / Tablet / Mobile)
3. Nếu trang yêu cầu đăng nhập: nhập **Email** và **Mật khẩu**
4. Nhấn **Bắt đầu kiểm tra**

**Kết quả bao gồm:**
- **Điểm chất lượng** (0-100) với xếp hạng (Good / Fair / Needs Improvement)
- **Ảnh chụp** trên Desktop, Tablet, Mobile
- **Danh sách vấn đề** phân theo mức độ:
  - 🔴 Critical — Lỗi nghiêm trọng cần sửa ngay
  - 🟠 High — Lỗi quan trọng
  - 🟡 Medium — Cần cải thiện
  - 🟢 Low — Gợi ý tối ưu

**Các hạng mục kiểm tra:**

| Hạng mục | Mô tả |
|----------|--------|
| Color Contrast | Độ tương phản màu sắc |
| Typography | Font chữ, kích thước, line-height |
| Layout & Spacing | Bố cục, khoảng cách, overflow |
| SEO & Meta Tags | Title, description, OG tags |
| Forms & Accessibility | Label, aria, tabindex |
| Images | Alt text, kích thước, lazy loading |
| Performance | File size, số request |
| Responsive | Hiển thị trên nhiều thiết bị |
| Blocking Elements | Popup, overlay che nội dung |
| UX Issues | Trải nghiệm người dùng |
| Accessibility | Khả năng truy cập |
| Visual Issues | Vấn đề hiển thị |

**Mỗi vấn đề bao gồm:**
- Mô tả chi tiết
- Selector của phần tử
- Gợi ý cách sửa kèm code mẫu

### Tab 2: So sánh Design

So sánh bản thiết kế (Figma/Adobe XD) với trang web thực tế.

1. Upload **ảnh thiết kế** (PNG/JPG) từ Figma hoặc công cụ design
2. Nhập **URL** trang web cần so sánh
3. Điều chỉnh **Tolerance** (độ chặt):
   - Strict (0.05) — Rất khắt khe
   - Normal (0.1) — Bình thường
   - Loose (0.3) — Linh hoạt
4. Nhấn **So sánh**

**Kết quả:**
- **Tỉ lệ khớp** (%) với xếp hạng A-F
- **Ảnh diff** highlight vùng khác biệt
- So sánh side-by-side: Thiết kế | Thực tế | Diff

### Tab 3: Kiểm tra tương tác

Tự động test các tương tác trên trang web.

**Cấp độ kiểm tra:**

| Cấp độ | Mô tả |
|--------|--------|
| **Smart** | Tự phát hiện form, button, link và test từng cái (khuyến nghị) |
| **Chaos** | Click ngẫu nhiên 500 lần để tìm crash |
| **Full** | Smart + Chaos kết hợp |

1. Nhập **URL**
2. Chọn **cấp độ** kiểm tra
3. Cấu hình số lượng hành động ngẫu nhiên (nếu dùng Chaos)
4. Nhấn **Bắt đầu**

**Kết quả:**
- Tổng test / Passed / Failed
- Đánh giá: Stable / Unstable / Critical Issues
- Chi tiết từng test với ảnh chụp

### Tab 4: Lịch sử

- Xem lại tất cả lần kiểm tra UI trước đó
- Lọc theo loại (Enhanced / Design Compare / Interaction)
- Xem chi tiết, xóa, hoặc xuất báo cáo (HTML/PDF)

---

## 14. Smart Analytics — Phân tích thông minh

**Menu:** Sidebar → **Smart Analytics**

Dashboard phân tích chuyên sâu về chất lượng kiểm thử.

### Chọn dữ liệu
1. Chọn **Dự án** từ dropdown
2. Chọn **Test Suite** cần phân tích
3. Hệ thống tự động tải dữ liệu

### Tab Overview — Tổng quan

**Health Score Cards (4 thẻ):**
- **Suite Health %** — Điểm sức khỏe tổng thể của suite
- **Total Tests** — Tổng số test case
- **Critical** — Số test case cần chú ý khẩn cấp
- **Flaky** — Số test case không ổn định

**Bảng Priority — Thứ tự ưu tiên:**
Danh sách test case được sắp xếp theo điểm ưu tiên (priority score), kèm theo các yếu tố:
- Trạng thái lần chạy cuối
- Điểm flaky
- Số lần fail gần đây
- Đề xuất: Run First / Normal / Low Priority

### Tab Flaky — Test không ổn định

Phân tích chi tiết test case flaky (đôi khi pass, đôi khi fail):

**Mỗi flaky test hiển thị:**
- **Flaky Score** (0-1) — Điểm không ổn định
- **Flip Rate** — Tần suất đổi trạng thái (pass↔fail)
- **Failure Rate** — Tỉ lệ fail
- **Retry-Healed** — Số lần pass nhờ retry
- **Suggest Retry** — Đề xuất số lần retry tối ưu
- **Error Patterns** — Các lỗi thường gặp, phân nhóm

### Tab Errors — Mẫu lỗi

Phân tích và nhóm các lỗi phổ biến:
- Số lần xuất hiện mỗi loại lỗi
- Test case bị ảnh hưởng
- Xu hướng tăng/giảm

### Tab Trends — Xu hướng

- **Biểu đồ thanh:** Pass/Fail/Cancelled theo từng lần chạy
- **Bảng lịch sử:** Chi tiết từng lần chạy (thời gian, tỉ lệ pass, số case)
- Giúp phát hiện xu hướng suy giảm chất lượng

---

## 15. Cài đặt

**Menu:** Sidebar → **Cài đặt**

### Giao diện

| Tùy chọn | Mô tả |
|-----------|--------|
| **Light Mode** | Giao diện sáng (mặc định) |
| **Dark Mode** | Giao diện tối — giảm mỏi mắt khi làm việc lâu |

Theme được lưu trong trình duyệt, tự động áp dụng khi mở lại.

### Tùy chọn chạy mặc định

Cấu hình giá trị mặc định cho mỗi lần chạy test:

| Tùy chọn | Mô tả | Mặc định |
|-----------|--------|----------|
| **Continue on Failure** | Chạy tiếp khi gặp fail | Tắt |
| **Self-Healing** | Tự sửa selector | Bật |
| **Smart Priority** | Sắp xếp thông minh | Tắt |
| **Retry Count** | Số lần retry | 0 |
| **Concurrency** | Số test chạy song song | 1 |

### Trạng thái AI Provider

Hiển thị trạng thái realtime của từng nhà cung cấp AI:
- Provider nào đang hoạt động / tắt / bị rate limit
- Số request đã dùng trong phút
- Cooldown còn lại (nếu có)

### Queue & Cache Metrics

| Thông số | Mô tả |
|----------|--------|
| **Queue Length** | Số request đang chờ |
| **Current RPM** | Số request/phút hiện tại |
| **Cache Size** | Số entry trong cache |
| **Hit Rate** | Tỉ lệ cache hit |

---

## 16. Xuất báo cáo

Hệ thống hỗ trợ xuất báo cáo ở nhiều định dạng:

### Định dạng hỗ trợ

| Định dạng | Mô tả | Dùng cho |
|-----------|--------|----------|
| **HTML** | Báo cáo web đầy đủ, có ảnh chụp | Xem trên trình duyệt, chia sẻ |
| **PDF** | Báo cáo PDF chuyên nghiệp | In ấn, gửi khách hàng |
| **JSON** | Dữ liệu cấu trúc đầy đủ | Tích hợp công cụ khác, phân tích |
| **JUnit XML** | Chuẩn JUnit cho CI/CD | Jenkins, GitLab CI, GitHub Actions |

### Vị trí xuất

| Nơi | Định dạng có sẵn |
|-----|-------------------|
| **Live Monitor** (sau khi chạy) | HTML, PDF |
| **Lịch sử chạy** | HTML, PDF, JSON, JUnit XML, Export Failed (HTML) |
| **UI Checker** → Lịch sử | HTML, PDF |

### Nội dung báo cáo HTML/PDF
- Thông tin lần chạy (ID, Suite, thời gian, người chạy)
- Tổng kết: Total / Passed / Failed / Tỉ lệ
- Chi tiết từng test case:
  - Trạng thái, thời gian chạy
  - Từng bước: action, selector, kết quả, thời gian
  - Ảnh chụp mỗi bước
  - Thông báo lỗi (nếu fail)
  - Selector đã chữa trị (nếu self-healing hoạt động)

### Nội dung báo cáo JSON
```json
{
  "run": { "id", "suite_id", "suite_name", "status", "started_at", "finished_at", "created_by", "options" },
  "summary": { "total", "passed", "failed" },
  "results": [
    { "test_case_id", "test_case_title", "status", "duration_ms", "error_message", "attempt", "steps": [...] }
  ]
}
```

### JUnit XML — Tích hợp CI/CD

File JUnit XML tương thích với các hệ thống CI/CD phổ biến:

```xml
<testsuites name="Suite Name" tests="10" failures="2" time="45.30">
  <testsuite name="Suite Name" tests="10" failures="2">
    <testcase name="Test Case Title" classname="tc-id" time="4.50">
      <failure message="Error message" type="AssertionError">
        Step details...
      </failure>
    </testcase>
  </testsuite>
</testsuites>
```

**Sử dụng trong CI/CD:**
- **Jenkins:** Thêm post-build action "Publish JUnit test result report"
- **GitLab CI:** Dùng `artifacts:reports:junit`
- **GitHub Actions:** Dùng action `dorny/test-reporter`

---

## Mẹo sử dụng

1. **Bắt đầu nhanh:** Dùng **Nhập ngôn ngữ tự nhiên** hoặc **AI Generator** để tạo test case nhanh mà không cần biết CSS selector
2. **API Testing:** Import từ **Postman Collection** để chuyển đổi test API hiện có thành test case tự động
3. **Record & Replay:** Dùng khi bạn muốn tạo test case bằng cách thao tác trực tiếp trên trình duyệt
4. **Data-Driven:** Dùng khi cần test cùng một luồng với nhiều bộ dữ liệu (đăng nhập, đăng ký, tìm kiếm...)
5. **Visual Regression:** Lưu baseline sau khi giao diện ổn định, so sánh sau mỗi lần cập nhật code
6. **Self-Healing:** Luôn bật để giảm maintenance khi UI thay đổi nhỏ
7. **Smart Priority:** Bật khi chạy regression test để phát hiện bug nhanh nhất
8. **Continue on Failure + Retry:** Bật khi chạy regression test để không bỏ sót case nào
9. **Parallel execution:** Tăng số song song (2-5) để chạy nhanh hơn khi có nhiều test case
10. **Smart Analytics:** Kiểm tra định kỳ để phát hiện test flaky và xu hướng suy giảm chất lượng
11. **UI Checker:** Chạy trước khi release để phát hiện lỗi responsive, accessibility, SEO
12. **Dark Mode:** Bật trong Cài đặt khi làm việc ban đêm
13. **Multi-provider AI:** Cấu hình thêm `GROQ_API_KEY` hoặc `OLLAMA_MODEL` để tăng tốc độ và giảm rate limit

---

## Yêu cầu hệ thống

| Thành phần | Yêu cầu |
|------------|---------|
| **Node.js** | v18 trở lên |
| **Trình duyệt** | Chrome, Firefox, hoặc Edge (bản mới nhất) |
| **RAM** | Tối thiểu 4GB (khuyến nghị 8GB cho chạy song song) |
| **AI Generator** | Cần ít nhất 1 trong các key: `GEMINI_API_KEY`, `GROQ_API_KEY`, hoặc `OLLAMA_MODEL` |

### Biến môi trường (tùy chọn)

| Biến | Mô tả | Bắt buộc |
|------|--------|:---:|
| `GEMINI_API_KEY` | API key Google Gemini (Flash + Flash Lite) | Ít nhất 1 |
| `GROQ_API_KEY` | API key Groq (LLaMA 3.3 70B) | Ít nhất 1 |
| `OLLAMA_MODEL` | Tên model Ollama local (ví dụ: `llama3.3`) | Ít nhất 1 |

---

## Khởi chạy ứng dụng

```bash
# Backend
cd backend
npm install
node src/server.js

# Frontend (development)
cd frontend
npm install
npm run dev
```

Truy cập: `http://localhost:5173` (dev) hoặc `http://localhost:8386` (production)

---

*AutoTest Tool — Web Automation Testing Platform v2.0*
