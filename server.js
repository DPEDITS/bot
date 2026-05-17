require("dotenv").config();

const express =
    require("express");

const crypto =
    require("crypto");

const fs =
    require("fs");

const app = express();

app.use(
    express.json()
);

// ================= PREMIUM FILE =================
const PREMIUM_FILE =
    "./premium.json";

let premiumUsers = {};

if (fs.existsSync(PREMIUM_FILE)) {

    premiumUsers =
        JSON.parse(
            fs.readFileSync(
                PREMIUM_FILE
            )
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

// ================= WEBHOOK =================
app.post(
    "/razorpay-webhook",

    (req, res) => {

        try {

            const secret =
                "YOUR_WEBHOOK_SECRET";

            const signature =
                req.headers[
                    "x-razorpay-signature"
                ];

            const expected =
                crypto
                .createHmac(
                    "sha256",
                    secret
                )
                .update(
                    JSON.stringify(
                        req.body
                    )
                )
                .digest("hex");

            if (
                signature !== expected
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid Signature"
                    );
            }

            const payload =
                req.body.payload
                .payment_link
                .entity;

            const telegramId =
                payload.notes
                .telegramId;

            // 30 days premium
            premiumUsers[
                telegramId
            ] =
                Date.now() +
                (
                    30 *
                    24 *
                    60 *
                    60 *
                    1000
                );

            savePremiumUsers();

            console.log(
                "Premium Activated:",
                telegramId
            );

            res.send("OK");

        } catch (err) {

            console.log(err);

            res.status(500)
                .send("Error");
        }
    }
);

app.listen(
    3000,

    () => {

        console.log(
            "Webhook Server Running"
        );
    }
);