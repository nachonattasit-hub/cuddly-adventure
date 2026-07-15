/**
 * ฟังก์ชันกำจัดการใช้งานทับซ้ำ (Deduplication)
 * สำหรับ Google Apps Script
 */

/**
 * กำจัดแถวที่ซ้ำกันในชีท
 * @param {string} sheetName - ชื่อของชีท
 * @param {number} columnToCheck - คอลัมน์ที่จะตรวจสอบการซ้ำ (เช่น 1 = คอลัมน์ A)
 */
function removeDuplicatesFromSheet(sheetName, columnToCheck = 1) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      console.error(`ไม่พบชีท: ${sheetName}`);
      return;
    }

    const data = sheet.getDataRange().getValues();
    const uniqueData = [];
    const seenValues = new Set();

    for (let i = 0; i < data.length; i++) {
      const valueToCheck = data[i][columnToCheck - 1]; // แปลงเป็น 0-indexed
      const valueString = JSON.stringify(valueToCheck); // เปรียบเทียบจากสตริง

      if (!seenValues.has(valueString)) {
        seenValues.add(valueString);
        uniqueData.push(data[i]);
      } else {
        console.log(`ลบแถวซ้ำ: ${valueToCheck}`);
      }
    }

    // ลบข้อมูลเดิมและเขียนข้อมูลใหม่
    sheet.clearContents();
    if (uniqueData.length > 0) {
      sheet.getRange(1, 1, uniqueData.length, uniqueData[0].length).setValues(uniqueData);
    }

    console.log(`✅ ลบข้อมูลซ้ำเสร็จสิ้น! ลบไป ${data.length - uniqueData.length} แถว`);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด: ", error);
    GmailApp.sendEmail(
      "คุณ",
      "❌ สคริปต์กำจัดข้อมูลซ้ำมีปัญหา",
      `เกิดข้อผิดพลาด: ${error.toString()}`
    );
  }
}

/**
 * กำจัดข้อมูลซ้ำจากหลายคอลัมน์
 * @param {string} sheetName - ชื่อของชีท
 * @param {number[]} columnsToCheck - อาร์เรย์ของหมายเลขคอลัมน์ที่จะตรวจสอบ
 */
function removeDuplicatesByMultipleColumns(sheetName, columnsToCheck = [1]) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      console.error(`ไม่พบชีท: ${sheetName}`);
      return;
    }

    const data = sheet.getDataRange().getValues();
    const uniqueData = [];
    const seenCombinations = new Set();

    for (let i = 0; i < data.length; i++) {
      // สร้างคีย์จากหลายคอลัมน์
      const keyValues = columnsToCheck.map(col => data[i][col - 1]);
      const keyString = JSON.stringify(keyValues);

      if (!seenCombinations.has(keyString)) {
        seenCombinations.add(keyString);
        uniqueData.push(data[i]);
      }
    }

    // ลบข้อมูลเดิมและเขียนข้อมูลใหม่
    sheet.clearContents();
    if (uniqueData.length > 0) {
      sheet.getRange(1, 1, uniqueData.length, uniqueData[0].length).setValues(uniqueData);
    }

    console.log(`✅ ลบข้อมูลซ้ำ (หลายคอลัมน์) เสร็จสิ้น! ลบไป ${data.length - uniqueData.length} แถว`);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด: ", error);
  }
}

/**
 * กำจัดช่องว่างซ้ำและจัดเรียงข้อมูล
 * @param {string} sheetName - ชื่อของชีท
 */
function removeBlankRowsAndDuplicates(sheetName) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      console.error(`ไม่พบชีท: ${sheetName}`);
      return;
    }

    const data = sheet.getDataRange().getValues();
    const uniqueData = [];
    const seenRows = new Set();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // ตรวจสอบว่าแถวว่างหรือไม่
      const isBlankRow = row.every(cell => cell === "" || cell === null);
      if (isBlankRow) continue;

      // ตรวจสอบการซ้ำ
      const rowString = JSON.stringify(row);
      if (!seenRows.has(rowString)) {
        seenRows.add(rowString);
        uniqueData.push(row);
      }
    }

    // ลบข้อมูลเดิมและเขียนข้อมูลใหม่
    sheet.clearContents();
    if (uniqueData.length > 0) {
      sheet.getRange(1, 1, uniqueData.length, uniqueData[0].length).setValues(uniqueData);
    }

    console.log(`✅ ลบช่องว่างและข้อมูลซ้ำเสร็จสิ้น! ลบไป ${data.length - uniqueData.length} แถว`);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด: ", error);
  }
}

/**
 * แสดงสรุปข้อมูลที่ซ้ำ
 * @param {string} sheetName - ชื่อของชีท
 * @param {number} columnToCheck - คอลัมน์ที่จะตรวจสอบ
 */
function showDuplicateSummary(sheetName, columnToCheck = 1) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      console.error(`ไม่พบชีท: ${sheetName}`);
      return;
    }

    const data = sheet.getDataRange().getValues();
    const duplicateMap = {};

    for (let i = 0; i < data.length; i++) {
      const value = data[i][columnToCheck - 1];
      const valueString = JSON.stringify(value);

      if (duplicateMap[valueString]) {
        duplicateMap[valueString]++;
      } else {
        duplicateMap[valueString] = 1;
      }
    }

    // หาค่าที่ซ้ำ
    const duplicates = Object.entries(duplicateMap)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);

    if (duplicates.length === 0) {
      console.log("✅ ไม่มีข้อมูลซ้ำ");
      return;
    }

    console.log(`⚠️ พบข้อมูลซ้ำ ${duplicates.length} รายการ:`);
    duplicates.forEach(([value, count]) => {
      console.log(`  - ${value}: ซ้ำ ${count} ครั้ง`);
    });

    // ส่งอีเมล
    const summary = duplicates
      .map(([value, count]) => `• ${value}: ซ้ำ ${count} ครั้ง`)
      .join("\n");

    GmailApp.sendEmail(
      "คุณ",
      `📊 สรุปข้อมูลซ้ำในชีท: ${sheetName}`,
      `พบข้อมูลซ้ำ ${duplicates.length} รายการ:\n\n${summary}`
    );
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด: ", error);
  }
}

/**
 * ตัวอย่างการใช้งาน
 */
function exampleUsage() {
  // ลบข้อมูลซ้ำจากคอลัมน์ที่ 1 (A) ในชีท "Sheet1"
  removeDuplicatesFromSheet("Sheet1", 1);

  // ลบข้อมูลซ้ำจากคอลัมน์ที่ 1, 2, 3
  // removeDuplicatesByMultipleColumns("Sheet1", [1, 2, 3]);

  // ลบช่องว่างและข้อมูลซ้ำ
  // removeBlankRowsAndDuplicates("Sheet1");

  // แสดงสรุปข้อมูลที่ซ้ำ
  // showDuplicateSummary("Sheet1", 1);
}
