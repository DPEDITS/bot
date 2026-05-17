require("dotenv").config();

const fs = require("fs");

const TelegramBot =
    require("node-telegram-bot-api");

const Razorpay =
    require("razorpay");

const {
    getSubjectAttendance,
    getResultPDF
} = require("./attendance");

const {
    loadModification,
    submitCanteen
} = require("./canteen");

// ================= TELEGRAM BOT =================
const bot = new TelegramBot(
    process.env.BOT_TOKEN ||
    "8473345699:AAHXYomdmS3zivvLpkqLRogq6jbExm2MwEc",
    {
        polling: true
    }
);

// ================= RAZORPAY =================
const razorpay =
    new Razorpay({

        key_id:
            process.env.RAZORPAY_KEY_ID,

        key_secret:
            process.env.RAZORPAY_KEY_SECRET
    });

// ================= PREMIUM STORAGE =================
const PREMIUM_FILE =
    "./premium.json";

let premiumUsers = {};

if (fs.existsSync(PREMIUM_FILE)) {

    premiumUsers =
        JSON.parse(
            fs.readFileSync(PREMIUM_FILE)
        );
}

function savePremiumUsers() {

    fs.writeFileSync(
        PREMIUM_FILE,

        JSON.stringify(
            premiumUsers,
            null,
            2
        )
    );
}

function isPremium(userId) {

    if (!premiumUsers[userId]) {
        return false;
    }

    return (
        Date.now() <
        premiumUsers[userId]
    );
}

// ================= CREATE PAYMENT =================
async function createPaymentLink(chatId) {

    try {

        const payment =
            await razorpay.paymentLink.create({

                amount: 100, // ₹1

                currency: "INR",

                description:
                    "ERP Bot Premium",

                customer: {
                    name:
                        "Telegram User"
                },

                notify: {
                    sms: false,
                    email: false
                },

                reminder_enable: true,

                notes: {
                    telegramId:
                        String(chatId)
                },

                callback_url:
                    "https://t.me/YOUR_BOT_USERNAME",

                callback_method:
                    "get"
            });

        return payment;

    } catch (err) {

        console.log(err);

        return null;
    }
}

// ================= VERIFY PAYMENT =================
async function verifyPayment(linkId) {

    try {

        const payment =
            await razorpay.paymentLink.fetch(
                linkId
            );

        return payment;

    } catch (err) {

        console.log(err);

        return null;
    }
}

// ================= SESSIONS =================
let sessions = {};

// ================= SUBJECTS =================
const SUBJECTS_23 = [

    {
        name:
            "Advanced Machine Learning",

        code:
            "BTCS-T-PE-055"
    },

    {
        name:
            "Big Data Analytics",

        code:
            "BTCS-T-PE-058"
    },

    {
        name:
            "Compiler Design",

        code:
            "BTCS-T-PC-020"
    },

    {
        name:
            "Computer Graphics",

        code:
            "BTCS-T-PE-028"
    },

    {
        name:
            "Cryptography & Network Security",

        code:
            "BTCS-T-PE-059"
    },

    {
        name:
            "Internet of Things",

        code:
            "BTCS-T-PC-056"
    },

    {
        name:
            "Software Engineering",

        code:
            "BTCS-T-PC-026"
    },

    {
        name:
            "Natural Language Processing",

        code:
            "BTCS-T-PE-052"
    }
];

// ================= START =================
bot.onText(
    /\/start/,

    async (msg) => {

        const chatId =
            msg.chat.id;

        sessions[chatId] = {};

        await bot.sendMessage(
            chatId,

`🎓 *Student Dashboard*

Choose an option below:`,

            {
                parse_mode:
                    "Markdown",

                reply_markup: {

                    inline_keyboard: [

                        [
                            {
                                text:
                                    "📊 Attendance",

                                callback_data:
                                    "att"
                            }
                        ],

                        [
                            {
                                text:
                                    "📈 Result PDF",

                                callback_data:
                                    "res"
                            }
                        ],

                        [
                            {
                                text:
                                    "🍽 Canteen",

                                callback_data:
                                    "canteen"
                            }
                        ],

                        [
                            {
                                text:
                                    "💎 Buy Premium",

                                callback_data:
                                    "premium"
                            }
                        ],

                        [
                            {
                                text:
                                    "🔄 Reset",

                                callback_data:
                                    "reset"
                            }
                        ]
                    ]
                }
            }
        );
    }
);

// ================= CALLBACK =================
bot.on(
    "callback_query",

    async (q) => {

        const chatId =
            q.message.chat.id;

        const data =
            q.data;

        if (!sessions[chatId]) {
            sessions[chatId] = {};
        }

        // ================= RESET =================
        if (data === "reset") {

            delete sessions[chatId];

            return bot.sendMessage(
                chatId,
                "🔄 Session reset"
            );
        }

        // ================= PREMIUM =================
        if (data === "premium") {

            const payment =
                await createPaymentLink(
                    chatId
                );

            if (!payment) {

                return bot.sendMessage(
                    chatId,
                    "❌ Failed creating payment"
                );
            }

            sessions[chatId]
                .paymentLinkId =
                payment.id;

            return bot.sendMessage(
                chatId,

`💎 *Premium Subscription*

✅ Attendance access
✅ Result PDF
✅ ERP automation
✅ Canteen modification

💰 ₹1 / Day

After payment click:
✅ Verify Payment`,

                {
                    parse_mode:
                        "Markdown",

                    reply_markup: {

                        inline_keyboard: [

                            [
                                {
                                    text:
                                        "💳 Pay ₹1",

                                    url:
                                        payment.short_url
                                }
                            ],

                            [
                                {
                                    text:
                                        "✅ Verify Payment",

                                    callback_data:
                                        "verify_payment"
                                }
                            ]
                        ]
                    }
                }
            );
        }

        // ================= VERIFY PAYMENT =================
        if (
            data ===
            "verify_payment"
        ) {

            const linkId =
                sessions[chatId]
                    ?.paymentLinkId;

            if (!linkId) {

                return bot.sendMessage(
                    chatId,
                    "❌ No payment found"
                );
            }

            const payment =
                await verifyPayment(
                    linkId
                );

            if (!payment) {

                return bot.sendMessage(
                    chatId,
                    "❌ Verification failed"
                );
            }

            if (
                payment.status ===
                "paid"
            ) {

                premiumUsers[
                    chatId
                ] =
                    Date.now() +
                    (
                        24 *
                        60 *
                        60 *
                        1000
                    );

                savePremiumUsers();

                return bot.sendMessage(
                    chatId,

`✅ Payment Verified

💎 Premium Activated

⏰ Valid:
1 Day`
                );
            }

            return bot.sendMessage(
                chatId,

`❌ Payment not completed yet`
            );
        }

        // ================= ATTENDANCE =================
        if (data === "att") {

            if (
                !isPremium(chatId)
            ) {

                return bot.sendMessage(
                    chatId,

`❌ Premium required

Buy premium first.`
                );
            }

            sessions[chatId] = {

                mode: "att",
                step: "id"
            };

            return bot.sendMessage(
                chatId,

`📊 Enter College ID

Example:
23bcsd66`
            );
        }

        // ================= RESULT =================
        if (data === "res") {

            if (
                !isPremium(chatId)
            ) {

                return bot.sendMessage(
                    chatId,

`❌ Premium required

Buy premium first.`
                );
            }

            sessions[chatId] = {

                mode: "res",
                step: "id"
            };

            return bot.sendMessage(
                chatId,

`📈 Enter College ID

Example:
23bcsd66`
            );
        }

        // ================= CANTEEN =================
        if (data === "canteen") {

            if (
                !isPremium(chatId)
            ) {

                return bot.sendMessage(
                    chatId,

`❌ Premium required

Buy premium first.`
                );
            }

            sessions[chatId] = {

                mode: "canteen",
                step: "id"
            };

            return bot.sendMessage(
                chatId,

`🍽 Enter College ID

Example:
23bcsd66`
            );
        }

        // ================= SUBJECT =================
        if (
            data.startsWith("sub_")
        ) {

            const index =
                parseInt(
                    data.split("_")[1]
                );

            sessions[
                chatId
            ].subject =
                SUBJECTS_23[index];

            return bot.sendMessage(
                chatId,

                "📌 Select Section",

                {
                    reply_markup: {

                        inline_keyboard: [

                            [
                                {
                                    text: "A",
                                    callback_data:
                                        "sec_A"
                                },

                                {
                                    text: "B",
                                    callback_data:
                                        "sec_B"
                                }
                            ],

                            [
                                {
                                    text: "C",
                                    callback_data:
                                        "sec_C"
                                },

                                {
                                    text: "D",
                                    callback_data:
                                        "sec_D"
                                }
                            ]
                        ]
                    }
                }
            );
        }

        // ================= SECTION =================
        if (
            data.startsWith("sec_")
        ) {

            const section =
                data.split("_")[1];

            const session =
                sessions[chatId];

            try {

                await bot.sendMessage(
                    chatId,
                    "⏳ Fetching..."
                );

                const result =
                    await getSubjectAttendance(
                        session.subject,
                        session.studentCode,
                        section
                    );

                return bot.sendMessage(
                    chatId,

`📊 *${session.subject.name}*

✅ Present:
${result.present}

❌ Absent:
${result.absent}

📚 Total:
${result.total}

📈 Attendance:
*${result.percent}%*`,

                    {
                        parse_mode:
                            "Markdown"
                    }
                );

            } catch (err) {

                console.log(err);

                return bot.sendMessage(
                    chatId,
                    "❌ Failed"
                );
            }
        }
    }
);

// ================= MESSAGE =================
bot.on(
    "message",

    async (msg) => {

        if (!msg.text) return;

        if (
            msg.text.startsWith("/")
        ) {
            return;
        }

        const chatId =
            msg.chat.id;

        const text =
            msg.text.trim();

        if (
            !sessions[chatId]
        ) {
            return;
        }

        const session =
            sessions[chatId];

        // ================= ATTENDANCE =================
        if (
            session.mode === "att"
        ) {

            if (
                session.step === "id"
            ) {

                session.studentCode =
                    "SITBBS" +
                    text.toUpperCase();

                const buttons =
                    SUBJECTS_23.map(
                        (s, i) => [

                            {
                                text:
                                    s.name,

                                callback_data:
                                    `sub_${i}`
                            }
                        ]
                    );

                return bot.sendMessage(
                    chatId,

                    "📚 Select Subject",

                    {
                        reply_markup: {

                            inline_keyboard:
                                buttons
                        }
                    }
                );
            }
        }

        // ================= RESULT =================
        if (
            session.mode === "res"
        ) {

            if (
                session.step === "id"
            ) {

                session.studentCode =
                    "SITBBS" +
                    text.toUpperCase();

                try {

                    await bot.sendMessage(
                        chatId,
                        "⏳ Fetching PDF..."
                    );

                    const filePath =
                        await getResultPDF(
                            session.studentCode
                        );

                    return bot.sendDocument(
                        chatId,
                        filePath
                    );

                } catch (err) {

                    console.log(err);

                    return bot.sendMessage(
                        chatId,
                        "❌ Failed"
                    );
                }
            }
        }

        // ================= CANTEEN =================
        if (
            session.mode === "canteen"
        ) {

            const DAYS = [

                "MONDAY",
                "TUESDAY",
                "WEDNESDAY",
                "THURSDAY",
                "FRIDAY",
                "SATURDAY",
                "SUNDAY"
            ];

            // ===== STEP 1 =====
            if (
                session.step === "id"
            ) {

                session.studentCode =
                    "SITBBS" +
                    text.toUpperCase();

                try {

                    const mealData =
                        await loadModification(
                            session.studentCode
                        );

                    session.lunchArr =
                        mealData.lunchArr;

                    session.dinnerArr =
                        mealData.dinnerArr;

                    session.step =
                        "date";

                    return bot.sendMessage(
                        chatId,

`📅 Enter Date

Example:
17-05-2026`
                    );

                } catch (err) {

                    console.log(err);

                    return bot.sendMessage(
                        chatId,
                        "❌ Failed"
                    );
                }
            }

            // ===== STEP 2 =====
            if (
                session.step === "date"
            ) {

                session.fromDate =
                    text;

                session.step =
                    "meal";

                return bot.sendMessage(
                    chatId,

`🍛 Lunch or Dinner?`
                );
            }

            // ===== STEP 3 =====
            if (
                session.step === "meal"
            ) {

                session.selectedMeal =
                    text.toLowerCase();

                session.step =
                    "day";

                return bot.sendMessage(
                    chatId,

`📅 Enter Day

Monday
Tuesday
Wednesday
Thursday
Friday
Saturday
Sunday`
                );
            }

            // ===== STEP 4 =====
            if (
                session.step === "day"
            ) {

                const index =
                    DAYS.indexOf(
                        text.toUpperCase()
                    );

                session.dayIndex =
                    index;

                session.step =
                    "value";

                return bot.sendMessage(
                    chatId,

`🍽 Enter Value

VEG
NON-VEG
EGG`
                );
            }

            // ===== STEP 5 =====
            if (
                session.step === "value"
            ) {

                const value =
                    text.toUpperCase();

                if (
                    session.selectedMeal ===
                    "lunch"
                ) {

                    session.lunchArr[
                        session.dayIndex
                    ] = value;

                } else {

                    session.dinnerArr[
                        session.dayIndex
                    ] = value;
                }

                try {

                    await submitCanteen({

                        category:
                            "Resident",

                        user_code:
                            session.studentCode,

                        breakFastArr: [
                            "ALL",
                            "ALL",
                            "ALL",
                            "ALL",
                            "ALL",
                            "ALL",
                            "ALL"
                        ],

                        lunchArr:
                            session.lunchArr,

                        dinnerArr:
                            session.dinnerArr,

                        caution_diposit:
                            "YES",

                        type:
                            "Registration",

                        record_status:
                            "Completed",

                        from_date:
                            session.fromDate
                    });

                    delete sessions[
                        chatId
                    ];

                    return bot.sendMessage(
                        chatId,

`✅ Updated Successfully

📅 ${DAYS[
    session.dayIndex
]}

🍛 ${session.selectedMeal}

🍽 ${value}`
                    );

                } catch (err) {

                    console.log(err);

                    return bot.sendMessage(
                        chatId,
                        "❌ Update failed"
                    );
                }
            }
        }
    }
);

// ================= START =================
console.log(
    "✅ Telegram Bot Running..."
);