const fs = require("fs");

// ===== Helper functions =====

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

function readShiftRecords(textFile) {
    let data;
    try {
        data = fs.readFileSync(textFile, { encoding: "utf8" });
    } catch (e) {
        return [];
    }
    const lines = data.split(/\r?\n/);
    const records = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (i === 0 && line.toLowerCase().startsWith("driverid")) continue;
        const parts = line.split(",");
        if (parts.length < 10) continue;
        const [
            driverID,
            driverName,
            date,
            startTime,
            endTime,
            shiftDuration,
            idleTime,
            activeTime,
            metQuotaStr,
            hasBonusStr
        ] = parts;
        records.push({
            driverID: driverID.trim(),
            driverName: driverName.trim(),
            date: date.trim(),
            startTime: startTime.trim(),
            endTime: endTime.trim(),
            shiftDuration: shiftDuration.trim(),
            idleTime: idleTime.trim(),
            activeTime: activeTime.trim(),
            metQuota: metQuotaStr.trim() === "true",
            hasBonus: hasBonusStr.trim() === "true"
        });
    }
    return records;
}

function writeShiftRecords(textFile, records) {
    const header = "DriverID,DriverName,Date,StartTime,EndTime,ShiftDuration,IdleTime,ActiveTime,MetQuota,HasBonus";
    const lines = [header];
    for (const r of records) {
        lines.push([
            r.driverID,
            r.driverName,
            r.date,
            r.startTime,
            r.endTime,
            r.shiftDuration,
            r.idleTime,
            r.activeTime,
            r.metQuota ? "true" : "false",
            r.hasBonus ? "true" : "false"
        ].join(","));
    }
    fs.writeFileSync(textFile, lines.join("\n"), { encoding: "utf8" });
}

function readDriverRates(rateFile) {
    let data;
    try {
        data = fs.readFileSync(rateFile, { encoding: "utf8" });
    } catch (e) {
        return [];
    }
    const lines = data.split(/\r?\n/);
    const rates = [];
    for (const lineRaw of lines) {
        const line = lineRaw.trim();
        if (!line) continue;
        const [driverID, dayOff, basePayStr, tierStr] = line.split(",");
        rates.push({
            driverID: driverID.trim(),
            dayOff: (dayOff || "").trim(),
            basePay: parseInt(basePayStr, 10) || 0,
            tier: parseInt(tierStr, 10) || 0
        });
    }
    return rates;
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
    const records = readShiftRecords(textFile);
    const driverID = shiftObj.driverID;
    const date = shiftObj.date;

    const duplicate = records.find(
        (r) => r.driverID === driverID && r.date === date
    );
    if (duplicate) {
        return {};
    }

    const shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    const idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    const activeTime = getActiveTime(shiftDuration, idleTime);
    const met = metQuota(date, activeTime);

    const newRecord = {
        driverID: driverID,
        driverName: shiftObj.driverName,
        date: date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration,
        idleTime,
        activeTime,
        metQuota: met,
        hasBonus: false
    };

    records.push(newRecord);
    records.sort((a, b) => {
        if (a.driverID !== b.driverID) {
            return a.driverID.localeCompare(b.driverID);
        }
        if (a.date !== b.date) {
            return a.date.localeCompare(b.date);
        }
        return parseTime12ToSeconds(a.startTime) - parseTime12ToSeconds(b.startTime);
    });

    writeShiftRecords(textFile, records);

    return {
        driverID: newRecord.driverID,
        driverName: newRecord.driverName,
        date: newRecord.date,
        startTime: newRecord.startTime,
        endTime: newRecord.endTime,
        shiftDuration: newRecord.shiftDuration,
        idleTime: newRecord.idleTime,
        activeTime: newRecord.activeTime,
        metQuota: newRecord.metQuota,
        hasBonus: newRecord.hasBonus
    };
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
    const records = readShiftRecords(textFile);
    let changed = false;
    for (const r of records) {
        if (r.driverID === driverID && r.date === date) {
            r.hasBonus = !!newValue;
            changed = true;
            break;
        }
    }
    if (changed) {
        writeShiftRecords(textFile, records);
    }
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    const records = readShiftRecords(textFile);
    const driverRecords = records.filter((r) => r.driverID === driverID);
    if (driverRecords.length === 0) {
        return -1;
    }
    const monthNum = parseInt(month, 10);
    let count = 0;
    for (const r of driverRecords) {
        const recMonth = parseInt(r.date.split("-")[1], 10);
        if (recMonth === monthNum && r.hasBonus) {
            count++;
        }
    }
    return count;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    const records = readShiftRecords(textFile);
    const monthNum = typeof month === "number" ? month : parseInt(month, 10);
    let totalSec = 0;

    for (const r of records) {
        if (r.driverID !== driverID) continue;
        const recMonth = parseInt(r.date.split("-")[1], 10);
        if (recMonth === monthNum) {
            totalSec += parseHmsToSeconds(r.activeTime);
        }
    }

    return formatSecondsToHMS(totalSec);
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
    const records = readShiftRecords(textFile);
    const monthNum = typeof month === "number" ? month : parseInt(month, 10);
    const normalQuotaSec = 8 * 3600 + 24 * 60; // 8h24m
    const specialQuotaSec = 6 * 3600; // Eid period

    const driverRecords = records.filter(
        (r) =>
            r.driverID === driverID &&
            parseInt(r.date.split("-")[1], 10) === monthNum
    );

    if (driverRecords.length === 0) {
        return "0:00:00";
    }

    let baseRequiredSec = 0;

    for (const r of driverRecords) {
        if (isEidDate(r.date)) {
            baseRequiredSec += specialQuotaSec;
        } else {
            baseRequiredSec += normalQuotaSec;
        }
    }

    const effectiveBonuses = Math.max(0, bonusCount || 0);
    const reductionPerBonus = 2 * 3600; // each bonus reduces 2 hours from required monthly hours
    const totalReduction = effectiveBonuses * reductionPerBonus;
    const requiredSec = Math.max(0, baseRequiredSec - totalReduction);

    return formatSecondsToHMS(requiredSec);
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
    const rates = readDriverRates(rateFile);
    const info = rates.find((r) => r.driverID === driverID);
    if (!info) {
        return 0;
    }

    const basePay = info.basePay;
    const tier = info.tier;

    const actualSec = parseHmsToSeconds(actualHours);
    const requiredSec = parseHmsToSeconds(requiredHours);
    let missingSec = requiredSec - actualSec;
    if (missingSec <= 0) {
        return basePay;
    }

    let allowedMissingHours = 0;
    if (tier === 1) {
        allowedMissingHours = 50;
    } else if (tier === 2) {
        allowedMissingHours = 20;
    } else if (tier === 3) {
        allowedMissingHours = 10;
    } else if (tier === 4) {
        allowedMissingHours = 3;
    }

    const allowedMissingSec = allowedMissingHours * 3600;
    let extraMissingSec = missingSec - allowedMissingSec;
    if (extraMissingSec <= 0) {
        return basePay;
    }

    const deductionRatePerHour = Math.floor(basePay / 185);
    const extraMissingHours = Math.floor(extraMissingSec / 3600);
    const salaryDeduction = extraMissingHours * deductionRatePerHour;

    const netPay = basePay - salaryDeduction;
    return netPay;
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
