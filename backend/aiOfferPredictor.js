/**
 * AI Predictive Offer Acceptance Likelihood Model — Industrial Readiness Level 12 (IR-12 / AI)
 * 
 * Predicts the probability P(Accept) that a student candidate will accept a binding corporate offer.
 * Evaluates logistic regression features:
 * 1. CTC Multiple Factor (Offered CTC / Campus Median CTC)
 * 2. Company Brand Tier (Tier 1 Dream, Tier 2 Super Dream, Tier 3 Core)
 * 3. Competing In-Flight Offers / Concurrent Final Round Pipelines
 * 4. Location Preference Alignment
 * 5. Candidate Wait Time & Fatigue Index
 */

class AIOfferPredictor {
    /**
     * Logistic Sigmoid function: 1 / (1 + e^-z)
     */
    sigmoid(z) {
        return 1.0 / (1.0 + Math.exp(-z));
    }

    /**
     * Predicts offer acceptance likelihood.
     * 
     * @param {Object} params
     * @param {number} params.offeredCtcLpa - Offered compensation (e.g. 24.5 LPA)
     * @param {number} params.campusMedianCtcLpa - University baseline median (e.g. 12.0 LPA)
     * @param {string} params.companyTier - 'TIER_1_DREAM' | 'TIER_2_SUPER_DREAM' | 'TIER_3_MASS'
     * @param {number} params.competingActiveOffersCount - Existing unaccepted offers
     * @param {boolean} params.isPreferredLocation - Matches candidate desired city
     * @param {number} params.candidateCgpa - Student CGPA
     * @returns {Object} Prediction report with acceptance probability, renege risk level, and recruitment strategy
     */
    predictAcceptanceLikelihood(params) {
        const {
            offeredCtcLpa = 15,
            campusMedianCtcLpa = 10,
            companyTier = 'TIER_2_SUPER_DREAM',
            competingActiveOffersCount = 0,
            isPreferredLocation = true,
            candidateCgpa = 8.5,
        } = params;

        // Feature Engineering
        const ctcRatio = Math.max(0.5, offeredCtcLpa / Math.max(1, campusMedianCtcLpa)); // Weight: +1.8
        
        let tierWeight = 0.5;
        if (companyTier === 'TIER_1_DREAM') tierWeight = 2.2;
        else if (companyTier === 'TIER_2_SUPER_DREAM') tierWeight = 1.0;
        else if (companyTier === 'TIER_3_MASS') tierWeight = -0.5;

        const competitionPenalty = competingActiveOffersCount * -1.2; // Weight: -1.2 per competing offer
        const locationBonus = isPreferredLocation ? 0.8 : -0.4;
        const cgpaLeverage = (candidateCgpa - 7.0) * 0.15;

        // Linear Log-Odds: z = beta_0 + sum(beta_i * x_i)
        const z = -0.5 + (ctcRatio * 1.2) + tierWeight + competitionPenalty + locationBonus - cgpaLeverage;

        const probability = parseFloat(this.sigmoid(z).toFixed(3));
        const acceptancePct = Math.round(probability * 100);

        let riskLevel = 'LOW_RENEGE_RISK';
        let actionRecommendation = 'STANDARD_OFFER_DISPATCH';

        if (acceptancePct >= 80) {
            riskLevel = 'VERY_HIGH_ACCEPTANCE_LOCK';
            actionRecommendation = 'High conversion expected. Lock slot and initiate onboarding paperwork.';
        } else if (acceptancePct >= 50) {
            riskLevel = 'MODERATE_ACCEPTANCE_LIKELIHOOD';
            actionRecommendation = 'Competitive candidate. Offer 48-hour decision window and arrange senior engineer 1-on-1 chat.';
        } else {
            riskLevel = 'HIGH_RENEGE_FLIGHT_RISK';
            actionRecommendation = 'CRITICAL: High probability candidate will hold out for competing Dream companies. Prepare immediate backup candidate from bipartite queue.';
        }

        return {
            predictedProbability: probability,
            acceptancePercentage: acceptancePct,
            renegeRiskLevel: riskLevel,
            featureContributions: {
                ctcRatioScore: parseFloat((ctcRatio * 1.2).toFixed(2)),
                companyTierScore: tierWeight,
                competitionPenaltyScore: competitionPenalty,
                locationBonusScore: locationBonus,
            },
            actionRecommendation,
            timestamp: new Date().toISOString()
        };
    }
}

const aiOfferPredictor = new AIOfferPredictor();
module.exports = aiOfferPredictor;
