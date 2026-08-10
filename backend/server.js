require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const writeFileAtomicSync = require('write-file-atomic').sync;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';
const WS_TOKEN = process.env.WS_TOKEN || 'supersecret123';

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        res.status(401).json({ error: "Invalid token" });
    }
};

// FIX #4: Secure WebSocket
const io = new Server(server, {
    cors: { origin: "*" }
});
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token === WS_TOKEN) {
        next();
    } else {
        next(new Error("Authentication error"));
    }
});

app.use(express.static(path.join(__dirname, '../frontend')));

// FIX #5: Disk Persistence
const DB_FILE = path.join(__dirname, 'db.json');
let systemState = {};

function saveState() {
    writeFileAtomicSync(DB_FILE, JSON.stringify(systemState, null, 2));
}

function loadState() {
    if (fs.existsSync(DB_FILE)) {
        systemState = JSON.parse(fs.readFileSync(DB_FILE));
    } else {
        resetState();
    }
}

// Helper to generate ISO starting times for today
function getISOOffsetMins(minutes) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Start of today in UTC
    const d = new Date(today);
    d.setUTCMinutes(d.getUTCMinutes() + minutes);
    return d.toISOString();
}

function resetState() {
    systemState = {
        // FIX #3: Timezone paradox (Use real ISO strings)
        academicTimetable: {
            "STU_001": [
                { name: "Computer Networks Lab", start: getISOOffsetMins(900), end: getISOOffsetMins(1100) }, 
                { name: "Midterm Exam: OS", start: getISOOffsetMins(1400), end: getISOOffsetMins(1530) }      
            ],
            "STU_002": [
                { name: "DBMS Lecture", start: getISOOffsetMins(600), end: getISOOffsetMins(690) },          
                { name: "Compiler Design Lab", start: getISOOffsetMins(900), end: getISOOffsetMins(1020) }   
            ],
            "STU_003": [
                { name: "VLSI Seminar", start: getISOOffsetMins(660), end: getISOOffsetMins(720) }            
            ]
        },
        // FIX #2: Panel Partitioning (Add panelId)
        interviews: [
            { panelId: "PanelA", studentId: "STU_001", studentName: "Preetham J", scheduledStart: getISOOffsetMins(600), scheduledEnd: getISOOffsetMins(630), estimatedStart: getISOOffsetMins(600), estimatedEnd: getISOOffsetMins(630), status: "Pending" }, 
            { panelId: "PanelA", studentId: "STU_002", studentName: "Aditya Roy", scheduledStart: getISOOffsetMins(630), scheduledEnd: getISOOffsetMins(700), estimatedStart: getISOOffsetMins(630), estimatedEnd: getISOOffsetMins(700), status: "Pending" }, 
            { panelId: "PanelB", studentId: "STU_003", studentName: "John Doe", scheduledStart: getISOOffsetMins(700), scheduledEnd: getISOOffsetMins(730), estimatedStart: getISOOffsetMins(700), estimatedEnd: getISOOffsetMins(730), status: "Pending" }     
        ],
        waitQueue: [
            { studentId: "STU_001", studentName: "Preetham J (STU_001)", waitIntervals: 0, baseScore: 45, priorityScore: 45 },
            { studentId: "STU_002", studentName: "Aditya Roy (STU_002)", waitIntervals: 0, baseScore: 55, priorityScore: 55 },
            { studentId: "STU_003", studentName: "John Doe (STU_003)", waitIntervals: 0, baseScore: 65, priorityScore: 65 }
        ],
        triggerLogs: [],
        corporateQueues: {
            "Google": ["STU_001", "STU_003", "STU_004"],
            "Microsoft": ["STU_002", "STU_001", "STU_005"],
            "Meta": ["STU_003", "STU_001", "STU_002"]
        },
        pushNotifications: []
    };
    saveState();
}

loadState();

// FIX #1: Bounded Growth without hard ceiling
function getBoundedPriority(base, intervals) {
    return Math.floor(base + 10 * Math.log2(1 + intervals));
}

io.on('connection', (socket) => {
    socket.emit('state_update', systemState);
});

function broadcastState() {
    if (systemState.pushNotifications.length > 100) {
        systemState.pushNotifications = systemState.pushNotifications.slice(-100);
    }
    if (systemState.triggerLogs.length > 100) {
        systemState.triggerLogs = systemState.triggerLogs.slice(-100);
    }
    saveState(); // Save to disk on every state mutation
    io.emit('state_update', systemState);
}

function isStudentBusy(studentId, startISO, endISO) {
    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();

    const timetable = systemState.academicTimetable[studentId] || [];
    const academicClash = timetable.some(block => {
        return (start < new Date(block.end).getTime() && end > new Date(block.start).getTime());
    });
    if (academicClash) return true;

    const interviewClash = systemState.interviews.some(interview => {
        if (interview.studentId !== studentId) return false;
        if (interview.status === "Completed") return false;
        return (start < new Date(interview.estimatedEnd).getTime() && end > new Date(interview.estimatedStart).getTime());
    });
    
    return interviewClash;
}

const checkClashSchema = z.object({
    studentId: z.string(),
    proposedStart: z.union([z.string().datetime(), z.number()]), 
    duration: z.number().positive() 
});

const logDelaySchema = z.object({
    interviewIndex: z.union([z.string(), z.number()]),
    actualDuration: z.number().positive()
});

const logScoreSchema = z.object({
    studentId: z.string(),
    studentName: z.string(),
    roundName: z.string(),
    score: z.union([z.string(), z.number()]),
    threshold: z.union([z.string(), z.number()])
});

const acceptOfferSchema = z.object({
    studentId: z.string(),
    studentName: z.string(),
    companyName: z.string()
});

app.get('/api/state', (req, res) => {
    res.json(systemState);
});

app.post('/api/login', (req, res) => {
    const token = jwt.sign({ user: 'admin' }, JWT_SECRET);
    res.json({ token });
});

app.post('/api/reset', authMiddleware, (req, res) => {
    resetState();
    broadcastState();
    res.json({ message: "System state reset successfully.", state: systemState });
});

app.post('/api/check-clash', authMiddleware, (req, res) => {
    try {
        const { studentId, proposedStart, duration } = checkClashSchema.parse(req.body);
        
        let startISO = proposedStart;
        if (typeof proposedStart === 'number') {
            startISO = getISOOffsetMins(proposedStart);
        }
        
        const durationMs = duration * 60000;
        const start = new Date(startISO).getTime();
        const end = start + durationMs;

        const timetable = systemState.academicTimetable[studentId] || [];

        const clash = timetable.find(block => {
            return (start < new Date(block.end).getTime() && end > new Date(block.start).getTime());
        });

        if (!clash) {
            return res.json({
                conflictFree: true,
                message: "No schedule conflicts detected. Reserved successfully."
            });
        }

        const alternatives = [];
        let cursorMs = start < new Date(getISOOffsetMins(540)).getTime() ? new Date(getISOOffsetMins(540)).getTime() : start;

        while (alternatives.length < 3) {
            const tempStart = new Date(cursorMs);
            const tempEnd = new Date(cursorMs + durationMs);

            const conflicts = timetable.some(block => {
                return (cursorMs < new Date(block.end).getTime() && cursorMs + durationMs > new Date(block.start).getTime());
            });

            const hour = tempStart.getUTCHours();
            if (hour >= 9 && hour < 17 && !conflicts && (cursorMs < start || cursorMs >= end)) {
                alternatives.push({
                    startStr: tempStart.toISOString(),
                    endStr: tempEnd.toISOString()
                });
            }
            cursorMs += 30 * 60000;
        }

        res.json({
            conflictFree: false,
            clashDetail: clash.name,
            clashStart: clash.start, 
            clashEnd: clash.end, 
            suggestedAlternatives: alternatives
        });
    } catch(e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/log-delay', authMiddleware, (req, res) => {
    try {
        const { interviewIndex, actualDuration } = logDelaySchema.parse(req.body);
        const idx = parseInt(interviewIndex);
    
    if (idx < 0 || idx >= systemState.interviews.length) {
        return res.status(400).json({ error: "Invalid interview index" });
    }

    const activeInterview = systemState.interviews[idx];
    const estStartMs = new Date(activeInterview.estimatedStart).getTime();
    const schedStartMs = new Date(activeInterview.scheduledStart).getTime();
    const schedEndMs = new Date(activeInterview.scheduledEnd).getTime();
    
    const scheduledDurationMs = schedEndMs - schedStartMs;
    const actualDurationMs = actualDuration * 60000;
    const delayMs = actualDurationMs - scheduledDurationMs;

    activeInterview.status = "Completed";
    activeInterview.actualEnd = new Date(estStartMs + actualDurationMs).toISOString();

    if (delayMs > 0) {
        // FIX #2: Shift ONLY downstream interviews in the SAME panel
        for (let i = idx + 1; i < systemState.interviews.length; i++) {
            if (systemState.interviews[i].panelId === activeInterview.panelId) {
                const oldEstStartMs = new Date(systemState.interviews[i].estimatedStart).getTime();
                const oldEstEndMs = new Date(systemState.interviews[i].estimatedEnd).getTime();
                
                systemState.interviews[i].estimatedStart = new Date(oldEstStartMs + delayMs).toISOString();
                systemState.interviews[i].estimatedEnd = new Date(oldEstEndMs + delayMs).toISOString();

                const msg = `🔔 Hi ${systemState.interviews[i].studentName}, due to an earlier delay, your interview is rescheduled. Please check dashboard.`;
                systemState.pushNotifications.push({
                    studentId: systemState.interviews[i].studentId,
                    studentName: systemState.interviews[i].studentName,
                    message: msg,
                    time: new Date().toISOString()
                });
            }
        }
    }

        broadcastState();
        res.json({ message: "Delay logged and panel downstream slots updated.", state: systemState });
    } catch (e) {
        res.status(400).json({ error: e.errors || e.message });
    }
});

app.post('/api/age-queue', authMiddleware, (req, res) => {
    systemState.waitQueue.forEach(student => {
        student.waitIntervals += 1;
        student.priorityScore = getBoundedPriority(student.baseScore, student.waitIntervals);
    });

    systemState.waitQueue.sort((a, b) => b.priorityScore - a.priorityScore);

    broadcastState();
    res.json({ message: "Queue aged safely.", queue: systemState.waitQueue });
});

app.post('/api/log-score', authMiddleware, (req, res) => {
    try {
        const { studentId, studentName, roundName, score, threshold } = logScoreSchema.parse(req.body);
    const scoreNum = parseInt(score);
    if(isNaN(scoreNum)) return res.status(400).json({ error: "Invalid score" });

    const pass = scoreNum >= parseInt(threshold);

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
    } catch (e) {
        res.status(400).json({ error: e.errors || e.message });
    }
});

app.post('/api/accept-offer', authMiddleware, (req, res) => {
    try {
        const { studentId, studentName, companyName } = acceptOfferSchema.parse(req.body);
    const reRoutedCompanies = [];

    Object.keys(systemState.corporateQueues).forEach(company => {
        const queue = systemState.corporateQueues[company];
        const index = queue.indexOf(studentId);

        if (index !== -1) {
            queue.splice(index, 1);
            reRoutedCompanies.push(company);

            let foundCandidate = null;
            
            for (let i = 0; i < queue.length; i++) {
                const candidate = queue[i];
                // Check if they are busy for the upcoming interview slot, assume new slot is around 800 mins
                const startIso = getISOOffsetMins(800);
                const endIso = getISOOffsetMins(860);

                if (isStudentBusy(candidate, startIso, endIso)) {
                    systemState.pushNotifications.push({
                        studentId: candidate,
                        studentName: `Candidate ${candidate}`,
                        message: `⚠️ We tried to pull you up for ${company} but you had a schedule clash!`,
                        time: new Date().toISOString()
                    });
                } else {
                    foundCandidate = candidate;
                    break;
                }
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
    } catch (e) {
        res.status(400).json({ error: e.errors || e.message });
    }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`🚀 Placement Drive Clash Resolver running on http://localhost:${PORT}`);
    });
}
module.exports = { app, server, io, getBoundedPriority };
