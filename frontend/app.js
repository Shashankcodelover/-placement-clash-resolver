const API_BASE = '/api';

let activeToken = '';
let activeRole = 'ADMIN';
let currentState = {};
let selectedInterviewIndex = 0;

// Initialize Socket.io with auth handshake
const socket = io({
    auth: { token: 'supersecret123' }
});

document.addEventListener("DOMContentLoaded", async () => {
    await switchPersona('ADMIN');
    await fetchAnalytics();
});

socket.on('state_update', (newState) => {
    currentState = newState;
    renderUI();
    fetchAnalytics();
});

async function switchPersona(role) {
    try {
        const res = await fetch(`${API_BASE}/login-as`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role })
        });
        const data = await res.json();
        activeToken = data.token;
        activeRole = data.role;
        addLocalLog(`Switched active persona to: ${data.name} (${data.role})`);
        await fetchState();
    } catch (e) {
        console.error("Failed to switch persona:", e);
    }
}

async function fetchState() {
    try {
        const response = await fetch(`${API_BASE}/state`);
        currentState = await response.json();
        renderUI();
    } catch (err) {
        console.error("Error fetching simulation state:", err);
    }
}

async function fetchAnalytics() {
    try {
        const res = await fetch(`${API_BASE}/analytics/throughput`);
        const data = await res.json();
        document.getElementById('kpi-placed').textContent = `${data.placedCount} / ${data.totalCandidates}`;
        document.getElementById('kpi-rate').textContent = data.placementRate;
        document.getElementById('kpi-clashes').textContent = `${data.totalAuditedActions} Events`;
        document.getElementById('kpi-panels').textContent = `${data.activePanels} Active`;
    } catch (e) {
        console.error("Failed to fetch analytics:", e);
    }
}

async function resetSystemState() {
    try {
        const response = await fetch(`${API_BASE}/reset`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${activeToken}` }
        });
        const res = await response.json();
        currentState = res.state;
        renderUI();
        fetchAnalytics();
        addLocalLog("SQLite database successfully re-seeded.");
    } catch (err) {
        console.error(err);
    }
}

function minToTimeStr(isoString) {
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return isoString;
    }
}

function addLocalLog(message) {
    const list = document.getElementById("notifications-list");
    if (!list) return;
    const item = document.createElement("div");
    item.className = "notification-item sys-msg";
    const localTime = new Date().toLocaleTimeString();
    
    const timeSpan = document.createElement("span");
    timeSpan.className = "notif-time";
    timeSpan.textContent = `${localTime} - System Alert`;
    
    const p = document.createElement("p");
    p.textContent = message;
    
    item.appendChild(timeSpan);
    item.appendChild(p);
    list.prepend(item);
}

// ================================================================================
// RENDERING FUNCTIONS (XSS-Safe DOM Construction)
// ================================================================================
function renderUI() {
    if (!currentState.interviews) return;

    // 1. Render Interactive Timeline
    const timeline = document.getElementById("timeline-list");
    timeline.innerHTML = "";
    currentState.interviews.forEach((interview, idx) => {
        const slot = document.createElement("div");
        slot.className = `timeline-slot ${idx === selectedInterviewIndex ? 'selected' : ''} ${interview.status === 'Completed' ? 'completed' : ''}`;
        slot.onclick = () => selectInterview(idx);

        const slotInfo = document.createElement("div");
        slotInfo.className = "slot-info";

        const nameSpan = document.createElement("span");
        nameSpan.className = "student-name";
        nameSpan.textContent = `${interview.studentName} (${interview.student_id}) — ${interview.panel_id}`;

        const hoursSpan = document.createElement("span");
        hoursSpan.className = "scheduled-hours";
        const delayTxt = interview.delay_mins > 0 ? ` | +${interview.delay_mins}m delay` : '';
        hoursSpan.textContent = `${minToTimeStr(interview.estimated_start)} - ${minToTimeStr(interview.estimated_end)} (${interview.round_name})${delayTxt}`;

        slotInfo.appendChild(nameSpan);
        slotInfo.appendChild(hoursSpan);

        const statusBadge = document.createElement("span");
        statusBadge.className = `slot-badge ${interview.delay_mins > 0 ? 'late' : ''}`;
        statusBadge.textContent = interview.delay_mins > 0 ? `+${interview.delay_mins}m Shifted` : interview.status;

        slot.appendChild(slotInfo);
        slot.appendChild(statusBadge);
        timeline.appendChild(slot);
    });

    // 2. Render Ranked Wait Queue
    const queueContainer = document.getElementById("queue-cards-container");
    queueContainer.innerHTML = "";
    currentState.waitQueue.forEach((student, idx) => {
        const card = document.createElement("div");
        card.className = `queue-card ${idx === 0 ? 'high-priority' : ''}`;
        card.style.animationDelay = `${idx * 0.1}s`; // Stagger animation

        const rank = document.createElement("span");
        rank.className = "rank-badge";
        rank.textContent = `Rank #${idx + 1} (${student.company}) ${idx === 0 ? '👑' : ''}`;

        const title = document.createElement("h4");
        title.textContent = student.studentName;

        const stats = document.createElement("div");
        stats.className = "card-stats";
        stats.innerHTML = `
            <p>Base Score: <strong>${student.baseScore}</strong></p>
            <p>Aging Cycles: <strong>${student.waitIntervals}</strong></p>
            <p>Priority Score: <strong style="color:var(--primary); font-size:1.05rem;">${student.priorityScore}</strong></p>
        `;

        card.appendChild(rank);
        card.appendChild(title);
        card.appendChild(stats);
        queueContainer.appendChild(card);
    });

    // 3. Render Corporate Queues
    const corpContainer = document.getElementById("corporate-queues");
    corpContainer.innerHTML = "";
    Object.keys(currentState.corporateQueues || {}).forEach(company => {
        const queue = currentState.corporateQueues[company];
        const card = document.createElement("div");
        card.className = "corp-card";

        const header = document.createElement("h3");
        header.textContent = `🏢 ${company} Pool (${queue.length})`;
        card.appendChild(header);

        const ul = document.createElement("ul");
        ul.className = "corp-list";

        if (queue.length === 0) {
            const emptyP = document.createElement("p");
            emptyP.className = "card-description";
            emptyP.textContent = "Queue is empty.";
            card.appendChild(emptyP);
        } else {
            queue.forEach((item, idx) => {
                const li = document.createElement("li");
                li.className = `corp-item ${idx === 0 ? 'first-place' : ''}`;
                
                const nameSpan = document.createElement("span");
                nameSpan.textContent = `${item.studentName || item.studentId}`;

                const statusSpan = document.createElement("span");
                statusSpan.textContent = idx === 0 ? `👑 ${item.status || 'Active'}` : `Wait #${idx}`;

                li.appendChild(nameSpan);
                li.appendChild(statusSpan);
                ul.appendChild(li);
            });
            card.appendChild(ul);
        }
        corpContainer.appendChild(card);
    });

    // 4. Render Notifications Feed
    const notifsContainer = document.getElementById("notifications-list");
    notifsContainer.innerHTML = "";
    (currentState.pushNotifications || []).forEach(notif => {
        const item = document.createElement("div");
        item.className = "notification-item";

        const timeSpan = document.createElement("span");
        timeSpan.className = "notif-time";
        timeSpan.textContent = `${new Date(notif.time).toLocaleTimeString()} — ${notif.studentName || notif.studentId}`;

        const p = document.createElement("p");
        p.textContent = notif.message;

        item.appendChild(timeSpan);
        item.appendChild(p);
        notifsContainer.appendChild(item);
    });

    // 5. Render Trigger & Audit Logs
    const logsContainer = document.getElementById("trigger-logs");
    logsContainer.innerHTML = "";
    (currentState.triggerLogs || []).forEach(log => {
        const row = document.createElement("div");
        row.className = "trigger-log-row";

        const leftSpan = document.createElement("span");
        leftSpan.textContent = `${new Date(log.timestamp).toLocaleTimeString()} | ${log.studentName} (${log.score}/100)`;

        const statusSpan = document.createElement("span");
        statusSpan.className = `trigger-status ${log.pass ? 'pass' : 'fail'}`;
        statusSpan.textContent = log.pass ? 'PASSED' : 'FAILED';

        row.appendChild(leftSpan);
        row.appendChild(statusSpan);
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
// ACTION TRIGGERS (Calling Protected Enterprise APIs)
// ================================================================================

// 1. Verify Clash & Check Alternatives
async function checkScheduleClash() {
    const studentId = document.getElementById("sync-student").value;
    const proposedStart = parseInt(document.getElementById("proposed-time").value);
    
    const resultBox = document.getElementById("clash-result");
    const syncCard = document.getElementById("sync-engine-card");
    const checkBtn = document.getElementById("btn-check-clash");
    
    // Reset classes for animation triggers
    resultBox.classList.remove("show", "success-ok", "clash-detected");
    syncCard.classList.remove("card-success", "card-danger");
    checkBtn.classList.add("btn-loading");
    
    // Slight artificial delay to showcase the smooth loading state and transition
    await new Promise(r => setTimeout(r, 600));

    try {
        const response = await fetch(`${API_BASE}/check-clash`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${activeToken}`
            },
            body: JSON.stringify({ studentId, proposedStart, duration: 45 })
        });
        
        const data = await response.json();
        
        if (data.conflictFree) {
            resultBox.classList.add("success-ok");
            syncCard.classList.add("card-success");
            resultBox.innerHTML = `✅ <strong>Success!</strong> ${data.message}`;
            addLocalLog(`Reserved conflict-free slot for ${studentId}`);
        } else {
            resultBox.classList.add("clash-detected");
            syncCard.classList.add("card-danger");
            
            let altHTML = "";
            (data.suggestedAlternatives || []).forEach(alt => {
                altHTML += `<li class="alt-slot-pill"><i class="icon">📅</i> ${alt.startStr} - ${alt.endStr}</li>`;
            });
            resultBox.innerHTML = `
                ❌ <strong>Schedule Conflict Detected!</strong> Candidate is blocked by: <strong>${data.clashDetail}</strong>.<br><br>
                <strong>Suggested Conflict-Free Slots:</strong>
                <ul class="alt-slot-list">
                    ${altHTML}
                </ul>
            `;
            addLocalLog(`⚠️ Conflict caught for ${studentId}: ${data.clashDetail}`);
        }
        
        // Trigger slide down animation
        requestAnimationFrame(() => {
            resultBox.classList.add("show");
        });
        
    } catch (err) {
        console.error(err);
    } finally {
        checkBtn.classList.remove("btn-loading");
    }
}

// 2. Generate Virtual HD Interview Room
async function generateVirtualMeeting() {
    const studentId = document.getElementById("sync-student").value;
    try {
        const res = await fetch(`${API_BASE}/virtual-room`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${activeToken}`
            },
            body: JSON.stringify({ panelId: 'PanelA', company: 'Google', candidateName: studentId })
        });
        const room = await res.json();
        addLocalLog(`📹 Virtual Room Provisioned: ${room.joinUrl}`);
        window.open(room.joinUrl, '_blank');
    } catch (e) {
        console.error("Failed to generate room:", e);
    }
}

// 3. Log Delay
async function logDelay() {
    const duration = parseInt(document.getElementById("actual-duration").value);
    const btn = document.getElementById("btn-log-delay");
    
    // Animate DOM immediately for visual feedback
    const timelineItems = document.querySelectorAll("#timeline-list .timeline-slot");
    timelineItems.forEach((item, idx) => {
        if (idx > selectedInterviewIndex) {
            item.classList.add("shake-warning");
        }
    });

    btn.classList.add("btn-loading");
    
    // Small artificial delay so the user can see the cascade animation
    await new Promise(r => setTimeout(r, 700));

    try {
        const response = await fetch(`${API_BASE}/log-delay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${activeToken}`
            },
            body: JSON.stringify({ interviewIndex: selectedInterviewIndex, actualDuration: duration })
        });
        const data = await response.json();
        currentState = data.state;
        renderUI();
        fetchAnalytics();
        addLocalLog(`Logged ${duration}m duration for Interview #${selectedInterviewIndex + 1}. Downstream panel slots updated.`);
    } catch (err) {
        console.error(err);
    } finally {
        btn.classList.remove("btn-loading");
    }
}

// 4. Age Queues
async function ageQueue() {
    const btn = document.getElementById("btn-age-queue");
    btn.classList.add("btn-loading");
    
    // Slight artificial delay for visual feedback of aging computation
    await new Promise(r => setTimeout(r, 500));
    
    try {
        const response = await fetch(`${API_BASE}/age-queue`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${activeToken}` }
        });
        const data = await response.json();
        currentState.waitQueue = data.queue;
        renderUI();
        addLocalLog("Advanced queue aging cycle. Multi-factor priority recalculated.");
    } catch (err) {
        console.error(err);
    } finally {
        btn.classList.remove("btn-loading");
    }
}

// Score Badge Live Updater
function updateScoreBadge(val) {
    const badge = document.getElementById("score-badge");
    badge.innerText = val;
    if (val >= 75) {
        badge.style.color = 'var(--success)';
        badge.style.borderColor = 'var(--success)';
        badge.style.background = 'rgba(16, 185, 129, 0.2)';
    } else {
        badge.style.color = 'var(--danger)';
        badge.style.borderColor = 'var(--danger)';
        badge.style.background = 'rgba(244, 63, 94, 0.2)';
    }
}

// 5. Submit Scorecard
async function logScore() {
    const name = document.getElementById("score-student-name").value;
    const id = document.getElementById("score-student-id").value;
    const score = parseInt(document.getElementById("score-value").value);
    
    const btn = document.getElementById("btn-log-score");
    btn.classList.add("btn-loading");
    
    await new Promise(r => setTimeout(r, 600));
    
    try {
        const response = await fetch(`${API_BASE}/log-score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${activeToken}`
            },
            body: JSON.stringify({
                studentId: id,
                studentName: name,
                roundName: "Technical Systems Round",
                score: score,
                threshold: 75
            })
        });
        const data = await response.json();
        currentState = data.state;
        renderUI();
        fetchAnalytics();
        addLocalLog(`Scorecard saved for ${name}: ${score}/100`);
    } catch (err) {
        console.error(err);
    } finally {
        btn.classList.remove("btn-loading");
    }
}

// 6. Accept Binding Offer
async function acceptOffer() {
    const studentId = document.getElementById("accept-student").value;
    const companyName = document.getElementById("accept-company").value;
    const studentName = studentId === "STU_001" ? "Preetham J" : (studentId === "STU_002" ? "Aditya Roy" : (studentId === "STU_004" ? "Sneha Sharma" : "John Doe"));

    const btn = document.getElementById("btn-accept-offer");
    const engineCard = document.getElementById("offer-engine-card");
    const corpContainer = document.getElementById("corporate-queues");
    
    // UI Feedback: Button Loading
    btn.classList.add("btn-loading");

    try {
        const response = await fetch(`${API_BASE}/accept-offer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${activeToken}`
            },
            body: JSON.stringify({ studentId, studentName, companyName })
        });
        const data = await response.json();
        
        // Success Animations
        engineCard.classList.remove("celebrate-pulse"); // reset if already played
        void engineCard.offsetWidth; // trigger reflow
        engineCard.classList.add("celebrate-pulse");
        
        // Evaporate the corporate queues to show they are being atomically emptied
        corpContainer.classList.add("evaporate");
        
        await new Promise(r => setTimeout(r, 800)); // wait for evaporation
        
        currentState = data.state;
        renderUI();
        fetchAnalytics();
        
        // Restore queue visibility
        corpContainer.classList.remove("evaporate");
        
        addLocalLog(`🎉 ${studentName} accepted offer at ${companyName}. Competitor pools backfilled.`);
    } catch (err) {
        console.error(err);
    } finally {
        btn.classList.remove("btn-loading");
    }
}

// 7. Export .ICS Calendar
function exportCalendar() {
    const studentId = document.getElementById("sync-student")?.value || "STU_001";
    window.location.href = `${API_BASE}/calendar/${studentId}.ics`;
}
