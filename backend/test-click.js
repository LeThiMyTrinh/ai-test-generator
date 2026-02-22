const NLStepParser = require('./src/parser/NLStepParser');
const p = new NLStepParser();

console.log('=== Test: Nhan nut ===');
const r1 = p.parseLine('Nhấn nút "Đăng nhập"');
console.log(JSON.stringify(r1, null, 2));

console.log('\n=== Test: Click link ===');
const r2 = p.parseLine('Click vào link "Quên mật khẩu"');
console.log(JSON.stringify(r2, null, 2));

console.log('\n=== Test: Bam nut (no quotes) ===');
const r3 = p.parseLine('Bấm nút Đăng ký');
console.log(JSON.stringify(r3, null, 2));

console.log('\n=== Test: Click generic ===');
const r4 = p.parseLine('Click vào #submit-btn');
console.log(JSON.stringify(r4, null, 2));
