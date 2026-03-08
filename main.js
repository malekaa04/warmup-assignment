const fs = require("fs");

// ===== Helper functions (time utilities) =====

function parseTime12ToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return 0;
    const trimmed = timeStr.trim().toLowerCase();
    const parts = trimmed.split(/\s+/);
    const ampm = parts.pop();
    const timePart = parts.join(" ");
    const [hStr, mStr, sStr] = timePart.split(":");
    let h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const s = parseInt(sStr, 10) || 0;

    if (ampm === "am") {
        if (h === 12) h = 0;
    } else if (ampm === "pm") {
        if (h !== 12) h += 12;
    }
    return h * 3600 + m * 60 + s;
}

function parseHmsToSeconds(str) {
    if (!str || typeof str !== "string") return 0;
    const [hStr, mStr, sStr] = str.trim().split(":");
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const s = parseInt(sStr, 10) || 0;
    return h * 3600 + m * 60 + s;
}

function formatSecondsToHMS(totalSeconds) {
    let sec = Math.floor(totalSeconds);
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const hours = Math.floor(sec / 3600);
    sec %= 3600;
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    const mm = minutes.toString().padStart(2, "0");
    const ss = seconds.toString().padStart(2, "0");
    return `${hours}:${mm}:${ss}`;
}

function overlapSeconds(start, end, a, b) {
    const s = Math.max(start, a);
    const e = Math.min(end, b);
    return e > s ? (e - s) : 0;
}

function isEidDate(dateStr) {
    return dateStr >= "2025-04-10" && dateStr <= "2025-04-30";
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    let start = parseTime12ToSeconds(startTime);
    let end = parseTime12ToSeconds(endTime);
    if (end < start) {
        end += 24 * 3600;
    }
    const diff = end - start;
    return formatSecondsToHMS(diff);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    let start = parseTime12ToSeconds(startTime);
    let end = parseTime12ToSeconds(endTime);
    if (end <= start) {
        end += 24 * 3600;
    }

    const DELIVERY_START = 8 * 3600;
    const DELIVERY_END = 22 * 3600;
    let idleSeconds = 0;
    let current = start;

    while (current < end) {
        const dayStart = Math.floor(current / 86400) * 86400;
        const dayEnd = dayStart + 86400;
        const segmentEnd = Math.min(end, dayEnd);

        const idle1Start = dayStart;
        const idle1End = dayStart + DELIVERY_START;
        const idle2Start = dayStart + DELIVERY_END;
        const idle2End = dayEnd;

        idleSeconds += overlapSeconds(current, segmentEnd, idle1Start, idle1End);
        idleSeconds += overlapSeconds(current, segmentEnd, idle2Start, idle2End);

        current = segmentEnd;
    }

    return formatSecondsToHMS(idleSeconds);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    const shiftSec = parseHmsToSeconds(shiftDuration);
    const idleSec = parseHmsToSeconds(idleTime);
    const activeSec = Math.max(0, shiftSec - idleSec);
    return formatSecondsToHMS(activeSec);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    const activeSec = parseHmsToSeconds(activeTime);
    const normalQuotaSec = 8 * 3600 + 24 * 60; // 8h24m
    const specialQuotaSec = 6 * 3600; // Eid period
    const quota = isEidDate(date) ? specialQuotaSec : normalQuotaSec;
    return activeSec >= quota;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    // TODO: Implement this function
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    // TODO: Implement this function
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    // TODO: Implement this function
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
