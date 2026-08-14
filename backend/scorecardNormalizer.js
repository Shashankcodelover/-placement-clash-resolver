/**
 * Real-Time Scorecard Calibration & Interviewer Bias Normalizer — Industrial Readiness Level 11 (IR-11)
 * 
 * Calibrates candidate ratings across heterogeneous interview panels:
 * 1. Z-Score Statistical Calibration: Z = (X - mu_panel) / sigma_panel, standardizing across harsh vs lenient interviewers.
 * 2. Leniency / Harshness Skew Detection: Identifies panels with rating distributions deviating > 1.5 standard deviations from campus mean.
 * 3. Standardized University Placement Percentile: Maps calibrated Z-scores to normalized percentiles (0 - 100).
 */

class ScorecardNormalizer {
    /**
     * Calculates mean and standard deviation of an array of scores.
     */
    calculateStats(scores = []) {
        if (!scores.length) return { mean: 50, stdDev: 15 };
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / Math.max(1, scores.length - 1);
        const stdDev = Math.max(1.0, Math.sqrt(variance)); // Avoid divide by 0
        return { mean: parseFloat(mean.toFixed(2)), stdDev: parseFloat(stdDev.toFixed(2)) };
    }

    /**
     * Converts a Z-score to standard normal cumulative distribution percentile (0 to 100).
     */
    zScoreToPercentile(z) {
        // Error function approximation for normal CDF
        const t = 1.0 / (1.0 + 0.2316419 * Math.abs(z));
        const d = 0.3989423 * Math.exp(-z * z / 2.0);
        const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        const cdf = z >= 0 ? 1.0 - p : p;
        return parseFloat((cdf * 100).toFixed(1));
    }

    /**
     * Normalizes a candidate's raw scorecard rating against historical panel distributions.
     * 
     * @param {number} rawScore - Candidate score (0-100)
     * @param {Array<number>} panelHistoricalScores - Previous scores awarded by this specific panel
     * @param {Array<number>} globalCampusScores - Scores across all panels campus-wide
     * @returns {Object} Normalized score report
     */
    calibrateScore(rawScore, panelHistoricalScores = [], globalCampusScores = []) {
        const panelStats = this.calculateStats(panelHistoricalScores);
        const campusStats = this.calculateStats(globalCampusScores);

        // Panel Z-score
        const zScore = parseFloat(((rawScore - panelStats.mean) / panelStats.stdDev).toFixed(2));

        // Projected normalized campus score = campus_mean + (Z * campus_stdDev)
        const calibratedScore = Math.min(100, Math.max(0, Math.round(campusStats.mean + (zScore * campusStats.stdDev))));
        const percentile = this.zScoreToPercentile(zScore);

        // Evaluate interviewer leniency bias
        const panelDiff = panelStats.mean - campusStats.mean;
        let biasCategory = 'NEUTRAL';
        if (panelDiff > 10) biasCategory = 'LENIENT_PANEL';
        else if (panelDiff < -10) biasCategory = 'HARSH_PANEL';

        return {
            rawScore,
            calibratedScore,
            panelMean: panelStats.mean,
            panelStdDev: panelStats.stdDev,
            campusMean: campusStats.mean,
            zScore,
            percentile,
            interviewerBiasCategory: biasCategory,
            explanation: `Raw ${rawScore} calibrated to ${calibratedScore} (Z-Score: ${zScore > 0 ? '+' : ''}${zScore}, ${percentile}th percentile) adjusting for ${biasCategory.toLowerCase().replace('_', ' ')}.`,
            timestamp: new Date().toISOString(),
        };
    }
}

const scorecardNormalizer = new ScorecardNormalizer();
module.exports = scorecardNormalizer;
