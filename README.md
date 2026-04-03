# 🛰️ Orbital Debris Tracker AI Agent

A full-stack AI agent that makes space situational awareness accessible through natural language. Ask questions about orbital debris, ISS position, and space safety — powered by real NASA data and Claude AI.

![Tech Stack](https://img.shields.io/badge/Claude-Anthropic-orange) ![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Node.js](https://img.shields.io/badge/Node.js-Express-green)

## 🌍 Live Demo
[🚀 View Live App](https://client-production-317a.up.railway.app)

## 💬 Example Queries
- "Where is the ISS right now?"
- "How many debris objects are in low earth orbit?"
- "Is it safe to launch to 400km orbit today?"
- "What are the closest debris objects to ISS?"
- "What is orbital debris and why is it dangerous?"

## 🚀 How It Works
1. User types a natural language question
2. React frontend sends it to Express backend
3. Claude AI decides which tool to call:
   - `get_iss_position` → Open Notify API → real-time ISS lat/lon
   - `get_debris_count` → Space-Track API → live debris catalog
   - `get_tle_data` → Space-Track API → orbital elements for any satellite
4. Claude synthesizes tool results into plain English response
5. Frontend displays response with live ISS globe updating in real time

## 🛠️ Tech Stack
- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite
- **Backend:** Node.js, Express, TypeScript
- **AI:** Anthropic Claude (claude-sonnet-4-6) with tool calling
- **APIs:** Open Notify (ISS position), Space-Track.org (TLE/debris data)
- **Orbital Math:** satellite.js (SGP4 propagation)

## ⚙️ Setup

### Prerequisites
- Node.js 18+
- Anthropic API key (console.anthropic.com)
- Space-Track.org account (space-track.org) — free

### Installation
```bash
git clone https://github.com/yaeger211202/orbital-debris-tracker.git
cd orbital-debris-tracker
npm install
```

### Environment Variables
Create a `.env` file:

## 📸 Screenshot
<img width="1917" height="907" alt="Screenshot 2026-04-02 024503" src="https://github.com/user-attachments/assets/666345ca-5cab-4720-9688-ebccddb43aeb" />

