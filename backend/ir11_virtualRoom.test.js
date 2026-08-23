const virtualRoomGateway = require('./virtualRoomGateway');

describe('IR-11 Feature 6: WebRTC E2EE Virtual Interview Room Gateway & Telemetry', () => {
    it('creates secure virtual room and updates candidate presence telemetry', () => {
        const room = virtualRoomGateway.createSecureInterviewRoom('PANEL_SYS', 'GOOGLE', 'STU_001', 'INT_TURING', 60);

        expect(room.roomId).toBeDefined();
        expect(room.joinUrlCandidate).toContain('role=candidate');
        expect(room.encryptionProtocol).toContain('AES-256-GCM');
        expect(room.webrtcConfig.iceServers.length).toBeGreaterThan(0);

        // Candidate joins and sends heartbeat
        const hb1 = virtualRoomGateway.recordHeartbeat(room.roomId, 'candidate', 32);
        expect(hb1.success).toBe(true);
        expect(hb1.bothParticipantsPresent).toBe(false);

        // Interviewer joins
        const hb2 = virtualRoomGateway.recordHeartbeat(room.roomId, 'interviewer', 18);
        expect(hb2.success).toBe(true);
        expect(hb2.bothParticipantsPresent).toBe(true);
        expect(hb2.status).toBe('IN_PROGRESS');

        // Candidate signs recording consent
        const consent = virtualRoomGateway.signRecordingConsent(room.roomId, 'STU_001');
        expect(consent).toBe(true);
        expect(virtualRoomGateway.getSession(room.roomId).recordingConsentSigned).toBe(true);
    });
});
