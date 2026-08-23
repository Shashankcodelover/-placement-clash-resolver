const intervalColoringEngine = require('./intervalColoringEngine');

describe('IR-11 Feature 4: Interval Graph Coloring & Parallel Room Capacity Maximizer', () => {
    it('solves minimum chromatic number and assigns non-overlapping rooms to concurrent interviews', () => {
        const interviews = [
            { id: 'I1', startMins: 600, endMins: 645, title: 'Google Round 1' },
            { id: 'I2', startMins: 630, endMins: 700, title: 'Microsoft Round 1' }, // overlaps with I1
            { id: 'I3', startMins: 640, endMins: 710, title: 'Amazon Round 1' },    // overlaps with I1 and I2 -> requires 3 rooms
            { id: 'I4', startMins: 720, endMins: 780, title: 'Apple Round 1' },     // reuses Room 1
        ];

        const result = intervalColoringEngine.allocateOptimalRooms(interviews, ['Hall A', 'Hall B', 'Hall C']);

        expect(result.minimumRoomsNeeded).toBe(3);
        expect(result.peakConcurrency).toBe(3);
        expect(result.scheduleWithRooms.length).toBe(4);

        // I4 starts at 720, which is after all previous interviews ended -> reuses room
        const i4 = result.scheduleWithRooms.find(r => r.id === 'I4');
        expect(i4.roomId).toBe(1);
        expect(i4.roomName).toBe('Hall A');
    });
});
