require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
const { SYSTEM_PROMPT, RESPONSE_SCHEMA } = require('./prompt');
const { buildDashboardMessage, formatThaiDate, getBangkokDateStr } = require('./formatter');
const {
  saveProgressReport,
  getReportByDate,
  getLatestReport,
  getHistoryContextForAI
} = require('./db');

const app = express();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.8-flash';

// ระบบคิวสำหรับรวบรวมรูปภาพแยกตาม Group ID หรือ Source ID
const groupQueues = new Map();
const BATCH_DELAY_MS = 6000; // รอ 6 วินาทีเพื่อรวบรวมรูปที่ส่งพร้อมกัน

// ฟังก์ชันดาวน์โหลดรูปจาก LINE Content API
async function downloadLineImageAsBase64(messageId) {
  const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    responseType: 'arraybuffer',
  });

  return {
    inlineData: {
      data: Buffer.from(response.data).toString('base64'),
      mimeType: response.headers['content-type'] || 'image/jpeg',
    },
  };
}

// ฟังก์ชันประมวลผลคิวรูปภาพแบบเงียบ (Silent Ingestion - ไม่ส่งข้อความรบกวนกลุ่ม)
async function processGroupBatchQuietly(groupId) {
  const batch = groupQueues.get(groupId);
  if (!batch || batch.images.length === 0) return;

  const imagesToProcess = [...batch.images];
  groupQueues.delete(groupId); // ล้างคิว

  const tStart = Date.now();
  console.log(`[Silent Ingestion] กำลังอ่านรูปภาพจำนวน ${imagesToProcess.length} รูป...`);

  try {
    let response;
    const contentsPayload = [
      ...imagesToProcess,
      'จงวิเคราะห์รูปภาพรายงานความก้าวหน้าทั้งหมดนี้และส่งออกเป็น JSON ตามโครงสร้างที่กำหนด'
    ];
    const generationConfig = {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1,
    };

    try {
      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: contentsPayload,
        config: generationConfig,
      });
    } catch (genErr) {
      if (GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL) {
        console.warn(`[Warning] โมเดล ${GEMINI_MODEL} สะดุด สลับไปใช้ ${GEMINI_FALLBACK_MODEL}...`);
        response = await ai.models.generateContent({
          model: GEMINI_FALLBACK_MODEL,
          contents: contentsPayload,
          config: generationConfig,
        });
      } else {
        throw genErr;
      }
    }

    const durationSec = ((Date.now() - tStart) / 1000).toFixed(1);
    const parsedData = JSON.parse(response.text);

    // บันทึกลงฐานข้อมูลเงียบๆ ไม่ส่งข้อความเข้ากลุ่ม
    saveProgressReport(parsedData);
    console.log(`[Silent Ingestion Success] บันทึกข้อมูลรายงานวันที่ ${parsedData.report_date} (${parsedData.locations?.length || 0} จุดงาน) เสร็จใน ${durationSec} วินาที (ทำงานเงียบ ไม่รบกวนกลุ่ม)`);

  } catch (error) {
    console.error('[Silent Ingestion Error] ประมวลผลรูปภาพล้มเหลว:', error.message);
  }
}

// ฟังก์ชันตอบคำถามหรือสรุปงานเมื่อสั่งผ่าน #ai
async function handleUserQuery(query) {
  const text = query.trim();
  const todayStr = getBangkokDateStr(0);
  const yesterdayStr = getBangkokDateStr(-1);

  // ตรวจจับการระบุชื่อ Location เช่น IVS06, IVS07
  const locMatch = text.match(/ivs\s*\d+/i);
  const filterLocation = locMatch ? locMatch[0].replace(/\s+/g, '') : null;

  // 1. ถ้าถามเกี่ยวกับ "เมื่อวาน" ➔ แสดง Dashboard รูปแบบเดิมของเมื่อวาน
  if (/เมื่อวาน/i.test(text)) {
    const yesterdayReport = getReportByDate(yesterdayStr);
    if (yesterdayReport) {
      return buildDashboardMessage(yesterdayReport, filterLocation);
    }
    const latest = getLatestReport();
    if (latest) {
      return `📌 ยังไม่มีข้อมูลรายงานของเมื่อวาน (${formatThaiDate(yesterdayStr)}) ขอนำส่งรายงานล่าสุด:\n\n` + buildDashboardMessage(latest, filterLocation);
    }
    return `📌 ยังไม่มีข้อมูลรายงานในระบบครับ`;
  }

  // 2. ถ้าเป็นคำถามแนว "เปรียบเทียบ" หรือ "วันไหนได้เยอะสุด" ➔ ใช้ AI วิเคราะห์จากฐานข้อมูล
  if (/(เปรียบเทียบ|เทียบ|วันไหน.*(เยอะ|มาก|สุด)|เหลือกี่ต้น|เฉลี่ย)/i.test(text) && !/สรุป.*ivs/i.test(text)) {
    const historyContext = getHistoryContextForAI(14);
    const aiPrompt = `คุณคือวิศวกรผู้ช่วยควบคุมงานก่อสร้างโครงการรถไฟฟ้าสายสีม่วงใต้ (MRT Purple Line)
หน้าที่ของคุณคือตอบคำถามจากวิศวกรในกลุ่มงาน โดยใช้ข้อมูลประวัติผลงานจริงที่บันทึกไว้ในระบบด้านล่างนี้:

ฐานข้อมูลประวัติรายงานผลงานก่อสร้าง (ย้อนหลัง):
========================================
${historyContext}
========================================

คำถามจากวิศวกร: "${text}"

แนวทางการตอบ:
1. ตอบให้กระชับ ได้ใจความ ตรงประเด็นแบบวิศวกรมืออาชีพ
2. อ้างอิงตัวเลข จำนวนต้น วันที่ (รูปแบบ DD/MM/YYYY) และจุดงาน (Location เช่น IVS06, IVS07) ให้ชัดเจน
3. หากเป็นการเปรียบเทียบ ให้แจกแจงผลงานแต่ละวัน และสรุปผลต่าง (เช่น มากกว่า/น้อยกว่ากี่ต้น)
4. หากถามหาวันที่ผลงานสูงสุด ให้บอกวันที่ จำนวนต้นที่ทำได้ และจุดงาน
5. ใช้ภาษาที่สุภาพและเป็นทางการในเชิงวิศวกรรม`;

    try {
      const aiRes = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [aiPrompt],
        config: { temperature: 0.2 }
      });
      return aiRes.text.trim();
    } catch (err) {
      console.error('[AI Query Error]:', err.message);
      return '⚠️ ขออภัยครับ ระบบไม่สามารถประมวลผลคำตอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
    }
  }

  // 3. กรณีสรุปงานทั้งหมด (สรุป, สรุปวันนี้, ขอแค่วันนี้, สรุป ivs06, สรุปงาน ฯลฯ) ➔ แสดง Dashboard ฟอร์มเดิมเสมอ!
  const todayReport = getReportByDate(todayStr);
  if (todayReport && !/ล่าสุด/i.test(text)) {
    return buildDashboardMessage(todayReport, filterLocation);
  }

  const latest = getLatestReport();
  if (latest) {
    return buildDashboardMessage(latest, filterLocation);
  }

  return `📌 ยังไม่มีข้อมูลรายงานความก้าวหน้าในระบบครับ (ส่งรูปภาพรายงานเข้ามาได้เลยครับ บอทจะบันทึกให้อัตโนมัติ)`;
}

// หน้าแรกสำหรับตรวจสอบสถานะเซิร์ฟเวอร์ผ่านเบราว์เซอร์ (Health Check)
app.get('/', (req, res) => {
  res.send('🏗️ LINE AI Construction Progress Bot (Chongchaman) is Online and Running 24/7!');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'chongchaman-line-bot', uptime: process.uptime() });
});

// Endpoint รับ Webhook จาก LINE
app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
  res.status(200).send('OK'); // ตอบกลับ LINE ทันที

  for (const event of req.body.events) {
    const sourceId = event.source.groupId || event.source.roomId || event.source.userId;

    // 1. กรณีผู้ใช้ส่งรูปภาพ (Image) ➔ ทำงานเงียบสนิท ไม่ส่งข้อความใดๆ รบกวนกลุ่ม
    if (event.type === 'message' && event.message.type === 'image') {
      try {
        const imagePart = await downloadLineImageAsBase64(event.message.id);

        if (!groupQueues.has(sourceId)) {
          groupQueues.set(sourceId, { images: [], timer: null });
        }

        const queue = groupQueues.get(sourceId);
        queue.images.push(imagePart);

        // รอ 6 วินาทีเพื่อรวบรวมรูปที่ส่งพร้อมกัน จากนั้นให้ AI อ่านและเซฟลงฐานข้อมูลเงียบๆ
        if (queue.timer) clearTimeout(queue.timer);
        queue.timer = setTimeout(() => processGroupBatchQuietly(sourceId), BATCH_DELAY_MS);

        console.log(`[Image Queued] รับรูปที่ ${queue.images.length} (กำลังรวบรวมและอ่านข้อมูลในพื้นหลังเงียบๆ...)`);
      } catch (err) {
        console.error('[Download Error]:', err.message);
      }
    }

    // 2. กรณีผู้ใช้พิมพ์ข้อความ (Text) ➔ ทำงานเฉพาะเมื่อขึ้นต้นด้วย #ai เท่านั้น
    else if (event.type === 'message' && event.message.type === 'text') {
      const userText = event.message.text.trim();

      // ตรวจสอบว่าขึ้นต้นด้วย #ai หรือ #AI หรือไม่
      if (/^#ai\b/i.test(userText) || /^#ai\s*/i.test(userText)) {
        const query = userText.replace(/^#ai\s*/i, '').trim();
        console.log(`[#ai Command Triggered] จาก ${sourceId}: "${query}"`);

        try {
          if (!query) {
            await client.replyMessage({
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: '👷‍♂️ สวัสดีครับ วิศวกรสามารถพิมพ์ #ai ตามด้วยคำสั่งได้เลยครับ เช่น:\n\n• #ai สรุป\n• #ai สรุป ivs06\n• #ai สรุป ivs07\n• #ai สรุปงานเมื่อวาน\n• #ai วันไหนที่ได้โปรเกรสเยอะสุด\n• #ai เปรียบเทียบวันที่ 11 กับ 12'
              }]
            });
            return;
          }

          const replyText = await handleUserQuery(query);
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: replyText }]
          });
          console.log(`[Reply Sent] ตอบกลับคำสั่ง #ai "${query}" สำเร็จ`);
        } catch (err) {
          console.error('[Reply Error]:', err.message);
        }
      }
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 #ai Construction Progress Bot is running on port ${PORT}`);
});
