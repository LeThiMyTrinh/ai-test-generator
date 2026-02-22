// Quick test of NLStepParser
const NLStepParser = require('./src/parser/NLStepParser');
const parser = new NLStepParser();

const text = `Mở trang https://example.com/login
Nhập "admin@test.com" vào ô Email
Nhập "123456" vào ô Mật khẩu
Nhấn nút "Đăng nhập"
Kiểm tra URL chứa /dashboard
Kiểm tra text "Xin chào" hiển thị
Chờ 2 giây
Chụp ảnh màn hình`;

const result = parser.parse(text);

console.log('=== STEPS ===');
result.steps.forEach(s => {
    console.log(`  ${s.step_id}. [${s.action}] ${s.description}`);
    if (s.selector) console.log(`     selector: ${s.selector}`);
    if (s.value) console.log(`     value: ${s.value}`);
    if (s.expected) console.log(`     expected: ${s.expected}`);
});

console.log(`\n=== WARNINGS (${result.warnings.length}) ===`);
result.warnings.forEach(w => {
    console.log(`  Line ${w.line}: "${w.text}" => ${w.message}`);
});

console.log(`\n=== SUMMARY: ${result.steps.length} steps parsed, ${result.warnings.length} warnings ===`);
process.exit(result.warnings.length > 0 ? 1 : 0);
