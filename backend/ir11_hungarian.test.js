const hungarianAssignmentEngine = require('./hungarianAssignmentEngine');

describe('IR-11 Feature 2: Hungarian (Munkres) Optimal Panel-Interviewer Assignment', () => {
    it('optimally assigns domain-expert panelists to matching candidates with lowest cost', () => {
        const interviewers = [
            { id: 'PANEL_ML', name: 'Dr. Turing (AI/ML Lead)', skills: ['Machine Learning', 'Python', 'PyTorch'], completedInterviewsToday: 1 },
            { id: 'PANEL_SYS', name: 'Linus (Systems Lead)', skills: ['C++', 'Distributed Systems', 'Linux Kernel'], completedInterviewsToday: 0 },
            { id: 'PANEL_WEB', name: 'Ada (Fullstack Lead)', skills: ['React', 'TypeScript', 'Node.js'], completedInterviewsToday: 2 },
        ];

        const candidates = [
            { id: 'STU_SYS', name: 'Candidate A', skills: ['Distributed Systems', 'C++', 'Go'] },
            { id: 'STU_ML', name: 'Candidate B', skills: ['Python', 'Machine Learning', 'NLP'] },
            { id: 'STU_WEB', name: 'Candidate C', skills: ['React', 'TypeScript', 'GraphQL'] },
        ];

        const result = hungarianAssignmentEngine.solveOptimalAssignment(interviewers, candidates);

        expect(result.assignedCount).toBe(3);
        const mlMatch = result.assignments.find(a => a.interviewerId === 'PANEL_ML');
        const sysMatch = result.assignments.find(a => a.interviewerId === 'PANEL_SYS');
        const webMatch = result.assignments.find(a => a.interviewerId === 'PANEL_WEB');

        expect(mlMatch.candidateId).toBe('STU_ML');
        expect(sysMatch.candidateId).toBe('STU_SYS');
        expect(webMatch.candidateId).toBe('STU_WEB');
        expect(sysMatch.skillMatchPct).toBeGreaterThanOrEqual(60);
    });
});
