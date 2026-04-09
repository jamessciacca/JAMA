# 🚀 JAMA — Network & Website Monitoring Dashboard

JAMA is a full-stack web application designed to monitor website availability, track response times, and provide a clean, modern interface for network diagnostics.

Built to bridge full-stack development with IT and networking concepts, JAMA turns raw system data into actionable insights.

---

## 🌐 Live Demo

https://jamessciacca.github.io/JAMA/

---

## 🧠 What It Does

- Check if a website is reachable
- Measure response time (latency)
- Display real-time results in a clean UI
- Built to expand into a full network diagnostics toolkit

---

## 🏗️ Tech Stack

Frontend:
- React (Vite)
- JavaScript
- CSS

Backend:
- Node.js
- Express
- CORS

Deployment:
- GitHub Pages (frontend)
- Render (backend API)

---

## ⚙️ How It Works

1. User enters a website (e.g. google.com)
2. React sends a request to the backend API
3. Express server:
   - sends a request to the target site
   - measures response time
   - returns status and latency
4. Frontend displays results in real time

Flow:
User → React → Express API → Target Website → Response → UI

---

## 🔌 API Example

GET /api/check-site

Example:
api/check-site?url=google.com

Response:
{
  "url": "google.com",
  "status": 200,
  "ok": true,
  "responseTime": 120,
  "checkedAt": "2026-04-09T18:30:00.000Z"
}

---

## 💻 Local Development

Clone the repo:
git clone https://github.com/jamessciacca/JAMA.git
cd JAMA

Install frontend:
cd client
npm install
npm run dev

Install backend:
cd ../server
npm install
npm run dev

Frontend runs on:
http://localhost:5173

Backend runs on:
http://localhost:5001

---

## 🚀 Deployment Notes

- Frontend is hosted on GitHub Pages
- Backend is hosted on Render

Important:
The frontend must call the deployed backend URL (not localhost) in production.

---

## 🔥 Features

Current:
- Website status checker
- Response time measurement
- Clean dashboard UI

Coming Soon:
- Response time charts
- Auto-refresh monitoring
- DNS lookup tools
- Port checking
- Network/device diagnostics dashboard

---

## 🎯 Why I Built This

JAMA was created to:
- Combine software engineering with IT/networking skills
- Demonstrate real-world monitoring and diagnostics concepts
- Turn “dark telemetry” into visible insights

---

## 📌 Resume Value

This project demonstrates:
- Full-stack development (React + Express)
- API design and integration
- Real-time data handling
- Networking fundamentals (latency, availability)
- Deployment across multiple platforms

---

## 🤝 Connect

Portfolio:
https://www.jamessciacca.com

LinkedIN:
www.linkedin.com/in/james-sciacca3

---

## ⭐ Final Note

JAMA is just the beginning — the goal is to evolve it into a full network and infrastructure monitoring platform.
