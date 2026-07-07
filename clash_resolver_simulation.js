/**
 * 🎓 Placement Drive Clash Resolver - Algorithmic Simulation Script
 * ----------------------------------------------------------------
 * This script demonstrates the core logic, algorithms, and features designed to solve
 * the 5 critical recruitment bottlenecks faced by universities during campus placement drives.
 * 
 * MAIN AGENDA:
 * Optimize student-recruiter scheduling in real-time, eliminating operational delays, 
 * unfair wait times, scheduling conflicts, and administrative overhead.
 * 
 * STRENGTH OF THE PROJECT:
 * Bypasses simple database queries to employ dynamic mathematical queuing (Tribonacci-weighted),
 * bipartite graphs for real-time re-routing, and predictive analytics for cascading delays.
 */

// Helper utility for visual console logs
function printHeader(title) {
    console.log(`\n================================================================================`);
    console.log(`🚀 FEATURE: ${title}`);
    console.log(`================================================================================`);
}

function printSubHeader(subtitle) {
    console.log(`\n🔹 ${subtitle}`);
}


// ================================================================================
// MINI-PROBLEM 1: Academic vs. Career Schedule Clashes
// FEATURE: Zero-Conflict Academic Synchronization Engine
// ================================================================================
class AcademicSyncEngine {
    constructor() {
        // University timetables for students
        this.academicTimetable = {
            "STU_001": [ // Student 1 has mandatory classes and midterms
                { name: "Computer Networks Lab", start: 900, end: 1100 }, // 09:00 AM - 11:00 AM in minutes from midnight
                { name: "Midterm Exam: OS", start: 1400, end: 1530 }      // 02:00 PM - 03:30 PM
            ],
            "STU_002": [ // Student 2
                { name: "DBMS Lecture", start: 1000, end: 1130 },         // 10:00 AM - 11:30 AM
                { name: "Compiler Design Lab", start: 1500, end: 1700 }   // 03:00 PM - 05:00 PM
            ]
        };
    }

    /**
     * Cross-references an interview slot against student's academic blockouts
     * Proposes alternative, conflict-free times if a clash is detected.
     */
    findConflictFreeSlots(studentId, proposedStart, duration, universityHours) {
        const studentSchedule = this.academicTimetable[studentId] || [];
        const proposedEnd = proposedStart + duration;

        console.log(`[Sync Engine] Checking Student ${studentId}'s schedule for proposed slot: ${this.minToTimeStr(proposedStart)} - ${this.minToTimeStr(proposedEnd)}`);

        // Check if there is an overlap with academic blocks
        const clash = studentSchedule.find(block => {
            return (proposedStart < block.end && proposedEnd > block.start);
        });

        if (!clash) {
            console.log(`   ✅ Success! No conflicts found. Slot reserved.`);
            return { conflictFree: true, scheduledSlot: { start: proposedStart, end: proposedEnd } };
        }

        console.log(`   ❌ CLASH DETECTED with: "${clash.name}" (${this.minToTimeStr(clash.start)} - ${this.minToTimeStr(clash.end)})`);
        console.log(`   [Sync Engine] Computing alternative slots...`);

        // Generate conflict-free slots in the university hour range (e.g., 9:00 AM to 5:00 PM)
        const alternatives = [];
        let cursor = universityHours.start;

        while (cursor + duration <= universityHours.end) {
            const tempEnd = cursor + duration;
            // Check if cursor conflicts with any academic timetable block
            const conflictsWithAcademic = studentSchedule.some(block => {
                return (cursor < block.end && tempEnd > block.start);
            });

            if (!conflictsWithAcademic && (cursor < proposedStart || cursor >= proposedEnd)) {
                alternatives.push({ start: cursor, end: tempEnd });
            }
            cursor += 30; // check in 30-min intervals
        }

        return {
            conflictFree: false,
            conflictDetail: clash.name,
            suggestedAlternatives: alternatives.slice(0, 3) // Return top 3 alternatives
        };
    }

    minToTimeStr(min) {
        const hrs = Math.floor(min / 60);
        const mins = min % 60;
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        const displayHrs = hrs % 12 === 0 ? 12 : hrs % 12;
        return `${displayHrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`;
    }
}


// ================================================================================
// MINI-PROBLEM 2: Cascading Operational Delays
// FEATURE: Predictive Delay Modeling
// ================================================================================
class PredictiveDelayModeler {
    constructor() {
        this.pushLog = [];
    }

    /**
     * Monitors active interview pacing and recalculates downstream schedules
     * to prevent students waiting hours without communication.
     */
    evaluateScheduleDelay(interviews, currentInterviewIndex, actualDuration) {
        const activeInterview = interviews[currentInterviewIndex];
        const scheduledDuration = activeInterview.scheduledEnd - activeInterview.scheduledStart;
        const delay = actualDuration - scheduledDuration;

        if (delay <= 0) {
            console.log(`[Predictive Model] Interview for ${activeInterview.studentName} completed on time.`);
            return interviews;
        }

        console.log(`[Predictive Model] ⚠️ Delay detected: ${activeInterview.studentName}'s interview overran by ${delay} minutes.`);
        console.log(`[Predictive Model] Recalculating downstream schedules and dispatching notifications...`);

        // Apply delay cascades dynamically to all subsequent interviews for the same panel
        for (let i = currentInterviewIndex + 1; i < interviews.length; i++) {
            interviews[i].estimatedStart = (interviews[i].estimatedStart || interviews[i].scheduledStart) + delay;
            interviews[i].estimatedEnd = (interviews[i].estimatedEnd || interviews[i].scheduledEnd) + delay;

            this.dispatchPushNotification(
                interviews[i].studentId,
                interviews[i].studentName,
                interviews[i].estimatedStart
            );
        }

        return interviews;
    }

    dispatchPushNotification(studentId, name, newStartTime) {
        const hrs = Math.floor(newStartTime / 60);
        const mins = newStartTime % 60;
        const timeStr = `${hrs % 12 === 0 ? 12 : hrs % 12}:${mins.toString().padStart(2, '0')} ${hrs >= 12 ? 'PM' : 'AM'}`;
        
        const message = `🔔 Hi ${name}, due to a minor delay in earlier rounds, your interview is rescheduled to ${timeStr}. Please arrive 10 mins prior.`;
        this.pushLog.push({ studentId, message });
        console.log(`   📲 [PUSH -> ${studentId}]: "${message}"`);
    }
}


// ================================================================================
// MINI-PROBLEM 3: Unfair and Stagnant Wait Times
// FEATURE: Tribonacci-Weighted Dynamic Queuing
// ================================================================================
class TribonacciQueue {
    constructor() {
        this.queue = []; // Array of { studentId, name, waitIntervals, baseScore }
    }

    // Tribonacci sequence implementation
    getTribonacciValue(n) {
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

    addStudent(studentId, name, baseScore) {
        this.queue.push({ studentId, name, waitIntervals: 0, baseScore });
    }

    /**
     * Aging mechanism: dynamically recalculates priority weights based on wait times
     * using the Tribonacci progression to prevent stagnant queuing.
     */
    ageQueue() {
        console.log(`[Queue aging] Aging all waiting candidates using Tribonacci-weighted coefficients...`);
        this.queue.forEach(student => {
            student.waitIntervals += 1;
            const weight = this.getTribonacciValue(student.waitIntervals);
            // Priority Score = Base Score + (Tribonacci Weight * Aging Coefficient)
            student.priorityScore = student.baseScore + (weight * 6);
        });

        // Sort queue by priority score (descending)
        this.queue.sort((a, b) => b.priorityScore - a.priorityScore);
    }

    printQueue() {
        console.log(`   Current Queue Status:`);
        this.queue.forEach((s, idx) => {
            console.log(`     Rank ${idx + 1}: ${s.name} | Wait Intervals: ${s.waitIntervals} | Score: ${s.priorityScore || s.baseScore}`);
        });
    }
}


// ================================================================================
// MINI-PROBLEM 4: Candidate Ghosting and Administrative Lag
// FEATURE: Multi-Stage Conditional Triggers
// ================================================================================
class ConditionalTriggerEngine {
    constructor() {
        this.triggeredBookings = [];
    }

    /**
     * Real-time listener that reads assessment score sheets and fires triggers
     * to prompt the student to book the next round instantly.
     */
    processScoreUpdate(studentId, studentName, roundName, score, threshold) {
        console.log(`[Triggers] Score logged for ${studentName} (${roundName}): ${score}/100`);

        if (score >= threshold) {
            console.log(`   🎯 Threshold of ${threshold} met. Instantly unlocking Next Round Scheduling!`);
            const bookingLink = `https://placements.uni.edu/book-slot?studentId=${studentId}&round=HR`;
            
            this.sendInstantInvite(studentId, studentName, bookingLink);
            this.triggeredBookings.push({ studentId, bookingLink });
        } else {
            console.log(`   ❌ Candidate did not meet threshold for immediate automation. Manual review triggered.`);
        }
    }

    sendInstantInvite(studentId, name, link) {
        console.log(`   📨 [SMS/Email Sent to ${name}]: "Congratulations! You have cleared the Technical Round. Secure your HR Interview slot immediately: ${link}"`);
    }
}


// ================================================================================
// MINI-PROBLEM 5: Opportunity Hoarding on Day 1
// FEATURE: Continuous Bipartite Match Re-Routing
// ================================================================================
class BipartiteReRouter {
    constructor() {
        // Track candidate memberships in various company interview queues
        this.queues = {
            "Google": ["STU_001", "STU_003", "STU_004"],
            "Microsoft": ["STU_002", "STU_001", "STU_005"],
            "Meta": ["STU_003", "STU_001", "STU_002"]
        };
        this.placedStudents = new Set();
    }

    /**
     * When a student accepts a binding offer, immediately remove them from all
     * other active corporate queues to give other students opportunities.
     */
    acceptBindingOffer(studentId, studentName, companyName) {
        console.log(`[Bipartite Re-Router] Student ${studentName} accepted a BINDING offer with ${companyName}!`);
        this.placedStudents.add(studentId);

        Object.keys(this.queues).forEach(company => {
            const queue = this.queues[company];
            const index = queue.indexOf(studentId);

            if (index !== -1) {
                console.log(`   ⚠️ Removing ${studentName} from concurrent queue of: ${company}`);
                queue.splice(index, 1);
                
                // Pull the next eligible student up
                if (queue[0]) {
                    console.log(`   🚀 Success: Pulling up next candidate in line for ${company}: ${queue[0]}`);
                }
            }
        });
    }

    printQueues() {
        console.log(`   Corporate Queues Status:`);
        Object.keys(this.queues).forEach(company => {
            console.log(`     ${company} Queue: [${this.queues[company].join(", ")}]`);
        });
    }
}


// ================================================================================
// SIMULATION RUNNER
// ================================================================================
async function runSimulation() {
    console.log("================================================================================");
    console.log("               PLACEMENT DRIVE CLASH RESOLVER - CORE ALGORITHM SIMULATOR       ");
    console.log("================================================================================");
    console.log("AGENDA: Eliminate schedule conflicts, long waiting times, and hoarding behaviors.");
    console.log("STRENGTH: Real-time event-driven updates and optimized operations.");
    
    // --- FEATURE 1 ---
    printHeader("Zero-Conflict Academic Synchronization Engine");
    const syncEngine = new AcademicSyncEngine();
    const uniHours = { start: 540, end: 1020 }; // 9:00 AM to 5:00 PM (minutes)
    
    // Attempt to book student STU_001 at 02:30 PM (870 minutes) for a 60 min interview
    const result1 = syncEngine.findConflictFreeSlots("STU_001", 870, 60, uniHours);
    
    if (!result1.conflictFree) {
        console.log(`\n[Sync Engine Suggestion] Rescheduling to alternative conflict-free slots:`);
        result1.suggestedAlternatives.forEach(slot => {
            console.log(`   👉 Alternate: ${syncEngine.minToTimeStr(slot.start)} - ${syncEngine.minToTimeStr(slot.end)}`);
        });
    }

    // --- FEATURE 2 ---
    printHeader("Predictive Delay Modeling");
    const modeler = new PredictiveDelayModeler();
    
    let activeInterviews = [
        { studentId: "STU_001", studentName: "Preetham J", scheduledStart: 600, scheduledEnd: 630 }, // 10:00 - 10:30 AM
        { studentId: "STU_002", studentName: "Aditya Roy", scheduledStart: 630, scheduledEnd: 700 }, // 10:30 - 11:00 AM
        { studentId: "STU_003", studentName: "John Doe", scheduledStart: 700, scheduledEnd: 730 }    // 11:00 - 11:30 AM
    ];

    // Simulating that Preetham's interview takes 55 minutes instead of the scheduled 30 minutes (25 min delay)
    modeler.evaluateScheduleDelay(activeInterviews, 0, 55);


    // --- FEATURE 3 ---
    printHeader("Tribonacci-Weighted Dynamic Queuing");
    const tQueue = new TribonacciQueue();
    tQueue.addStudent("STU_001", "Student A (Preetham - Waiting longest)", 45);
    
    printSubHeader("Initial Queue State: Student A joins");
    tQueue.printQueue();

    printSubHeader("Simulation: Time Tick 1 (Student A ages, Student B joins)");
    tQueue.ageQueue();
    tQueue.addStudent("STU_002", "Student B (Aditya - Newly joined)", 55);
    tQueue.printQueue();

    printSubHeader("Simulation: Time Tick 2 (Student A and B age, Student C joins)");
    tQueue.ageQueue();
    tQueue.addStudent("STU_003", "Student C (John - Newly joined)", 65);
    tQueue.printQueue();

    printSubHeader("Simulation: Time Tick 3 (All age - Tribonacci weight scales Student A priority)");
    tQueue.ageQueue();
    tQueue.printQueue();

    printSubHeader("Simulation: Time Tick 4 (All age - Student A overtakes Student B)");
    tQueue.ageQueue();
    tQueue.printQueue();

    printSubHeader("Simulation: Time Tick 5 (All age - Student A overtakes Student C to take Rank 1)");
    tQueue.ageQueue();
    tQueue.printQueue();


    // --- FEATURE 4 ---
    printHeader("Multi-Stage Conditional Triggers");
    const triggerEngine = new ConditionalTriggerEngine();
    
    // Case 1: Student cleared round (Score 85 >= 70 Threshold)
    triggerEngine.processScoreUpdate("STU_001", "Preetham J", "Technical Round 1", 85, 70);
    
    // Case 2: Student failed to clear (Score 55 < 70 Threshold)
    triggerEngine.processScoreUpdate("STU_002", "Aditya Roy", "Technical Round 1", 55, 70);


    // --- FEATURE 5 ---
    printHeader("Continuous Bipartite Match Re-Routing (Offer Hoarding Prevention)");
    const reRouter = new BipartiteReRouter();
    
    printSubHeader("Initial State: Preetham (STU_001) in multiple queues");
    reRouter.printQueues();

    printSubHeader("Simulation: Preetham accepts offer at Microsoft");
    reRouter.acceptBindingOffer("STU_001", "Preetham J", "Microsoft");

    printSubHeader("Final Queues State (Safeguarded from hoarding)");
    reRouter.printQueues();
    
    console.log(`\n================================================================================`);
    console.log("🏁 SIMULATION COMPLETED SUCCESSFULLY");
    console.log("================================================================================");
}

runSimulation();
