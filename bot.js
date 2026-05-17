require("dotenv").config();

const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const Razorpay = require("razorpay");

const { getSubjectAttendance, getResultPDF } = require("./attendance");
const { loadModification, submitCanteen } = require("./canteen");

// ================= BOT =================
const bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: true,
});

// ================= RAZORPAY =================
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ================= PREMIUM STORAGE =================
const PREMIUM_FILE = "./premium.json";
let premiumUsers = {};

if (fs.existsSync(PREMIUM_FILE)) {
    premiumUsers = JSON.parse(fs.readFileSync(PREMIUM_FILE));
}

function savePremiumUsers() {
    fs.writeFileSync(PREMIUM_FILE, JSON.stringify(premiumUsers, null, 2));
}

function isPremium(userId) {
    return premiumUsers[userId] && Date.now() < premiumUsers[userId];
}

// ================= AUTO SESSION CLEANUP (1 DAY) =================
let sessions = {};

setInterval(() => {
    const now = Date.now();

    for (const id in sessions) {
        if (sessions[id]?.createdAt && now - sessions[id].createdAt > 24 * 60 * 60 * 1000) {
            delete sessions[id];
        }
    }
}, 60 * 60 * 1000);

// ================= SUBJECTS =================
const SUBJECTS_23 = [
    { name: "Advanced Machine Learning", code: "BTCS-T-PE-055" },
    { name: "Big Data Analytics", code: "BTCS-T-PE-058" },
    { name: "Compiler Design", code: "BTCS-T-PC-020" },
    { name: "Computer Graphics", code: "BTCS-T-PE-028" },
    { name: "Cryptography & Network Security", code: "BTCS-T-PE-059" },
    { name: "Internet of Things", code: "BTCS-T-PC-056" },
    { name: "Software Engineering", code: "BTCS-T-PC-026" },
    { name: "Natural Language Processing", code: "BTCS-T-PE-052" },
];

// ================= PAYMENT =================
async function createPaymentLink(chatId) {
    try {
        return await razorpay.paymentLink.create({
            amount: 100,
            currency: "INR",
            description: "Telegram Premium",
            customer: { name: "Telegram User" },
            notify: { sms: false, email: false },
            notes: { telegramId: String(chatId) },
            callback_method: "get"
        });
    } catch (err) {
        console.log(err);
        return null;
    }
}

async function verifyPayment(linkId) {
    try {
        return await razorpay.paymentLink.fetch(linkId);
    } catch (err) {
        console.log(err);
        return null;
    }
}

// ================= START =================
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    sessions[chatId] = { createdAt: Date.now() };

    await bot.sendMessage(chatId, `🎓 Student Dashboard`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Attendance", callback_data: "att" }],
                [{ text: "📈 Result PDF", callback_data: "res" }],
                [{ text: "🍽 Canteen", callback_data: "canteen" }],
                [{ text: "💎 Buy Premium", callback_data: "premium" }],
                [{ text: "🔄 Reset", callback_data: "reset" }],
            ],
        },
    });
});

// ================= CALLBACK =================
bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const data = q.data;

    if (!sessions[chatId]) {
        sessions[chatId] = { createdAt: Date.now() };
    }

    // RESET
    if (data === "reset") {
        delete sessions[chatId];
        return bot.sendMessage(chatId, "🔄 Reset done");
    }

    // PREMIUM
    if (data === "premium") {
        const payment = await createPaymentLink(chatId);

        if (!payment) return bot.sendMessage(chatId, "❌ Payment error");

        sessions[chatId].paymentLinkId = payment.id;

        return bot.sendMessage(chatId,
            `💎 Premium ₹1/day`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "💳 Pay", url: payment.short_url }],
                    [{ text: "✅ Verify", callback_data: "verify_payment" }],
                ],
            },
        });
    }

    // VERIFY PAYMENT
    if (data === "verify_payment") {
        const linkId = sessions[chatId]?.paymentLinkId;

        if (!linkId) return bot.sendMessage(chatId, "❌ No payment found");

        const payment = await verifyPayment(linkId);

        if (payment?.status === "paid") {
            premiumUsers[chatId] = Date.now() + 24 * 60 * 60 * 1000;
            savePremiumUsers();

            return bot.sendMessage(chatId, "✅ Premium Activated (1 Day)");
        }

        return bot.sendMessage(chatId, "❌ Payment not completed");
    }

    // ATTENDANCE
    if (data === "att") {
        if (!isPremium(chatId))
            return bot.sendMessage(chatId, "❌ Premium required");

        sessions[chatId] = {
            mode: "att",
            step: "id",
            createdAt: Date.now(),
        };

        return bot.sendMessage(chatId, "📊 Enter College ID");
    }

    // RESULT
    if (data === "res") {
        if (!isPremium(chatId))
            return bot.sendMessage(chatId, "❌ Premium required");

        sessions[chatId] = {
            mode: "res",
            step: "id",
            createdAt: Date.now(),
        };

        return bot.sendMessage(chatId, "📈 Enter College ID");
    }

    // CANTEEN
    if (data === "canteen") {
        if (!isPremium(chatId))
            return bot.sendMessage(chatId, "❌ Premium required");

        sessions[chatId] = {
            mode: "canteen",
            step: "id",
            createdAt: Date.now(),
        };

        return bot.sendMessage(chatId, "🍽 Enter College ID");
    }

    // SUBJECT
    if (data.startsWith("sub_")) {
        const index = parseInt(data.split("_")[1]);

        sessions[chatId].subject = SUBJECTS_23[index];

        return bot.sendMessage(chatId, "📌 Select Section", {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "A", callback_data: "sec_A" },
                        { text: "B", callback_data: "sec_B" },
                    ],
                    [
                        { text: "C", callback_data: "sec_C" },
                        { text: "D", callback_data: "sec_D" },
                    ],
                ],
            },
        });
    }

    // SECTION RESULT
    if (data.startsWith("sec_")) {
        const section = data.split("_")[1];
        const session = sessions[chatId];

        try {
            const result = await getSubjectAttendance(
                session.subject,
                session.studentCode,
                section
            );

            return bot.sendMessage(chatId,
`📊 ${session.subject.name}
Present: ${result.present}
Absent: ${result.absent}
Total: ${result.total}
Attendance: ${result.percent}%`
            );
        } catch (e) {
            return bot.sendMessage(chatId, "❌ Error fetching data");
        }
    }
});

// ================= MESSAGE HANDLER =================
bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    const session = sessions[chatId];
    if (!session) return;

    // ATTENDANCE FLOW
    if (session.mode === "att") {
        if (session.step === "id") {
            session.studentCode = "SITBBS" + text.toUpperCase();

            const buttons = SUBJECTS_23.map((s, i) => [
                { text: s.name, callback_data: `sub_${i}` }
            ]);

            return bot.sendMessage(chatId, "📚 Select Subject", {
                reply_markup: { inline_keyboard: buttons },
            });
        }
    }

    // RESULT FLOW
    if (session.mode === "res") {
        session.studentCode = "SITBBS" + text.toUpperCase();

        try {
            const file = await getResultPDF(session.studentCode);
            return bot.sendDocument(chatId, file);
        } catch {
            return bot.sendMessage(chatId, "❌ Failed");
        }
    }

    // ================= CANTEEN FULL FLOW =================
    if (session.mode === "canteen") {

        const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];

        if (session.step === "id") {
            session.studentCode = "SITBBS" + text.toUpperCase();

            const mealData = await loadModification(session.studentCode);

            session.lunchArr = mealData.lunchArr;
            session.dinnerArr = mealData.dinnerArr;

            session.step = "date";

            return bot.sendMessage(chatId, "📅 Enter Date (DD-MM-YYYY)");
        }

        if (session.step === "date") {
            session.fromDate = text;
            session.step = "meal";

            return bot.sendMessage(chatId, "🍛 Lunch or Dinner?");
        }

        if (session.step === "meal") {
            session.selectedMeal = text.toLowerCase();
            session.step = "day";

            return bot.sendMessage(chatId, "📅 Enter Day (Monday-Sunday)");
        }

        if (session.step === "day") {
            session.dayIndex = DAYS.indexOf(text.toUpperCase());
            session.step = "value";

            return bot.sendMessage(chatId, "🍽 VEG / NON-VEG / EGG");
        }

        if (session.step === "value") {
            const value = text.toUpperCase();

            if (session.selectedMeal === "lunch") {
                session.lunchArr[session.dayIndex] = value;
            } else {
                session.dinnerArr[session.dayIndex] = value;
            }

            await submitCanteen({
                category: "Resident",
                user_code: session.studentCode,
                breakFastArr: ["ALL","ALL","ALL","ALL","ALL","ALL","ALL"],
                lunchArr: session.lunchArr,
                dinnerArr: session.dinnerArr,
                caution_diposit: "YES",
                type: "Registration",
                record_status: "Completed",
                from_date: session.fromDate
            });

            delete sessions[chatId];

            return bot.sendMessage(chatId, "✅ Canteen Updated");
        }
    }
});

console.log("✅ Bot Running...");