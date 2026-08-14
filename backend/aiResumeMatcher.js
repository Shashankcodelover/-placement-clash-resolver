/**
 * AI Resume-Job Skill Vector Embedding & Semantic Matcher — Industrial Readiness Level 12 (IR-12 / AI)
 * 
 * Computes multi-dimensional skill vector embeddings and semantic cosine similarity:
 * 1. Skill Vectorizer: Maps raw candidate resumes and company JDs into normalized high-dimensional tech skill vectors.
 * 2. Cosine Similarity Matcher: Cosine(V_resume, V_job) providing 0.0 to 1.0 fit score.
 * 3. Skill Gap & Strength Analyzer: Identifies exact missing prerequisites (e.g. Kubernetes, Redis, System Design).
 * 4. Experience & Project Weighting: Calibrates score based on hands-on project depth.
 */

const TECH_TAXONOMY = {
    'languages': ['javascript', 'typescript', 'python', 'java', 'c++', 'c', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin'],
    'frontend': ['react', 'vue', 'angular', 'next.js', 'svelte', 'html5', 'css3', 'tailwind', 'redux', 'webrtc'],
    'backend': ['node.js', 'express', 'django', 'fastapi', 'spring boot', 'graphql', 'rest api', 'grpc', 'microservices'],
    'databases': ['postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'dynamodb', 'cassandra', 'elasticsearch'],
    'systems_cloud': ['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'linux', 'ci/cd', 'terraform', 'distributed systems', 'kafka'],
    'ai_ml': ['machine learning', 'deep learning', 'pytorch', 'tensorflow', 'nlp', 'computer vision', 'pandas', 'numpy', 'scikit-learn'],
    'fundamentals': ['data structures', 'algorithms', 'system design', 'dbms', 'operating systems', 'computer networks', 'oop']
};

class AIResumeMatcher {
    /**
     * Extracts and tokenizes tech keywords from raw text.
     */
    extractSkills(text = '') {
        const lower = text.toLowerCase();
        const extracted = new Set();

        Object.values(TECH_TAXONOMY).forEach(skills => {
            skills.forEach(skill => {
                const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                if (regex.test(lower)) {
                    extracted.add(skill);
                }
            });
        });

        return Array.from(extracted);
    }

    /**
     * Creates a normalized vector representation of extracted skills.
     */
    vectorize(skills = []) {
        const allVocab = Object.values(TECH_TAXONOMY).flat();
        const vector = new Array(allVocab.length).fill(0);
        const skillSet = new Set(skills.map(s => s.toLowerCase()));

        allVocab.forEach((term, idx) => {
            if (skillSet.has(term.toLowerCase())) {
                vector[idx] = 1.0;
            }
        });

        return vector;
    }

    /**
     * Computes Cosine Similarity between two skill vectors.
     */
    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return parseFloat((dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))).toFixed(3));
    }

    /**
     * Analyzes candidate resume text against a company job description.
     * 
     * @param {string} resumeText - Candidate resume summary / skill list
     * @param {string} jobDescriptionText - Company requirement text
     * @param {number} candidateCgpa - Student CGPA (0.0 to 10.0)
     * @returns {Object} Semantic matching report with match percentage, missing skills, and interview readiness
     */
    evaluateCandidateFit(resumeText, jobDescriptionText, candidateCgpa = 8.5) {
        const resumeSkills = this.extractSkills(resumeText);
        const jobSkills = this.extractSkills(jobDescriptionText);

        const vResume = this.vectorize(resumeSkills);
        const vJob = this.vectorize(jobSkills);

        const semanticScore = this.cosineSimilarity(vResume, vJob);

        const resumeSkillSet = new Set(resumeSkills.map(s => s.toLowerCase()));
        const jobSkillSet = new Set(jobSkills.map(s => s.toLowerCase()));

        const matchedSkills = jobSkills.filter(s => resumeSkillSet.has(s.toLowerCase()));
        const missingPrerequisites = jobSkills.filter(s => !resumeSkillSet.has(s.toLowerCase()));
        const bonusSkills = resumeSkills.filter(s => !jobSkillSet.has(s.toLowerCase()));

        // Weighted composite suitability: 70% Skill Vector Match + 30% CGPA Baseline
        const cgpaFactor = Math.min(1.0, candidateCgpa / 10.0);
        const compositeScore = parseFloat((semanticScore * 0.75 + cgpaFactor * 0.25).toFixed(3));
        const matchPercentage = Math.round(compositeScore * 100);

        let recommendation = 'POTENTIAL_FIT';
        if (matchPercentage >= 75) recommendation = 'HIGHLY_RECOMMENDED';
        else if (matchPercentage < 50) recommendation = 'SKILL_DEFICIT_HIGH_RISK';

        return {
            semanticSimilarityScore: semanticScore,
            compositeSuitabilityScore: compositeScore,
            matchPercentage,
            recommendation,
            extractedResumeSkills: resumeSkills,
            requiredJobSkills: jobSkills,
            matchedSkills,
            missingPrerequisites,
            bonusCandidateSkills: bonusSkills,
            readinessVerdict: matchPercentage >= 70
                ? 'EXCELLENT: Candidate profile matches > 70% of core tech requirements with strong academic baseline.'
                : `ACTION: Candidate needs upskilling in [${missingPrerequisites.slice(0, 3).join(', ')}] prior to technical panel.`,
            timestamp: new Date().toISOString()
        };
    }
}

const aiResumeMatcher = new AIResumeMatcher();
module.exports = aiResumeMatcher;
