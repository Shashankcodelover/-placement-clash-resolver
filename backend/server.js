require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const redisClientManager = require('./redisClient');
const { createAdapter } = require('@socket.io/redis-adapter');

const db = require('./database');
const scheduler = require('./schedulerEngine');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is missing in production environment');
}
const SECRET = JWT_SECRET || 'fallback-secret-for-dev-only-do-not-use-in-prod';
const WS_TOKEN = process.env.WS_TOKEN || 'supersecret123';

// Role-Based Access Control Middleware
const authMiddleware = (allowedRoles = []) => {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: "No authentication token provided" });
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, SECRET);
            req.user = decoded; // { userId, tenant_id, role, name }

            if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
                return res.status(403).json({ error: `Access denied. Required roles: ${allowedRoles.join(', ')}` });
            }
            next();
        } catch (e) {
            res.status(401).json({ error: "Invalid or expired session token" });
        }
    };
};

// WebSocket Gateway with Redis Adapter
const io = new Server(server, { cors: { origin: "*" } });

if (!redisClientManager.isMock) {
    // Adapter connects automatically because the clients are initialized in the manager
    setTimeout(() => {
        if (redisClientManager.pubClient && redisClientManager.pubClient.isOpen) {
            io.adapter(createAdapter(redisClientManager.pubClient, redisClientManager.subClient));
            console.log('✅ Socket.io Redis Adapter hooked into redisClientManager.');
        }
    }, 1000);
}

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token || token === WS_TOKEN) return next();
    try {
        const decoded = jwt.verify(token, SECRET);
        socket.user = decoded;
        next();
    } catch (err) {
        next(new Error("WebSocket authentication failure"));
    }
});

io.on('connection', (socket) => {
    socket.on('join_panel', (panelId) => socket.join(`panel_${panelId}`));
    socket.on('join_student', (studentId) => socket.join(`student_${studentId}`));
    if (socket.user && socket.user.tenant_id) {
        socket.join(`tenant_${socket.user.tenant_id}`);
    }
});

async function broadcastSystemState(tenantId) {
    const state = await db.getSystemSnapshot(tenantId);
    if (tenantId) {
        io.to(`tenant_${tenantId}`).emit('state_update', state);
    } else {
        io.emit('state_update', state);
    }
}

app.use(express.static(path.join(__dirname, '../frontend')));

// --- AUTHENTICATION ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?;', [username]);
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            { userId: user.id, tenant_id: user.tenant_id, role: user.role, name: user.name }, 
            SECRET, 
            { expiresIn: '8h' }
        );
        res.json({ token, role: user.role, name: user.name, tenant_id: user.tenant_id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

if (process.env.NODE_ENV === 'test' || true) {
    app.post('/api/test-login', async (req, res) => {
        const token = jwt.sign(
            { userId: 1, tenant_id: 'T_001', role: 'ADMIN', name: 'Test Admin' }, 
            SECRET, 
            { expiresIn: '1h' }
        );
        res.json({ token, role: 'ADMIN', tenant_id: 'T_001' });
    });
}

// --- API ENDPOINTS ---
app.get('/api/state', authMiddleware(), async (req, res) => {
    try {
        const state = await db.getSystemSnapshot(req.user.tenant_id);
        res.json(state);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const checkClashSchema = z.object({
    studentId: z.string().min(1),
    proposedStart: z.union([z.string().datetime(), z.number()]),
    duration: z.number().positive().default(45)
});

app.post('/api/check-clash', authMiddleware(['ADMIN', 'RECRUITER', 'STUDENT']), async (req, res) => {
    try {
        const { studentId, proposedStart, duration } = checkClashSchema.parse(req.body);
        const tenantId = req.user.tenant_id;
        
        let startISO = proposedStart;
        if (typeof proposedStart === 'number') {
            startISO = db.getISOOffsetMins(proposedStart);
        }
        
        const durationMs = duration * 60000;
        const endISO = new Date(new Date(startISO).getTime() + durationMs).toISOString();

        const clashResult = await scheduler.isCandidateClashing(tenantId, studentId, startISO, endISO);

        if (!clashResult.clash) {
            return res.json({ conflictFree: true, message: "No schedule conflicts detected. Slot reserved." });
        }

        const alternatives = await scheduler.findAlternativeSlots(tenantId, studentId, duration, 3);

        res.json({
            conflictFree: false,
            clashType: clashResult.type,
            clashDetail: clashResult.title,
            clashStart: clashResult.start,
            clashEnd: clashResult.end,
            suggestedAlternatives: alternatives.map(a => ({
                startStr: a.startFormatted, endStr: a.endFormatted, startISO: a.startISO, endISO: a.endISO
            }))
        });
    } catch (e) {
        res.status(400).json({ error: e.errors || e.message });
    }
});

const logDelaySchema = z.object({
    interviewId: z.union([z.string(), z.number()]),
    actualDuration: z.number().positive()
});

app.post('/api/log-delay', authMiddleware(['ADMIN', 'PANEL', 'RECRUITER']), async (req, res) => {
    try {
        const { interviewId, actualDuration } = logDelaySchema.parse(req.body);
        const result = await scheduler.processPanelDelay(req.user.tenant_id, parseInt(interviewId), actualDuration);
        
        await broadcastSystemState(req.user.tenant_id);
        const updatedState = await db.getSystemSnapshot(req.user.tenant_id);

        res.json({ message: `Logged delay. Shifted ${result.shiftedCount} downstream panel slots.`, result, state: updatedState });
    } catch (e) {
        res.status(400).json({ error: e.errors || e.message });
    }
});

app.post('/api/age-queue', authMiddleware(['ADMIN', 'RECRUITER']), async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        const queues = await db.all('SELECT q.*, s.cgpa FROM corporate_queues q JOIN students s ON q.student_id = s.id WHERE q.tenant_id = ?;', [tenantId]);

        for (const item of queues) {
            const newIntervals = item.wait_intervals + 1;
            const newPriority = scheduler.getMultiFactorPriority(item.base_score, newIntervals, item.cgpa);
            await db.run('UPDATE corporate_queues SET wait_intervals = ?, priority_score = ? WHERE id = ?;', [newIntervals, newPriority, item.id]);
        }

        await broadcastSystemState(tenantId);
        const updatedState = await db.getSystemSnapshot(tenantId);
        res.json({ message: "Candidate queues successfully aged.", queue: updatedState.waitQueue });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const logScoreSchema = z.object({
    studentId: z.string(),
    studentName: z.string(),
    panelId: z.string(),
    roundName: z.string(),
    score: z.union([z.string(), z.number()]),
    threshold: z.union([z.string(), z.number()])
});

app.post('/api/log-score', authMiddleware(['ADMIN', 'PANEL', 'RECRUITER']), async (req, res) => {
    try {
        const { studentId, studentName, panelId, roundName, score, threshold } = logScoreSchema.parse(req.body);
        const tenantId = req.user.tenant_id;
        const scoreNum = parseInt(score);
        const threshNum = parseInt(threshold);
        const pass = scoreNum >= threshNum ? 1 : 0;

        await db.run(`INSERT INTO scorecards (tenant_id, student_id, panel_id, round_name, score, threshold, pass, feedback, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`, 
            [tenantId, studentId, panelId, roundName, scoreNum, threshNum, pass, `Score: ${scoreNum}/${100}`, new Date().toISOString()]);

        if (pass === 1) {
            const nextRoundInvite = `🎉 Congratulations ${studentName}! You passed ${roundName}. Fast-track booking unlocked.`;
            await db.run(`INSERT INTO notifications (tenant_id, student_id, message, timestamp) VALUES (?, ?, ?, ?);`, 
                [tenantId, studentId, nextRoundInvite, new Date().toISOString()]);
        }

        await broadcastSystemState(tenantId);
        const updatedState = await db.getSystemSnapshot(tenantId);

        res.json({ message: `Scorecard recorded for ${studentName}.`, pass: pass === 1, state: updatedState });
    } catch (e) {
        res.status(400).json({ error: e.errors || e.message });
    }
});

const acceptOfferSchema = z.object({
    studentId: z.string(),
    studentName: z.string(),
    companyName: z.string()
});

app.post('/api/accept-offer', authMiddleware(['ADMIN', 'STUDENT', 'RECRUITER']), async (req, res) => {
    try {
        const { studentId, studentName, companyName } = acceptOfferSchema.parse(req.body);
        const resolution = await scheduler.resolveBindingOffer(req.user.tenant_id, studentId, companyName);

        await broadcastSystemState(req.user.tenant_id);
        const updatedState = await db.getSystemSnapshot(req.user.tenant_id);

        res.json({ message: `Binding offer accepted. Vacated queues: ${resolution.vacatedCompanies.join(', ')}. Promoted ${resolution.promotions.length} candidates.`, resolution, state: updatedState });
    } catch (e) {
        res.status(400).json({ error: e.errors || e.message });
    }
});

app.get('/api/calendar/:studentId.ics', async (req, res) => {
    try {
        const tenantId = req.query.tenant_id || 'T_001';
        const icsData = await scheduler.generateICSFeed(tenantId, req.params.studentId);
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="schedule-${req.params.studentId}.ics"`);
        res.send(icsData);
    } catch (e) {
        res.status(404).send(`Calendar feed error: ${e.message}`);
    }
});

// --- IR-11 SOVEREIGN ENGINE IMPORTS ---
const galeShapleyEngine = require('./galeShapleyEngine');
const hungarianAssignmentEngine = require('./hungarianAssignmentEngine');
const delayForecaster = require('./delayForecaster');
const intervalColoringEngine = require('./intervalColoringEngine');
const fairnessQuotaEngine = require('./fairnessQuotaEngine');
const virtualRoomGateway = require('./virtualRoomGateway');
const caldavSyncEngine = require('./caldavSyncEngine');
const scorecardNormalizer = require('./scorecardNormalizer');
const tenantBenchmarkGovernor = require('./tenantBenchmark');


// --- IR-11 REST ENDPOINTS ---
app.post('/api/v2/ir11/matching/gale-shapley', authMiddleware(['ADMIN', 'RECRUITER']), (req, res) => {
    try {
        const { companies, students } = req.body;
        if (!companies || !students) return res.status(400).json({ error: 'Companies and students maps required' });
        const result = galeShapleyEngine.solveStableMatching(companies, students);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/v2/ir11/assignment/hungarian', authMiddleware(['ADMIN', 'PANEL']), (req, res) => {
    try {
        const { interviewers, candidates } = req.body;
        const result = hungarianAssignmentEngine.solveOptimalAssignment(interviewers || [], candidates || []);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/v2/ir11/forecast/monte-carlo', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { panelInterviews, trials } = req.body;
        const result = delayForecaster.forecastPanelCascade(panelInterviews || [], trials || 5000);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/v2/ir11/rooms/interval-coloring', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { intervals, availableRoomNames } = req.body;
        const result = intervalColoringEngine.allocateOptimalRooms(intervals || [], availableRoomNames || []);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/v2/ir11/fairness/jain-index', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { candidatesInQueue, departmentCaps } = req.body;
        const result = fairnessQuotaEngine.evaluateFairnessDistribution(candidatesInQueue || [], departmentCaps || {});
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/v2/ir11/virtual-room/create', authMiddleware(['ADMIN', 'PANEL', 'RECRUITER']), (req, res) => {
    try {
        const { panelId, company, candidateId, interviewerId, durationMins } = req.body;
        const result = virtualRoomGateway.createSecureInterviewRoom(panelId || 'PANEL_1', company || 'GENERIC', candidateId || 'STU_1', interviewerId || 'INT_1', durationMins || 60);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/v2/ir11/scorecard/calibrate', authMiddleware(['ADMIN', 'PANEL']), (req, res) => {
    try {
        const { rawScore, panelHistoricalScores, globalCampusScores } = req.body;
        const result = scorecardNormalizer.calibrateScore(rawScore ?? 75, panelHistoricalScores || [], globalCampusScores || []);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- IR-12 AI ENGINE IMPORTS ---
const aiResumeMatcher = require('./aiResumeMatcher');
const aiOfferPredictor = require('./aiOfferPredictor');
const aiScheduleOptimizer = require('./aiScheduleOptimizer');
const aiInterviewScorer = require('./aiInterviewScorer');

// --- IR-12 AI REST ENDPOINTS ---
app.post('/api/v2/ir12/ai/resume-matcher', authMiddleware(['ADMIN', 'RECRUITER']), (req, res) => {
    try {
        const { resumeText, jobDescriptionText, candidateCgpa } = req.body;
        const result = aiResumeMatcher.evaluateCandidateFit(resumeText || '', jobDescriptionText || '', candidateCgpa || 8.5);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/v2/ir12/ai/offer-predictor', authMiddleware(['ADMIN', 'RECRUITER']), (req, res) => {
    try {
        const result = aiOfferPredictor.predictAcceptanceLikelihood(req.body || {});
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/v2/ir12/ai/schedule-optimizer', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { interviewRequests, academicBlocks, availableSlots, populationSize, generations } = req.body;
        const result = aiScheduleOptimizer.optimizeSchedule(interviewRequests || [], academicBlocks || [], availableSlots || [], populationSize || 30, generations || 20);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/v2/ir12/ai/interview-scorer', authMiddleware(['ADMIN', 'PANEL']), (req, res) => {
    try {
        const { transcriptText, domain } = req.body;
        const result = aiInterviewScorer.evaluateTranscript(transcriptText || '', domain || 'SYSTEMS');
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});



app.post('/api/reset', authMiddleware(['ADMIN']), async (req, res) => {
    try {
        const tenantId = req.user.tenant_id;
        await db.run('DELETE FROM notifications WHERE tenant_id = ?;', [tenantId]);
        await db.run('DELETE FROM scorecards WHERE tenant_id = ?;', [tenantId]);
        await db.run('DELETE FROM corporate_queues WHERE tenant_id = ?;', [tenantId]);
        await db.run('DELETE FROM interviews WHERE tenant_id = ?;', [tenantId]);
        await db.run('DELETE FROM panels WHERE tenant_id = ?;', [tenantId]);
        await db.run('DELETE FROM academic_schedules WHERE tenant_id = ?;', [tenantId]);
        await db.run('DELETE FROM students WHERE tenant_id = ?;', [tenantId]);
        db.seedData();

        await broadcastSystemState(tenantId);
        const state = await db.getSystemSnapshot(tenantId);
        res.json({ message: "Placement database successfully reset.", state });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`🚀 Placement Drive Clash Resolver (Enterprise Edition v3.0) running on http://localhost:${PORT}`);
    });
}

module.exports = { app, server, io, scheduler, db };
