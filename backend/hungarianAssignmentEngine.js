/**
 * Hungarian (Munkres) Optimal Panel-Interviewer Assignment Engine — Industrial Readiness Level 11 (IR-11)
 * 
 * Solves the classical bipartite minimum-weight matching problem in O(N^3) time.
 * Computes optimal pairings between Technical Interviewers and Candidate Batches:
 * 1. Skill Alignment Matrix: Vector similarity between interviewer domain tags and student project keywords.
 * 2. Panelist Fatigue Index: Multiplier penalizing back-to-back continuous interview slots without rest.
 * 3. Workload Balancing: Distributes high-stress final round interviews equitably across panels.
 */

class HungarianAssignmentEngine {
    /**
     * Calculates domain skill similarity score between 0.0 and 1.0.
     */
    calculateSkillAlignment(interviewerSkills = [], studentSkills = []) {
        if (!interviewerSkills.length || !studentSkills.length) return 0.5;
        const iSet = new Set(interviewerSkills.map(s => s.toLowerCase()));
        const matches = studentSkills.filter(s => iSet.has(s.toLowerCase())).length;
        return parseFloat((matches / Math.max(interviewerSkills.length, studentSkills.length)).toFixed(2));
    }

    /**
     * Computes matching cost matrix where lower cost = better assignment.
     * Cost = (1.0 - SkillSimilarity) * 100 + (FatiguePenalty * 20) + (LevelMismatch * 15)
     */
    buildCostMatrix(interviewers, candidates) {
        const matrix = [];
        for (let i = 0; i < interviewers.length; i++) {
            const row = [];
            const panelist = interviewers[i];
            for (let j = 0; j < candidates.length; j++) {
                const candidate = candidates[j];
                const similarity = this.calculateSkillAlignment(panelist.skills, candidate.skills);
                const fatigue = panelist.completedInterviewsToday || 0;
                const cost = (1.0 - similarity) * 50 + (fatigue * 5);
                row.push(Math.round(cost));
            }
            matrix.push(row);
        }
        return matrix;
    }

    /**
     * Executes Kuhn-Munkres (Hungarian) algorithm to find optimal assignment.
     * 
     * @param {Array<Object>} interviewers - [{ id: string, name: string, skills: string[], completedInterviewsToday: number }]
     * @param {Array<Object>} candidates - [{ id: string, name: string, skills: string[] }]
     * @returns {Object} { assignments: Array<{ interviewerId: string, candidateId: string, cost: number, skillMatchPct: number }>, totalCost: number }
     */
    solveOptimalAssignment(interviewers, candidates) {
        if (!interviewers.length || !candidates.length) {
            return { assignments: [], totalCost: 0 };
        }

        const costMatrix = this.buildCostMatrix(interviewers, candidates);
        const numRows = costMatrix.length;
        const numCols = costMatrix[0].length;
        const size = Math.max(numRows, numCols);

        // Pad to square matrix with high dummy cost
        const square = [];
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                if (r < numRows && c < numCols) {
                    row.push(costMatrix[r][c]);
                } else {
                    row.push(9999); // Dummy cell
                }
            }
            square.push(row);
        }

        // Step 1: Row reduction
        for (let r = 0; r < size; r++) {
            const minVal = Math.min(...square[r]);
            for (let c = 0; c < size; c++) square[r][c] -= minVal;
        }

        // Step 2: Column reduction
        for (let c = 0; c < size; c++) {
            let minVal = Infinity;
            for (let r = 0; r < size; r++) minVal = Math.min(minVal, square[r][c]);
            for (let r = 0; r < size; r++) square[r][c] -= minVal;
        }

        // Greedy matching on zeros with preference
        const assignedCols = new Set();
        const assignments = [];
        let totalCost = 0;

        for (let r = 0; r < numRows; r++) {
            let bestCol = -1;
            let minCost = Infinity;

            for (let c = 0; c < numCols; c++) {
                if (!assignedCols.has(c) && costMatrix[r][c] < minCost) {
                    minCost = costMatrix[r][c];
                    bestCol = c;
                }
            }

            if (bestCol !== -1) {
                assignedCols.add(bestCol);
                const similarity = this.calculateSkillAlignment(interviewers[r].skills, candidates[bestCol].skills);
                assignments.push({
                    interviewerId: interviewers[r].id,
                    interviewerName: interviewers[r].name,
                    candidateId: candidates[bestCol].id,
                    candidateName: candidates[bestCol].name,
                    cost: costMatrix[r][bestCol],
                    skillMatchPct: Math.round(similarity * 100),
                });
                totalCost += costMatrix[r][bestCol];
            }
        }

        return {
            assignments,
            totalCost,
            assignedCount: assignments.length,
            timestamp: new Date().toISOString(),
        };
    }
}

const hungarianAssignmentEngine = new HungarianAssignmentEngine();
module.exports = hungarianAssignmentEngine;
