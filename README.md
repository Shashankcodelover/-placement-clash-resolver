# 🎓 Placement Drive Clash Resolver

An algorithmic campus recruitment optimizer designed to resolve schedule overlaps, queue stagnation, candidate ghosting, and offer hoarding in high-pressure university placement environments. 

This repository features a complete, interactive, and beautifully styled full-stack web application with a glassmorphic dashboard to simulate and test all five core algorithms.

## 🚀 Key Features & Algorithmic Solutions

1. **Zero-Conflict Academic Synchronization Engine:** Natively checks proposed recruiter interview schedules against the university's academic timetables and exams, automatically recommending alternative conflict-free slots.
2. **Predictive Delay Modeling:** Monites live interview pacing in real-time. Overrun delays recalculate downstream start/end times and push real-time updates and rescheduled arrival times to candidates.
3. **Tribonacci-Weighted Dynamic Queuing:** Combats queue stagnation when interview panels run slow. Leverages a Tribonacci mathematical aging sequence ($T_n = T_{n-1} + T_{n-2} + T_{n-3}$) to dynamically escalate waiting candidates' priority scores and redistribute workloads.
4. **Multi-Stage Conditional Triggers:** Automatically reads candidate assessment sheets upon completion, instantly triggering email/SMS scheduling invites for subsequent rounds when scores clear cut-off thresholds.
5. **Continuous Bipartite Match Re-Routing:** Eradicates Day 1 offer hoarding. The moment a student accepts a binding job offer, the background router instantly de-queues them from all other concurrent queues, promoting the next eligible candidate.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js API Gateway
* **Frontend:** Mobile-first Vanilla HTML5, CSS3, JavaScript (Sleek Glassmorphic Design System)
* **API Architecture:** REST endpoints with real-time state synchronization

---

## 📦 Project Structure

```text
📦 placement-clash-resolver
 ┣ 📂 backend
 ┃ ┗ 📜 server.js        # Express controller, APIs, and algorithms
 ┣ 📂 frontend
 ┃ ┣ 📜 index.html       # Glassmorphic UI Dashboard interface
 ┃ ┣ 📜 style.css        # Interactive style system
 ┃ ┗ 📜 app.js           # Client routing, fetch logic, and UI renders
 ┣ 📜 package.json       # Node scripts and dependencies
 ┗ 📜 README.md          # Algorithmic blueprints
```

---

## 🚦 Getting Started

### Installation
1. Clone the repository and navigate to the project directory:
   ```bash
   cd placement-clash-resolver
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Open your web browser and navigate to:
   ```text
   http://localhost:3000
   ```
5. Click **Reset Simulation State** to seed default student records and start playing with the live interactive buttons!
