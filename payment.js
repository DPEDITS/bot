require("dotenv").config();

const Razorpay =
    require("razorpay");

const razorpay =
    new Razorpay({

        key_id:
            process.env
            .RAZORPAY_KEY_ID,

        key_secret:
            process.env
            .RAZORPAY_KEY_SECRET
    });

async function createPaymentLink(
    chatId
) {

    try {

        const payment =
            await razorpay
            .paymentLink
            .create({

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
                }
            });

        return payment;

    } catch (err) {

        console.log(err);

        return null;
    }
}

module.exports = {
    createPaymentLink
};