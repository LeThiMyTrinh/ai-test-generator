# 🎯 Hướng dẫn sử dụng UI Checker V2

## ✨ Tính năng mới

### 1. **Dual-Mode Display** - 2 Chế độ xem
Tính năng UI Checker giờ đây có **2 chế độ xem** phù hợp cho từng đối tượng người dùng:

#### 🎭 **Chế độ Quản lý / PM** (Manager View)
- **Đối tượng**: Product Manager, Stakeholder, QA Leader, người không kỹ thuật
- **Đặc điểm**:
  - ✅ Ngôn ngữ đơn giản, dễ hiểu
  - ✅ Nhóm theo **tác động nghiệp vụ** thay vì loại lỗi kỹ thuật:
    - 🚫 **Chặn người dùng** - Blocking issues (JS Error, Navigation Error, Broken Link)
    - 😣 **Gây khó chịu** - Critical UX issues (Horizontal scrollbar, Broken image, Overflow)
    - 📱 **Khó dùng trên điện thoại** - Mobile issues (Small touch target, Text truncated)
    - ♿ **Không thân thiện** - Accessibility issues
    - 🎨 **Ảnh hưởng thẩm mỹ** - Visual issues
  - ✅ Hiển thị **tác động** đến người dùng cuối
  - ✅ Hiển thị **người chịu trách nhiệm fix** (Frontend Dev, Content Team, etc.)
  - ✅ Hiển thị **thời gian ước tính** để fix

#### 👨‍💻 **Chế độ Developer** (Developer View)
- **Đối tượng**: Frontend Developer, Designer, Technical team
- **Đặc điểm**:
  - 🛠️ Nhóm theo **loại lỗi kỹ thuật**
  - 🛠️ Hiển thị đầy đủ thông tin kỹ thuật:
    - CSS Selector
    - Viewport affected
    - Score (mức độ ưu tiên 0-100)
    - Technical details (scrollWidth, contrast ratio, etc.)
  - 🛠️ **Code snippet sẵn sàng để fix** - Copy ngay vào code
  - 🛠️ **Step-by-step fix guide** - Hướng dẫn chi tiết từng bước
  - 🛠️ Priority, Fix effort, User impact
  - 🛠️ Copy-to-clipboard cho selector và code

### 2. **Executive Summary Dashboard**
- 📊 **Điểm chất lượng UI**: Tính toán dựa trên tổng số lỗi (0-100)
- 🔥 Thống kê nhanh: Số lỗi cần fix ngay / nên fix / cải thiện
- 📱 Đánh giá nhanh Mobile vs Desktop
- ⏱️ Ước tính thời gian fix tổng

### 3. **Image Highlight - Highlight lỗi trực tiếp trên ảnh**
- 🖼️ **Click vào issue** → Highlight vị trí lỗi trên screenshot
- 🔴 Đánh số các lỗi trên ảnh (1, 2, 3...) để dễ theo dõi
- 🎯 **Hover vào issue** → Highlight tự động trên ảnh
- 🔍 Click vào vùng highlight trên ảnh → Hiện chi tiết lỗi

---

## 🚀 Cách sử dụng

### Bước 1: Mở trang UI Checker
- Truy cập menu bên trái → **🔍 Kiểm tra UI**

### Bước 2: Nhập URL và chọn thiết bị
1. Nhập URL trang web cần kiểm tra (ví dụ: `https://example.com`)
2. Chọn độ phân giải:
   - **Desktop**: 1920×1080, 1440×900, 1366×768
   - **Tablet**: iPad Pro, iPad Mini, Galaxy Tab
   - **Mobile**: iPhone 15, iPhone SE, Pixel 7, Galaxy S24
3. *(Tùy chọn)* Tick "Đăng nhập tự động" nếu trang yêu cầu login
4. Click **"Kiểm tra UI"**

### Bước 3: Chọn chế độ xem
Sau khi kiểm tra xong, chọn chế độ phù hợp:
- **👥 Quản lý / PM**: Cho người không kỹ thuật
- **👨‍💻 Developer**: Cho developer

### Bước 4: Xem kết quả và highlight
1. **Xem Executive Summary** ở đầu trang để nắm tổng quan
2. **Click vào ảnh screenshot** để xem highlight các lỗi
3. **Click vào issue** trong danh sách → Tự động highlight trên ảnh
4. **Hover qua issue** → Highlight tạm thời
5. Trong Developer mode → Click vào issue để xem code fix

---

## 📋 Ví dụ thực tế

### Kịch bản 1: PM review trước release
1. PM mở **Manager View**
2. Nhìn Executive Summary: **Score 68/100**, có **3 lỗi cần fix ngay**
3. Xem mục **"🚫 Chặn người dùng"**:
   - "Trang có thanh cuộn ngang → Người dùng mobile không xem được hết nội dung"
   - Người chịu trách nhiệm: **Frontend Dev**
   - Thời gian: **15-20 phút**
4. Click vào issue → Xem highlight trên ảnh Mobile
5. Assign task cho developer

### Kịch bản 2: Developer fix bugs
1. Developer mở **Developer View**
2. Filter theo type: **HORIZONTAL_SCROLLBAR**
3. Click expand issue → Xem code fix:
   ```css
   body {
     overflow-x: hidden;
     max-width: 100vw;
   }
   ```
4. Click **"Copy code"** → Paste vào file CSS
5. Follow step-by-step guide để fix
6. Re-run UI check để verify

---

## 🎨 So sánh 2 chế độ

| Tính năng | Manager View | Developer View |
|-----------|--------------|----------------|
| Ngôn ngữ | Đơn giản, dễ hiểu | Kỹ thuật, chuyên sâu |
| Nhóm theo | Tác động nghiệp vụ | Loại lỗi kỹ thuật |
| Code snippet | ❌ Không | ✅ Có, sẵn sàng copy |
| Fix guide | ✅ Tổng quan | ✅ Step-by-step chi tiết |
| Selector | ❌ Ẩn | ✅ Hiện rõ |
| Score/Priority | ✅ Priority đơn giản | ✅ Score 0-100 + Priority |
| Người chịu trách nhiệm | ✅ Có | ❌ Không cần |

---

## 🔧 Các cải tiến Backend

### 1. Thêm `position` cho mỗi issue
- Backend giờ trả về tọa độ (x, y, width, height) của element bị lỗi
- Dùng `getBoundingClientRect()` để lấy vị trí chính xác
- Cho phép frontend highlight đúng vị trí trên screenshot

### 2. Sử dụng IssueAnalyzer
- Mỗi issue được phân tích và gán:
  - **Score** (0-100): Mức độ nghiêm trọng
  - **Priority**: CRITICAL, MUST_FIX, SHOULD_FIX, NICE_TO_HAVE, MINOR
  - **autoFix**: Code snippet + step-by-step guide
  - **metadata**: User impact, fix effort, category

---

## 🎯 Lợi ích

### Cho PM / Stakeholder:
✅ Hiểu rõ vấn đề mà không cần biết code
✅ Assign task dễ dàng (biết ai chịu trách nhiệm)
✅ Ước tính thời gian fix để plan release
✅ Focus vào business impact thay vì technical detail

### Cho Developer:
✅ Copy code fix ngay, không cần Google
✅ Biết chính xác vị trí lỗi trên ảnh
✅ Có step-by-step guide để fix nhanh
✅ Biết priority để ưu tiên fix lỗi quan trọng trước

---

## 📸 Screenshots chức năng

### Executive Summary
```
┌─────────────────────────────────────────────────┐
│ 🎯 TỔNG QUAN CHẤT LƯỢNG UI                     │
│                                                  │
│  68/100      3 vấn đề     8 vấn đề     5 cải   │
│  Điểm        🔥 Cần fix   ⚠️ Nên fix   thiện   │
│                                                  │
│  📱 Mobile: 🔴 Nhiều vấn đề                     │
│  🖥️ Desktop: 🟢 Ổn định                         │
│  ⏱️ Thời gian fix ước tính: 2 giờ               │
└─────────────────────────────────────────────────┘
```

### Manager View
```
┌─────────────────────────────────────────────────┐
│ 🚫 CHẶN NGƯỜI DÙNG (3 lỗi)                      │
│                                                  │
│ 📏 Trang bị thanh cuộn ngang                    │
│ Tác động: Người dùng mobile không xem được hết  │
│ 👤 Frontend Dev  📱 Mobile  ⏱️ 15-20 phút       │
│ [Click để xem trên ảnh]                         │
└─────────────────────────────────────────────────┘
```

### Developer View
```
┌─────────────────────────────────────────────────┐
│ 📏 HORIZONTAL_SCROLLBAR (Score: 95/100)        │
│                                                  │
│ Selector: body                                   │
│ Details: scrollWidth: 1920, viewportWidth: 375  │
│                                                  │
│ 💡 CÁCH FIX:                                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ body {                                      │ │
│ │   overflow-x: hidden;                       │ │
│ │   max-width: 100vw;                         │ │
│ │ }                                           │ │
│ └─────────────────────────────────────────────┘ │
│ [Copy code]                                      │
└─────────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### Không thấy highlight trên ảnh?
- **Nguyên nhân**: Issue không có `position` data
- **Giải pháp**: Một số lỗi (như broken link, console error) không có vị trí cụ thể nên không highlight được

### Code snippet không hiện?
- **Nguyên nhân**: Một số loại lỗi chưa có auto-fix template
- **Giải pháp**: Xem manual fix guide trong collapsed section

### Ảnh quá nhỏ, không thấy rõ?
- **Giải pháp**: Click vào ảnh để expand fullscreen (tính năng này có thể thêm sau)

---

## 🔮 Tính năng tương lai (Optional)

1. **Export PDF Report** cho Manager View
2. **Assign to Team Member** - Integration với Jira/Trello
3. **Historical Tracking** - So sánh kết quả qua thời gian
4. **AI-Enhanced Fix** - Dùng Gemini API để generate fix code thông minh hơn
5. **Screenshot Comparison** - So sánh Before/After khi fix
6. **Priority Score Custom** - Cho phép user tự set priority

---

## 📝 Technical Notes

### Files đã thay đổi:
1. **Backend**:
   - [UIChecker.js](backend/src/ai/UIChecker.js) - Thêm `getElementPosition()` helper, thêm `position` vào mỗi issue
   - [IssueAnalyzer.js](backend/src/ai/IssueAnalyzer.js) - Đã có sẵn, không cần sửa

2. **Frontend**:
   - [UICheckerV2.jsx](frontend/src/pages/UICheckerV2.jsx) - Component mới hoàn toàn
   - [App.jsx](frontend/src/App.jsx) - Thay UIChecker → UICheckerV2

### Key Components:
- `ExecutiveSummary`: Dashboard tổng quan
- `ManagerView`: View cho PM/stakeholder
- `DeveloperView`: View cho developer
- `ImageWithHighlights`: SVG overlay để highlight trên ảnh

---

## 🎉 Kết luận

Với UI Checker V2, giờ đây:
- **Người không kỹ thuật** có thể hiểu và quản lý bug UI
- **Developer** có code sẵn để fix nhanh
- **Team** có thể collaborate tốt hơn với language chung
- **Highlight trên ảnh** giúp visualize vấn đề rõ ràng

Happy testing! 🚀
