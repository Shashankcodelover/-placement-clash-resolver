const caldavSyncEngine = require('./caldavSyncEngine');

describe('IR-11 Feature 7: Bi-Directional CalDAV / RFC 5545 Sync & Enterprise ATS Connector', () => {
    it('parses RFC 5545 iCalendar stream into structured VEVENT objects', () => {
        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'BEGIN:VEVENT',
            'UID:exam-networks-101@uni.edu',
            'SUMMARY:Computer Networks Lab Viva',
            'DTSTART:20260814T143000Z',
            'DTEND:20260814T163000Z',
            'LOCATION:Lab Block 3',
            'STATUS:CONFIRMED',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');

        const events = caldavSyncEngine.parseICalendarFeed(ics);
        expect(events.length).toBe(1);
        expect(events[0].uid).toBe('exam-networks-101@uni.edu');
        expect(events[0].summary).toBe('Computer Networks Lab Viva');
        expect(events[0].dtStart).toBe('2026-08-14T14:30:00Z');
        expect(events[0].location).toBe('Lab Block 3');
    });

    it('generates signed ATS webhook payloads for Greenhouse and Lever integrations', () => {
        const candidate = { studentId: 'STU_001', studentName: 'Preetham J', email: 'p@uni.edu', cgpa: 9.2 };
        const interview = { company: 'Google', roundName: 'System Design', score: 92, pass: true, feedback: 'Strong on distributed caching' };

        const ghWebhook = caldavSyncEngine.generateATSWebhookPayload('GREENHOUSE', candidate, interview, 'secret_123');
        expect(ghWebhook.provider).toBe('GREENHOUSE');
        expect(ghWebhook.payload.action).toBe('candidate_stage_update');
        expect(ghWebhook.signatureHeader).toMatch(/^sha256=[a-f0-9]{64}$/);

        const leverWebhook = caldavSyncEngine.generateATSWebhookPayload('LEVER', candidate, interview, 'secret_123');
        expect(leverWebhook.provider).toBe('LEVER');
        expect(leverWebhook.payload.event).toBe('candidateFeedbackSubmitted');
    });
});
