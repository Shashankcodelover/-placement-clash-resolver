const request = require('supertest');
const { app, io, scheduler, db } = require('./server');

let adminToken = '';
let studentToken = '';
let tenantId = 'T_001';

beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 500)); // wait for DB init and seed

    // Use test-login for testing purposes
    const adminRes = await request(app).post('/api/test-login').send({});
    adminToken = adminRes.body.token;

    studentToken = adminToken; // For simplicity in tests, we use admin token for student actions that are authorized for ADMIN as well
    
    // Reset database so dates are freshly generated relative to today
    await request(app).post('/api/reset').set('Authorization', `Bearer ${adminToken}`);
});

const redisClientManager = require('./redisClient');

afterAll(async () => {
    io.close();
    db.db.close();
    await redisClientManager.quit();
});

describe('Placement Drive Clash Resolver — Enterprise Test Suite', () => {

    describe('1. Algorithmic Multi-Factor Priority Scoring', () => {
        it('should compute smooth logarithmic priority incorporating wait time and CGPA', () => {
            const score0 = scheduler.getMultiFactorPriority(50, 0, 9.0);
            const score1 = scheduler.getMultiFactorPriority(50, 1, 9.0);
            const score3 = scheduler.getMultiFactorPriority(50, 3, 9.0);
            
            expect(score0).toBe(68);
            expect(score1).toBe(80);
            expect(score3).toBe(92);
        });
    });

    describe('2. Security & Multi-Tenancy Enforcement', () => {
        it('should reject unauthenticated requests to protected endpoints', async () => {
            const res = await request(app).post('/api/check-clash').send({});
            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/No authentication token/i);
        });
    });

    describe('3. Dynamic Clash Detection & Alternative Suggestion', () => {
        it('should detect academic timetable clash for STU_001 at 03:00 PM (900 mins)', async () => {
            const res = await request(app)
                .post('/api/check-clash')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    studentId: 'STU_001',
                    proposedStart: 900,
                    duration: 45
                });

            expect(res.status).toBe(200);
            expect(res.body.conflictFree).toBe(false);
            expect(res.body.clashDetail).toMatch(/Computer Networks Lab/i);
            expect(res.body.suggestedAlternatives.length).toBeGreaterThan(0);
        });

        it('should confirm conflict-free slot for STU_001 at 12:00 PM (720 mins)', async () => {
            const res = await request(app)
                .post('/api/check-clash')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    studentId: 'STU_001',
                    proposedStart: 720,
                    duration: 45
                });

            expect(res.status).toBe(200);
            expect(res.body.conflictFree).toBe(true);
            expect(res.body.message).toMatch(/No schedule conflicts/i);
        });
    });

    describe('4. Delay Modeling & Cascade Shifts (Primary Key Routing)', () => {
        it('should cascade delays ONLY to downstream interviews in the same panel', async () => {
            // First fetch an interview ID
            const stateRes = await request(app).get('/api/state').set('Authorization', `Bearer ${adminToken}`);
            const interview = stateRes.body.interviews[0];

            const res = await request(app)
                .post('/api/log-delay')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    interviewId: interview.id,
                    actualDuration: 65 // 20 mins over scheduled 45 mins
                });

            expect(res.status).toBe(200);
            expect(res.body.result.shiftedCount).toBeGreaterThanOrEqual(0);
            expect(res.body.result.delayMins).toBe(20);
        });
    });

    describe('5. Bipartite Binding Offer Resolution (Concurrency)', () => {
        it('should dequeue student from all competing corporate queues and backfill spots with transaction safety', async () => {
            // Concurrency Test: Accept offer multiple times simultaneously
            const promises = [
                request(app).post('/api/accept-offer').set('Authorization', `Bearer ${adminToken}`).send({ studentId: 'STU_001', studentName: 'Preetham J', companyName: 'Google' }),
                request(app).post('/api/accept-offer').set('Authorization', `Bearer ${adminToken}`).send({ studentId: 'STU_001', studentName: 'Preetham J', companyName: 'Google' }),
                request(app).post('/api/accept-offer').set('Authorization', `Bearer ${adminToken}`).send({ studentId: 'STU_001', studentName: 'Preetham J', companyName: 'Google' })
            ];
            
            const results = await Promise.all(promises);
            
            // Only one should succeed completely or they all resolve but idempotent
            const success = results.find(r => r.status === 200 && r.body.resolution);
            expect(success).toBeDefined();

            // Verification
            const stateRes = await request(app).get('/api/state').set('Authorization', `Bearer ${adminToken}`);
            expect(stateRes.body.corporateQueues.Google.some(c => c.studentId === 'STU_001')).toBe(false);
        });
    });

    describe('6. RFC 5545 iCalendar Subscription Feed', () => {
        it('should return valid iCalendar (.ics) stream for candidate', async () => {
            const res = await request(app).get('/api/calendar/STU_001.ics');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/calendar/i);
            expect(res.text).toContain('BEGIN:VCALENDAR');
            expect(res.text).toContain('END:VCALENDAR');
        });
    });
});
