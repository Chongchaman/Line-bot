const SYSTEM_PROMPT = `
คุณคือวิศวกรควบคุมงานก่อสร้าง (Construction Control Engineer) มืออาชีพ
หน้าที่ของคุณคืออ่านรูปภาพรายงานความก้าวหน้า (Progress Drawing / Table / CAD) แล้วสกัดข้อมูลออกมาเป็น JSON ตามโครงสร้างที่กำหนดอย่างแม่นยำ 100%

กฎเหล็กในการอ่านข้อมูล:
1. การระบุชื่องาน (work_category):
   - ให้อ่านจากหัวกระดาษหลักด้านบนสุดของแบบก่อนเสมอ เช่น "DEMOLITION OF EXISTING PILE" = "งานรื้อถอนเสาเข็มเดิม (Demolition of Existing Pile)" หรือ "JET GROUTING" = "งานปรับปรุงคุณภาพดิน (Jet Grout)"
2. การระบุจุดงาน (location_name):
   - ให้ใช้ชื่อจุดงานสั้นๆ กระชับ เช่น "OR11 (Zone 3-1)" หรือ "IVS06" ห้ามนำชื่อสัญญายาวๆ มาใส่
3. การอ่านตัวเลขและตรวจสอบความถูกต้องทางคณิตศาสตร์ (CRITICAL):
   - ตัวเลขต้องตรงกับแถวสรุป (Total / Summary Row) ในตาราง
   - กฎการตรวจสอบ: total_qty ต้องเท่ากับ (accum_qty + remaining_qty) เสมอ ระวังการอ่านตัวเลขเบิ้ลหลัก (เช่น 949 ห้ามอ่านเป็น 9499)
   - daily_qty คือผลงานเฉพาะวันนี้/ล่าสุด
   - accum_qty คือผลงานสะสม
   - remaining_qty คือคงเหลือ
4. วันที่ของรายงาน (report_date):
   - ให้อ่านจากช่อง Date ในตารางหรือ Title Block แปลงเป็น YYYY-MM-DD
5. วันที่เริ่มและสิ้นสุดตามแผน (start_date, target_end_date):
   - ถ้าในตารางหรือแบบ "ไม่มีระบุ" วันที่เริ่มหรือกำหนดเสร็จ ให้ใส่ค่าเป็น null ห้ามเดาหรือสมมุติขึ้นมาเองเด็ดขาด
6. ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นปน
`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    report_date: { type: "STRING", description: "วันที่ของรายงาน YYYY-MM-DD" },
    work_category: { type: "STRING", description: "ประเภทงานหลัก เช่น งานรื้อถอนเสาเข็มเดิม (Demolition of Existing Pile)" },
    locations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          location_name: { type: "STRING", description: "ชื่อจุดงานสั้นๆ เช่น OR11 (Zone 3-1), IVS06" },
          sub_title: { type: "STRING", nullable: true, description: "รายละเอียดเพิ่มเติม เช่น Zone 3-1 หรือ Break-out" },
          start_date: { type: "STRING", nullable: true, description: "YYYY-MM-DD หรือ null หากไม่มีในแบบ" },
          target_end_date: { type: "STRING", nullable: true, description: "YYYY-MM-DD หรือ null หากไม่มีในแบบ" },
          total_qty: { type: "NUMBER", description: "จำนวนรวมทั้งหมด" },
          daily_qty: { type: "NUMBER", description: "ผลงานวันนี้" },
          accum_qty: { type: "NUMBER", description: "ผลงานสะสม" },
          remaining_qty: { type: "NUMBER", description: "คงเหลือ (ต้องสอดคล้อง: total = accum + remaining)" },
          current_avg_per_day: { type: "NUMBER", nullable: true },
          target_avg_per_day: { type: "NUMBER", nullable: true },
          note: { type: "STRING", nullable: true, description: "ข้อมูลเสริม เช่น Hole No. หรือหมายเหตุในตาราง" }
        },
        required: [
          "location_name",
          "total_qty",
          "daily_qty",
          "accum_qty",
          "remaining_qty"
        ]
      }
    }
  },
  required: ["report_date", "work_category", "locations"]
};

module.exports = { SYSTEM_PROMPT, RESPONSE_SCHEMA };
