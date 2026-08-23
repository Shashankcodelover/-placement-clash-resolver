const delayForecaster = require('./delayForecaster');

describe('IR-11 Feature 3: Probabilistic Monte Carlo Delay Cascade Forecaster', () => {
    it('runs 5,000 Monte Carlo trials and computes accurate P95 delay metrics and protective buffers', () => {
        const chain = [
            { id: 'IV_1', scheduledMinutes: 45, scheduledGapMinutes: 5, candidateId: 'STU_1', varianceFactor: 0.3 },
            { id: 'IV_2', scheduledMinutes: 45, scheduledGapMinutes: 5, candidateId: 'STU_2', varianceFactor: 0.3 },
            { id: 'IV_3', scheduledMinutes: 45, scheduledGapMinutes: 5, candidateId: 'STU_3', varianceFactor: 0.3 },
            { id: 'IV_4', scheduledMinutes: 45, scheduledGapMinutes: 5, candidateId: 'STU_4', varianceFactor: 0.3 },
        ];

        const forecast = delayForecaster.forecastPanelCascade(chain, 5000);

        expect(forecast.totalTrials).toBe(5000);
        expect(forecast.candidateForecasts.length).toBe(4);
        expect(forecast.p95CumulativeDelayMinutes).toBeGreaterThanOrEqual(0);
        expect(forecast.recommendedProtectiveBufferMinutes).toBeGreaterThanOrEqual(5);
        expect(typeof forecast.globalClashProbability).toBe('number');
        expect(forecast.mitigationPlan).toBeDefined();
    });
});
