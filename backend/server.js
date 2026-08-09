const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../frontend')));

// ================================================================================
// IN-MEMORY SYSTEM STATE
// ================================================================================
let systemState = {};

function resetState() {
    systemState = {
        // Timetable blockouts (minutes from midnight)
        academicTimetable: {
            "STU_001": [
                { name: "Computer Networks Lab", start: 900, end: 1100 }, 
                { name: "Midterm Exam: OS", start: 1400, end: 1530 }      
            ],
            "STU_002": [
                { name: "DBMS Lecture", start: 600, end: 690 },          
                { name: "Compiler Design Lab", start: 900, end: 1020 }   
            ],
            "STU_003": [
                { name: "VLSI Seminar", start: 660, end: 720 }            
            ]
        },
        // Active interview queues for Panel A
        interviews: [
            { studentId: "STU_001", studentName: "Preetham J", scheduledStart: 600, scheduledEnd: 630, estimatedStart: 600, estimatedEnd: 630, status: "Pending" }, 
            { studentId: "STU_002", studentName: "Aditya Roy", scheduledStart: 630, scheduledEnd: 700, estimatedStart: 630, estimatedEnd: 700, status: "Pending" }, 
            { studentId: "STU_003", studentName: "John Doe", scheduledStart: 700, scheduledEnd: 730, estimatedStart: 700, estimatedEnd: 730, status: "Pending" }     
        ],
        // Wait queue for the Tribonacci aging demonstration
        waitQueue: [
            { studentId: "STU_001", studentName: "Preetham J (STU_001)", waitIntervals: 0, baseScore: 45, priorityScore: 45 },
            { studentId: "STU_002", studentName: "Aditya Roy (STU_002)", waitIntervals: 0, baseScore: 55, priorityScore: 55 },
            { studentId: "STU_003", studentName: "John Doe (STU_003)", waitIntervals: 0, baseScore: 65, priorityScore: 65 }
        ],
        // Multi-stage triggers logs
        triggerLogs: [],
        // Bipartite matching company queues
        corporateQueues: {
            "Google": ["STU_001", "STU_003", "STU_004"],
            "Microsoft": ["STU_002", "STU_001", "STU_005"],
            "Meta": ["STU_003", "STU_001", "STU_002"]
        },
        // Notifications list
        pushNotifications: []
    };
}

resetState();

// Tribonacci Helper
function getTribonacciValue(n) {
    if (n === 0) return 0;
    if (n === 1 || n === 2) return 1;
    let a = 0, b = 1, c = 1;
    for (let i = 3; i <= n; i++) {
        let next = a + b + c;
        a = b;
        b = c;
        c = next;
    }
    return c;
}

// Convert minutes to time string handling multi-day overflow
function minToTimeStr(min) {
    const day = Math.floor(min / 1440);
    const dayMin = min % 1440;
    const hrs = Math.floor(dayMin / 60);
    const mins = dayMin % 60;
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const displayHrs = hrs % 12 === 0 ? 12 : hrs % 12;
    const timeStr = `${displayHrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`;
    return day > 0 ? `${timeStr} (+${day} Day)` : timeStr;
}

// Websocket logic
io.on('connection', (socket) => {
    socket.emit('state_update', systemState);
});

function broadcastState() {
    io.emit('state_update', systemState);
}

// Helper to check if a student is currently busy (academic or interview)
function isStudentBusy(studentId, startMin, endMin) {
    const timetable = systemState.academicTimetable[studentId] || [];
    const academicClash = timetable.some(block => {
        return (startMin < block.end && endMin > block.start);
    });
    if (academicClash) return true;

    // Check interviews
    const interviewClash = systemState.interviews.some(interview => {
        if (interview.studentId !== studentId) return false;
        if (interview.status === "Completed") return false;
        return (startMin < interview.estimatedEnd && endMin > interview.estimatedStart);
    });
    
    return interviewClash;
}

// ================================================================================
// API ENDPOINTS
// ================================================================================

// Get State
app.get('/api/state', (req, res) => {
    res.json(systemState);
});

// Reset State
app.post('/api/reset', (req, res) => {
    resetState();
    broadcastState();
    res.json({ message: "System state reset successfully.", state: systemState });
});

// Check Clash (Feature 1)
app.post('/api/check-clash', (req, res) => {
    const { studentId, proposedStart, duration } = req.body; 
    const timetable = systemState.academicTimetable[studentId] || [];
    const proposedEnd = proposedStart + duration;

    const clash = timetable.find(block => {
        return (proposedStart < block.end && proposedEnd > block.start);
    });

    if (!clash) {
        return res.json({
            conflictFree: true,
            message: "No schedule conflicts detected. Reserved successfully."
        });
    }

    // Compute 3 alternatives allowing multi-day overflow
    const alternatives = [];
    let cursor = proposedStart < 540 ? 540 : proposedStart; 
    let daysAdded = Math.floor(cursor / 1440);

    while (alternatives.length < 3) {
        let currentDayOffset = daysAdded * 1440;
        let dayCursor = cursor % 1440;
        
        // Ensure within 9 AM - 5 PM
        if (dayCursor < 540) {
            cursor = currentDayOffset + 540;
        } else if (dayCursor + duration > 1020) {
            daysAdded++;
            cursor = (daysAdded * 1440) + 540;
            continue;
        }

        const tempEnd = cursor + duration;
        const conflicts = timetable.some(block => {
            return (cursor < block.end && tempEnd > block.start);
        });

        if (!conflicts && (cursor < proposedStart || cursor >= proposedEnd)) {
            alternatives.push({
                start: cursor,
                end: tempEnd,
                startStr: minToTimeStr(cursor),
                endStr: minToTimeStr(tempEnd)
            });
        }
        cursor += 30;
    }

    res.json({
        conflictFree: false,
        clashDetail: clash.name,
        clashStart: minToTimeStr(clash.start),
        clashEnd: minToTimeStr(clash.end),
        suggestedAlternatives: alternatives
    });
});

// Log Delay (Feature 2)
app.post('/api/log-delay', (req, res) => {
    const { interviewIndex, actualDuration } = req.body;
    const idx = parseInt(interviewIndex);
    
    if (idx < 0 || idx >= systemState.interviews.length) {
        return res.status(400).json({ error: "Invalid interview index" });
    }

    const activeInterview = systemState.interviews[idx];
    const scheduledDuration = activeInterview.scheduledEnd - activeInterview.scheduledStart;
    const delay = actualDuration - scheduledDuration;

    activeInterview.status = "Completed";
    activeInterview.actualEnd = activeInterview.estimatedStart + actualDuration;

    if (delay > 0) {
        for (let i = idx + 1; i < systemState.interviews.length; i++) {
            systemState.interviews[i].estimatedStart += delay;
            systemState.interviews[i].estimatedEnd += delay;

            const newTimeStr = minToTimeStr(systemState.interviews[i].estimatedStart);
            const msg = `🔔 Hi ${systemState.interviews[i].studentName}, due to an earlier delay, your interview is rescheduled to ${newTimeStr}. Please prepare accordingly.`;
            systemState.pushNotifications.push({
                studentId: systemState.interviews[i].studentId,
                studentName: systemState.interviews[i].studentName,
                message: msg,
                time: new Date().toISOString()
            });
        }
    }

    broadcastState();
    res.json({ message: "Delay logged and downstream slots updated.", state: systemState });
});

// Age Queue (Feature 3)
app.post('/api/age-queue', (req, res) => {
    systemState.waitQueue.forEach(student => {
        student.waitIntervals += 1;
        const weight = getTribonacciValue(student.waitIntervals);
        student.priorityScore = student.baseScore + (weight * 6);
    });

    systemState.waitQueue.sort((a, b) => b.priorityScore - a.priorityScore);

    broadcastState();
    res.json({ message: "Queue aged using Tribonacci aging factor.", queue: systemState.waitQueue });
});

// Log Score (Feature 4)
app.post('/api/log-score', (req, res) => {
    const { studentId, studentName, roundName, score, threshold } = req.body;
    const scoreNum = parseInt(score);
    const pass = scoreNum >= threshold;

    let logMsg = `[Triggers] ${studentName} scored ${scoreNum}/100 in ${roundName}. `;
    let alertSent = false;
    
    if (pass) {
        const link = `https://placements.uni.edu/book-slot?studentId=${studentId}&round=HR`;
        logMsg += `🎯 Threshold met! SMS invitation sent to book HR interview.`;
        alertSent = true;

        systemState.pushNotifications.push({
            studentId,
            studentName,
            message: `🎉 Congrats! You passed the ${roundName}. Click here to book your HR round: ${link}`,
            time: new Date().toISOString()
        });
    } else {
        logMsg += `❌ Candidate did not meet cut-off threshold.`;
    }

    systemState.triggerLogs.unshift({
        studentId,
        studentName,
        roundName,
        score: scoreNum,
        pass,
        alertSent,
        timestamp: new Date().toISOString()
    });

    broadcastState();
    res.json({ message: logMsg, state: systemState });
});

// Accept Offer (Feature 5) - Bipartite Re-routing with Clash Prevention
app.post('/api/accept-offer', (req, res) => {
    const { studentId, studentName, companyName } = req.body;
    const reRoutedCompanies = [];

    Object.keys(systemState.corporateQueues).forEach(company => {
        const queue = systemState.corporateQueues[company];
        const index = queue.indexOf(studentId);

        if (index !== -1) {
            queue.splice(index, 1);
            reRoutedCompanies.push(company);

            // Fetch current time (simulated via max estimated end of current interviews, or defaulting to 600)
            const currentTime = Math.max(...systemState.interviews.map(i => i.estimatedStart), 600);
            
            // Look for next non-busy candidate
            let foundCandidate = null;
            let attempts = 0;
            const maxAttempts = queue.length;
            
            while(attempts < maxAttempts && queue.length > 0) {
                const candidate = queue[0];
                if (isStudentBusy(candidate, currentTime, currentTime + 60)) {
                    // Candidate is busy, they are bypassed for immediate slot
                    systemState.pushNotifications.push({
                        studentId: candidate,
                        studentName: `Candidate ${candidate}`,
                        message: `⚠️ We tried to pull you up for ${company} but you had a schedule clash!`,
                        time: new Date().toISOString()
                    });
                    const shifted = queue.shift();
                    queue.push(shifted);
                } else {
                    foundCandidate = candidate;
                    break;
                }
                attempts++;
            }

            if (foundCandidate) {
                systemState.pushNotifications.push({
                    studentId: foundCandidate,
                    studentName: `Candidate ${foundCandidate}`,
                    message: `🚀 You have been promoted to the active interview candidate position for ${company}!`,
                    time: new Date().toISOString()
                });
            }
        }
    });

    broadcastState();
    res.json({
        message: `Student ${studentName} accepted binding offer from ${companyName}. De-queued from: ${reRoutedCompanies.join(', ')}.`,
        state: systemState
    });
});

// Start Server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Placement Drive Clash Resolver running on http://localhost:${PORT}`);
});
