require("dotenv").config();

const axios = require("axios");
const qs = require("qs");
const { initBrowser } = require("./attendance");

let cachedCookie = null;

// ===============================
// GET SESSION COOKIE (FAST CACHE)
// ===============================
async function getSessionCookie(force = false) {
    try {
        if (cachedCookie && !force) return cachedCookie;

        await initBrowser();

        const page = await global.browserInstance.newPage();

        await page.goto(
            "https://erp.silicon.ac.in/estcampus/canteen/canteen_registration.php?role_code=M1Z5SEVJM2dub0NWWE5GZy82dHh2QT09",
            {
                waitUntil: "domcontentloaded",
                timeout: 60000
            }
        );

        const cookies = await page.cookies();
        await page.close();

        cachedCookie = cookies.map(c => `${c.name}=${c.value}`).join("; ");

        console.log("✅ ERP COOKIE UPDATED");
        return cachedCookie;

    } catch (err) {
        console.log("COOKIE ERROR:", err.message);
        throw err;
    }
}

// ===============================
// ACTIVATE MODIFICATION
// ===============================
async function activateModification(userCode) {
    const cookie = await getSessionCookie();

    try {
        const res = await axios.post(
            "https://erp.silicon.ac.in/estcampus/canteen/db/canteen_registration_db.php?oper=1004",
            qs.stringify({
                emp_code: userCode,
                regd_type: "Registration",
                type: "Modification"
            }),
            {
                headers: {
                    Cookie: cookie,
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest",
                    Origin: "https://erp.silicon.ac.in"
                }
            }
        );

        return res.data;

    } catch (err) {
        console.log("1004 ERROR:", err.message);
        throw err;
    }
}

// ===============================
// LOAD MODIFICATION
// ===============================
async function loadModification(userCode) {
    const cookie = await getSessionCookie();

    await activateModification(userCode);

    try {
        const res = await axios.post(
            "https://erp.silicon.ac.in/estcampus/canteen/db/canteen_registration_db.php?oper=1002",
            qs.stringify({ user_code: userCode }),
            {
                headers: {
                    Cookie: cookie,
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest",
                    Origin: "https://erp.silicon.ac.in"
                }
            }
        );

        const data = res.data || {};

        return {
            lunchArr: Array.isArray(data.lunchArr) ? data.lunchArr : Array(7).fill("NON-VEG"),
            dinnerArr: Array.isArray(data.dinnerArr) ? data.dinnerArr : Array(7).fill("NON-VEG"),
        };

    } catch (err) {
        console.log("LOAD ERROR:", err.message);

        return {
            lunchArr: Array(7).fill("NON-VEG"),
            dinnerArr: Array(7).fill("NON-VEG"),
        };
    }
}

// ===============================
// SUBMIT CANTEEN
// ===============================
async function submitCanteen(data) {
    const cookie = await getSessionCookie();

    await activateModification(data.user_code);

    const payload = {
        category: "Resident",
        user_code: data.user_code,

        breakFastArr: data.breakFastArr.join(","),
        lunchArr: data.lunchArr.join(","),
        dinnerArr: data.dinnerArr.join(","),

        caution_diposit: "YES",
        type: "Registration",
        record_status: "Completed",
        from_date: data.from_date,
    };

    try {
        const res = await axios.post(
            "https://erp.silicon.ac.in/estcampus/canteen/db/canteen_registration_db.php?oper=1003",
            qs.stringify(payload),
            {
                headers: {
                    Cookie: cookie,
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest",
                    Origin: "https://erp.silicon.ac.in"
                }
            }
        );

        return res.data;

    } catch (err) {
        console.log("SUBMIT ERROR:", err.message);
        throw err;
    }
}

module.exports = {
    loadModification,
    submitCanteen,
};