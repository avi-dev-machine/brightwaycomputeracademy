# BRIGHTWAY COMPUTER EDUCATION — Official Student & Fee Portal

Full-stack Student Management, Digital ID Card Generator, and Razorpay Online Fee Collection Platform for **BRIGHTWAY COMPUTER EDUCATION**, affiliated with **Rajiv Gandhi Youth Computer Saksharta Mission (RGYCSM)**.

* **Official RGYCSM Course Affiliation**: [https://www.rgycsm.org/courses](https://www.rgycsm.org/courses)
* **Verified Campus Location (Google Maps)**: [https://share.google/ckM9UxaHIv8pXOjjd](https://share.google/ckM9UxaHIv8pXOjjd)

---

## Modular Repository Architecture

```text
brightwaycomputeracademy/
├── backend/                  # FastAPI Backend Service (Deployable on Render)
│   ├── app/
│   │   ├── api/v1/           # Modular REST Routers (/auth, /admin, /student, /payment, /imports, /notifications)
│   │   ├── core/             # JWT Signer, Bcrypt Passwords, RBAC Permissions, Dynamic Month Rollover
│   │   ├── db/               # MongoDB Atlas Client + Zero-Subprocess In-Process Fallback + Bundled Seed Data
│   │   ├── integrations/     # Server-Side Razorpay HMAC-SHA256 Gateway, Storage & Multi-Channel Messaging
│   │   ├── schemas/          # Pydantic Request/Response Contracts
│   │   └── services/         # Student, Auth, Payment, ID Card (CR80 PDF/PNG), Streaming CSV & Report Services
│   ├── scripts/              # Database Seeding & CSV Ingestion CLI (`populate_database.py`)
│   ├── Dockerfile            # Production Container Image for Render
│   └── requirements.txt      # Locked Production Python Dependencies
├── frontend/                 # Next.js 16.4.6 App Router Frontend (Deployable on Vercel)
│   ├── app/
│   │   ├── api/              # Server-Side BFF Proxy Routes (httpOnly JWT Cookies & Razorpay Order/Verify)
│   │   ├── admin/            # Master Admin Portal (Student CRUD, Missing ID Assignment, PAID/UNPAID Toggles)
│   │   ├── student/          # Student Portal (Profile, Active Month Fee Desk, Photo Upload & Digital ID Card)
│   │   ├── courses/          # RGYCSM Affiliated Course Catalog (ADOAP, DCAE, DDTP, RCIT, Python & CS)
│   │   ├── about/            # Institutional Profile & RGYCSM Affiliation Details
│   │   ├── contact/          # Campus Location & Google Maps Directions
│   │   └── login/            # Dual Student & Admin Authentication Portal
│   ├── components/           # Reusable UI, Layouts, Canvas ID Card Studio & Razorpay Checkout Modal
│   └── vercel.json           # Vercel Deployment Configuration
└── render.yaml               # Render Blueprint Specification for Backend Deployment
```

---

## Core Student Schema & Active Month Rollover

Every student record in the database follows the canonical 7-column structure:

| Field | Description |
| :--- | :--- |
| **`NAME`** | Student Full Name |
| **`STUDENT ID`** | Unique Registration ID (e.g., `RG240017`, `BW240038`; editable/assignable by Admin if blank in CSV) |
| **`PASSWORD`** | Student Portal Password (auto-derived or custom-set by Admin) |
| **`CONTACT NO.`** | 10-Digit Registered Mobile Number |
| **`COURSE`** | Enrolled Program (`ADOAP`, `DCAE`, `DDTP`, `RCIT`, `PYTHON`, `CLASS IV–XII`) |
| **`FEES (PAID/UNPAID)`** | Monthly Fee Amount & Current Active Month Payment Status (`PAID` or `UNPAID`) |
| **`MONTH`** | Active Billing Cycle (Starts at **December 2027 / `2027-12`**; rolls over to **January 2028 / `2028-01`** while preserving previous months in the backend `fee_payments` collection) |

---

## Cloud Deployment Guide

### 1. Deploy Backend on Render (`backend/`)
1. Push this repository to GitHub (`https://github.com/avi-dev-machine/brightwaycomputeracademy.git`).
2. In **Render Dashboard**, click **New +** → **Web Service** (or **Blueprint** to auto-detect [`render.yaml`](render.yaml)) and connect the GitHub repository.
3. Configure the service settings:
   * **Root Directory**: `backend`
   * **Runtime**: `Python 3` (or `Docker`)
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers`
4. Set the following **Environment Variables** in Render:
   * `APP_ENV` = `production`
   * `MONGODB_URI` = *(Your MongoDB Atlas connection string)*
   * `MONGODB_DB_NAME` = `brightway`
   * `SUPABASE_JWT_SECRET` = *(Any strong 32+ character secret)*
   * `RAZORPAY_KEY_ID` = *(Your Razorpay Key ID)*
   * `RAZORPAY_KEY_SECRET` = *(Your Razorpay Key Secret)*
   * `CORS_ORIGINS` = *(Your Vercel frontend domain, e.g. `https://brightwaycomputeracademy.vercel.app`)*

### 2. Deploy Frontend on Vercel (`frontend/`)
1. In **Vercel Dashboard**, click **Add New...** → **Project** and import `avi-dev-machine/brightwaycomputeracademy`.
2. Set **Root Directory** to `frontend`.
3. Add the following **Environment Variables** in Vercel:
   * `API_BASE_URL` = `https://<your-render-service-name>.onrender.com`
   * `NEXT_PUBLIC_API_BASE_URL` = `https://<your-render-service-name>.onrender.com`
   * `NEXT_PUBLIC_RAZORPAY_KEY_ID` = *(Your Razorpay Public Key ID)*
4. Click **Deploy**.

# brightwaycomputeracademy
