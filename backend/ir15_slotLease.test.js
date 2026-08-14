const slotLeaseLockEngine = require('./slotLeaseLockEngine');

describe('IR-15 Stage 5: High-Concurrency Slot Lease Lock Engine', () => {
    it('acquires atomic lease and commits booking', () => {
        const slotId = 'slot_amazon_001';
        slotLeaseLockEngine.initSlot(slotId, 'Amazon', '2026-08-15T09:00:00Z');

        // Student 1 acquires lease
        const lease = slotLeaseLockEngine.acquireSlotLease(slotId, 'STU_101', 300000);
        expect(lease.success).toBe(true);
        expect(lease.leaseToken.startsWith('lease_')).toBe(true);

        // Student 2 tries to acquire same slot -> rejected
        const conflict = slotLeaseLockEngine.acquireSlotLease(slotId, 'STU_102', 300000);
        expect(conflict.success).toBe(false);
        expect(conflict.reason).toBe('SLOT_ALREADY_RESERVED_OR_COMMITTED');

        // Student 1 commits booking with lease token
        const commit = slotLeaseLockEngine.commitSlotBooking(slotId, 'STU_101', lease.leaseToken);
        expect(commit.success).toBe(true);
        expect(commit.status).toBe('INTERVIEW_SLOT_CONFIRMED_COMMITTED');
    });
});
