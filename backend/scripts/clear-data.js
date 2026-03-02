const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

if (!fs.existsSync(DATA_DIR)) {
    console.log('Thư mục data/ không tồn tại. Không cần xóa.');
    process.exit(0);
}

const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.db'));

if (files.length === 0) {
    console.log('Không có file .db nào trong data/');
    process.exit(0);
}

console.log(`Sẽ xóa ${files.length} file:`, files.join(', '));
files.forEach(f => {
    fs.unlinkSync(path.join(DATA_DIR, f));
    console.log(`  ✅ Đã xóa: ${f}`);
});

console.log('\n🧹 Đã xóa sạch dữ liệu. Khởi động lại server để seed tài khoản admin.');
