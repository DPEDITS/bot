const axios = require("axios");
const qs = require("qs");

// ========================================
// SESSION COOKIE
// ========================================
async function getSessionCookie() {

    // Replace with fresh cookie if expired
    return "PHPSESSID=mdqbkjfq6q4br2dhfb0uvgrdm2";
}

// ========================================
// LOAD CURRENT MEAL DATA
// ========================================
async function loadModification(userCode) {

    const cookie =
        await getSessionCookie();

    try {

        const response = await axios.post(

            "https://erp.silicon.ac.in/estcampus/canteen/db/canteen_registration_db.php?oper=1002",

            qs.stringify({
                user_code: userCode
            }),

            {
                headers: {

                    Cookie: cookie,

                    "Content-Type":
                        "application/x-www-form-urlencoded; charset=UTF-8",

                    "X-Requested-With":
                        "XMLHttpRequest",

                    Origin:
                        "https://erp.silicon.ac.in",

                    Referer:
                        "https://erp.silicon.ac.in/estcampus/canteen/canteen_registration.php"
                }
            }
        );

        console.log("LOAD RESPONSE:");
        console.log(response.data);

        const data =
            response.data || {};

        // SAFE DEFAULT ARRAYS
        const lunchArr =
            Array.isArray(data.lunchArr)
                ? data.lunchArr
                : [
                    "NON-VEG",
                    "NON-VEG",
                    "NON-VEG",
                    "NON-VEG",
                    "NON-VEG",
                    "NON-VEG",
                    "NON-VEG"
                ];

        const dinnerArr =
            Array.isArray(data.dinnerArr)
                ? data.dinnerArr
                : [
                    "NON-VEG",
                    "NON-VEG",
                    "NON-VEG",
                    "NON-VEG",
                    "NON-VEG",
                    "NON-VEG",
                    "NON-VEG"
                ];

        return {
            lunchArr,
            dinnerArr
        };

    } catch (err) {

        console.log(
            "LOAD ERROR:",
            err.response?.data || err.message
        );

        return {

            lunchArr: [
                "NON-VEG",
                "NON-VEG",
                "NON-VEG",
                "NON-VEG",
                "NON-VEG",
                "NON-VEG",
                "NON-VEG"
            ],

            dinnerArr: [
                "NON-VEG",
                "NON-VEG",
                "NON-VEG",
                "NON-VEG",
                "NON-VEG",
                "NON-VEG",
                "NON-VEG"
            ]
        };
    }
}

// ========================================
// SUBMIT CANTEEN UPDATE
// ========================================
async function submitCanteen(data) {

    const cookie =
        await getSessionCookie();

    const payload = {

        category: "Resident",

        user_code:
            data.user_code,

        breakFastArr:
            data.breakFastArr.join(","),

        lunchArr:
            data.lunchArr.join(","),

        dinnerArr:
            data.dinnerArr.join(","),

        caution_diposit:
            "YES",

        type:
            "Registration",

        record_status:
            "Completed",

        from_date:
            data.from_date
    };

    console.log("========== PAYLOAD ==========");
    console.log(payload);

    try {

        const response = await axios.post(

            "https://erp.silicon.ac.in/estcampus/canteen/db/canteen_registration_db.php?oper=1003",

            qs.stringify(payload),

            {
                headers: {

                    Cookie: cookie,

                    "Content-Type":
                        "application/x-www-form-urlencoded; charset=UTF-8",

                    "X-Requested-With":
                        "XMLHttpRequest",

                    Origin:
                        "https://erp.silicon.ac.in",

                    Referer:
                        "https://erp.silicon.ac.in/estcampus/canteen/canteen_registration.php"
                }
            }
        );

        console.log("UPDATE RESPONSE:");
        console.log(response.data);

        return response.data;

    } catch (err) {

        console.log(
            "UPDATE ERROR:",
            err.response?.data || err.message
        );

        throw err;
    }
}

module.exports = {

    loadModification,

    submitCanteen
};