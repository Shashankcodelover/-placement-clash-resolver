const blindScreeningEngine = require('./blindScreeningEngine');

describe('IR-15 Stage 4: Automated E2EE Blind Screening & Bias Neutralization', () => {
    it('strips PII and generates cryptographic anonymous candidate dossier', () => {
        const raw = {
            usn: '4JC21CS099',
            name: 'John Doe',
            gender: 'MALE',
            college: 'SJCE Mysore',
            gpa: 9.1,
            technicalSkills: ['Node.js', 'Distributed Systems', 'PostgreSQL'],
            projects: [
                { title: 'Disaster Mesh', domain: 'Networking', technologiesUsed: ['TypeScript', 'LoRa'] },
            ],
        };

        const dossier = blindScreeningEngine.anonymizeCandidate(raw);
        expect(dossier.candidateAlias.startsWith('ANON_CANDIDATE_')).toBe(true);
        expect(dossier.isPIIRedacted).toBe(true);
        expect(dossier.academicMetrics.gpaBracket).toBe('TIER_1_DISTINCTION');
        expect(dossier.verifiedProjectsCount).toBe(1);
        expect(dossier.name).toBeUndefined();
        expect(dossier.college).toBeUndefined();
    });
});
