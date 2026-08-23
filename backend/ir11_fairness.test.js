const fairnessQuotaEngine = require('./fairnessQuotaEngine');

describe('IR-11 Feature 5: Weighted Fairness & Jain Index Department Diversity Balancer', () => {
    it('computes accurate Jain Fairness Index for equitable vs skewed department distributions', () => {
        // Equal distribution: 10, 10, 10, 10 -> Jain Index = 1.0
        const equalJain = fairnessQuotaEngine.calculateJainsFairnessIndex([10, 10, 10, 10]);
        expect(equalJain).toBe(1.0);

        // Skewed distribution: 90, 5, 3, 2 -> Jain Index is very low
        const skewedJain = fairnessQuotaEngine.calculateJainsFairnessIndex([90, 5, 3, 2]);
        expect(skewedJain).toBeLessThan(0.60);
    });

    it('evaluates candidate queue and flags branch concentration warnings', () => {
        const queue = [
            { id: 'S1', department: 'Computer Science', cgpa: 9.5 },
            { id: 'S2', department: 'Computer Science', cgpa: 9.2 },
            { id: 'S3', department: 'Computer Science', cgpa: 8.9 },
            { id: 'S4', department: 'Computer Science', cgpa: 8.7 },
            { id: 'S5', department: 'Electronics', cgpa: 8.8 },
        ];

        const evaluation = fairnessQuotaEngine.evaluateFairnessDistribution(queue, {
            'Computer Science': 0.35,
            'Electronics': 0.35,
        });

        expect(evaluation.totalCandidatesEvaluated).toBe(5);
        expect(evaluation.departmentBreakdown['Computer Science'].candidateCount).toBe(4);
        expect(evaluation.departmentBreakdown['Computer Science'].actualPercentage).toBe(80.0);
        expect(evaluation.recommendations.length).toBeGreaterThan(0);
    });
});
