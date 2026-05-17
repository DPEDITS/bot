// ============================
// 👤 GET STUDENT INFO
// ============================
function extractStudentInfo() {
    let name = document.querySelector(".user-menu span")?.innerText || "Student";
    let studentCode = document.querySelector("#student_code")?.value || "N/A";
    return { name, studentCode };
}

// ============================
// 📊 EXTRACT PERSONAL ATTENDANCE
// ============================
function extractPersonalAttendance() {
    let rows = document.querySelectorAll("table tbody tr");

    let present = 0;
    let absent = 0;

    rows.forEach(row => {
        let smile = row.querySelector(".fa-smile-o");
        let frown = row.querySelector(".fa-frown-o");

        if (smile) present++;
        else if (frown) absent++;
    });

    let total = present + absent;

    if (total === 0) return;

    let percentage = (present / total) * 100;

    let needed = 0;
    if (percentage < 80) {
        needed = Math.ceil((0.8 * total - present) / 0.2);
    }

    let student = extractStudentInfo();

    showUI(student, present, total, absent, percentage, needed);
}

// ============================
// 🎨 UI COMPONENT
// ============================
function showUI(student, p, t, a, percent, needed) {
    let oldBox = document.getElementById("attendance-box");
    if (oldBox) oldBox.remove();

    // 🔘 FLOAT BUTTON (always stays)
    let toggleBtn = document.getElementById("attendance-toggle");
    if (!toggleBtn) {
        toggleBtn = document.createElement("div");
        toggleBtn.id = "attendance-toggle";

        Object.assign(toggleBtn.style, {
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "55px",
            height: "55px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #00ff9d, #00c3ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#000",
            fontSize: "22px",
            cursor: "pointer",
            zIndex: "999999",
            boxShadow: "0 8px 20px rgba(0,0,0,0.4)"
        });

        toggleBtn.innerHTML = "📊";
        document.body.appendChild(toggleBtn);
    }

    let box = document.createElement("div");
    box.id = "attendance-box";

    Object.assign(box.style, {
        position: "fixed",
        bottom: "90px",
        right: "20px",
        width: "300px",
        maxWidth: "90vw",
        padding: "18px",
        borderRadius: "18px",
        background: "linear-gradient(145deg, #1a1a1a, #2b2b2b)",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
        zIndex: "999999",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        transition: "all 0.3s ease",
    });

    let statusColor = percent >= 80 ? "#00ff9d" : percent >= 60 ? "#ffc107" : "#ff4d4d";

    box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-size:13px; color:#aaa;">Attendance</div>
                <div style="font-size:17px; font-weight:600;">${student.name}</div>
                <div style="font-size:11px; color:#777;">${student.studentCode}</div>
            </div>
            <div id="hideBox" style="
                cursor:pointer;
                font-size:16px;
                padding:4px 8px;
                border-radius:6px;
                background:#333;">
                —
            </div>
        </div>

        <!-- Progress Bar (Better than circle) -->
        <div style="margin:15px 0;">
            <div style="height:10px; background:#333; border-radius:10px; overflow:hidden;">
                <div style="
                    width:${percent}%;
                    height:100%;
                    background:${statusColor};
                    transition:width 0.5s ease;">
                </div>
            </div>
            <div style="margin-top:6px; font-size:12px; text-align:right;">
                ${percent.toFixed(2)}%
            </div>
        </div>

        <div style="display:flex; justify-content:space-between; text-align:center;">
            <div>
                <div style="color:#00ff9d; font-weight:600;">${p}</div>
                <div style="font-size:11px; color:#aaa;">Present</div>
            </div>
            <div>
                <div style="color:#ff4d4d; font-weight:600;">${a}</div>
                <div style="font-size:11px; color:#aaa;">Absent</div>
            </div>
            <div>
                <div style="color:#ccc; font-weight:600;">${t}</div>
                <div style="font-size:11px; color:#aaa;">Total</div>
            </div>
        </div>

        <div style="
            margin-top:12px;
            padding:10px;
            border-radius:10px;
            background:#111;
            font-size:12px;
            text-align:center;">
            🎯 Need <b>${needed}</b> more classes for 80%
        </div>
    `;

    document.body.appendChild(box);

    // ============================
    // 🔘 TOGGLE LOGIC (HIDE NOT DELETE)
    // ============================
    let isVisible = true;

    toggleBtn.onclick = () => {
        isVisible = !isVisible;
        box.style.display = isVisible ? "block" : "none";
    };

    document.getElementById("hideBox").onclick = () => {
        box.style.display = "none";
        isVisible = false;
    };
}

// ============================
// 🚀 RUN SAFELY AFTER LOAD
// ============================
function waitForTable() {
    let interval = setInterval(() => {
        let table = document.querySelector("table tbody");
        if (table) {
            clearInterval(interval);
            extractPersonalAttendance();
        }
    }, 1000);
}

waitForTable();