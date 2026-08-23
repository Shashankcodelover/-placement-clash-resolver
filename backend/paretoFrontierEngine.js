/**
 * Multi-Criteria Pareto Frontier Optimal Slot Allocator — Placement Clash Resolver IR-15
 * 
 * 1. Multi-Objective Optimization:
 *    f_1: Minimize Total Student Idle Wait Time (mins)
 *    f_2: Maximize Panelist Interview Slot Utilization (%)
 *    f_3: Minimize Departmental Fatigue Variance (σ^2)
 * 2. Non-Dominated Sorting: Identifies the Pareto Frontier {S_1, S_2, ... S_k} where no single objective can be improved without degrading another.
 * 3. Knee-Point Trade-off Selector: Recommends the optimal balanced compromise schedule.
 */

class ParetoFrontierEngine {
    /**
     * Identifies non-dominated Pareto optimal schedules from a candidate pool.
     * 
     * @param {Array<Object>} schedules - Array of { scheduleId, waitTimeMins, utilizationPct, fatigueVariance }
     * @returns {Object} Pareto frontier schedules, dominated schedules, and recommended knee-point
     */
    findParetoFrontier(schedules) {
        if (!schedules || !schedules.length) return { paretoFrontier: [], totalEvaluated: 0 };

        const frontier = [];
        const dominated = [];

        for (let i = 0; i < schedules.length; i++) {
            const current = schedules[i];
            let isDominated = false;

            for (let j = 0; j < schedules.length; j++) {
                if (i === j) continue;
                const other = schedules[j];

                // other dominates current if other is better-or-equal in all and strictly better in at least one
                // Better: lower waitTime, higher utilization, lower fatigueVariance
                const otherWaitBetterOrEqual = other.waitTimeMins <= current.waitTimeMins;
                const otherUtilBetterOrEqual = other.utilizationPct >= current.utilizationPct;
                const otherFatigueBetterOrEqual = other.fatigueVariance <= current.fatigueVariance;

                const otherStrictlyBetter =
                    other.waitTimeMins < current.waitTimeMins ||
                    other.utilizationPct > current.utilizationPct ||
                    other.fatigueVariance < current.fatigueVariance;

                if (otherWaitBetterOrEqual && otherUtilBetterOrEqual && otherFatigueBetterOrEqual && otherStrictlyBetter) {
                    isDominated = true;
                    break;
                }
            }

            if (!isDominated) {
                frontier.push(current);
            } else {
                dominated.push(current);
            }
        }

        // Select knee-point (closest to ideal normalized point [0, 1, 0])
        let bestKnee = frontier[0];
        let minDistance = Infinity;

        for (const candidate of frontier) {
            // Distance formula: (waitTime / 100)^2 + ((100 - utilization) / 100)^2 + (fatigue / 10)^2
            const d = Math.pow(candidate.waitTimeMins / 100, 2) +
                      Math.pow((100 - candidate.utilizationPct) / 100, 2) +
                      Math.pow(candidate.fatigueVariance / 10, 2);

            if (d < minDistance) {
                minDistance = d;
                bestKnee = candidate;
            }
        }

        return {
            totalEvaluated: schedules.length,
            paretoFrontierCount: frontier.length,
            paretoFrontier: frontier,
            recommendedKneePointSchedule: bestKnee,
            optimizationStatus: 'PARETO_OPTIMAL_FRONTIER_COMPUTED',
            timestamp: new Date().toISOString(),
        };
    }
}

const paretoFrontierEngine = new ParetoFrontierEngine();
module.exports = paretoFrontierEngine;
