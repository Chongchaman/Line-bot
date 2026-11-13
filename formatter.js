// ฟังก์ชันวาด Progress Bar 10 ช่องแบบสี (Color Emoji)
function createProgressBar(percent, fillEmoji = '🟩', emptyEmoji = '⬜') {
  const clamped = Math.max(0, Math.min(100, percent));
  let filled = Math.round((clamped / 100) * 10);

  // กรณีมีผลงานเริ่มต้น (> 0%) ให้แสดงอย่างน้อย 1 ช่องสี เพื่อให้เห็นความก้าวหน้าชัดเจน
  if (clamped > 0 && filled === 0) {
    filled = 1;
  }
  // กรณีงานยังไม่เสร็จ 100% ไม่ให้ขึ้นเต็มหลอด
  if (clamped < 100 && filled === 10) {
    filled = 9;
  }

  const empty = 10 - filled;
  return fillEmoji.repeat(filled) + emptyEmoji.repeat(empty);
}

// ฟังก์ชันใส่จุลภาคคั่นหลักพัน (เช่น 1,457)
function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return Number(n).toLocaleString('en-US');
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
  let overallColor = '🟩';

  let locations = data.locations || [];
  if (filterLocation) {
    const cleanFilter = filterLocation.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const matched = locations.filter(l => l.location_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(cleanFilter));
    if (matched.length > 0) {
      locations = matched;
    } else {
      return buildNotFoundMessage(filterLocation);
    }
  }

  const headerTitle = filterLocation ? `🎯 𝗦𝗣𝗢𝗧 𝗙𝗢𝗖𝗨𝗦 𝗥𝗘𝗣𝗢𝗥𝗧` : `🏗️ 𝗗𝗔𝗜𝗟𝗬 𝗣𝗥𝗢𝗚𝗥𝗘𝗦𝗦 𝗥𝗘𝗣𝗢𝗥𝗧`;
  let msg = `${headerTitle}\n`;
  msg += `📌 งาน: ${data.work_category}\n`;
  msg += `📅 ข้อมูล ณ วันที่: ${formatThaiDate(reportDate)}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  locations.forEach((loc) => {
    totalAll += loc.total_qty;
    accumAll += loc.accum_qty;

    // 1. คำนวณ % Actual
    const actualPct = loc.total_qty > 0 ? (loc.accum_qty / loc.total_qty) * 100 : 0;

    // 2. คำนวณ % Plan ตามระยะเวลา (กรณีในแบบมีระบุวันเริ่มและวันสิ้นสุดจริง)
    const hasSchedule = loc.start_date && loc.target_end_date;
    let planPct = 0;
    let planQty = 0;
    let variance = 0;
    let isOverdue = false;
    let daysLeft = 0;

    let statusBadge = '';
    let actionText = '';
    let actualEmoji = '🟩';

    if (hasSchedule) {
      const totalDuration = diffDays(loc.start_date, loc.target_end_date) + 1;
      const elapsedDays = diffDays(loc.start_date, reportDate) + 1;
      planPct = totalDuration > 0 ? (elapsedDays / totalDuration) * 100 : 0;
      planPct = Math.max(0, Math.min(100, planPct));
      planQty = Math.round((planPct / 100) * loc.total_qty);

      variance = actualPct - planPct;
      isOverdue = new Date(reportDate) > new Date(loc.target_end_date);
      daysLeft = diffDays(reportDate, loc.target_end_date);

      if (isOverdue && loc.remaining_qty > 0) {
        statusBadge = `🔴 𝗦𝗧𝗔𝗧𝗨𝗦: ล่าช้ากว่าแผน ${variance.toFixed(1)}% (เกินกำหนด)`;
        actionText = `🚨 𝗔𝗰𝘁𝗶𝗼𝗻: เร่งปิดงาน ${loc.remaining_qty} ต้นสุดท้ายด่วน`;
        actualEmoji = '🟥';
      } else if (variance < -10) {
        statusBadge = `🔴 𝗦𝗧𝗔𝗧𝗨𝗦: ช้ากว่าแผน ${variance.toFixed(1)}% (วิกฤต)`;
        const reqRate = (loc.remaining_qty / Math.max(1, daysLeft)).toFixed(1);
        actionText = `🚨 𝗔𝗰𝘁𝗶𝗼𝗻: ต้องเร่งเพิ่มเป็น ${reqRate} ต้น/วัน`;
        actualEmoji = '🟥';
      } else if (variance < 0) {
        statusBadge = `🟡 𝗦𝗧𝗔𝗧𝗨𝗦: ต้องเร่งงาน (ช้ากว่าแผน ${variance.toFixed(1)}%)`;
        const reqRate = (loc.remaining_qty / Math.max(1, daysLeft)).toFixed(1);
        actionText = `⚡ 𝗔𝗰𝘁𝗶𝗼𝗻: ต้องเร่งเพิ่มเป็น ${reqRate} ต้น/วัน`;
        actualEmoji = '🟨';
      } else {
        const sign = variance > 0 ? '+' : '';
        statusBadge = `🟢 𝗦𝗧𝗔𝗧𝗨𝗦: อยู่ในแผน (ไวกว่าแผน ${sign}${variance.toFixed(1)}%)`;
        actionText = `✅ 𝗔𝗰𝘁𝗶𝗼𝗻: รักษาระดับการทำงานต่อเนื่อง`;
        actualEmoji = '🟩';
      }
    } else {
      // ไม่มีแผนระยะเวลาในแบบ ให้แสดงผลงานสะสมตามจริง
      statusBadge = `🔵 𝗦𝗧𝗔𝗧𝗨𝗦: ดำเนินงานสะสม ${actualPct.toFixed(1)}%`;
      actionText = `ℹ️ 𝗔𝗰𝘁𝗶𝗼𝗻: ติดตามผลงานประจำวันต่อเนื่อง`;
      actualEmoji = '🟩';
    }

    if (actualEmoji === '🟥') {
      overallColor = '🟥';
    } else if (actualEmoji === '🟨' && overallColor !== '🟥') {
      overallColor = '🟨';
    }

    // 4. ประกอบข้อความรายจุดงาน
    msg += `📍 𝗜𝗩𝗦 / จุดงาน: ${loc.location_name} ${loc.sub_title ? `(${loc.sub_title})` : ''}\n`;
    msg += `${statusBadge}\n\n`;

    if (hasSchedule) {
      msg += `Plan   [${createProgressBar(planPct, '🟦')}] ${planPct.toFixed(1).padStart(5, ' ')}% (${fmtNum(planQty)} ต้น)\n`;
    }
    msg += `Actual [${createProgressBar(actualPct, actualEmoji)}] ${actualPct.toFixed(1).padStart(5, ' ')}% (${fmtNum(loc.accum_qty)}/${fmtNum(loc.total_qty)} ต้น)\n\n`;
    msg += `▸ ผลงานวันนี้ : +${fmtNum(loc.daily_qty)} ต้น (คงเหลือ ${fmtNum(loc.remaining_qty)} ต้น)\n`;

    if (loc.current_avg_per_day && loc.target_avg_per_day) {
      msg += `▸ อัตราเฉลี่ย : ${loc.current_avg_per_day} ต้น/วัน (เป้า ${loc.target_avg_per_day})\n`;
    }

    if (loc.note) {
      msg += `▸ หมายเหตุ : ${loc.note}\n`;
    }

    if (hasSchedule) {
      if (isOverdue) {
        msg += `▸ กำหนดเสร็จ : ${formatThaiDate(loc.target_end_date)} (ล่าช้า ${Math.abs(daysLeft)} วัน)\n`;
      } else {
        msg += `▸ กำหนดเสร็จ : ${formatThaiDate(loc.target_end_date)} (เหลือ ${daysLeft} วัน)\n`;
      }
    }

    msg += `${actionText}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  });

  // 5. สรุปภาพรวมทั้งหมด
  const overallPct = totalAll > 0 ? (accumAll / totalAll) * 100 : 0;
  msg += `📊 𝗢𝗩𝗘𝗥𝗔𝗟𝗟 𝗦𝗨𝗠𝗠𝗔𝗥𝗬\n`;
  msg += `[${createProgressBar(overallPct, overallColor)}] ${overallPct.toFixed(1)}% (รวม ${fmtNum(accumAll)} / ${fmtNum(totalAll)} ต้น)\n\n`;
  msg += `เกณฑ์สถานะ: 🟢 ตามแผน | 🟡 เร่งงาน | 🔴 ล่าช้า`;

  return msg;
}

// ฟังก์ชันสร้างข้อความสรุปภาพรวมจุดงานทั้งหมดในโครงการ (Site Overview)
function buildSiteOverviewMessage(locations) {
  if (!locations || locations.length === 0) {
    return '📌 ยังไม่มีข้อมูลจุดงานในระบบครับ';
  }

  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  let totalAll = 0;
  let accumAll = 0;

  let msg = `📍 𝗦𝗜𝗧𝗘 𝗢𝗩𝗘𝗥𝗩𝗜𝗘𝗪 : จุดงานทั้งหมดในโครงการ\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  locations.forEach((loc, index) => {
    totalAll += loc.total_qty || 0;
    accumAll += loc.accum_qty || 0;

    const numIcon = numberEmojis[index] || `[${index + 1}]`;
    const actualPct = loc.total_qty > 0 ? (loc.accum_qty / loc.total_qty) * 100 : 0;

    // ประเมินสีหลอดตามสถานะ
    let barColor = '🟩';
    if (loc.start_date && loc.target_end_date && loc.latest_date) {
      const isOverdue = new Date(loc.latest_date) > new Date(loc.target_end_date);
      if (isOverdue && loc.remaining_qty > 0) {
        barColor = '🟥';
      }
    }

    const subTitleStr = loc.sub_title ? ` (${loc.sub_title})` : '';
    const workName = loc.work_category ? loc.work_category.replace(/\(.*?\)/g, '').trim() : 'งานก่อสร้าง';

    msg += `${numIcon} จุดงาน: ${loc.location_name}\n`;
    msg += `🏗️ งาน: ${workName}${subTitleStr}\n`;
    msg += `Actual [${createProgressBar(actualPct, barColor)}] ${actualPct.toFixed(1).padStart(5, ' ')}%\n`;
    msg += `▸ ผลงานสะสม : ${fmtNum(loc.accum_qty)} / ${fmtNum(loc.total_qty)} ต้น (คงเหลือ ${fmtNum(loc.remaining_qty)} ต้น)\n\n`;
  });

  const overallPct = totalAll > 0 ? (accumAll / totalAll) * 100 : 0;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 ผลงานรวมทุกจุด : ${fmtNum(accumAll)} / ${fmtNum(totalAll)} ต้น (${overallPct.toFixed(1)}%)\n`;
  msg += `💡 พิมพ์ "#ai สรุป [ชื่อจุด]" เช่น "#ai สรุป ivs07" เพื่อดูรายละเอียดเชิงลึก`;

  return msg;
}

// ฟังก์ชันสร้างเมนูช่วยเหลือและคู่มือการใช้งาน (Help & Command Guide)
function buildHelpMenuMessage() {
  return `👷‍♂️ 𝗖𝗛𝗢𝗡𝗚𝗖𝗛𝗔𝗠𝗔𝗡 𝗔𝗜 𝗔𝗦𝗦𝗜𝗦𝗧𝗔𝗡𝗧
ระบบผู้ช่วยวิศวกรควบคุมงานก่อสร้างอัจฉริยะ
━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 คำสั่งดูรายงานความก้าวหน้า
▸ #ai สรุป ➔ ดู Dashboard ประจำวันล่าสุด
▸ #ai สรุป ivs07 ➔ เจาะจงดูเฉพาะจุดงานที่ต้องการ
▸ #ai สรุปเมื่อวาน ➔ ดูรายงานย้อนหลังของเมื่อวาน

📍 ตรวจสอบจุดงานในโครงการ
▸ #ai มีงานจุดไหนบ้าง ➔ สรุปรายการทุกจุดงานในโครงการ
▸ #ai แต่ละจุดเหลือกี่ต้น ➔ สรุปยอดคงเหลือรายจุด

📈 วิเคราะห์และเปรียบเทียบผลงาน (AI)
▸ #ai วันไหนได้ผลงานเยอะสุด
▸ #ai เปรียบเทียบผลงานวันที่ 12 กับ 13
▸ #ai จุดไหนล่าช้ากว่าแผนมากที่สุด
▸ #ai งานรื้อถอนเสร็จหรือยัง

━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 ส่งภาพแบบ/ตารางความก้าวหน้าเข้ากลุ่มได้ตลอดเวลา บอทจะบันทึกข้อมูลให้อัตโนมัติ (เงียบสนิท ไม่รบกวนกลุ่ม)`;
}

// ฟังก์ชันตกแต่งคำตอบจาก Gemini AI ให้อยู่ในฟอร์มวิศวกรที่สวยงาม
function buildAiResponseCard(answerText) {
  return `📊 𝗔𝗜 𝗘𝗡𝗚𝗜𝗡𝗘𝗘𝗥𝗜𝗡𝗚 𝗔𝗡𝗔𝗟𝗬𝗦𝗜𝗦
━━━━━━━━━━━━━━━━━━━━━━━━━━
${answerText}
━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 สอบถามข้อมูลอื่น พิมพ์ "#ai [คำถาม]" ได้เลยครับ`;
}

// ฟังก์ชันแจ้งเตือนกรณีค้นหาไม่พบข้อมูล
function buildNotFoundMessage(searchedTerm) {
  return `ℹ️ 𝗡𝗢𝗧𝗜𝗙𝗜𝗖𝗔𝗧𝗜𝗢𝗡
━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ไม่พบข้อมูลจุดงาน "${searchedTerm}" ในระบบครับ

💡 พิมพ์ "#ai มีงานจุดไหนบ้าง" เพื่อตรวจสอบรายชื่อจุดงานที่มีข้อมูลในระบบ`;
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
  createProgressBar,
  buildDashboardMessage,
  buildSiteOverviewMessage,
  buildHelpMenuMessage,
  buildAiResponseCard,
  buildNotFoundMessage,
  formatThaiDate,
  getBangkokDateStr
};
