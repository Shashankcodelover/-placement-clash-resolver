const paretoFrontierEngine = require('./paretoFrontierEngine');

describe('IR-15 Stage 1: Pareto Frontier Optimal Slot Allocator', () => {
    it('isolates non-dominated multi-objective schedules', () => {
        const schedules = [
            { scheduleId: 'SCHED_A', waitTimeMins: 30, utilizationPct: 95, fatigueVariance: 1.2 }, // Strong candidate
            { scheduleId: 'SCHED_B', waitTimeMins: 20, utilizationPct: 90, fatigueVariance: 1.5 }, // Low wait trade-off
            { scheduleId: 'SCHED_C', waitTimeMins: 50, utilizationPct: 80, fatigueVariance: 3.0 }, // Dominated by A
        ];

        const result = paretoFrontierEngine.findParetoFrontier(schedules);
        expect(result.totalEvaluated).toBe(3);
        expect(result.paretoFrontierCount).toBe(2);
        expect(result.paretoFrontier.some(s => s.scheduleId === 'SCHED_A')).toBe(true);
        expect(result.paretoFrontier.some(s => s.scheduleId === 'SCHED_B')).toBe(true);
        expect(result.paretoFrontier.some(s => s.scheduleId === 'SCHED_C')).toBe(false);
        expect(result.recommendedKneePointSchedule).toBeDefined();
    });
});
