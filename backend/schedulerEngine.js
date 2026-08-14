const db = require('./database');
const crypto = require('crypto');

const redisClientManager = require('./redisClient');

class SchedulerEngine {
    constructor() {
        // Redlock is managed by redisClientManager
    }

    getMultiFactorPriority(baseScore, intervals, cgpa = 8.5) {
        const waitBonus = 12 * Math.log2(1 + intervals);
        const academicBonus = (cgpa || 8.5) * 2;
        return Math.round((baseScore + waitBonus + academicBonus) * 10) / 10;
    }

    async isCandidateClashing(tenantId, studentId, startISO, endISO, excludeInterviewId = null) {
        const start = new Date(startISO).getTime();
        const end = new Date(endISO).getTime();

        const academicSchedules = await db.all(
            'SELECT * FROM academic_schedules WHERE tenant_id = ? AND student_id = ?;',
            [tenantId, studentId]
        );

        for (const block of academicSchedules) {
            const bStart = new Date(block.start_time).getTime();
            const bEnd = new Date(block.end_time).getTime();
            if (start < bEnd && end > bStart) {
                return { clash: true, type: 'ACADEMIC', title: block.event_name, start: block.start_time, end: block.end_time };
            }
        }

        let query = 'SELECT * FROM interviews WHERE tenant_id = ? AND student_id = ? AND status != "Completed";';
        let params = [tenantId, studentId];
        if (excludeInterviewId) {
            query = 'SELECT * FROM interviews WHERE tenant_id = ? AND student_id = ? AND status != "Completed" AND id != ?;';
            params = [tenantId, studentId, excludeInterviewId];
        }

        const activeInterviews = await db.all(query, params);
        for (const iv of activeInterviews) {
            const iStart = new Date(iv.estimated_start).getTime();
            const iEnd = new Date(iv.estimated_end).getTime();
            if (start < iEnd && end > iStart) {
                return { clash: true, type: 'INTERVIEW_COLLISION', title: `Existing Interview: ${iv.round_name} (${iv.panel_id})`, start: iv.estimated_start, end: iv.estimated_end };
            }
        }

        return { clash: false };
    }

    async findAlternativeSlots(tenantId, studentId, durationMins = 45, count = 3) {
        const alternatives = [];
        const durationMs = durationMins * 60000;
        
        const today = new Date();
        today.setUTCHours(9, 0, 0, 0); // Start search at 9:00 AM UTC
        
        let cursorMs = today.getTime();
        let daysSearched = 0;
        
        while (alternatives.length < count && daysSearched < 3) {
            const endOfDayMs = today.getTime() + (daysSearched * 24 * 60 * 60000) + (9 * 60 * 60000); // 6:00 PM UTC for the current search day
            
            while (alternatives.length < count && cursorMs < endOfDayMs) {
                const candidateStartISO = new Date(cursorMs).toISOString();
                const candidateEndISO = new Date(cursorMs + durationMs).toISOString();

                const check = await this.isCandidateClashing(tenantId, studentId, candidateStartISO, candidateEndISO);
                if (!check.clash) {
                    alternatives.push({
                        startISO: candidateStartISO,
                        endISO: candidateEndISO,
                        startFormatted: new Date(cursorMs).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
                        endFormatted: new Date(cursorMs + durationMs).toLocaleString([], { hour: '2-digit', minute: '2-digit' })
                    });
                    cursorMs += durationMs + (15 * 60000); // 15 min gap
                } else {
                    cursorMs += 30 * 60000; // Step forward 30 mins
                }
            }
            
            daysSearched++;
            // Move cursor to 9:00 AM of the next day
            cursorMs = today.getTime() + (daysSearched * 24 * 60 * 60000);
        }

        return alternatives;
    }

    async processPanelDelay(tenantId, interviewId, actualDurationMins) {
        const interview = await db.get('SELECT * FROM interviews WHERE tenant_id = ? AND id = ?;', [tenantId, interviewId]);
        if (!interview) throw new Error('Interview not found');

        const schedStart = new Date(interview.scheduled_start).getTime();
        const schedEnd = new Date(interview.scheduled_end).getTime();
        const scheduledDurationMins = Math.round((schedEnd - schedStart) / 60000);
        const delayMins = Math.max(0, actualDurationMins - scheduledDurationMins);
        const delayMs = delayMins * 60000;

        await db.run(
            'UPDATE interviews SET status = "Completed", actual_duration = ?, delay_mins = ? WHERE id = ?;',
            [actualDurationMins, delayMins, interviewId]
        );

        const shiftedInterviews = [];

        if (delayMins > 0) {
            const downstream = await db.all(
                'SELECT * FROM interviews WHERE tenant_id = ? AND panel_id = ? AND status = "Pending" AND id != ? ORDER BY estimated_start ASC;',
                [tenantId, interview.panel_id, interviewId]
            );

            for (const item of downstream) {
                const oldEstStartMs = new Date(item.estimated_start).getTime();
                const oldEstEndMs = new Date(item.estimated_end).getTime();
                const newEstStartISO = new Date(oldEstStartMs + delayMs).toISOString();
                const newEstEndISO = new Date(oldEstEndMs + delayMs).toISOString();

                await db.run(
                    'UPDATE interviews SET estimated_start = ?, estimated_end = ?, delay_mins = delay_mins + ? WHERE id = ?;',
                    [newEstStartISO, newEstEndISO, delayMins, item.id]
                );

                const student = await db.get('SELECT name FROM students WHERE id = ?;', [item.student_id]);
                const notifMsg = `🔔 Hi ${student?.name || item.student_id}, your interview (${item.round_name}) in ${item.panel_id} is rescheduled to ${new Date(newEstStartISO).toLocaleTimeString()} (+${delayMins} min panel overrun).`;

                await db.run(
                    'INSERT INTO notifications (tenant_id, student_id, message, timestamp) VALUES (?, ?, ?, ?);',
                    [tenantId, item.student_id, notifMsg, new Date().toISOString()]
                );

                shiftedInterviews.push({ interviewId: item.id, studentId: item.student_id, newStart: newEstStartISO, newEnd: newEstEndISO, delayMins });
            }
        }

        await db.run(
            'INSERT INTO audit_logs (tenant_id, actor, action, details, timestamp) VALUES (?, ?, ?, ?, ?);',
            [tenantId, 'PANEL_COORDINATOR', 'LOG_DELAY', `Logged ${actualDurationMins}m for Interview #${interviewId}. Shifted ${shiftedInterviews.length} slots.`, new Date().toISOString()]
        );

        return { interviewId, actualDurationMins, delayMins, shiftedCount: shiftedInterviews.length, shiftedInterviews };
    }

    async resolveBindingOffer(tenantId, studentId, companyName) {
        let lock = null;
        try {
            // Acquire distributed lock for 5000ms
            lock = await redisClientManager.redlock.acquire([`lock:offer:resolve:${tenantId}`], 5000);
            
            await db.run('BEGIN TRANSACTION;');

            const student = await db.get('SELECT * FROM students WHERE tenant_id = ? AND id = ?;', [tenantId, studentId]);
            if (!student) throw new Error('Student not found');

            await db.run('UPDATE students SET status = "PLACED" WHERE tenant_id = ? AND id = ?;', [tenantId, studentId]);

            const activeEntries = await db.all('SELECT * FROM corporate_queues WHERE tenant_id = ? AND student_id = ?;', [tenantId, studentId]);
            const vacatedCompanies = [];
            const promotions = [];

            for (const entry of activeEntries) {
                const comp = entry.company;
                vacatedCompanies.push(comp);

                await db.run('DELETE FROM corporate_queues WHERE id = ?;', [entry.id]);

                if (comp !== companyName) {
                    const remainingCandidates = await db.all(
                        'SELECT q.*, s.name as studentName, s.cgpa FROM corporate_queues q JOIN students s ON q.student_id = s.id WHERE q.tenant_id = ? AND q.company = ? AND q.queue_status = "WAITING" ORDER BY q.priority_score DESC;',
                        [tenantId, comp]
                    );

                    // DYNAMIC SLOT BINDING (Find actual vacant slot for this company)
                    const vacantInterview = await db.get(
                        'SELECT * FROM interviews WHERE tenant_id = ? AND student_id = ? AND panel_id IN (SELECT id FROM panels WHERE company = ?) LIMIT 1;',
                        [tenantId, studentId, comp]
                    );
                    
                    let nextSlotStart, nextSlotEnd;
                    if (vacantInterview) {
                        nextSlotStart = vacantInterview.estimated_start;
                        nextSlotEnd = vacantInterview.estimated_end;
                        // Delete the old interview for the student who got placed
                        await db.run('DELETE FROM interviews WHERE id = ?;', [vacantInterview.id]);
                    } else {
                        nextSlotStart = db.getISOOffsetMins(720); // Fallback
                        nextSlotEnd = db.getISOOffsetMins(780);
                    }

                    let promoted = null;
                    for (const cand of remainingCandidates) {
                        const clashCheck = await this.isCandidateClashing(tenantId, cand.student_id, nextSlotStart, nextSlotEnd);
                        if (!clashCheck.clash) {
                            promoted = cand;
                            break;
                        }
                    }

                    if (promoted) {
                        await db.run('UPDATE corporate_queues SET queue_status = "ACTIVE" WHERE id = ?;', [promoted.id]);

                        // Schedule the promoted candidate dynamically
                        if (vacantInterview) {
                            await db.run(
                                'INSERT INTO interviews (tenant_id, panel_id, student_id, round_name, scheduled_start, scheduled_end, estimated_start, estimated_end, status, delay_mins) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
                                [tenantId, vacantInterview.panel_id, promoted.student_id, vacantInterview.round_name, nextSlotStart, nextSlotEnd, nextSlotStart, nextSlotEnd, 'Pending', 0]
                            );
                        }

                        const promoMsg = `🚀 You have been promoted to the ACTIVE candidate position for ${comp} at ${new Date(nextSlotStart).toLocaleTimeString()}!`;
                        await db.run('INSERT INTO notifications (tenant_id, student_id, message, timestamp) VALUES (?, ?, ?, ?);', [tenantId, promoted.student_id, promoMsg, new Date().toISOString()]);

                        promotions.push({ company: comp, promotedStudentId: promoted.student_id, promotedStudentName: promoted.studentName });
                    }
                }
            }

            const placedMsg = `🎉 Congratulations ${student.name}! Your binding offer acceptance with ${companyName} has been officially locked.`;
            await db.run('INSERT INTO notifications (tenant_id, student_id, message, timestamp) VALUES (?, ?, ?, ?);', [tenantId, studentId, placedMsg, new Date().toISOString()]);

            await db.run('INSERT INTO audit_logs (tenant_id, actor, action, details, timestamp) VALUES (?, ?, ?, ?, ?);', [tenantId, studentId, 'ACCEPT_OFFER', `Student accepted offer from ${companyName}. Backfilled ${promotions.length} spots.`, new Date().toISOString()]);

            await db.run('COMMIT;');
            return { studentName: student.name, companyName, vacatedCompanies, promotions };
        } catch (err) {
            await db.run('ROLLBACK;');
            throw err;
        } finally {
            if (lock) {
                try {
                    await lock.release();
                } catch (e) {
                    console.error('Failed to release distributed lock:', e);
                }
            }
        }
    }

    async generateICSFeed(tenantId, studentId) {
        const student = await db.get('SELECT * FROM students WHERE tenant_id = ? AND id = ?;', [tenantId, studentId]);
        if (!student) throw new Error('Student not found');

        const interviews = await db.all(`
            SELECT i.*, p.name as panelName, p.company, p.virtual_room_url
            FROM interviews i
            JOIN panels p ON i.panel_id = p.id
            WHERE i.tenant_id = ? AND i.student_id = ?;
        `, [tenantId, studentId]);

        const academic = await db.all('SELECT * FROM academic_schedules WHERE tenant_id = ? AND student_id = ?;', [tenantId, studentId]);

        const formatDateToICS = (iso) => {
            return new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        let ics = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//University Placement Hub//Schedule Optimizer//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
            `X-WR-CALNAME:Placement Drive Schedule - ${student.name}`, 'X-WR-TIMEZONE:UTC'
        ];

        for (const iv of interviews) {
            ics.push('BEGIN:VEVENT', `UID:interview-${iv.id}@placements.uni.edu`, `DTSTAMP:${formatDateToICS(new Date().toISOString())}`, `DTSTART:${formatDateToICS(iv.estimated_start)}`, `DTEND:${formatDateToICS(iv.estimated_end)}`, `SUMMARY:${iv.company} - ${iv.round_name}`, `DESCRIPTION:Join link: ${iv.virtual_room_url || 'Physical Hall A'}`, `LOCATION:${iv.virtual_room_url || 'Room 101'}`, `STATUS:${iv.status === 'Completed' ? 'CONFIRMED' : 'TENTATIVE'}`, 'END:VEVENT');
        }

        for (const ac of academic) {
            ics.push('BEGIN:VEVENT', `UID:academic-${ac.id}@placements.uni.edu`, `DTSTAMP:${formatDateToICS(new Date().toISOString())}`, `DTSTART:${formatDateToICS(ac.start_time)}`, `DTEND:${formatDateToICS(ac.end_time)}`, `SUMMARY:Academic: ${ac.event_name}`, `DESCRIPTION:Mandatory academic session.`, 'LOCATION:Main Campus', 'STATUS:CONFIRMED', 'END:VEVENT');
        }

        ics.push('END:VCALENDAR');
        return ics.join('\r\n');
    }

    generateVirtualRoom(panelId, company, candidateName) {
        const roomId = `room-${panelId.toLowerCase()}-${crypto.randomBytes(4).toString('hex')}`;
        const roomToken = crypto.randomBytes(16).toString('hex');
        return {
            roomId,
            joinUrl: `https://meet.placements.uni.edu/${roomId}?token=${roomToken}`,
            platform: 'WebRTC Secured HD Video Hub',
            panelId, company, candidateName,
            expiresAt: new Date(Date.now() + (2 * 60 * 60000)).toISOString()
        };
    }
}

const schedulerInstance = new SchedulerEngine();
module.exports = schedulerInstance;
