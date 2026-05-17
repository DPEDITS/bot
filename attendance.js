// ================= attendance.js =================

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// ================= CONFIG =================
const ROLE_CODE = "M1Z5SEVJM2dub0NWWE5GZy82dHh2QT09";
const SEM = "6";
const BRANCH = "CSE";
const PROGRAM = "B.TECH";
const BATCH = "SITBBS_B.TECH_2023-2027";

const ADMIN_ID = process.env.ERP_USER || "23bcsd66";
const ADMIN_PASSWORD = process.env.ERP_PASS || "KbcL1Vw25y_p0yEdp";

// ================= GLOBAL BROWSER =================
global.browserInstance = null;

// ================= INIT BROWSER =================
async function initBrowser() {

    if (global.browserInstance) {
        return;
    }

    global.browserInstance = await puppeteer.launch({
        headless: false,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox"
        ]
    });

    const page = await global.browserInstance.newPage();

    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);

    await page.goto(
        "https://erp.silicon.ac.in/estcampus/index.php",
        {
            waitUntil: "domcontentloaded"
        }
    );

    await page.waitForSelector("#username");

    await page.type("#username", ADMIN_ID);

    await page.type("#password", ADMIN_PASSWORD);

    await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({
            waitUntil: "domcontentloaded"
        })
    ]);

    console.log("✅ Logged in once");

    await page.close();
}

// ================= ATTENDANCE =================
async function getSubjectAttendance(
    subject,
    studentCode,
    section
) {

    let page;

    try {

        await initBrowser();

        page = await global.browserInstance.newPage();

        const url =
`https://erp.silicon.ac.in/estcampus/academics/course_coverage_details.php?role_code=${ROLE_CODE}&paper_code=${subject.code}&semester_code=${SEM}&branch_code=${BRANCH}&section_code=${section}&student_code=${studentCode}&programme_code=${PROGRAM}&batch_code=${BATCH}`;

        await page.goto(url, {
            waitUntil: "domcontentloaded"
        });

        const result = await page.evaluate(() => {

            let present = 0;
            let absent = 0;

            document.querySelectorAll("tr").forEach(row => {

                if (row.querySelector(".fa-smile-o")) {
                    present++;
                }

                else if (row.querySelector(".fa-frown-o")) {
                    absent++;
                }
            });

            const total = present + absent;

            const percent =
                total
                    ? ((present / total) * 100).toFixed(2)
                    : 0;

            return {
                present,
                absent,
                total,
                percent
            };
        });

        await page.close();

        return result;

    } catch (err) {

        console.log(err);

        if (page) {
            await page.close();
        }

        return {
            error: true
        };
    }
}

// ================= RESULT PDF =================
async function getResultPDF(studentCode) {

    let page;

    try {

        await initBrowser();

        page = await global.browserInstance.newPage();

        const downloadDir =
            path.join(__dirname, "downloads");

        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir);
        }

        const client =
            await page.target().createCDPSession();

        await client.send(
            "Page.setDownloadBehavior",
            {
                behavior: "allow",
                downloadPath: downloadDir
            }
        );

        await page.goto(
`https://erp.silicon.ac.in/estcampus/autonomous_exam/exam_result.php?role_code=${ROLE_CODE}`,
            {
                waitUntil: "networkidle2"
            }
        );

        await page.waitForFunction(
            () =>
                typeof Final_Semester_Result_pdf_Download === "function"
        );

        const beforeFiles =
            fs.readdirSync(downloadDir);

        await page.evaluate((code) => {

            Final_Semester_Result_pdf_Download(code);

        }, studentCode);

        let filePath = null;

        for (let i = 0; i < 40; i++) {

            await new Promise(r => setTimeout(r, 1000));

            const files =
                fs.readdirSync(downloadDir);

            const newFile = files.find(f =>

                !beforeFiles.includes(f) &&
                f.endsWith(".pdf") &&
                !f.endsWith(".crdownload")
            );

            if (newFile) {

                filePath =
                    path.join(downloadDir, newFile);

                break;
            }
        }

        await page.close();

        return filePath;

    } catch (err) {

        console.log(err);

        if (page) {
            await page.close();
        }

        return null;
    }
}

module.exports = {
    getSubjectAttendance,
    getResultPDF,
    initBrowser
};