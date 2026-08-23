const scorecardNormalizer = require('./scorecardNormalizer');

describe('IR-11 Feature 8: Real-Time Scorecard Calibration & Interviewer Bias Normalizer', () => {
    it('calibrates raw scores from harsh vs lenient panels accurately using Z-scores', () => {
        // Harsh panel: gives average score of 50 (stdDev ~10)
        const harshPanelScores = [45, 50, 55, 48, 52];
        // Campus wide: average is 70 (stdDev ~12)
        const campusScores = [65, 70, 75, 68, 72, 80, 60];

        // Candidate getting 65 from harsh panel is actually top-tier!
        const calibrated = scorecardNormalizer.calibrateScore(65, harshPanelScores, campusScores);

        expect(calibrated.zScore).toBeGreaterThan(1.0); // +1.5 stdDev
        expect(calibrated.calibratedScore).toBeGreaterThan(80); // boosted up to campus scale
        expect(calibrated.interviewerBiasCategory).toBe('HARSH_PANEL');
        expect(calibrated.percentile).toBeGreaterThan(90);
    });
});
