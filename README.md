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

### Deploy
You can deploy on Vercel:
```bash
npx vercel
```
Follow prompts to create a new project and link this directory.

### Notes
This project uses Tailwind CSS and Recharts. No PII or real student data is included; the dataset is synthetic.
