// ฟังก์ชันวาด Progress Bar 10 ช่อง
function createProgressBar(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// ฟังก์ชันแปลงวันที่ YYYY-MM-DD เป็น DD/MM/YYYY
function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// ฟังก์ชันคำนวณจำนวนวันระหว่าง 2 วันที่
function diffDays(date1Str, date2Str) {
  const d1 = new Date(date1Str);
  const d2 = new Date(date2Str);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function buildDashboardMessage(data, filterLocation = null) {
  const reportDate = data.report_date;
  let totalAll = 0;
  let accumAll = 0;

  let locations = data.locations || [];
  if (filterLocation) {
    const cleanFilter = filterLocation.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const matched = locations.filter(l => l.location_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(cleanFilter));
    if (matched.length > 0) {
      locations = matched;
    }
  }

  let msg = `🏗️ 𝗗𝗔𝗜𝗟𝗬 𝗣𝗥𝗢𝗚𝗥𝗘𝗦𝗦 𝗥𝗘𝗣𝗢𝗥𝗧\n`;
  msg += `📌 งาน: ${data.work_category}\n`;
  msg += `📅 ข้อมูล ณ วันที่: ${formatThaiDate(reportDate)}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  locations.forEach((loc) => {
    totalAll += loc.total_qty;
    accumAll += loc.accum_qty;

    // 1. คำนวณ % Actual
    const actualPct = loc.total_qty > 0 ? (loc.accum_qty / loc.total_qty) * 100 : 0;

    // 2. คำนวณ % Plan ตามระยะเวลา
    const totalDuration = diffDays(loc.start_date, loc.target_end_date) + 1;
    const elapsedDays = diffDays(loc.start_date, reportDate) + 1;
    let planPct = totalDuration > 0 ? (elapsedDays / totalDuration) * 100 : 0;
    planPct = Math.max(0, Math.min(100, planPct));
    const planQty = Math.round((planPct / 100) * loc.total_qty);

    const variance = actualPct - planPct;
    const isOverdue = new Date(reportDate) > new Date(loc.target_end_date);
    const daysLeft = diffDays(reportDate, loc.target_end_date);

    // 3. กำหนดสถานะและสีแจ้งเตือน
    let statusBadge = '';
    let actionText = '';

    if (isOverdue && loc.remaining_qty > 0) {
      statusBadge = `🔴 𝗦𝗧𝗔𝗧𝗨𝗦: ล่าช้ากว่าแผน ${variance.toFixed(1)}% (เกินกำหนด)`;
      actionText = `🚨 𝗔𝗰𝘁𝗶𝗼𝗻: เร่งปิดงาน ${loc.remaining_qty} ต้นสุดท้ายด่วน`;
    } else if (variance < -10) {
      statusBadge = `🔴 𝗦𝗧𝗔𝗧𝗨𝗦: ช้ากว่าแผน ${variance.toFixed(1)}% (วิกฤต)`;
      const reqRate = (loc.remaining_qty / Math.max(1, daysLeft)).toFixed(1);
      actionText = `🚨 𝗔𝗰𝘁𝗶𝗼𝗻: ต้องเร่งเพิ่มเป็น ${reqRate} ต้น/วัน`;
    } else if (variance < 0) {
      statusBadge = `🟡 𝗦𝗧𝗔𝗧𝗨𝗦: ต้องเร่งงาน (ช้ากว่าแผน ${variance.toFixed(1)}%)`;
      const reqRate = (loc.remaining_qty / Math.max(1, daysLeft)).toFixed(1);
      actionText = `⚡ 𝗔𝗰𝘁𝗶𝗼𝗻: ต้องเร่งเพิ่มเป็น ${reqRate} ต้น/วัน`;
    } else {
      const sign = variance > 0 ? '+' : '';
      statusBadge = `🟢 𝗦𝗧𝗔𝗧𝗨𝗦: อยู่ในแผน (ไวกว่าแผน ${sign}${variance.toFixed(1)}%)`;
      actionText = `✅ 𝗔𝗰𝘁𝗶𝗼𝗻: รักษาระดับการทำงานต่อเนื่อง`;
    }

    // 4. ประกอบข้อความรายจุดงาน
    msg += `📍 𝗜𝗩𝗦 / จุดงาน: ${loc.location_name} ${loc.sub_title ? `(${loc.sub_title})` : ''}\n`;
    msg += `${statusBadge}\n\n`;
    msg += `Plan   [${createProgressBar(planPct)}] ${planPct.toFixed(1).padStart(5, ' ')}% (${planQty} ต้น)\n`;
    msg += `Actual [${createProgressBar(actualPct)}] ${actualPct.toFixed(1).padStart(5, ' ')}% (${loc.accum_qty}/${loc.total_qty} ต้น)\n\n`;
    msg += `▸ ผลงานวันนี้ : +${loc.daily_qty} ต้น (คงเหลือ ${loc.remaining_qty} ต้น)\n`;

    if (loc.current_avg_per_day && loc.target_avg_per_day) {
      msg += `▸ อัตราเฉลี่ย : ${loc.current_avg_per_day} ต้น/วัน (เป้า ${loc.target_avg_per_day})\n`;
    }

    if (loc.note) {
      msg += `▸ หมายเหตุ : ${loc.note}\n`;
    }

    if (isOverdue) {
      msg += `▸ กำหนดเสร็จ : ${formatThaiDate(loc.target_end_date)} (ล่าช้า ${Math.abs(daysLeft)} วัน)\n`;
    } else {
      msg += `▸ กำหนดเสร็จ : ${formatThaiDate(loc.target_end_date)} (เหลือ ${daysLeft} วัน)\n`;
    }

    msg += `${actionText}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  });

  // 5. สรุปภาพรวมทั้งหมด
  const overallPct = totalAll > 0 ? (accumAll / totalAll) * 100 : 0;
  msg += `📊 𝗢𝗩𝗘𝗥𝗔𝗟𝗟 𝗦𝗨𝗠𝗠𝗔𝗥𝗬\n`;
  msg += `[${createProgressBar(overallPct)}] ${overallPct.toFixed(1)}% (รวม ${accumAll} / ${totalAll} ต้น)\n\n`;
  msg += `เกณฑ์สถานะ: 🟢 ตามแผน | 🟡 เร่งงาน | 🔴 ล่าช้า`;

  return msg;
}

// ฟังก์ชันดึงวันที่ปัจจุบันในเวลาไทย (YYYY-MM-DD)
function getBangkokDateStr(offsetDays = 0) {
  const now = new Date();
  const bangkokTime = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
  bangkokTime.setDate(bangkokTime.getDate() + offsetDays);
  const y = bangkokTime.getFullYear();
  const m = String(bangkokTime.getMonth() + 1).padStart(2, '0');
  const d = String(bangkokTime.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = {
  buildDashboardMessage,
  formatThaiDate,
  getBangkokDateStr
};
