const { createClient } = require('redis');
const Redlock = require('redlock').default;

class RedisClientManager {
    constructor() {
        this.pubClient = null;
        this.subClient = null;
        this.redlock = null;
        this.isMock = false;

        this.init();
    }

    init() {
        if (process.env.REDIS_URL) {
            this.pubClient = createClient({ url: process.env.REDIS_URL });
            this.subClient = this.pubClient.duplicate();

            Promise.all([this.pubClient.connect(), this.subClient.connect()])
                .then(() => {
                    console.log('✅ Redis Clients connected successfully.');
                    this.redlock = new Redlock([this.pubClient], {
                        driftFactor: 0.01,
                        retryCount: 10,
                        retryDelay: 200, // time in ms
                        retryJitter: 200 // time in ms
                    });
                })
                .catch(err => {
                    console.error('❌ Failed to connect to Redis:', err.message);
                });
        } else {
            console.log('⚠️ REDIS_URL not found. Using local in-memory mock for Redlock.');
            this.isMock = true;
            this.mockLockState = {
                locked: false,
                queue: []
            };

            // Mock Redlock for testing and local dev
            this.redlock = {
                acquire: async (keys, duration) => {
                    const lockKey = keys[0];
                    if (!this.mockLockState.locked) {
                        this.mockLockState.locked = true;
                    } else {
                        await new Promise(resolve => this.mockLockState.queue.push(resolve));
                    }

                    return {
                        release: async () => {
                            if (this.mockLockState.queue.length > 0) {
                                const next = this.mockLockState.queue.shift();
                                next();
                            } else {
                                this.mockLockState.locked = false;
                            }
                        }
                    };
                }
            };
        }
    }

    async quit() {
        if (!this.isMock) {
            if (this.pubClient) await this.pubClient.quit();
            if (this.subClient) await this.subClient.quit();
        }
    }
}

const redisClientManager = new RedisClientManager();
module.exports = redisClientManager;
