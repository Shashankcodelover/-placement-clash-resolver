const aiInterviewScorer = require('./aiInterviewScorer');

describe('IR-12 AI Feature 4: Real-time Audio/Video Interview STAR Clarity Scorer', () => {
    it('awards high clarity score to well-structured STAR responses with quantified results', () => {
        const transcript = `
            During my internship at TechCorp, the situation was that our API was experiencing 800ms latency under peak load.
            My task was to optimize the database query latency and caching architecture.
            I implemented an asynchronous distributed Redis cache and refactored the PostgreSQL compound indices.
            As a result, we achieved a 65% reduction in latency and improved throughput by 3x.
        `;

        const score = aiInterviewScorer.evaluateTranscript(transcript, 'SYSTEMS');

        expect(score.starAnalysis.hasSituation).toBe(true);
        expect(score.starAnalysis.hasTask).toBe(true);
        expect(score.starAnalysis.hasAction).toBe(true);
        expect(score.starAnalysis.hasResult).toBe(true);
        expect(score.starAnalysis.starAdherencePercentage).toBe(100);
        expect(score.compositeClarityScore).toBeGreaterThanOrEqual(80);
    });

    it('detects missing STAR components and penalizes high filler word density', () => {
        const transcript = `
            Um, like, basically I worked on some code, you know, and like, it was, um, kind of hard to do, but actually we did it.
        `;

        const score = aiInterviewScorer.evaluateTranscript(transcript, 'GENERAL');

        expect(score.fillerMetrics.isExcessiveFiller).toBe(true);
        expect(score.starAnalysis.hasResult).toBe(false);
        expect(score.compositeClarityScore).toBeLessThan(50);
        expect(score.feedbackSummary).toContain('filler words');
    });
});
