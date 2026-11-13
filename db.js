const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'progress.json');

// ตรวจสอบและสร้างโฟลเดอร์ data
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// โหลดข้อมูลทั้งหมดจากไฟล์
function loadData() {
  if (!fs.existsSync(DB_FILE)) {
    return { records: {} };
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[DB Error] อ่านไฟล์ข้อมูลล้มเหลว:', err.message);
    return { records: {} };
  }
}

// บันทึกข้อมูลลงไฟล์
function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB Error] บันทึกไฟล์ข้อมูลล้มเหลว:', err.message);
  }
}

// บันทึกหรืออัปเดตข้อมูลรายงานความก้าวหน้าตามวันที่ (report_date)
function saveProgressReport(reportData) {
  if (!reportData || !reportData.report_date) return null;

  const data = loadData();
  const dateKey = reportData.report_date; // YYYY-MM-DD

  // หากมีข้อมูลเดิมของวันนั้น ให้รวม location เข้าด้วยกัน
  if (!data.records[dateKey]) {
    data.records[dateKey] = {
      report_date: dateKey,
      work_category: reportData.work_category || 'Construction Progress',
      locations: reportData.locations || [],
      updated_at: new Date().toISOString(),
    };
  } else {
    const existing = data.records[dateKey];
    existing.work_category = reportData.work_category || existing.work_category;
    existing.updated_at = new Date().toISOString();

    // รวมหรืออัปเดตแต่ละ location
    const locMap = new Map();
    (existing.locations || []).forEach(loc => locMap.set(loc.location_name, loc));
    (reportData.locations || []).forEach(loc => locMap.set(loc.location_name, loc));
    existing.locations = Array.from(locMap.values());
  }

  saveData(data);
  return data.records[dateKey];
}

// ดึงข้อมูลตามวันที่ระบุ YYYY-MM-DD
function getReportByDate(dateStr) {
  const data = loadData();
  return data.records[dateStr] || null;
}

// ดึงข้อมูลย้อนหลัง N วัน
function getRecentReports(limit = 30) {
  const data = loadData();
  const dates = Object.keys(data.records).sort().reverse().slice(0, limit);
  return dates.map(d => data.records[d]);
}

// ดึงข้อมูลล่าสุดที่มีในระบบ
function getLatestReport() {
  const data = loadData();
  const dates = Object.keys(data.records).sort().reverse();
  if (dates.length === 0) return null;
  return data.records[dates[0]];
}

// ดึงข้อมูลทั้งหมดในรูปแบบข้อความสรุป เพื่อส่งเป็น Context ให้ Gemini ตอบคำถาม
function getHistoryContextForAI(limit = 14) {
  const data = loadData();
  const dates = Object.keys(data.records).sort().reverse().slice(0, limit);
  if (dates.length === 0) return 'ไม่มีข้อมูลรายงานในระบบ';

  return dates.map(dateKey => {
    const rec = data.records[dateKey];
    let locSummary = (rec.locations || []).map(loc => {
      return `  - จุดงาน ${loc.location_name} (${loc.sub_title || '-'}): ผลงานวันนี้ +${loc.daily_qty} ต้น, สะสม ${loc.accum_qty}/${loc.total_qty} ต้น (${((loc.accum_qty/loc.total_qty)*100).toFixed(1)}%), คงเหลือ ${loc.remaining_qty} ต้น, เฉลี่ย ${loc.current_avg_per_day || '-'} ต้น/วัน (เป้า ${loc.target_avg_per_day || '-'})`;
    }).join('\n');

    return `[วันที่ ${dateKey} - งาน: ${rec.work_category}]\n${locSummary}`;
  }).join('\n\n');
}

// ดึงรายการจุดงานทั้งหมด (Unique) พร้อมผลงานล่าสุดของแต่ละจุด
function getAllUniqueLocations() {
  const data = loadData();
  const dates = Object.keys(data.records).sort().reverse();
  const locMap = new Map();

  for (const d of dates) {
    const rec = data.records[d];
    for (const loc of (rec.locations || [])) {
      const key = loc.location_name.trim().toLowerCase();
      if (!locMap.has(key)) {
        locMap.set(key, {
          ...loc,
          work_category: rec.work_category,
          latest_date: d
        });
      }
    }
  }

  return Array.from(locMap.values());
}

module.exports = {
  saveProgressReport,
  getReportByDate,
  getRecentReports,
  getLatestReport,
  getAllUniqueLocations,
  getHistoryContextForAI
};
