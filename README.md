# 🏗️ AI Construction Progress LINE Bot

ระบบบอท LINE สรุปความก้าวหน้างานก่อสร้างอัตโนมัติ สำหรับกลุ่มงาน MRT Purple Line Project

## 📦 โครงสร้างไฟล์
- `index.js`: ตัวรับ Webhook จาก LINE Messaging API และจัดการคิวรูปภาพ (Batch Queue 15s)
- `prompt.js`: System Prompt และ JSON Schema สำหรับให้ Gemini สกัดข้อมูลจาก CAD / Drawing / ตาราง
- `formatter.js`: คำนวณ Variance, % Plan vs % Actual และจัดรูปแบบกราฟิก Engineering Text Dashboard
- `.env`: ไฟล์ตั้งค่า Channel Token, Secret และ Gemini API Key

## 🚀 วิธีติดตั้ง Dependencies
```bash
npm install
```

## ⚙️ การตั้งค่า (.env)
คัดลอกไฟล์ `.env.example` ไปเป็น `.env` แล้วระบุข้อมูลจริง:
```env
PORT=3000
LINE_CHANNEL_ACCESS_TOKEN=ใส่_LINE_Channel_Access_Token
LINE_CHANNEL_SECRET=ใส่_LINE_Channel_Secret
GEMINI_API_KEY=ใส่_Gemini_API_Key
GEMINI_MODEL=gemini-2.5-flash
```

## 🏃 วิธีรันระบบ
1. เริ่มการทำงานของ Server:
   ```bash
   node index.js
   # หรือ npm start
   ```
2. รัน ngrok เพื่อเปิด Webhook:
   ```bash
   ngrok http 3000
   ```
3. นำ URL ที่ได้จาก ngrok เช่น `https://xxxx.ngrok-free.app/webhook` ไปใส่ใน LINE Developers Console (Messaging API > Webhook URL) แล้วกด **Verify**
