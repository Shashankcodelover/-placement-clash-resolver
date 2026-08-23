const cspBacktrackingEngine = require('./cspBacktrackingEngine');

describe('IR-15 Stage 2: Real-Time Constraint Satisfaction Engine (AC-3 CSP)', () => {
    it('solves constrained slot allocations with zero clashes', () => {
        const candidates = [
            { id: 'CAND_1', allowedSlots: [1, 2] },
            { id: 'CAND_2', allowedSlots: [1, 2] },
            { id: 'CAND_3', allowedSlots: [2, 3] },
        ];

        const clashes = [
            { candidateA: 'CAND_1', candidateB: 'CAND_2' },
        ];

        const solution = cspBacktrackingEngine.solveCSP(candidates, clashes);
        expect(solution.isSolvable).toBe(true);
        expect(solution.assignment['CAND_1']).not.toBe(solution.assignment['CAND_2']);
        expect(solution.status).toBe('AC3_CSP_CONSTRAINTS_SATISFIED');
    });
});
