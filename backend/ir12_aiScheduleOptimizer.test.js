const aiScheduleOptimizer = require('./aiScheduleOptimizer');

describe('IR-12 AI Feature 3: Genetic Multi-Objective Timetable Optimizer', () => {
    it('evolves conflict-free schedule across generations avoiding academic exams', () => {
        const interviewRequests = [
            { interviewId: 'REQ_1', studentId: 'STU_A', company: 'Google', durationMins: 45 },
            { interviewId: 'REQ_2', studentId: 'STU_B', company: 'Microsoft', durationMins: 45 },
            { interviewId: 'REQ_3', studentId: 'STU_A', company: 'Amazon', durationMins: 45 }, // STU_A has 2 interviews
        ];

        // Academic exam for STU_A from 600 to 660 mins
        const academicBlocks = [
            { studentId: 'STU_A', startMins: 600, endMins: 660 },
        ];

        const slots = [
            { slotId: 'SLOT_1', startMins: 600, endMins: 645 }, // CLASH with exam
            { slotId: 'SLOT_2', startMins: 700, endMins: 745 }, // SAFE
            { slotId: 'SLOT_3', startMins: 760, endMins: 805 }, // SAFE
            { slotId: 'SLOT_4', startMins: 820, endMins: 865 }, // SAFE
        ];

        const optimization = aiScheduleOptimizer.optimizeSchedule(interviewRequests, academicBlocks, slots, 30, 20);

        expect(optimization.optimizedSchedule.length).toBe(3);
        expect(optimization.bestFitnessScore).toBeGreaterThan(700);

        // STU_A interviews must not be placed in SLOT_1 (600-645)
        const stuAInterviews = optimization.optimizedSchedule.filter(s => s.studentId === 'STU_A');
        stuAInterviews.forEach(iv => {
            expect(iv.startTimeMinutes).not.toBe(600);
        });
    });
});
