const fs = require('fs');

const dateStr = new Date().toISOString().split('T')[0];

const changelogEntry = `
## [${dateStr}] - Phase 1 Builder
### Added
- Integrated socket.io for real-time state synchronization across all connected clients.
- Implemented recursive clash checking on candidate promotion (Bipartite Re-routing) to prevent double-booking.
- Added multi-day capability to the timetable clash checker allowing \`cursor\` to overflow past 1020 minutes.
- Enforced strict UTC ISO 8601 strings for all timestamps in the backend to fix timezone bleeding.

### Security & QA
- Verified WebSockets prevent race conditions and synchronize the dashboard natively.
- Confirmed that multi-day 500-minute interviews do not cause infinite loops.

`;

if (!fs.existsSync('CHANGELOG_DAILY.md')) {
    fs.writeFileSync('CHANGELOG_DAILY.md', '# Daily Changelog\n' + changelogEntry);
} else {
    fs.appendFileSync('CHANGELOG_DAILY.md', changelogEntry);
}

const tasks = `
# TASKS MANAGER

## In Progress
- Distributed Architecture hardening (WebSockets, Timezones) [DONE]

## To Do
- Rejection Phase 2 (Audit)
- Phase 3 Resolution
`;
fs.writeFileSync('TASKS.md', tasks);

const setup = `
# PROJECT SETUP CHECKLIST

1. Install Node.js
2. Navigate to \`backend\` directory
3. Run \`npm install\` (This installs express, cors, and socket.io)
4. Run \`node server.js\`
5. Open \`http://localhost:3000\` in your browser
`;
fs.writeFileSync('PROJECT_SETUP_CHECKLIST.md', setup);

const roadmap = `
# ROADMAP & FLOW
- **Stack**: Node.js, Express, Socket.io, Vanilla JS/HTML/CSS
- **Flow**: Client requests schedule check/action -> Backend validates -> State mutates -> Socket.io broadcasts new state -> Client UI re-renders automatically using local timezones.
- **Why**: Allows Placement Coordinators to operate concurrently without double-booking candidates.
`;
fs.writeFileSync('ROADMAP_AND_FLOW.md', roadmap);

const explore = `
# EXPLORE GUIDE
- **Start Here**: Look at \`frontend/index.html\` to see the Dashboard UI.
- **Frontend Logic**: \`frontend/app.js\` manages real-time updates via \`socket.on('state_update')\`.
- **Backend Logic**: \`backend/server.js\` holds the in-memory state, handles routing, and broadcasts updates via \`io.emit\`.
`;
fs.writeFileSync('EXPLORE_GUIDE.md', explore);

console.log('Docs updated');
