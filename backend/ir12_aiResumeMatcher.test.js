const aiResumeMatcher = require('./aiResumeMatcher');

describe('IR-12 AI Feature 1: Resume-Job Skill Vector Embedding & Semantic Matcher', () => {
    it('extracts tech keywords and computes high cosine similarity for aligned profiles', () => {
        const resume = 'Experienced in React, TypeScript, Node.js, Express, PostgreSQL, Docker, and Redis with strong Data Structures knowledge.';
        const jd = 'Looking for Fullstack Engineer skilled in TypeScript, React, Node.js, PostgreSQL, Docker, and System Design.';

        const result = aiResumeMatcher.evaluateCandidateFit(resume, jd, 9.2);

        expect(result.matchedSkills).toEqual(expect.arrayContaining(['typescript', 'react', 'node.js', 'postgresql', 'docker']));
        expect(result.missingPrerequisites).toContain('system design');
        expect(result.semanticSimilarityScore).toBeGreaterThan(0.70);
        expect(result.matchPercentage).toBeGreaterThan(75);
        expect(result.recommendation).toBe('HIGHLY_RECOMMENDED');
    });

    it('identifies critical skill deficits for misaligned job applications', () => {
        const resume = 'Experienced in Python, Pandas, Machine Learning, Deep Learning, and PyTorch.';
        const jd = 'Looking for iOS Mobile Developer with Swift, Objective-C, UIKit, SwiftUI, and CoreData.';

        const result = aiResumeMatcher.evaluateCandidateFit(resume, jd, 7.5);

        expect(result.semanticSimilarityScore).toBeLessThan(0.30);
        expect(result.recommendation).toBe('SKILL_DEFICIT_HIGH_RISK');
        expect(result.missingPrerequisites.length).toBeGreaterThan(0);
    });
});
