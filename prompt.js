const SYSTEM_PROMPT = `
คุณคือวิศวกรควบคุมงานก่อสร้าง (Construction Control Engineer)
หน้าที่ของคุณคืออ่านรูปภาพรายงานความก้าวหน้า (Progress Drawing / Table) ที่ส่งเข้ามาทั้งหมด แล้วสกัดข้อมูลออกมาเป็น JSON ตามโครงสร้างที่กำหนดอย่างแม่นยำ

กฎการอ่านข้อมูล:
1. แยกข้อมูลตามแต่ละจุดงาน (Location) เช่น IVS06, IVS07 โดยดูจาก Title Block มุมขวาล่าง หรือหัวข้อใต้แบบ
2. อ่านวันที่อัปเดตข้อมูล (Update Date) แปลงเป็นรูปแบบ YYYY-MM-DD (หากเป็นปี พ.ศ. เช่น 69 ให้แปลงเป็น ค.ศ. 2026)
3. อ่านวันที่เริ่มงาน (Start Date) และวันที่กำหนดเสร็จ (Target End Date) แปลงเป็น YYYY-MM-DD
4. ดึงตัวเลข Quantity (ทั้งหมด), Daily Progress (ทำได้วันนี้/ล่าสุด), Accumulate (สะสม), Remaining (คงเหลือ), Average per day (เฉลี่ย/วัน) และ Target avg. per day (เป้า/วัน)
5. หากเป็นตารางแบบลิสต์ (เช่น รูป IVS06 ที่มีตาราง Complete Date) ให้ตรวจสอบว่าวันที่ล่าสุดตรงกับ Update Date มีกี่ต้น นั่นคือ daily_qty และระบุหมายเลข Hole No. ล่าสุดในช่อง note
6. ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอธิบายอื่นปน
`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    report_date: { type: "STRING", description: "วันที่ของรายงาน YYYY-MM-DD" },
    work_category: { type: "STRING", description: "ประเภทงานหลัก เช่น Ground Improvement (Jet Grout)" },
    locations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          location_name: { type: "STRING", description: "ชื่อจุดงาน เช่น IVS07, IVS06" },
          sub_title: { type: "STRING", description: "รายละเอียดเพิ่มเติม เช่น TBM Break-out" },
          start_date: { type: "STRING", description: "YYYY-MM-DD" },
          target_end_date: { type: "STRING", description: "YYYY-MM-DD" },
          total_qty: { type: "NUMBER" },
          daily_qty: { type: "NUMBER" },
          accum_qty: { type: "NUMBER" },
          remaining_qty: { type: "NUMBER" },
          current_avg_per_day: { type: "NUMBER", nullable: true },
          target_avg_per_day: { type: "NUMBER", nullable: true },
          note: { type: "STRING", description: "ข้อมูลเสริม เช่น Hole No. ล่าสุด หรือรูที่เหลือ" }
        },
        required: [
          "location_name",
          "start_date",
          "target_end_date",
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
