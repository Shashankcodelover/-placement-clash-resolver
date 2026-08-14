const galeShapleyEngine = require('./galeShapleyEngine');

describe('IR-11 Feature 1: Gale-Shapley Stable Marriage & Deferred Acceptance Matching', () => {
    it('solves stable matching with 0 blocking pairs for multi-capacity corporate drives', () => {
        const companies = {
            'GOOGLE': { capacity: 2, preferences: ['STU_001', 'STU_004', 'STU_002', 'STU_003'] },
            'MICROSOFT': { capacity: 1, preferences: ['STU_002', 'STU_001', 'STU_004', 'STU_003'] },
            'AMAZON': { capacity: 1, preferences: ['STU_003', 'STU_002', 'STU_001', 'STU_004'] },
        };

        const students = {
            'STU_001': { preferences: ['GOOGLE', 'MICROSOFT', 'AMAZON'] },
            'STU_002': { preferences: ['MICROSOFT', 'GOOGLE', 'AMAZON'] },
            'STU_003': { preferences: ['AMAZON', 'GOOGLE', 'MICROSOFT'] },
            'STU_004': { preferences: ['GOOGLE', 'AMAZON', 'MICROSOFT'] },
        };

        const result = galeShapleyEngine.solveStableMatching(companies, students);

        expect(result.isStable).toBe(true);
        expect(result.blockingPairsCount).toBe(0);
        expect(result.matches['GOOGLE']).toEqual(['STU_001', 'STU_004']);
        expect(result.matches['MICROSOFT']).toEqual(['STU_002']);
        expect(result.matches['AMAZON']).toEqual(['STU_003']);
        expect(result.studentMatches['STU_001']).toBe('GOOGLE');
    });

    it('correctly reassigns offers upon student preference rank changes without deadlocks', () => {
        const companies = {
            'COMP_A': { capacity: 1, preferences: ['S1', 'S2'] },
            'COMP_B': { capacity: 1, preferences: ['S2', 'S1'] },
        };

        const students = {
            'S1': { preferences: ['COMP_B', 'COMP_A'] },
            'S2': { preferences: ['COMP_A', 'COMP_B'] },
        };

        const result = galeShapleyEngine.solveStableMatching(companies, students);
        expect(result.isStable).toBe(true);
        expect(result.studentMatches['S1']).toBe('COMP_A');
        expect(result.studentMatches['S2']).toBe('COMP_B');
    });
});

