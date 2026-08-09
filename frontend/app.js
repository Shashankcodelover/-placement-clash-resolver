const API_BASE = 'http://localhost:3000/api';

const socket = io({ auth: { token: "supersecret123" } });
let currentState = {};
let selectedInterviewIndex = 0;

// Fetch state on startup
document.addEventListener("DOMContentLoaded", () => {
    fetchState();
});

socket.on('state_update', (newState) => {
    currentState = newState;
    renderUI();
});

async function fetchState() {
    try {
        const response = await fetch(`${API_BASE}/state`);
        currentState = await response.json();
        renderUI();
    } catch (err) {
        console.error("Error fetching simulation state:", err);
    }
}

async function resetSystemState() {
    try {
        const response = await fetch(`${API_BASE}/reset`, { method: 'POST' });
        const res = await response.json();
        currentState = res.state;
        renderUI();
        addLocalLog("System state reset successfully.");
    } catch (err) {
        console.error(err);
    }
}

function minToTimeStr(min) {
    const hrs = Math.floor(min / 60);
    const mins = min % 60;
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const displayHrs = hrs % 12 === 0 ? 12 : hrs % 12;
    return `${displayHrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

function addLocalLog(message) {
    const list = document.getElementById("notifications-list");
    const item = document.createElement("div");
    item.className = "notification-item sys-msg";
    const localTime = new Intl.DateTimeFormat(navigator.language, { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(new Date());
    item.innerHTML = `
        <span class="notif-time">${localTime}</span>
        <p>${message}</p>
    `;
    list.prepend(item);
}

// ================================================================================
// RENDERING FUNCTIONS
// ================================================================================
function renderUI() {
    if (!currentState.interviews) return;

    // 1. Render Timeline (Feature 2)
    const timeline = document.getElementById("timeline-list");
    timeline.innerHTML = "";
    currentState.interviews.forEach((interview, idx) => {
        const slot = document.createElement("div");
        slot.className = `timeline-slot ${idx === selectedInterviewIndex ? 'selected' : ''} ${interview.status === 'Completed' ? 'completed' : ''}`;
        slot.onclick = () => selectInterview(idx);

        const delayAmount = interview.estimatedStart - interview.scheduledStart;
        const statusBadge = delayAmount > 0 
            ? `<span class="slot-badge late">+${delayAmount} min delay</span>` 
            : `<span class="slot-badge">${interview.status}</span>`;

        slot.innerHTML = `
            <div class="slot-info">
                <span class="student-name">${interview.studentName} (${interview.studentId})</span>
                <span class="scheduled-hours">
                    Scheduled: ${minToTimeStr(interview.scheduledStart)} - ${minToTimeStr(interview.scheduledEnd)}
                    ${delayAmount > 0 ? `| <strong style="color: #f59e0b">Est: ${minToTimeStr(interview.estimatedStart)}</strong>` : ''}
                </span>
            </div>
            ${statusBadge}
        `;
        timeline.appendChild(slot);
    });

    // 2. Render Wait Queue (Feature 3)
    const queueContainer = document.getElementById("queue-cards-container");
    queueContainer.innerHTML = "";
    currentState.waitQueue.forEach((student, idx) => {
        const card = document.createElement("div");
        card.className = `queue-card ${idx === 0 ? 'high-priority' : ''}`;
        
        card.innerHTML = `
            <span class="rank-badge">Rank ${idx + 1}</span>
            <h4>${student.studentName}</h4>
            <div class="card-stats">
                <p>Base Score: <strong>${student.baseScore}</strong></p>
                <p>Wait Time: <strong>${student.waitIntervals} cycles</strong></p>
                <p>Priority Score: <strong style="color:#6366f1; font-size: 1.15rem">${student.priorityScore}</strong></p>
            </div>
        `;
        queueContainer.appendChild(card);
    });

    // 3. Render Corporate Queues (Feature 5)
    const corpContainer = document.getElementById("corporate-queues");
    corpContainer.innerHTML = "";
    Object.keys(currentState.corporateQueues).forEach(company => {
        const queue = currentState.corporateQueues[company];
        const card = document.createElement("div");
        card.className = "corp-card";
        
        let listHTML = "";
        if (queue.length === 0) {
            listHTML = `<p class="card-description" style="margin-top: 10px;">Queue is empty.</p>`;
        } else {
            queue.forEach((studentId, idx) => {
                listHTML += `
                    <li class="corp-item ${idx === 0 ? 'first-place' : ''}">
                        <span>${studentId}</span>
                        <span>${idx === 0 ? '👑 Active' : `Wait #${idx}`}</span>
                    </li>
                `;
            });
        }

        card.innerHTML = `
            <h3>🏢 ${company}</h3>
            <ul class="corp-list">
                ${listHTML}
            </ul>
        `;
        corpContainer.appendChild(card);
    });

    // 4. Render Notifications Logs
    const notifsContainer = document.getElementById("notifications-list");
    notifsContainer.innerHTML = "";
    if (currentState.pushNotifications.length === 0) {
        notifsContainer.innerHTML = `<div class="notification-item sys-msg"><span class="notif-time">System</span><p>No notifications yet.</p></div>`;
    }
    currentState.pushNotifications.forEach(notif => {
        const item = document.createElement("div");
        item.className = "notification-item";
        let timeStr = notif.time;
        try {
            timeStr = new Intl.DateTimeFormat(navigator.language, { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(new Date(notif.time));
        } catch (e) {}
        item.innerHTML = `
            <span class="notif-time">${timeStr} - ${notif.studentName}</span>
            <p>${notif.message}</p>
        `;
        notifsContainer.appendChild(item);
    });

    // 5. Render Trigger Logs (Feature 4)
    const logsContainer = document.getElementById("trigger-logs");
    logsContainer.innerHTML = "";
    if (currentState.triggerLogs.length === 0) {
        logsContainer.innerHTML = `<div style="color:var(--text-secondary); text-align:center; font-size: 0.85rem; padding: 10px;">No assessment logs submitted yet.</div>`;
    }
    currentState.triggerLogs.forEach(log => {
        const row = document.createElement("div");
        row.className = "trigger-log-row";
        let timeStr = log.timestamp;
        try {
            timeStr = new Intl.DateTimeFormat(navigator.language, { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(new Date(log.timestamp));
        } catch (e) {}
        row.innerHTML = `
            <span>${timeStr} | ${log.studentName} (${log.roundName})</span>
            <span>Score: ${log.score}</span>
            <span class="trigger-status ${log.pass ? 'pass' : 'fail'}">${log.pass ? 'PASSED & INVITED' : 'FAILED'}</span>
        `;
        logsContainer.appendChild(row);
    });
}

function selectInterview(idx) {
    selectedInterviewIndex = idx;
    const items = document.querySelectorAll(".timeline-slot");
    items.forEach((item, i) => {
        if (i === idx) item.classList.add("selected");
        else item.classList.remove("selected");
    });
}

// ================================================================================
// ACTION TRIGGERS (CALLING API)
// ================================================================================

// Verify Clash (Feature 1)
async function checkScheduleClash() {
    const studentId = document.getElementById("sync-student").value;
    const proposedStart = parseInt(document.getElementById("proposed-time").value);
    
    const resultBox = document.getElementById("clash-result");
    resultBox.classList.remove("hidden");
    resultBox.className = "result-box";

    try {
        const response = await fetch(`${API_BASE}/check-clash`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, proposedStart, duration: 60 })
        });
        
        const data = await response.json();
        
        if (data.conflictFree) {
            resultBox.classList.add("success-ok");
            resultBox.innerHTML = `✅ <strong>Success!</strong> ${data.message}`;
            addLocalLog(`Successfully booked slot for ${studentId} at ${minToTimeStr(proposedStart)}`);
        } else {
            resultBox.classList.add("clash-detected");
            let altHTML = "";
            data.suggestedAlternatives.forEach(alt => {
                altHTML += `<li>👉 ${alt.startStr} - ${alt.endStr}</li>`;
            });
            resultBox.innerHTML = `
                ❌ <strong>Clash Detected!</strong> Candidate has a mandatory <strong>"${data.clashDetail}"</strong> scheduled during this time (${data.clashStart} - ${data.clashEnd}).<br><br>
                <strong>Suggested Conflict-Free Slots:</strong>
                <ul style="margin-top:5px; padding-left: 20px;">
                    ${altHTML}
                </ul>
            `;
            addLocalLog(`⚠️ Clash detected for ${studentId} at ${minToTimeStr(proposedStart)}`);
        }
    } catch (err) {
        console.error(err);
    }
}

// Log Delay (Feature 2)
async function logDelay() {
    const duration = parseInt(document.getElementById("actual-duration").value);
    try {
        const response = await fetch(`${API_BASE}/log-delay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interviewIndex: selectedInterviewIndex, actualDuration: duration })
        });
        const data = await response.json();
        currentState = data.state;
        renderUI();
        addLocalLog(`Logged actual duration of ${duration} mins for Interview #${selectedInterviewIndex + 1}`);
    } catch (err) {
        console.error(err);
    }
}

// Age Wait Queue (Feature 3)
async function ageQueue() {
    try {
        const response = await fetch(`${API_BASE}/age-queue`, { method: 'POST' });
        const data = await response.json();
        currentState.waitQueue = data.queue;
        renderUI();
        addLocalLog("Wait Queue aged. Tribonacci priority weights recalculated.");
    } catch (err) {
        console.error(err);
    }
}

// Log Score Sheet (Feature 4)
async function logScore() {
    const name = document.getElementById("score-student-name").value;
    const id = document.getElementById("score-student-id").value;
    const score = parseInt(document.getElementById("score-value").value);
    
    try {
        const response = await fetch(`${API_BASE}/log-score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: id,
                studentName: name,
                roundName: "Technical Interview Round 1",
                score: score,
                threshold: 70
            })
        });
        const data = await response.json();
        currentState = data.state;
        renderUI();
        addLocalLog(`Score sheet updated for ${name}: ${score}/100`);
    } catch (err) {
        console.error(err);
    }
}

// Accept Binding Offer (Feature 5)
async function acceptOffer() {
    const studentId = document.getElementById("accept-student").value;
    const companyName = document.getElementById("accept-company").value;
    const studentName = studentId === "STU_001" ? "Preetham J" : (studentId === "STU_002" ? "Aditya Roy" : "John Doe");

    try {
        const response = await fetch(`${API_BASE}/accept-offer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, studentName, companyName })
        });
        const data = await response.json();
        currentState = data.state;
        renderUI();
        addLocalLog(`🎉 Student ${studentName} accepted binding offer at ${companyName}. Concurrent queues cleared!`);
    } catch (err) {
        console.error(err);
    }
}
