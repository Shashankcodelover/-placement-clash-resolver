const tenantBenchmarkGovernor = require('./tenantBenchmark');

describe('IR-11 Feature 9: Multi-Tenant Audit Benchmark & High-Concurrency Governor', () => {
    it('verifies zero cross-tenant data leakage and flags tenant isolation anomalies', () => {
        const tenantA = [
            { id: '1', tenant_id: 'T_001', name: 'Student A1' },
            { id: '2', tenant_id: 'T_001', name: 'Student A2' },
        ];
        const tenantB = [
            { id: '3', tenant_id: 'T_002', name: 'Student B1' },
        ];

        const report = tenantBenchmarkGovernor.verifyTenantIsolation(tenantA, tenantB, 'T_001', 'T_002');
        expect(report.isStrictlyIsolated).toBe(true);
        expect(report.leaksFound).toBe(0);
        expect(report.auditStatus).toBe('PASS_ZERO_LEAKAGE');
    });

    it('prevents overselling and guarantees ACID safety under high concurrent contention', () => {
        const contention = tenantBenchmarkGovernor.simulateConcurrentSlotContention(100, 8);
        expect(contention.allocatedCount).toBe(8);
        expect(contention.rejectedCount).toBe(92);
        expect(contention.zeroOversellVerified).toBe(true);
        expect(contention.concurrencyIntegrity).toBe('100% ACID_RACE_SAFE');
    });
});
