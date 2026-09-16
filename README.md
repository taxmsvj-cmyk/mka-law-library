# Tax Law Library

در سایت همراه یا به آدرسhttps://hamrahyaar.com/books/177679با توجه به اطلاعات ذیل می خواهیمکل قوانین و بخشنامه های مالیاتی را استخراج و به عنوان یک کتابخانه ذخیره کنیم آیا در این باب شما می توانید همکاری کنید . حالا اطلاعات کلیدی صفحه‌بندی همراه‌یار را داریم

خلاصه پارامترها:

پارامترمعنیsعبارت جستجو (مالیات)rتعداد نتایج / آفست (۱۰، ۲۰، ۳۰ و ...)بقیه فیلترهای اختیاری (خالی)

دکمه «نمایش بیشتر» تابع get_search_books_mog('q','20') را صدا می‌زند و مقدار r را افزایش می‌دهد.

مرحله بعد

الان می‌توانم HamrahYaarProvider را طوری بنویسم که:

لیست را با پارامتر r صفحه‌بندی کند

اسناد را پارس کند

در دیتابیس SQLite ذخیره کند

قبل از نوشتن کد نهایی، دو سؤال کوتاه:

مسیر دیتابیس را همان data/sqlite/regulations.db نگه داریم؟

آیا می‌خواهید نسخه کامل HamrahYaarProvider + اتصال به دیتابیس را یکجا بنویسم، یا مرحله‌به‌مرحله؟

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/32baae1f-2457-4c0b-bd91-809a4951effa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
