# ♿ Hướng dẫn chi tiết về Lỗi Trợ năng (Accessibility Issues)

## 📚 Tổng quan

**Accessibility (A11y)** là khả năng truy cập của website đối với **tất cả mọi người**, đặc biệt là người khuyết tật:
- 👁️ Người khiếm thị (dùng trình đọc màn hình - Screen reader)
- 🦻 Người khiếm thính (cần phụ đề video)
- ♿ Người khuyết tật vận động (chỉ dùng bàn phím, không dùng chuột)
- 🧠 Người suy giảm nhận thức (cần nội dung đơn giản, rõ ràng)

### Tại sao quan trọng?
1. **Pháp lý**: Nhiều nước yêu cầu website phải tuân thủ **WCAG** (Web Content Accessibility Guidelines)
2. **Đạo đức**: 15% dân số thế giới có khuyết tật, họ có quyền truy cập thông tin
3. **SEO**: Google ưu tiên các website có accessibility tốt
4. **Trải nghiệm tốt hơn**: Accessibility tốt → UX tốt cho tất cả mọi người

---

## 🔍 Khi nào xuất hiện lỗi Accessibility?

Hệ thống **UI Checker** sử dụng **axe-core** (công cụ kiểm tra accessibility của Deque) để quét trang web. Dưới đây là các lỗi phổ biến:

---

## 📋 CÁC LOẠI LỖI TRUY CẬP PHỔ BIẾN

### 1. 🎨 **Lỗi độ tương phản màu (Color Contrast)**

#### ❓ Khi nào xuất hiện?
Khi **tỷ lệ tương phản** giữa màu chữ và màu nền **quá thấp**, khiến chữ khó đọc.

#### 📏 Tiêu chuẩn WCAG:
- **Text thường** (< 18px): Tỷ lệ tương phản ≥ **4.5:1**
- **Text lớn** (≥ 18px hoặc ≥ 14px bold): Tỷ lệ tương phản ≥ **3:1**

#### 🔴 Ví dụ sai:
```html
<!-- Bad: Chữ xám nhạt (#999) trên nền trắng (#fff) = 2.8:1 (quá thấp!) -->
<p style="color: #999999; background: #ffffff;">
  Chữ này rất khó đọc với người có vấn đề về thị lực
</p>
```

#### ✅ Ví dụ đúng:
```html
<!-- Good: Chữ xám đậm (#333) trên nền trắng (#fff) = 12.6:1 -->
<p style="color: #333333; background: #ffffff;">
  Chữ này dễ đọc hơn nhiều!
</p>
```

#### 👥 Ảnh hưởng:
- Người khiếm thị một phần không đọc được nội dung
- Người già có thị lực kém gặp khó khăn
- Người xem màn hình dưới ánh sáng mặt trời không thấy rõ

#### 🛠️ Cách fix:
```css
/* Dùng tool check contrast: https://webaim.org/resources/contrastchecker/ */

/* Bad */
.text {
  color: #999;
  background: #ccc;
}

/* Good */
.text {
  color: #333;
  background: #fff;
}

/* Hoặc */
.text {
  color: #fff;
  background: #0066cc;
}
```

---

### 2. 🖼️ **Lỗi ảnh thiếu alt text (Missing Alt Text)**

#### ❓ Khi nào xuất hiện?
Khi thẻ `<img>` **không có** hoặc có **alt rỗng** (`alt=""`) mà ảnh lại mang ý nghĩa quan trọng.

#### 🔴 Ví dụ sai:
```html
<!-- Bad: Không có alt -->
<img src="product.jpg">

<!-- Bad: Alt rỗng cho ảnh quan trọng -->
<img src="buy-now-button.jpg" alt="">
```

#### ✅ Ví dụ đúng:
```html
<!-- Good: Alt mô tả rõ ràng -->
<img src="product.jpg" alt="iPhone 15 Pro màu titan tự nhiên">

<!-- Good: Alt rỗng CHỈ cho ảnh decorative -->
<img src="decorative-line.svg" alt="" role="presentation">
```

#### 👥 Ảnh hưởng:
- **Screen reader** đọc "Image" hoặc "button.jpg" → Người dùng không biết ảnh là gì
- **SEO**: Google không hiểu nội dung ảnh
- Khi ảnh không load, người dùng không biết ảnh nên hiển thị gì

#### 🛠️ Cách fix:
```html
<!-- Quy tắc viết alt text tốt -->

<!-- 1. Mô tả ngắn gọn, đủ nghĩa -->
<img src="dog.jpg" alt="Chó Golden Retriever đang chạy trên bãi cỏ">

<!-- 2. Không viết "Ảnh của..." hay "Hình..." (screen reader tự nói "Image") -->
<!-- Bad -->
<img src="logo.png" alt="Ảnh logo công ty ABC">
<!-- Good -->
<img src="logo.png" alt="Logo công ty ABC">

<!-- 3. Nếu ảnh là link, mô tả đích đến -->
<a href="/products">
  <img src="shop-icon.png" alt="Xem danh sách sản phẩm">
</a>

<!-- 4. Nếu ảnh decorative (không quan trọng), dùng alt rỗng -->
<img src="border-decoration.svg" alt="" role="presentation">
```

---

### 3. 🏷️ **Lỗi form input thiếu label (Form Missing Label)**

#### ❓ Khi nào xuất hiện?
Khi **form input** (input, select, textarea) không có `<label>` hoặc không có `aria-label`.

#### 🔴 Ví dụ sai:
```html
<!-- Bad: Không có label -->
<input type="text" placeholder="Nhập email">

<!-- Bad: Label không liên kết với input -->
<label>Email</label>
<input type="text" id="email">
```

#### ✅ Ví dụ đúng:
```html
<!-- Good: Dùng for và id -->
<label for="email">Email</label>
<input type="text" id="email" name="email">

<!-- Good: Wrap input trong label -->
<label>
  Email
  <input type="email" name="email">
</label>

<!-- Good: Dùng aria-label nếu không muốn hiện label -->
<input type="search" aria-label="Tìm kiếm sản phẩm" placeholder="Tìm kiếm...">
```

#### 👥 Ảnh hưởng:
- Screen reader không biết field này để nhập gì
- Người dùng bàn phím không click được vào label để focus input
- Trải nghiệm mobile kém (không thể tap vào label)

---

### 4. 📑 **Lỗi cấu trúc heading sai (Heading Structure)**

#### ❓ Khi nào xuất hiện?
Khi thứ tự heading bị **nhảy cóc** (ví dụ: h1 → h3, bỏ qua h2).

#### 🔴 Ví dụ sai:
```html
<!-- Bad: Nhảy từ h1 sang h3 -->
<h1>Trang chủ</h1>
<h3>Giới thiệu</h3> <!-- Sai! Phải là h2 -->
<h4>Lịch sử</h4>
```

#### ✅ Ví dụ đúng:
```html
<!-- Good: Thứ tự đúng -->
<h1>Trang chủ</h1>
<h2>Giới thiệu</h2>
<h3>Lịch sử</h3>
<h3>Tầm nhìn</h3>
<h2>Sản phẩm</h2>
```

#### 👥 Ảnh hưởng:
- Screen reader dùng heading để **điều hướng nhanh** trong trang
- SEO: Google dùng heading để hiểu cấu trúc nội dung
- Người dùng nhảy từ heading này sang heading khác → Nếu sai thứ tự sẽ bị lạc

#### 🛠️ Quy tắc:
1. Mỗi trang **chỉ có 1 thẻ h1** (tiêu đề chính)
2. Không được **nhảy cấp** (h1 → h2 → h3, không được h1 → h3)
3. Có thể có **nhiều heading cùng cấp** (h2, h2, h2 là OK)

---

### 5. ⌨️ **Lỗi không focus được bằng bàn phím (Keyboard Focus)**

#### ❓ Khi nào xuất hiện?
Khi các **element tương tác** (button, link, input) không thể focus bằng **Tab** key.

#### 🔴 Ví dụ sai:
```html
<!-- Bad: Dùng div làm button, không focus được -->
<div onclick="submitForm()">Gửi đi</div>

<!-- Bad: Ẩn focus outline -->
<style>
  button:focus { outline: none; } /* Sai! */
</style>
```

#### ✅ Ví dụ đúng:
```html
<!-- Good: Dùng button thật -->
<button onclick="submitForm()">Gửi đi</button>

<!-- Good: Nếu bắt buộc dùng div, thêm tabindex và role -->
<div role="button" tabindex="0" onclick="submitForm()">Gửi đi</div>

<!-- Good: Focus outline rõ ràng -->
<style>
  button:focus {
    outline: 2px solid #0066cc;
    outline-offset: 2px;
  }
</style>
```

#### 👥 Ảnh hưởng:
- Người không dùng chuột (khuyết tật vận động) **không thể tương tác**
- Người dùng bàn phím chuyên nghiệp (developer, power user) bị chậm lại
- Screen reader không nhận diện được element có thể click

---

### 6. 🌍 **Lỗi thiếu khai báo ngôn ngữ (Missing Lang Attribute)**

#### ❓ Khi nào xuất hiện?
Khi thẻ `<html>` không có thuộc tính `lang`.

#### 🔴 Ví dụ sai:
```html
<!-- Bad: Không có lang -->
<!DOCTYPE html>
<html>
<head>...</head>
<body>...</body>
</html>
```

#### ✅ Ví dụ đúng:
```html
<!-- Good: Khai báo ngôn ngữ -->
<!DOCTYPE html>
<html lang="vi">
<head>...</head>
<body>...</body>
</html>

<!-- Nếu có đa ngôn ngữ -->
<html lang="en">
  <body>
    <p>Welcome!</p>
    <p lang="vi">Chào mừng!</p>
  </body>
</html>
```

#### 👥 Ảnh hưởng:
- Screen reader không biết dùng **giọng đọc ngôn ngữ nào** → Đọc sai
- Trình dịch tự động không hoạt động tốt
- SEO: Google không biết trang này ngôn ngữ gì

---

### 7. 🧭 **Lỗi thiếu ARIA Landmark (Missing Landmarks)**

#### ❓ Khi nào xuất hiện?
Khi trang không có các **vùng cấu trúc** như header, nav, main, footer.

#### 🔴 Ví dụ sai:
```html
<!-- Bad: Toàn bộ dùng div -->
<div class="header">Logo</div>
<div class="nav">Menu</div>
<div class="content">Nội dung</div>
<div class="footer">Footer</div>
```

#### ✅ Ví dụ đúng:
```html
<!-- Good: Dùng semantic HTML5 -->
<header>
  <img src="logo.png" alt="Logo">
</header>

<nav>
  <ul>
    <li><a href="/">Trang chủ</a></li>
    <li><a href="/about">Giới thiệu</a></li>
  </ul>
</nav>

<main>
  <h1>Nội dung chính</h1>
  <p>...</p>
</main>

<footer>
  <p>&copy; 2024 Company</p>
</footer>

<!-- Hoặc dùng ARIA role -->
<div role="banner">Header</div>
<div role="navigation">Menu</div>
<div role="main">Nội dung</div>
<div role="contentinfo">Footer</div>
```

#### 👥 Ảnh hưởng:
- Screen reader dùng landmark để **nhảy nhanh** giữa các vùng
- Người dùng không thể nhanh chóng đến phần nội dung chính
- Trải nghiệm điều hướng kém

---

### 8. 🔢 **Lỗi thứ tự tabindex sai (Tabindex Issue)**

#### ❓ Khi nào xuất hiện?
Khi dùng `tabindex` với **giá trị dương** (1, 2, 3...) hoặc tabindex không hợp lý.

#### 🔴 Ví dụ sai:
```html
<!-- Bad: Dùng tabindex dương, phá vỡ thứ tự tự nhiên -->
<button tabindex="3">Button 1</button>
<button tabindex="1">Button 2</button> <!-- Focus vào đây trước -->
<button tabindex="2">Button 3</button>
```

#### ✅ Ví dụ đúng:
```html
<!-- Good: Để trình duyệt tự động quản lý tab order -->
<button>Button 1</button>
<button>Button 2</button>
<button>Button 3</button>

<!-- Good: Chỉ dùng tabindex="0" để thêm element vào tab order -->
<div role="button" tabindex="0">Custom Button</div>

<!-- Good: Dùng tabindex="-1" để loại khỏi tab order nhưng vẫn focus được bằng JS -->
<div tabindex="-1" id="error-message">Lỗi: ...</div>
```

#### 👥 Ảnh hưởng:
- Thứ tự tab **hỗn loạn**, người dùng bàn phím bị lạc
- Screen reader điều hướng không đúng logic
- Trải nghiệm form filling kém

---

## 🎯 TÓM TẮT: Khi nào lỗi Accessibility xuất hiện?

| Lỗi | Khi nào xuất hiện | Ảnh hưởng chính |
|-----|-------------------|-----------------|
| **Color Contrast** | Tỷ lệ tương phản < 4.5:1 (text) hoặc < 3:1 (text lớn) | Người khiếm thị không đọc được |
| **Missing Alt** | `<img>` không có alt hoặc alt không đúng nghĩa | Screen reader không mô tả được ảnh |
| **Form Missing Label** | Input không có `<label>` hoặc `aria-label` | Không biết field để nhập gì |
| **Heading Structure** | Thứ tự h1, h2, h3 bị nhảy cóc | Điều hướng bằng heading bị lỗi |
| **Keyboard Focus** | Element tương tác không focus được bằng Tab | Người dùng bàn phím không tương tác được |
| **Missing Lang** | `<html>` không có thuộc tính `lang` | Screen reader đọc sai giọng |
| **Missing Landmarks** | Không có header, nav, main, footer | Không nhảy nhanh giữa các vùng |
| **Tabindex Issue** | Dùng tabindex dương (1, 2, 3...) | Thứ tự tab bị lộn xộn |

---

## 🛠️ CÔNG CỤ KIỂM TRA ACCESSIBILITY

### 1. **Tự động** (đã tích hợp trong UI Checker):
- **axe-core** - Thư viện của Deque, phát hiện 50+ loại lỗi
- **Lighthouse** (Chrome DevTools) - Audit tổng thể
- **WAVE** - Browser extension

### 2. **Thủ công**:
- **Keyboard Testing**: Tab qua toàn bộ trang, không dùng chuột
- **Screen Reader**: NVDA (Windows), JAWS (Windows), VoiceOver (Mac/iOS)
- **Color Contrast Checker**: https://webaim.org/resources/contrastchecker/

---

## 📊 MỨC ĐỘ NGHIÊM TRỌNG

UI Checker phân loại lỗi accessibility theo 4 mức:

| Mức độ | Ý nghĩa | Ví dụ |
|--------|---------|-------|
| **CRITICAL** | Chặn hoàn toàn người dùng | Form không có label, không submit được |
| **HIGH** | Ảnh hưởng nghiêm trọng | Color contrast quá thấp, không đọc được text |
| **MEDIUM** | Gây khó khăn | Heading sai thứ tự, điều hướng khó |
| **LOW** | Vi phạm nhỏ, ảnh hưởng ít | Ảnh decorative có alt text dư thừa |

---

## ✅ CHECKLIST: Làm thế nào để tránh lỗi Accessibility?

### Trước khi code:
- [ ] Thiết kế có đủ **color contrast** (dùng tool check trước)
- [ ] Plan cấu trúc heading (h1, h2, h3) logic
- [ ] Plan keyboard navigation flow

### Khi code:
- [ ] Luôn dùng **semantic HTML** (button, nav, header, main, footer)
- [ ] Mọi `<img>` đều có **alt text** có nghĩa
- [ ] Mọi form input đều có **label**
- [ ] Thêm `lang="vi"` vào `<html>`
- [ ] Không dùng `tabindex` dương
- [ ] Focus outline phải **rõ ràng** (không ẩn outline)

### Sau khi code:
- [ ] Tab qua toàn bộ trang bằng bàn phím
- [ ] Chạy **UI Checker** để quét tự động
- [ ] Test bằng screen reader (ít nhất 1 lần)
- [ ] Dùng Lighthouse audit

---

## 🎓 HỌC THÊM

### Tài liệu chuẩn:
- **WCAG 2.1**: https://www.w3.org/WAI/WCAG21/quickref/
- **MDN Accessibility**: https://developer.mozilla.org/en-US/docs/Web/Accessibility
- **WebAIM**: https://webaim.org/

### Khóa học miễn phí:
- Google: Web Accessibility by Google (Udacity)
- Microsoft: Introduction to Accessibility

---

## 💡 KẾT LUẬN

**Lỗi Accessibility xuất hiện khi:**
1. Website không tuân thủ tiêu chuẩn WCAG
2. Không test với screen reader, keyboard, color contrast tool
3. Developer không có awareness về accessibility

**Tác động:**
- ❌ Người khuyết tật không sử dụng được → **Vi phạm quyền con người**
- ❌ SEO kém → **Mất traffic**
- ❌ Vi phạm pháp luật → **Rủi ro pháp lý** (ở một số nước)
- ❌ Trải nghiệm kém cho tất cả người dùng

**Giải pháp:**
- ✅ Dùng **UI Checker** để quét tự động
- ✅ Follow các best practice trong guide này
- ✅ Test thủ công bằng keyboard + screen reader
- ✅ Educate team về accessibility

Accessibility không phải "nice to have", mà là **must have**! 🚀
