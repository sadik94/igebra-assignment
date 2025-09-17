## Cognitive Skills & Student Performance Dashboard

This repository contains:
- Next.js dashboard with KPIs, charts (bar, scatter, radar) and a searchable/sortable students table
- Synthetic dataset under `public/data/students.json` (+ CSV in `data/students.csv`)
- Jupyter notebook for EDA, a simple regression model, and clustering that exports artifacts to `public/analysis/`

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+ with Jupyter (optional, for running the analysis)

### Install and run
```bash
npm install
npm run dev
# open http://localhost:3000
```

### Upload-first flow (new)
The homepage now starts clean and renders the dashboard only after you upload a CSV.
- Accepts `.csv` files (max 5 MB)
- Drag-and-drop supported (panel highlights on drag-over)
- Keyboard shortcut: press `Ctrl+O` to open the file dialog
- Inline validation and errors (type/size/header)
- Shows a preview card (filename, size, detected rows)
- "Clear data" button resets the view
- "Copy header" button copies the exact required header

Required CSV header (copyable):
```
student_id,name,class,attention,focus,comprehension,retention,engagement_time,assessment_score
```

### Sample data
- Download sample CSV: button on the homepage downloads `public/data/students.csv` (mirrors `data/students.csv`).
- You can also access it directly at `/data/students.csv` when the dev server is running.

### Data and analysis
- Data generator already ran; source files are in `public/data/students.json` and `data/students.csv`.
- Notebook path: `notebooks/analysis.ipynb`.
  - EDA exports: `public/analysis/correlations.json`
  - Model exports: `public/analysis/model.json`
  - Clustering exports: `public/analysis/personas.json`

To re-run the notebook, open it in Jupyter and execute all cells. Artifacts will be overwritten.

### Dashboard features
- Overview KPIs for averages
- Bar chart: correlation of each skill with `assessment_score`
- Scatter chart: `attention` vs `assessment_score`
- Radar chart: per-student profile (attention, focus, comprehension, retention)
- Students table: search and sort on all columns
- Insights section digesting correlations and averages

### Mobile testing
If phone and laptop are on the same Wi‑Fi, open the Network URL shown by Next.js (e.g., `http://<your-local-ip>:3000`). If you see CORS warnings from `/_next/*` in dev, consider adding `allowedDevOrigins` in `next.config.mjs` per Next.js docs.

To bind to all interfaces explicitly:
```bash
PORT=3000 npm run dev -- -H 0.0.0.0 -p 3000
```

### Deploy
You can deploy on Vercel:
```bash
npx vercel
```
Follow prompts to create a new project and link this directory.

### Notes
This project uses Tailwind CSS and Recharts. No PII or real student data is included; the dataset is synthetic.
