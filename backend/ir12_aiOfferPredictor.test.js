const aiOfferPredictor = require('./aiOfferPredictor');

describe('IR-12 AI Feature 2: Predictive Offer Acceptance Likelihood Model', () => {
    it('predicts high acceptance probability (>80%) for Tier-1 Dream companies offering premium CTC', () => {
        const prediction = aiOfferPredictor.predictAcceptanceLikelihood({
            offeredCtcLpa: 32,
            campusMedianCtcLpa: 12,
            companyTier: 'TIER_1_DREAM',
            competingActiveOffersCount: 0,
            isPreferredLocation: true,
            candidateCgpa: 9.1,
        });

        expect(prediction.predictedProbability).toBeGreaterThan(0.80);
        expect(prediction.acceptancePercentage).toBeGreaterThanOrEqual(80);
        expect(prediction.renegeRiskLevel).toBe('VERY_HIGH_ACCEPTANCE_LOCK');
    });

    it('flags high renege flight risk when candidate has multiple competing offers and lower compensation', () => {
        const prediction = aiOfferPredictor.predictAcceptanceLikelihood({
            offeredCtcLpa: 7,
            campusMedianCtcLpa: 12,
            companyTier: 'TIER_3_MASS',
            competingActiveOffersCount: 2,
            isPreferredLocation: false,
            candidateCgpa: 8.8,
        });

        expect(prediction.predictedProbability).toBeLessThan(0.40);
        expect(prediction.renegeRiskLevel).toBe('HIGH_RENEGE_FLIGHT_RISK');
        expect(prediction.actionRecommendation).toContain('CRITICAL');
    });
});
