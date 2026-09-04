# 🎓 Placement Drive Clash Resolver (Enterprise Edition v2.0) — Showcase & Architecture

[![Automated Tests](https://img.shields.io/badge/Tests-32%2F32%20Passing-brightgreen?style=for-the-badge&logo=jest)](tests/)
[![Suites](https://img.shields.io/badge/Suites-19%20Passed-blue?style=for-the-badge&logo=node.js)](tests/)
[![Architecture](https://img.shields.io/badge/Architecture-Autonomous%20Bipartite%20Engine-orange?style=for-the-badge)](backend/)
[![UI Polish](https://img.shields.io/badge/Status-100%25%20Complete%20%26%20Certified-success?style=for-the-badge)]()

> **Zero-Conflict Recruitment Logistics & Dynamic Bipartite Scheduling Engine**  
> An ACID-compliant, high-throughput recruitment logistics platform built for Tier-1 universities and enterprise hiring drives, featuring Autonomous AI Scheduling, Bipartite Matching, and Predictive Delay Cascade Modeling.

---

## 📸 Canonical Showcase Gallery

### 1. Multi-Role Dashboards
| Persona | Screenshot | Description |
|---|---|---|
| **Placement Admin** | ![Admin Dashboard](screenshots/placement_admin_dashboard.png) | Unified executive dashboard with conflict resolution matrix, drive metrics, and delay cascade monitor. |
| **Corporate Recruiter** | ![Recruiter Dashboard](screenshots/placement_recruiter_dashboard.png) | Recruiter portal with candidate queue, slot dispatch, and real-time candidate availability. |
| **Technical Panelist** | ![Panelist Dashboard](screenshots/placement_panelist_dashboard.png) | Live interview panel interface with candidate evaluation tools, STAR rating, and timekeeper controls. |
| **Student Candidate** | ![Student Dashboard](screenshots/placement_student_dashboard.png) | Student portal displaying scheduled drives, virtual room links, calendar sync, and real-time slot status. |

### 2. Autonomous AI & Scheduling Modules
| Module | Screenshot | Description |
|---|---|---|
| **Genetic Scheduler** | ![Genetic Schedule](screenshots/placement_ai_genetic_schedule.png) | Evolutionary GA algorithm optimizing multi-company schedules over 25 generations (Fitness: 1000/1000). |
| **Semantic Skill Matcher** | ![Semantic Skills](screenshots/placement_ai_skills_active.png) | NLP-driven cosine similarity matching student candidate profiles against job descriptions (77% match). |
| **Offer Acceptance Predictor** | ![Offer Predictor](screenshots/placement_ai_offer_predictor.png) | Logistic sigmoid regression predicting candidate offer acceptance probability (P = 98%). |
| **STAR Delivery Scorer** | ![STAR Scorer](screenshots/placement_ai_star_scorer.png) | Natural Language Processing evaluation of candidate interview answers based on Situation, Task, Action, Result. |

### 3. Real-Time Logistics Engines
| Engine | Screenshot | Description |
|---|---|---|
| **Matrix Sync Clash Detection** | ![Matrix Conflict](screenshots/placement_matrix_sync_conflict.png) | Real-time clash detection against university academic schedules with alternative conflict-free slot recommendations. |
| **Predictive Delay Cascade** | ![Delay Cascade](screenshots/placement_delay_cascade.png) | Dynamic delay shift propagation that automatically reschedules downstream slots when interviewers overrun. |

---

## 🔬 Core Algorithmic Architecture

### 1. Dynamic Bipartite Matching
Matches interview slots to candidate pools while strictly respecting academic calendar constraints, company exclusivity, and panel availability using bipartite maximum weight matching.

### 2. Logarithmic Multi-Factor Queue Aging
Dynamic queue priority calculated as:
`P(t) = BaseScore + 12 * log2(1 + t) + (CGPA * 2)`
Completely eliminates wait-time stagnation and hard priority collision ceilings.

### 3. Predictive Delay Cascade Modeling
When an interview session overruns by `Delta_t`:
1. Calculates buffer slack time `tau_buf`.
2. Propagates residual delay `delta = max(0, Delta_t - tau_buf)` strictly down the current panel's pipeline.
3. Leaves orthogonal company tracks unperturbed.
4. Broadcasts WebSocket events to notified candidates with updated ETAs.

---

## 🧪 Verification & Automated Testing
- **Test Framework**: Jest & Supertest
- **Total Test Suites**: `19 passed, 19 total`
- **Total Tests**: `32 passed, 32 total`
- **Coverage**:
  - Authentication & Persona Switching (`/api/login-as`, JWT verification)
  - Slot Allocation & Conflict Detection
  - Delay Cascade Propagation
  - Offer Dequeuing & Bipartite Backfill
  - AI Scorer & Predictive Models
