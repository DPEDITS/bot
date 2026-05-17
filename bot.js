require("dotenv").config();

const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const Razorpay = require("razorpay");

const { getSubjectAttendance, getResultPDF } = require("./attendance");
const { loadModification, submitCanteen } = require("./canteen");

// ================= BOT =================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ================= MENU =================
bot.setMyCommands([{ command: "start", description: "Start Bot" }]);

// ================= RAZORPAY =================
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ================= PREMIUM DB =================
const PREMIUM_FILE = "./premium.json";

let premiumUsers = fs.existsSync(PREMIUM_FILE)
    ? JSON.parse(fs.readFileSync(PREMIUM_FILE))
    : {};

function savePremiumUsers() {
    fs.writeFileSync(PREMIUM_FILE, JSON.stringify(premiumUsers, null, 2));
}

// ================= STATE =================
let sessions = {};
let uiMessage = {};
let messageStore = {};
let canteenLock = {};

// ================= TRACK SYSTEM (FIXED) =================

// Track ALL messages (bot + user metadata)
bot.on("message", (msg) => {
    const chatId = msg.chat.id;

    if (!messageStore[chatId]) {
        messageStore[chatId] = [];
    }

    messageStore[chatId].push({
        id: msg.message_id,
        fromBot: msg.from.is_bot,
        text: msg.text || null
    });
});

// ================= UI ENGINE =================
async function render(chatId, text, buttons = []) {
    const opts = { reply_markup: { inline_keyboard: buttons } };

    try {
        if (uiMessage[chatId]) {
            try {
                await bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: uiMessage[chatId],
                    ...opts
                });
                return;
            } catch {
                // fallback if edit fails
            }
        }

        const msg = await bot.sendMessage(chatId, text, opts);
        uiMessage[chatId] = msg.message_id;

        // track bot message properly
        if (!messageStore[chatId]) messageStore[chatId] = [];
        messageStore[chatId].push({
            id: msg.message_id,
            fromBot: true
        });

    } catch (err) {
        console.log("Render error:", err.message);
    }
}

// ================= DATA =================
const SUBJECTS_23 = [
    { name: "Advanced Machine Learning", code: "BTCS-T-PE-055" },
    { name: "Big Data Analytics", code: "BTCS-T-PE-058" },
    { name: "Compiler Design", code: "BTCS-T-PC-020" },
    { name: "Computer Graphics", code: "BTCS-T-PE-028" },
    { name: "Cryptography & Network Security", code: "BTCS-T-PE-059" },
    { name: "IoT", code: "BTCS-T-PC-056" },
    { name: "Software Engineering", code: "BTCS-T-PC-026" },
    { name: "NLP", code: "BTCS-T-PE-052" },
];

const SECTIONS = ["A", "B", "C", "D"];
const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];

// ================= HOME UI =================
function homeUI() {
    return [
        [{ text: "📊 Attendance", callback_data: "att" }],
        [{ text: "📈 Result PDF", callback_data: "res" }],
        [{ text: "🍽 Canteen", callback_data: "canteen" }],
        [{ text: "💎 Buy Premium", callback_data: "premium" }],
        [{ text: "🔄 Reset", callback_data: "reset" }]
    ];
}

// ================= PAYMENT =================
async function createPaymentLink(chatId, username) {
    return razorpay.paymentLink.create({
        amount: 2000,
        currency: "INR",
        description: "Premium Access",
        customer: { name: "User" },
        notes: {
            telegramId: String(chatId),
            username: username || "unknown"
        }
    }).catch(() => null);
}

async function verifyPayment(id) {
    return razorpay.paymentLink.fetch(id).catch(() => null);
}

// ================= RESET (PRO VERSION FIXED) =================
async function hardReset(chatId) {
    try {
        // delete UI message (bot only)
        if (uiMessage[chatId]) {
            await bot.deleteMessage(chatId, uiMessage[chatId]).catch(() => {});
        }

        // delete tracked bot messages ONLY (safe)
        if (messageStore[chatId]) {
            for (const m of messageStore[chatId]) {
                if (m.fromBot) {
                    await bot.deleteMessage(chatId, m.id).catch(() => {});
                }
            }
        }

    } catch (err) {
        console.log("Reset error:", err.message);
    }

    // FULL CLEAN MEMORY
    delete sessions[chatId];
    delete uiMessage[chatId];
    delete canteenLock[chatId];
    delete messageStore[chatId];

    const msg = await bot.sendMessage(chatId, "🔄 Reset Done", {
        reply_markup: { inline_keyboard: homeUI() }
    });

    uiMessage[chatId] = msg.message_id;
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    sessions[chatId] = {};
    return render(chatId, "🎓 Student Dashboard", homeUI());
});

// ================= CALLBACK =================
bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const data = q.data;

    if (!sessions[chatId]) sessions[chatId] = {};

    if (data === "home") return render(chatId, "🎓 Student Dashboard", homeUI());
    if (data === "reset") return hardReset(chatId);

    // ================= PREMIUM =================
    if (data === "premium") {
        const pay = await createPaymentLink(chatId, q.from?.username);
        if (!pay) return render(chatId, "❌ Payment Error");

        sessions[chatId].payId = pay.id;

        return render(chatId, "💎 Premium ₹20/day", [
            [{ text: "💳 Pay", url: pay.short_url }],
            [{ text: "✅ Verify", callback_data: "verify" }],
            [{ text: "🏠 Home", callback_data: "home" }]
        ]);
    }

    if (data === "verify") {
        const p = await verifyPayment(sessions[chatId]?.payId);

        if (p?.status !== "paid") {
            return render(chatId, "❌ Not Paid Yet", homeUI());
        }

        premiumUsers[chatId] = {
            expiresAt: Date.now() + 86400000,
            canteenUsed: false
        };

        canteenLock[chatId] = false;
        savePremiumUsers();

        return render(chatId, "✅ Premium Activated", homeUI());
    }

    // ================= PREMIUM CHECK =================
    if (["att", "res", "canteen"].includes(data)) {
        const p = premiumUsers[chatId];

        if (!p || Date.now() > p.expiresAt) {
            return render(chatId, "❌ Premium Required", homeUI());
        }

        sessions[chatId] = { mode: data, step: "id" };
        return render(chatId, "📌 Enter College ID");
    }

    const s = sessions[chatId];
    if (!s) return;

    // ================= ATTENDANCE =================
    if (s.mode === "att") {

        if (data.startsWith("sub_")) {
            const i = +data.split("_")[1];
            s.subject = SUBJECTS_23[i];

            return render(chatId, "Select Section", SECTIONS.map(sec => ([{
                text: sec,
                callback_data: `sec_${sec}`
            }])));
        }

        if (data.startsWith("sec_")) {
            const r = await getSubjectAttendance(
                s.subject,
                s.studentCode,
                data.split("_")[1]
            );

            return render(chatId,
`📊 ${s.subject.name}
Present: ${r.present}
Absent: ${r.absent}
Total: ${r.total}
%: ${r.percent}`, homeUI());
        }
    }

    // ================= RESULT =================
    if (s.mode === "res") {
        const file = await getResultPDF(s.studentCode);
        await bot.sendDocument(chatId, file);
        return render(chatId, "📈 Result Ready", homeUI());
    }

    // ================= CANTEEN =================
    if (s.mode === "canteen") {

        if (canteenLock[chatId] || premiumUsers[chatId]?.canteenUsed) {
            return render(chatId, "❌ Already used. Buy again.", homeUI());
        }

        if (s.step === "meal") {
            s.selectedMeal = data.split("_")[1];
            s.step = "day";

            return render(chatId, "Select Day", DAYS.map(d => ([{
                text: d,
                callback_data: `day_${d}`
            }])));
        }

        if (s.step === "day") {
            s.dayIndex = DAYS.indexOf(data.split("_")[1]);
            s.step = "food";

            return render(chatId, "Select Food", [
                [{ text: "VEG", callback_data: "food_VEG" }],
                [{ text: "NON-VEG", callback_data: "food_NON-VEG" }]
            ]);
        }

        if (s.step === "food") {
            const val = data.split("_")[1];

            if (s.selectedMeal === "lunch")
                s.lunchArr[s.dayIndex] = val;
            else
                s.dinnerArr[s.dayIndex] = val;

            await submitCanteen({
                user_code: s.studentCode,
                breakFastArr: Array(7).fill("ALL"),
                lunchArr: s.lunchArr,
                dinnerArr: s.dinnerArr,
                from_date: s.fromDate
            });

            premiumUsers[chatId].canteenUsed = true;
            canteenLock[chatId] = true;
            savePremiumUsers();

            delete sessions[chatId];

            return render(chatId, "✅ Canteen Updated", homeUI());
        }
    }
});

// ================= MESSAGE FLOW =================
bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const s = sessions[chatId];
    if (!s) return;

    if (s.mode === "att" && s.step === "id") {
        s.studentCode = "SITBBS" + msg.text.trim().toUpperCase();

        return render(chatId, "Select Subject", SUBJECTS_23.map((x, i) => ([{
            text: x.name,
            callback_data: `sub_${i}`
        }])));
    }

    if (s.mode === "res") {
        const file = await getResultPDF("SITBBS" + msg.text.trim().toUpperCase());
        await bot.sendDocument(chatId, file);
        return render(chatId, "Result Ready", homeUI());
    }

    if (s.mode === "canteen" && s.step === "id") {
        s.studentCode = "SITBBS" + msg.text.trim().toUpperCase();

        const m = await loadModification(s.studentCode);

        s.lunchArr = m.lunchArr;
        s.dinnerArr = m.dinnerArr;
        s.fromDate = new Date().toISOString().split("T")[0];
        s.step = "meal";

        return render(chatId, "Select Meal", [
            [{ text: "Lunch", callback_data: "meal_lunch" }],
            [{ text: "Dinner", callback_data: "meal_dinner" }]
        ]);
    }
});

console.log("🚀 BOT RUNNING - PRO RESET + FULL TRACKING SYSTEM");