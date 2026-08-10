const request = require('supertest');
const { app, io, getBoundedPriority } = require('./server');

let validToken = '';

beforeAll(async () => {
    // Obtain a token for testing protected routes
    const res = await request(app).post('/api/login');
    validToken = res.body.token;
});

afterAll(done => {
    io.close();
    done();
});

describe('Placement Clash Resolver API', () => {

    it('should calculate priority math without +20 hard ceiling (Flaw 8)', () => {
        // base + 10 * log2(1 + intervals)
        expect(getBoundedPriority(50, 0)).toBe(50);
        expect(getBoundedPriority(50, 1)).toBe(60); // log2(2) = 1
        expect(getBoundedPriority(50, 3)).toBe(70); // log2(4) = 2
        expect(getBoundedPriority(50, 7)).toBe(80); // log2(8) = 3
    });

    it('should reject unauthenticated API mutations (Flaw 1)', async () => {
        const res = await request(app).post('/api/check-clash').send({});
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('No token provided');
    });

    it('should validate Zod schema for missing data in /api/log-score (Flaw 9)', async () => {
        const res = await request(app)
            .post('/api/log-score')
            .set('Authorization', `Bearer ${validToken}`)
            .send({ studentId: "STU_001" }); // missing other fields

        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('should successfully log a valid score', async () => {
        const res = await request(app)
            .post('/api/log-score')
            .set('Authorization', `Bearer ${validToken}`)
            .send({
                studentId: "STU_001",
                studentName: "Test",
                roundName: "Test Round",
                score: 85,
                threshold: 70
            });
        
        expect(res.status).toBe(200);
        expect(res.body.state).toBeDefined();
    });

    it('should successfully fetch system state', async () => {
        const res = await request(app).get('/api/state');
        expect(res.status).toBe(200);
        expect(res.body.waitQueue).toBeDefined();
    });
});
