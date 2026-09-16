# MKA – دستورات اجرایی پروژه (قابل ابلاغ به دستیار)

**پروژه:** MKA – Modular Knowledge Assistant  
**مخزن هسته:** https://github.com/mka-platform/MKA-Core  
**مالک / صاحب‌امتیاز:** ضیاءالدین موسوی جراحی (ziya1346)  
**ایمیل مدیر:** ziya.mka2026@gmail.com  
**مدیر معماری:** Grok  
**دستیار کدنویسی UI:** Lovable.dev  

**آخرین به‌روزرسانی:** 2026-08-12

---

## ۱. نقش‌ها و همکاری

| نقش | نام | مسئولیت |
|-----|-----|---------|
| مالک | ضیاءالدین موسوی جراحی | تصمیم نهایی، کپی‌رایت، اولویت‌ها |
| مدیر | ضیاءالدین موسوی جراحی | معماری، کیفیت دانش، هماهنگی |
| کارشناس | ضیاءالدین موسوی جراحی | ثبت Registry، پیشنهاد Citation |
| دستیار UI | Lovable.dev | پنل React/TanStack روی Lovable Cloud |
| هسته دانش | MKA-Core (Python) | Parser، Embedding، Vector DB، ربات |

**در UI لاگین:** برای هر سه نقش owner / manager / expert نام نمایشی:

```
ضیاءالدین موسوی جراحی
```

---

## ۲. اصل حاکم: Knowledge First + Citation

- هر پاسخ باید قابل استناد باشد.
- هیچ ماده، بخشنامه، دستورالعمل یا رأی دیوانی بدون ثبت در Registry وارد پایگاه پاسخ‌گویی نشود.
- Citation بدون source_id / عنوان / منبع = نامعتبر.

---

## ۳. منابع معتبر (اولویت)

1. regulation.tax.gov.ir
2. qavanin.ir / rrk.ir
3. intamedia.ir / tax.gov.ir
4. hamrahyaar.com (پس از تطبیق با منبع رسمی)
5. آراء دیوان عدالت اداری
6. Wikipedia فقط زمینه عمومی

### منبع پشتیبان و مخزن جستجو (ثبت اجباری)

| نقش | آدرس |
|-----|------|
| اولین منبع / مخزن جستجو (Primary Vault) | https://drive.google.com/drive/folders/1NcBkZOTemmVfnNKY7FgxuqbIXj6f4Dtl |
| منبع پشتیبان هنگام قطع سایت‌های رسمی (Working Drive) | https://drive.google.com/drive/folders/1Jx0cipUqQyGnJk4hFCURzWIg1Abo1Del |

**سیاست:** رسمی آنلاین → Primary Vault → Working Drive → همراه‌یار

در پنل Lovable:
- PRIMARY_KNOWLEDGE_DRIVE = Primary Vault
- FALLBACK_KNOWLEDGE_DRIVE = Working Drive

---

## ۴. Registry (ثبت دانش) – اجباری

**Sheet مرکزی:**
https://docs.google.com/spreadsheets/d/1nG3HwfhXwJYcUo6ljzXPy9mUv0eebn0B

**پوشه ثبت:**
https://drive.google.com/drive/folders/1LmVU0WnD_-qlzs8Upv2HkpI-dYrUfkqg

**Drive کاری دانش:**
https://drive.google.com/drive/folders/1Jx0cipUqQyGnJk4hFCURzWIg1Abo1Del

به محض شناسایی هر سند → یک ردیف در Registry + فایل/لینک.

### فیلدهای حداقلی Registry

| فیلد | توضیح |
|------|--------|
| id | شناسه یکتا |
| doc_type | قانون / بخشنامه / دستورالعمل / رأی دیوان / ماده / سایر |
| number | شماره سند |
| date | تاریخ |
| title | عنوان |
| source_url | لینک منبع |
| drive_path | مسیر/لینک Drive |
| law_family | مالیات مستقیم / ارزش افزوده / سامانه مؤدیان / سوداگری / بودجه / سایر |
| index_status | pending / indexed / failed |
| notes | یادداشت |
| created_by / updated_at | ردیابی |

---

## ۵. قوانین ضروری (اولویت ایندکس)

1. قانون مالیات‌های مستقیم
2. قانون مالیات بر ارزش افزوده 1400
3. قانون پایانه‌های فروشگاهی و سامانه مؤدیان
4. قانون مالیات بر سوداگری و سفته‌بازی
5. احکام مالیاتی بودجه و برنامه توسعه

---

## ۶. تقسیم کار فنی

### Lovable (فقط React / Lovable Cloud)

- لاگین + نقش‌ها (owner / manager / expert)
- CRUD جدول Registry
- پیش‌نمایش Citation
- داشبورد شمارشی
- صفحه اول: بلوک ارتباط با مشاور
- فیلد اختیاری BACKEND_URL برای اتصال بعدی به MKA-Core

Lovable به GitHub push نمی‌کند. نسخه پایدار را مالک Export می‌کند.

### MKA-Core (Python – GitHub)

- backend-api, ai-gateway, telegram-bot
- document-parser, embedding-service, retrieval-engine
- google-drive-sync, shared

ربات تلگرام: @taxiran1395_bot  
ربات بله: در نقشه راه  
LLM توسعه: Ollama (رایگان و خصوصی)

---

## ۷. صفحه اول – ارتباط با مشاور

عنوان: ارتباط با مشاور رسمی مالیاتی

متن:
در صورت نیاز به مشاوره آنلاین و تهیه لایحه دفاعی منطبق بر قوانین موضوعه کشور می‌توانید از طریق اپلیکیشن‌های داخلی و خارجی و شماره همراه زیر با مشاور در تماس باشید:

آقای ضیاءالدین موسوی جراحی
مشاور رسمی مالیاتی
موبایل: 09153068322
لینک تماس: tel:+989153068322

این بلوک برای همه بازدیدکنندگان (با/بدون لاگین) دیده شود. خروجی مدل نیست.

---

## ۸. فاز A – معیار اتمام (Lovable)

- [ ] لاگین + سه نقش با نام ضیاءالدین موسوی جراحی
- [ ] CRUD Registry
- [ ] فیلتر نوع سند و وضعیت ایندکس
- [ ] Citation نمونه
- [ ] داشبورد
- [ ] ثابت‌های Drive (Primary + Fallback)
- [ ] بلوک ارتباط با مشاور در صفحه اول
- [ ] BACKEND_URL اختیاری

---

## ۹. RAG – منبع پاسخ

| لایه | مسئول |
|------|--------|
| پنل و نمایش Citation | Lovable Cloud + AI (موقت) |
| ایندکس و بازیابی واقعی | MKA-Core /v1/rag/query (بعداً) |

---

## ۱۰. قوانین توسعه

- رازها فقط در .env – بدون commit
- Citation اجباری برای پاسخ دانشی
- منبع فقط از فهرست معتبر + Driveهای ثبت‌شده
- تغییر اولویت فقط با تأیید مالک

---

## ۱۱. شناسه‌های مهم Drive

```
Primary Vault:     1NcBkZOTemmVfnNKY7FgxuqbIXj6f4Dtl
Working Drive:     1Jx0cipUqQyGnJk4hFCURzWIg1Abo1Del
Registry folder:   1LmVU0WnD_-qlzs8Upv2HkpI-dYrUfkqg
Registry Sheet:    1nG3HwfhXwJYcUo6ljzXPy9mUv0eebn0B
```

---

*این فایل مرجع واحد دستورات برای مالک، مدیر و دستیار (Lovable) است.*
