/**
 * AI Real-time Audio/Video Interview STAR Clarity & Response Scorer — Industrial Readiness Level 12 (IR-12 / AI)
 * 
 * Analyzes interview responses and transcripts:
 * 1. STAR Method Framework Evaluation: Assesses Situation, Task, Action, and measurable Result components.
 * 2. Technical Vocabulary Density: Measures precision of domain-specific terminology.
 * 3. Filler Word Penalty: Detects excessive hesitation tokens ('um', 'uh', 'like', 'you know').
 * 4. Communication Clarity & Conciseness Index: Computes composite interview presentation rating (0-100).
 */

const STAR_MARKERS = {
    situation: ['when i was at', 'in my previous project', 'during my internship', 'the situation was', 'we had a challenge where', 'in our college team'],
    task: ['my task was to', 'my goal was', 'i was responsible for', 'we needed to', 'the requirement was to', 'my objective was'],
    action: ['i implemented', 'i designed', 'i developed', 'i refactored', 'i optimized', 'i used', 'i integrated', 'i investigated', 'i fixed'],
    result: ['as a result', 'we achieved', 'reduced latency by', 'improved throughput by', 'increased performance', 'successfully deployed', 'resulting in']
};

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'sort of', 'kind of', 'i mean'];

class AIInterviewScorer {
    /**
     * Evaluates a candidate's verbal response transcript.
     * 
     * @param {string} transcriptText - Transcript of candidate's answer
     * @param {string} domain - e.g. 'SYSTEMS' | 'FRONTEND' | 'AI_ML'
     * @returns {Object} Scorecard with STAR breakdown, filler density, clarity score, and constructive feedback
     */
    evaluateTranscript(transcriptText = '', domain = 'SYSTEMS') {
        const text = transcriptText.toLowerCase();
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;

        if (wordCount < 10) {
            return {
                compositeClarityScore: 20,
                starAdherenceScore: 10,
                technicalDensityScore: 10,
                feedback: 'Response too brief. Provide structured explanation with concrete technical details.',
            };
        }

        // 1. STAR Breakdown
        let sCount = 0, tCount = 0, aCount = 0, rCount = 0;
        STAR_MARKERS.situation.forEach(m => { if (text.includes(m)) sCount++; });
        STAR_MARKERS.task.forEach(m => { if (text.includes(m)) tCount++; });
        STAR_MARKERS.action.forEach(m => { if (text.includes(m)) aCount++; });
        STAR_MARKERS.result.forEach(m => { if (text.includes(m)) rCount++; });

        const starComponentsPresent = [sCount > 0, tCount > 0, aCount > 0, rCount > 0].filter(Boolean).length;
        const starAdherencePct = Math.round((starComponentsPresent / 4) * 100);

        // 2. Filler Word Density
        let fillerCount = 0;
        FILLER_WORDS.forEach(fw => {
            const regex = new RegExp(`\\b${fw}\\b`, 'gi');
            const matches = text.match(regex);
            if (matches) fillerCount += matches.length;
        });

        const fillerDensityPct = parseFloat(((fillerCount / Math.max(1, wordCount)) * 100).toFixed(1));
        const fillerPenalty = Math.min(30, fillerDensityPct * 5);

        // 3. Technical Vocabulary Density
        const techKeywords = ['architecture', 'concurrency', 'asynchronous', 'database', 'latency', 'algorithm', 'cache', 'pipeline', 'optimization', 'distributed', 'security', 'index', 'query', 'scalability', 'state'];
        let techCount = 0;
        techKeywords.forEach(tk => { if (text.includes(tk)) techCount++; });
        const technicalDensityScore = Math.min(100, techCount * 18);

        // 4. Composite Score: 40% STAR + 35% Tech Density + 25% Conciseness/Fluency
        const baseFluency = Math.max(0, 100 - fillerPenalty);
        const compositeScore = Math.round((starAdherencePct * 0.40) + (technicalDensityScore * 0.35) + (baseFluency * 0.25));


        const feedbackItems = [];
        if (sCount === 0) feedbackItems.push('Set clear context/situation before diving into code.');
        if (aCount === 0) feedbackItems.push('Highlight individual actions and design trade-offs made.');
        if (rCount === 0) feedbackItems.push('Conclude with quantified impact/results (e.g. latency, scale, user adoption).');
        if (fillerDensityPct > 5.0) feedbackItems.push(`Reduce filler words (${fillerDensityPct}% detected). Practice structured pauses.`);

        return {
            compositeClarityScore: Math.min(100, Math.max(0, compositeScore)),
            wordCount,
            starAnalysis: {
                hasSituation: sCount > 0,
                hasTask: tCount > 0,
                hasAction: aCount > 0,
                hasResult: rCount > 0,
                starAdherencePercentage: starAdherencePct,
            },
            fillerMetrics: {
                totalFillerWords: fillerCount,
                fillerDensityPercentage: fillerDensityPct,
                isExcessiveFiller: fillerDensityPct > 5.0,
            },
            technicalDensityScore,
            feedbackSummary: feedbackItems.length > 0
                ? feedbackItems.join(' ')
                : 'Excellent structured delivery adhering to STAR guidelines with rich technical depth.',
            timestamp: new Date().toISOString()
        };
    }
}

const aiInterviewScorer = new AIInterviewScorer();
module.exports = aiInterviewScorer;
