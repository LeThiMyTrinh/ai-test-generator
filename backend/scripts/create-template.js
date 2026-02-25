/**
 * Script to generate the testcase_template.xlsx file
 * Run: npm run create-template
 * 
 * Template đơn giản cho QC/BA: chỉ cần nhập ngôn ngữ tự nhiên ở cột "buoc_thuc_hien"
 */
const XLSX = require('xlsx');
const path = require('path');

const OUTPUT = path.join(__dirname, '../src/templates/testcase_template.xlsx');

const wb = XLSX.utils.book_new();

// ===== Sheet 1: TestCases (simplified for QC/BA) =====
const headers = ['tc_id', 'tieu_de', 'url', 'trinh_duyet', 'thiet_bi', 'buoc_thuc_hien'];

const data = [
    headers,
    // TC-001 - Đăng nhập thành công (Desktop)
    ['TC-001', 'Đăng nhập thành công', 'https://example.com/login', 'chromium', '', 'Mở trang https://example.com/login'],
    ['TC-001', '', '', '', '', 'Nhập "user@test.com" vào ô Email'],
    ['TC-001', '', '', '', '', 'Nhập "password123" vào ô Mật khẩu'],
    ['TC-001', '', '', '', '', 'Nhấn nút "Đăng nhập"'],
    ['TC-001', '', '', '', '', 'Kiểm tra URL chứa /dashboard'],
    ['TC-001', '', '', '', '', 'Chụp ảnh màn hình'],
    // TC-002 - Kiểm tra trang chủ trên iPhone 15
    ['TC-002', 'Kiểm tra trang chủ (Mobile)', 'https://example.com', 'webkit', 'iphone-15', 'Mở trang https://example.com'],
    ['TC-002', '', '', '', '', 'Kiểm tra phần tử h1 hiển thị'],
    ['TC-002', '', '', '', '', 'Chờ 2 giây'],
    ['TC-002', '', '', '', '', 'Chụp ảnh màn hình'],
];

const ws = XLSX.utils.aoa_to_sheet(data);
ws['!cols'] = [
    { wch: 10 }, { wch: 30 }, { wch: 35 }, { wch: 12 }, { wch: 14 }, { wch: 50 }
];

// ===== Sheet 2: Hướng dẫn =====
const guideData = [
    ['HƯỚNG DẪN SỬ DỤNG FILE MẪU'],
    [''],
    ['Cột', 'Mô tả', 'Bắt buộc?'],
    ['tc_id', 'Mã test case (VD: TC-001). Các dòng cùng tc_id = cùng 1 test case', 'Có'],
    ['tieu_de', 'Tiêu đề test case (chỉ cần ghi ở dòng đầu tiên của mỗi TC)', 'Có (dòng đầu)'],
    ['url', 'URL trang cần test (chỉ cần ghi ở dòng đầu tiên)', 'Có (dòng đầu)'],
    ['trinh_duyet', 'chromium / firefox / webkit (mặc định: chromium)', 'Không'],
    ['thiet_bi', 'Thiết bị mobile (xem danh sách bên dưới). Để trống = Desktop', 'Không'],
    ['buoc_thuc_hien', 'Mô tả bước bằng ngôn ngữ tự nhiên', 'Có'],
    [''],
    ['CÁC MẪU CÂU HỖ TRỢ:'],
    ['Hành động', 'Cách viết', 'Ví dụ'],
    ['Mở trang', 'Mở trang <URL>', 'Mở trang https://example.com'],
    ['Nhập liệu', 'Nhập "<giá trị>" vào ô <tên trường>', 'Nhập "admin" vào ô Email'],
    ['Nhấn nút', 'Nhấn nút "<tên nút>"', 'Nhấn nút "Đăng nhập"'],
    ['Click link', 'Click vào link "<text>"', 'Click vào link "Quên mật khẩu"'],
    ['Chọn dropdown', 'Chọn "<giá trị>" trong dropdown <tên>', 'Chọn "VN" trong dropdown Quốc gia'],
    ['Kiểm tra text', 'Kiểm tra text "<text>" hiển thị', 'Kiểm tra text "Xin chào" hiển thị'],
    ['Kiểm tra URL', 'Kiểm tra URL chứa <path>', 'Kiểm tra URL chứa /dashboard'],
    ['Kiểm tra hiển thị', 'Kiểm tra phần tử <selector> hiển thị', 'Kiểm tra phần tử #header hiển thị'],
    ['Chờ', 'Chờ <N> giây', 'Chờ 3 giây'],
    ['Chụp ảnh', 'Chụp ảnh màn hình', 'Chụp ảnh màn hình'],
    ['Di chuột', 'Di chuột vào <phần tử>', 'Di chuột vào menu "Sản phẩm"'],
    [''],
    ['LƯU Ý:'],
    ['- Mỗi dòng = 1 bước thực hiện'],
    ['- Các dòng cùng tc_id thuộc cùng 1 test case'],
    ['- Cột tieu_de, url, trinh_duyet, thiet_bi chỉ cần ghi ở dòng đầu tiên của mỗi test case'],
    ['- Nếu biết CSS selector, có thể dùng trực tiếp: Nhấn vào #submit-btn'],
    [''],
    ['GIÁ TRỊ HỢP LỆ cho cột thiet_bi:'],
    ['', 'iphone-15', 'iPhone 15 (390×844)'],
    ['', 'iphone-15-pro', 'iPhone 15 Pro (393×852)'],
    ['', 'iphone-14', 'iPhone 14 (390×844)'],
    ['', 'iphone-13', 'iPhone 13 (390×844)'],
    ['', 'iphone-12', 'iPhone 12 (390×844)'],
    ['', 'iphone-se', 'iPhone SE (375×667)'],
    ['', 'pixel-7', 'Pixel 7 (412×915)'],
    ['', 'pixel-5', 'Pixel 5 (393×851)'],
    ['', 'galaxy-s23', 'Galaxy S23 (360×780)'],
    ['', 'galaxy-s9', 'Galaxy S9+ (320×658)'],
    ['', 'ipad-pro', 'iPad Pro 11 (834×1194)'],
    ['', 'ipad-mini', 'iPad Mini (768×1024)'],
    ['', 'galaxy-tab', 'Galaxy Tab S4 (712×1138)'],
    ['', '(để trống)', 'Desktop 1920×1080 (mặc định)'],
];

const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
wsGuide['!cols'] = [
    { wch: 18 }, { wch: 55 }, { wch: 45 }
];

XLSX.utils.book_append_sheet(wb, ws, 'TestCases');
XLSX.utils.book_append_sheet(wb, wsGuide, 'Huong_dan');
XLSX.writeFile(wb, OUTPUT);
console.log('✅ Template created:', OUTPUT);
