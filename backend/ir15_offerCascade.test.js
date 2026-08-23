const offerCascadeEngine = require('./offerCascadeEngine');

describe('IR-15 Stage 3: Real-Time Live Offer Cascade & Deadlock Resolver', () => {
    it('instantly releases lower-tier held slots upon dream offer acceptance', () => {
        const candidates = [
            {
                studentId: 'STU_101',
                acceptedOfferCompany: 'Microsoft',
                heldOffers: ['Microsoft', 'Infosys', 'Wipro'],
            },
        ];

        const result = offerCascadeEngine.processOfferCascade(candidates, [{ company: 'Microsoft', availableSlots: 1 }]);
        expect(result.totalCascadesTriggered).toBe(2);
        expect(result.releasedSlotsToWaitlist.length).toBe(2);
        expect(result.finalAssignments['STU_101']).toBe('Microsoft');
        expect(result.status).toBe('CASCADE_RIPPLE_RESOLVED_ZERO_DEADLOCKS');
    });
});
