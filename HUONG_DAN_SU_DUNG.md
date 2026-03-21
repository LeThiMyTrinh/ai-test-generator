# Hướng dẫn sử dụng AutoTest Tool

> Web Automation Testing Platform — Nền tảng kiểm thử tự động giao diện web

---

## Mục lục

1. [Đăng nhập / Đăng ký](#1-đăng-nhập--đăng-ký)
2. [Dashboard — Tổng quan](#2-dashboard--tổng-quan)
3. [Quản lý Dự án](#3-quản-lý-dự-án)
4. [Quản lý Test Suite](#4-quản-lý-test-suite)
5. [Tạo / Chỉnh sửa Test Case](#5-tạo--chỉnh-sửa-test-case)
6. [Data-Driven Testing — Kiểm thử theo dữ liệu](#6-data-driven-testing--kiểm-thử-theo-dữ-liệu)
7. [Live Monitor — Theo dõi thực thi](#7-live-monitor--theo-dõi-thực-thi)
8. [Lịch sử các lần chạy](#8-lịch-sử-các-lần-chạy)
9. [Visual Regression — So sánh giao diện](#9-visual-regression--so-sánh-giao-diện)
10. [Tạo Test Case bằng AI](#10-tạo-test-case-bằng-ai)
11. [Record & Replay — Ghi và phát lại](#11-record--replay--ghi-và-phát-lại)
12. [Kiểm tra UI (UI Checker V3)](#12-kiểm-tra-ui-ui-checker-v3)
13. [Xuất báo cáo](#13-xuất-báo-cáo)

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

| Thông tin | Mô tả |
|-----------|--------|
| **Tổng dự án** | Số lượng dự án đang quản lý |
| **Tổng Test Suite** | Số lượng bộ test |
| **Tổng Test Case** | Số lượng kịch bản test |
| **Tỉ lệ Pass** | Phần trăm test case đã pass |

**Biểu đồ:**
- **Biểu đồ tròn:** Tỉ lệ Pass / Fail tổng thể
- **Biểu đồ đường:** Xu hướng Pass / Fail trong 10 lần chạy gần nhất

**Bảng lần chạy gần đây:** Hiển thị danh sách các lần chạy test mới nhất với trạng thái và kết quả.

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

**Ví dụ:**
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

5. Nhấn **Chuyển đổi ✨** — hệ thống tự động phân tích và tạo các bước kỹ thuật
6. Xem lại kết quả chuyển đổi
7. Nhấn **Lưu Test Case**

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

**Danh sách Action:**

| Action | Mô tả | Cần Selector | Cần Value |
|--------|--------|:---:|:---:|
| `navigate` | Mở trang web | ❌ | ✅ (URL) |
| `click` | Click vào phần tử | ✅ | ❌ |
| `fill` | Nhập text vào ô input | ✅ | ✅ |
| `select` | Chọn giá trị dropdown | ✅ | ✅ |
| `hover` | Di chuột qua phần tử | ✅ | ❌ |
| `assert_text` | Kiểm tra text hiển thị | ✅ | ❌ (Expected) |
| `assert_visible` | Kiểm tra phần tử hiển thị | ✅ | ❌ |
| `assert_url` | Kiểm tra URL hiện tại | ❌ | ❌ (Expected) |
| `wait` | Chờ (milliseconds) | ❌ | ✅ (ms) |
| `screenshot` | Chụp ảnh màn hình | ❌ | ❌ |

### Cách 3: Import từ Excel

1. Tải file mẫu bằng nút **File mẫu**
2. Điền test case theo mẫu trong file Excel (.xlsx)
3. Kéo thả file vào vùng upload hoặc nhấn để chọn file
4. Hệ thống tự động import tất cả test case

### Tùy chọn bổ sung
- **Trình duyệt:** Chromium (mặc định), Firefox, WebKit (Safari)
- **Thiết bị:** Desktop, iPhone 15/14/SE, Pixel 7/5, Galaxy S24/S9, iPad Pro/Mini...
- **Clone:** Nhấn nút **Clone** để tạo bản sao test case
- **Xuất Excel:** Nhấn **Xuất Excel** để tải tất cả test case về file .xlsx

---

## 6. Data-Driven Testing — Kiểm thử theo dữ liệu

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

## 7. Live Monitor — Theo dõi thực thi

**Menu:** Sidebar → **Live Monitor**

### Bắt đầu chạy test
1. Chọn **Dự án** (tùy chọn — để lọc)
2. Chọn **Test Suite** cần chạy
3. **Tick chọn** các Test Case muốn chạy (mặc định chọn tất cả)
4. Cấu hình tùy chọn chạy (nếu cần):

| Tùy chọn | Mô tả | Giá trị |
|-----------|--------|---------|
| **Chạy tiếp khi fail** | Không dừng khi gặp test case fail | Bật/Tắt |
| **Retry** | Số lần thử lại khi fail | 0 - 3 |
| **Song song** | Số test case chạy đồng thời | 1 - 10 |

5. Nhấn **▶ Bắt đầu chạy**

### Trong khi chạy
- **Thanh tiến độ:** Hiển thị số test case đã xong / tổng
- **Kết quả real-time:** Từng test case hiển thị kết quả ngay khi chạy xong
- **Chi tiết từng bước:** Action, selector, thời gian, ảnh chụp
- **Nút điều khiển:**
  - ⏸️ **Tạm dừng** — dừng tạm, giữ trạng thái
  - ▶ **Tiếp tục** — chạy lại sau khi tạm dừng
  - ⏹️ **Hủy** — dừng hoàn toàn

### Sau khi chạy xong
- **Bảng tổng kết:** Tổng / Passed / Failed / Tỉ lệ Pass
- **Xuất báo cáo:** HTML hoặc PDF
- **Xem ảnh chụp:** Click vào thumbnail để phóng to
- **Xem video:** Click link 🎬 Video để xem quá trình chạy

---

## 8. Lịch sử các lần chạy

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
| **HTML / PDF** | Xuất báo cáo |
| **Export Failed** | Chỉ xuất các test case fail |
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

## 9. Visual Regression — So sánh giao diện

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

## 10. Tạo Test Case bằng AI

**Menu:** Sidebar → **Tạo TC bằng AI**

> **Yêu cầu:** Cấu hình biến môi trường `GEMINI_API_KEY` trên server

### Quy trình 3 bước

**Bước 1: Nhập thông tin**
1. Upload **ảnh chụp giao diện** (kéo thả hoặc click — hỗ trợ nhiều ảnh)
2. Nhập **URL trang web** (AI sẽ tự truy cập và phân tích)
3. Viết **mô tả** chức năng cần kiểm thử
4. Chọn **Test Suite** để lưu kết quả
5. Nhấn **Tạo Test Case bằng AI**

**Bước 2: AI xử lý**
- Hệ thống phân tích ảnh, truy cập URL, gửi đến AI
- Thời gian: 15-60 giây tùy độ phức tạp

**Bước 3: Xem lại và lưu**
1. Chỉnh sửa **tiêu đề** test case
2. Xem danh sách các bước AI đã tạo
3. Có thể **sửa / xóa / thêm / sắp xếp** bước
4. Nếu cần thay đổi, nhập yêu cầu vào ô **AI Refinement** và nhấn gửi
5. Nhấn **Lưu Test Case**

---

## 11. Record & Replay — Ghi và phát lại

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

## 12. Kiểm tra UI (UI Checker V3)

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

## 13. Xuất báo cáo

Hệ thống hỗ trợ xuất báo cáo ở nhiều nơi:

### Báo cáo Test Run
- **Từ Live Monitor:** Sau khi chạy xong → nhấn **📄 HTML** hoặc **📋 PDF**
- **Từ Lịch sử chạy:** Nhấn **HTML** hoặc **PDF** trên mỗi lần chạy
- **Chỉ test case fail:** Nhấn **Export Failed** để chỉ xuất kết quả fail

### Báo cáo UI Checker
- Từ tab **Lịch sử** trong UI Checker → nhấn **HTML** hoặc **PDF**

### Nội dung báo cáo
- Thông tin lần chạy (ID, Suite, thời gian, người chạy)
- Tổng kết: Total / Passed / Failed / Tỉ lệ
- Chi tiết từng test case:
  - Trạng thái, thời gian chạy
  - Từng bước: action, selector, kết quả, thời gian
  - Ảnh chụp mỗi bước
  - Thông báo lỗi (nếu fail)

---

## Mẹo sử dụng

1. **Bắt đầu nhanh:** Dùng **Nhập ngôn ngữ tự nhiên** hoặc **AI Generator** để tạo test case nhanh mà không cần biết CSS selector
2. **Record & Replay:** Dùng khi bạn muốn tạo test case bằng cách thao tác trực tiếp trên trình duyệt
3. **Data-Driven:** Dùng khi cần test cùng một luồng với nhiều bộ dữ liệu (đăng nhập, đăng ký, tìm kiếm...)
4. **Visual Regression:** Lưu baseline sau khi giao diện ổn định, so sánh sau mỗi lần cập nhật code
5. **Continue on Failure + Retry:** Bật khi chạy regression test để không bỏ sót case nào
6. **Parallel execution:** Tăng số song song (2-5) để chạy nhanh hơn khi có nhiều test case
7. **UI Checker:** Chạy trước khi release để phát hiện lỗi responsive, accessibility, SEO

---

## Yêu cầu hệ thống

| Thành phần | Yêu cầu |
|------------|---------|
| **Node.js** | v18 trở lên |
| **Trình duyệt** | Chrome, Firefox, hoặc Edge (bản mới nhất) |
| **RAM** | Tối thiểu 4GB (khuyến nghị 8GB cho chạy song song) |
| **AI Generator** | Cần cấu hình `GEMINI_API_KEY` trong biến môi trường |

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

*AutoTest Tool — Web Automation Testing Platform v1.0*
