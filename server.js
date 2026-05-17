require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");

const app = express();
app.use(express.json());

const PREMIUM_FILE = "./premium.json";

let premiumUsers = {};

if (fs.existsSync(PREMIUM_FILE)) {
    premiumUsers = JSON.parse(fs.readFileSync(PREMIUM_FILE));
}

function save() {
    fs.writeFileSync(PREMIUM_FILE, JSON.stringify(premiumUsers, null, 2));
}

// ================= WEBHOOK =================
app.post("/razorpay-webhook", (req, res) => {
    try {
        const secret = process.env.WEBHOOK_SECRET;

        const signature = req.headers["x-razorpay-signature"];

        const expected = crypto
            .createHmac("sha256", secret)
            .update(JSON.stringify(req.body))
            .digest("hex");

        if (signature !== expected) {
            return res.status(400).send("Invalid signature");
        }

        const payload = req.body.payload;

        // safer extraction
        const paymentEntity =
            payload.payment_link?.entity ||
            payload.payment?.entity;

        if (!paymentEntity) {
            return res.status(400).send("No payment data");
        }

        const telegramId = paymentEntity.notes?.telegramId;
        const username = paymentEntity.notes?.username || "unknown";

        if (!telegramId) {
            return res.status(400).send("Missing telegramId");
        }

        // ================= STORE PREMIUM =================
        premiumUsers[telegramId] = {
            username: username,
            expiry: Date.now() + 24 * 60 * 60 * 1000 // 1 day
        };

        save();

        console.log("✅ Premium Activated:", {
            telegramId,
            username
        });

        res.send("OK");

    } catch (err) {
        console.log(err);
        res.status(500).send("error");
    }
});

app.listen(3000, () => {
    console.log("Webhook running on 3000");
});