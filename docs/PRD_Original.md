# 📋 Product Requirements Document (PRD)
## Công cụ Kiểm thử Web Tự động (Web Automation Testing Tool)

> **Phiên bản:** 1.0 | **Ngày:** 21/02/2026 | **Trạng thái:** Draft

---

## 1. Tổng quan Sản phẩm

### 1.1. Tầm nhìn (Vision)
Xây dựng một nền tảng kiểm thử tự động trên nền web giúp **Tester và QA Engineer** có thể tạo, chạy và theo dõi các kịch bản kiểm thử (test case) trên bất kỳ trang web nào chỉ bằng cách nhập URL và định nghĩa các bước hành động — mà **không cần viết mã lập trình phức tạp**.

### 1.2. Giá trị cốt lõi
| Vấn đề hiện tại | Giải pháp của sản phẩm |
|---|---|
| Viết test automation đòi hỏi kỹ năng lập trình cao | Giao diện nhập liệu trực quan, dạng form/bảng dễ điền |
| Thu thập bằng chứng (screenshot, video) tốn thời gian | Tự động chụp ảnh, quay video tại từng bước |
| Báo cáo kết quả khó đọc, phải lắp ghép thủ công | Xuất báo cáo HTML/PDF đẹp mắt, có ảnh kèm theo |
| Khó theo dõi lịch sử kiểm thử | Lưu lịch sử tất cả các lần chạy, hỗ trợ CI/CD |

---

## 2. Mục tiêu (Objectives & Key Results)

### Mục tiêu 1: Đơn giản hóa việc tạo test case
- Người dùng không có kỹ năng code có thể tạo test case trong < 5 phút
- Hỗ trợ Import từ file JSON/CSV để tái sử dụng kịch bản

### Mục tiêu 2: Thực thi đáng tin cậy
- Hỗ trợ đa trình duyệt: Chromium, Firefox, Webkit (Safari)
- Tỉ lệ "flaky test" (kết quả không ổn định) < 5%
- Thực thi song song để rút ngắn thời gian test

### Mục tiêu 3: Bằng chứng minh bạch
- 100% các lần chạy đều có screenshot và log đính kèm
- Video quay toàn bộ quá trình khi có lỗi

### Mục tiêu 4: Báo cáo chuyên nghiệp
- Báo cáo HTML xuất ra trong < 30 giây sau khi hoàn thành test
- Hỗ trợ chia sẻ báo cáo qua file PDF

---

## 3. Đối tượng Người dùng (User Personas)

### Persona 1: Tester thủ công đang chuyển đổi
- **Kỹ năng:** Biết dùng Excel, không biết viết code
- **Nhu cầu:** Tự động hóa các test case lặp đi lặp lại (regression test)
- **Nỗi đau:** Phải nhờ developer viết script, chờ đợi mất thời gian

### Persona 2: QA Engineer kinh nghiệm
- **Kỹ năng:** Biết lập trình Python/JS cơ bản
- **Nhu cầu:** Chạy nhanh nhiều kịch bản và tích hợp vào Jenkins/GitLab CI
- **Nỗi đau:** Công cụ hiện tại không có báo cáo đẹp để trình bày với PM/Client

### Persona 3: Project Manager / BA
- **Kỹ năng:** Không có kỹ năng kỹ thuật
- **Nhu cầu:** Xem Dashboard tổng quan để đánh giá chất lượng sản phẩm
- **Nỗi đau:** Không hiểu báo cáo kỹ thuật, cần thông tin đơn giản dạng biểu đồ

---

## 4. Yêu cầu Chức năng (Functional Requirements)

### 4.1. Module Quản lý Test Case

| ID | Tính năng | Mô tả | Ưu tiên |
|---|---|---|---|
| F-01 | Tạo Test Suite | Nhóm nhiều Test Case vào một bộ test | Cao |
| F-02 | Tạo Test Case (nhập tay) | Điền tiêu đề, mô tả, URL mục tiêu và các bước trực tiếp trên màn hình | Cao |
| F-03 | Thêm/xóa/sửa bước | Định nghĩa từng Action tuần tự trên giao diện | Cao |
| F-04 | Upload Excel | Tải lên file Excel theo mẫu để tạo hàng loạt test case; hệ thống cung cấp file mẫu để tải về | Cao |

**Các Action được hỗ trợ trong một bước:**

| Action | Mô tả | Tham số |
|---|---|---|
| `navigate` | Điều hướng tới URL | `url` |
| `click` | Click vào phần tử | `selector` |
| `fill` | Nhập văn bản vào ô input | `selector`, `value` |
| `select` | Chọn option trong dropdown | `selector`, `value` |
| `hover` | Rê chuột lên phần tử | `selector` |
| `assert_text` | Kiểm tra nội dung văn bản | `selector`, `expected_text` |
| `assert_visible` | Kiểm tra phần tử có hiện không | `selector` |
| `assert_url` | Kiểm tra URL hiện tại | `expected_url` |
| `wait` | Chờ một khoảng thời gian | `milliseconds` |
| `screenshot` | Chụp ảnh tại bước này (thủ công) | _(không cần)_ |

### 4.2. Module Thực thi Kiểm thử

| ID | Tính năng | Mô tả | Ưu tiên |
|---|---|---|---|
| F-10 | Chạy một Test Case | Chạy đơn lẻ một kịch bản | Cao |
| F-11 | Chạy một Test Suite | Chạy toàn bộ kịch bản trong nhóm | Cao |
| F-12 | Chọn trình duyệt | Chạy trên Chromium, Firefox, hoặc Webkit | Cao |
| F-13 | Xem tiến độ Real-time | Thấy bước nào đang chạy, bước nào qua/fail | Cao |

### 4.3. Module Thu thập Bằng chứng (Evidence)

| ID | Tính năng | Mô tả | Ưu tiên |
|---|---|---|---|
| F-20 | Auto Screenshot | Chụp ảnh tự động sau mỗi bước | Cao |
| F-21 | Screenshot khi lỗi | Chụp ảnh ngay khi bước bị fail | Cao |
| F-22 | Video Recording | Quay video toàn bộ session chạy | Cao |
| F-23 | Lưu trữ Evidence | Tổ chức bằng chứng theo Test Case / Lần chạy | Cao |

### 4.4. Module Báo cáo (Reporting)

| ID | Tính năng | Mô tả | Ưu tiên |
|---|---|---|---|
| F-30 | Dashboard Tổng quan | Biểu đồ Pass/Fail, tổng số test, thời gian | Cao |
| F-31 | Chi tiết Test Case | Từng bước, trạng thái, ảnh, thông báo lỗi | Cao |
| F-32 | Export HTML Report | Báo cáo tương tác hoàn chỉnh | Cao |
| F-33 | Export PDF Report | Báo cáo tĩnh để gửi qua email | Trung bình |
| F-34 | Lịch sử các lần chạy | Danh sách tất cả các lần chạy trước đây | Trung bình |

---

## 5. Cấu trúc Dữ liệu (Data Models)

### 5.1. Test Suite
```json
{
  "id": "SUITE-001",
  "name": "Kiểm thử chức năng Đăng nhập",
  "description": "Bộ test toàn diện cho trang đăng nhập",
  "created_at": "2026-02-21T09:00:00Z",
  "test_cases": ["TC-001", "TC-002", "TC-003"]
}
```

### 5.2. Test Case
```json
{
  "id": "TC-001",
  "suite_id": "SUITE-001",
  "title": "Đăng nhập thành công với thông tin hợp lệ",
  "description": "Xác nhận người dùng có thể đăng nhập với email và mật khẩu đúng",
  "url": "https://example.com/login",
  "browser": "chromium",
  "headless": true,
  "steps": [
    {
      "step_id": 1,
      "action": "navigate",
      "url": "https://example.com/login",
      "description": "Mở trang đăng nhập"
    },
    {
      "step_id": 2,
      "action": "fill",
      "selector": "#email",
      "value": "user@example.com",
      "description": "Nhập địa chỉ email"
    },
    {
      "step_id": 3,
      "action": "fill",
      "selector": "#password",
      "value": "password123",
      "description": "Nhập mật khẩu"
    },
    {
      "step_id": 4,
      "action": "click",
      "selector": "button[type='submit']",
      "description": "Nhấn nút Đăng nhập"
    },
    {
      "step_id": 5,
      "action": "assert_url",
      "expected_url": "https://example.com/dashboard",
      "description": "Kiểm tra chuyển hướng thành công về Dashboard"
    }
  ]
}
```

### 5.3. Test Run (Kết quả một lần chạy)
```json
{
  "run_id": "RUN-20260221-001",
  "suite_id": "SUITE-001",
  "started_at": "2026-02-21T09:30:00Z",
  "finished_at": "2026-02-21T09:32:45Z",
  "duration_ms": 165000,
  "environment": {
    "browser": "chromium",
    "os": "Windows 11",
    "viewport": "1280x720"
  },
  "summary": {
    "total": 3,
    "passed": 2,
    "failed": 1,
    "skipped": 0
  },
  "results": [
    {
      "test_case_id": "TC-001",
      "status": "PASSED",
      "duration_ms": 8200,
      "steps": [
        {
          "step_id": 1,
          "status": "PASSED",
          "timestamp": "2026-02-21T09:30:01Z",
          "screenshot": "evidence/RUN-001/TC-001/step-1.png"
        }
      ],
      "evidence": {
        "screenshots": ["evidence/RUN-001/TC-001/step-1.png"],
        "video": "evidence/RUN-001/TC-001/video.mp4",
        "console_log": "evidence/RUN-001/TC-001/console.log",
        "network_log": "evidence/RUN-001/TC-001/network.har"
      }
    }
  ]
}
```

---

## 6. Yêu cầu Phi chức năng (Non-Functional Requirements)

| Loại | Yêu cầu |
|---|---|
| **Hiệu năng** | Thực thi song song tối thiểu 5 test case cùng lúc |
| **Độ tin cậy** | Timeout thông minh, tự retry khi element chưa load (tối đa 3 lần) |
| **Khả năng mở rộng** | Hỗ trợ tối thiểu 100 test case trong một Suite |
| **Bảo mật** | Giá trị nhạy cảm (mật khẩu) được che trong log và báo cáo |
| **Giao diện** | Responsive, tương thích với màn hình 1280px trở lên |
| **Tích hợp CI/CD** | Hỗ trợ gọi qua CLI (`node run.js`) để tích hợp Jenkins/GitLab |

---

## 7. Giao diện Người dùng (UI - Mô tả Wireframe)

### 7.1. Trang Dashboard
- **Header**: Logo, điều hướng (Dashboard / Test Cases / History)
- **KPI Cards**: Tổng test | Đã pass | Đã fail | Tỉ lệ pass (%)
- **Biểu đồ**: Pie chart Pass/Fail và Line chart lịch sử theo ngày
- **Danh sách Test Suite**: Tên, số test case, lần chạy gần nhất

### 7.2. Trang Tạo/Chỉnh sửa Test Case
- Form nhập: Tên kịch bản, Mô tả, URL mục tiêu, Chọn trình duyệt
- Bảng steps: Mỗi hàng là một bước, có thể kéo thả để sắp xếp lại
- Nút hành động: "Thêm bước" / "Chạy thử" / "Lưu" / "Import JSON"

### 7.3. Trang Theo dõi Thực thi (Live Monitor)
- Danh sách test case với màu sắc trạng thái: Đang chạy / Pass / Fail
- Progress bar tổng thể
- Log hiển thị real-time từng bước đang thực hiện

### 7.4. Trang Kết quả / Báo cáo
- Tóm tắt: Tổng test, Pass/Fail, Thời gian chạy
- Accordion từng test case: Click để xem chi tiết các bước
- Xem ảnh minh chứng (lightbox) ngay trên trang
- Nút xuất: "Xuất HTML" / "Xuất PDF"
