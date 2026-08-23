
# EXPLORE GUIDE
- **Start Here**: Look at `frontend/index.html` to see the Dashboard UI.
- **Frontend Logic**: `frontend/app.js` manages real-time updates via `socket.on('state_update')`.
- **Backend Logic**: `backend/server.js` holds the in-memory state, handles routing, and broadcasts updates via `io.emit`.
