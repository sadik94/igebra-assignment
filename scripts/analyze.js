// Simple analysis generator to avoid requiring Jupyter when exporting artifacts
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dataPath = path.join(ROOT, 'public', 'data', 'students.json');
const outDir = path.join(ROOT, 'public', 'analysis');
fs.mkdirSync(outDir, { recursive: true });

const students = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

function corr(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a,b)=>a+b,0)/n;
  const my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, dx=0, dy=0;
  for (let i=0;i<n;i++) { const vx=xs[i]-mx; const vy=ys[i]-my; num+=vx*vy; dx+=vx*vx; dy+=vy*vy; }
  return num / (Math.sqrt(dx*dy) || 1);
}

// Correlations
const metrics = ['attention','focus','comprehension','retention','engagement_time','assessment_score'];
const M = {};
for (const a of metrics) {
  M[a] = {};
  for (const b of metrics) {
    const xs = students.map(s=>s[a]);
    const ys = students.map(s=>s[b]);
    M[a][b] = Number(corr(xs, ys).toFixed(3));
  }
}
const sortedVsScore = Object.fromEntries(
  Object.entries(M).map(([k,row])=>[k,row['assessment_score']]).sort((a,b)=>b[1]-a[1])
);
fs.writeFileSync(path.join(outDir, 'correlations.json'), JSON.stringify({ matrix: M, sorted_vs_score: sortedVsScore }, null, 2));

// Linear regression (closed form) y = Xb; b = (X^T X)^{-1} X^T y
const Xcols = ['attention','focus','comprehension','retention','engagement_time'];
const X = students.map(s=>[1, ...Xcols.map(c=>s[c])]); // intercept
const y = students.map(s=>s.assessment_score);

function transpose(A){return A[0].map((_,i)=>A.map(r=>r[i]));}
function matmul(A,B){
  const n = A.length; const m = A[0].length; const p = B[0].length;
  const C = Array.from({length:n},()=>Array(p).fill(0));
  for(let i=0;i<n;i++){
    for(let k=0;k<m;k++){
      const aik = A[i][k];
      for(let j=0;j<p;j++) C[i][j] += aik * B[k][j];
    }
  }
  return C;
}
function inv2d(A){
  // generic small matrix inverse via Gaussian elimination
  const n = A.length; const M = A.map(row=>row.slice());
  const I = Array.from({length:n},(_,i)=>Array.from({length:n},(__,j)=>i===j?1:0));
  for(let i=0;i<n;i++){
    // pivot
    let p=i; for(let r=i+1;r<n;r++){ if(Math.abs(M[r][i])>Math.abs(M[p][i])) p=r; }
    if (p!==i){ [M[i],M[p]]=[M[p],M[i]]; [I[i],I[p]]=[I[p],I[i]]; }
    const pivot = M[i][i] || 1e-8;
    const invPivot = 1/pivot;
    for(let j=0;j<n;j++){ M[i][j]*=invPivot; I[i][j]*=invPivot; }
    for(let r=0;r<n;r++) if(r!==i){ const f=M[r][i]; for(let j=0;j<n;j++){ M[r][j]-=f*M[i][j]; I[r][j]-=f*I[i][j]; } }
  }
  return I;
}
const Xt = transpose(X);
const XtX = matmul(Xt, X);
const XtXInv = inv2d(XtX);
const ycol = y.map(v=>[v]);
const Xty = matmul(Xt, ycol);
const beta = matmul(XtXInv, Xty).map(r=>r[0]);
const intercept = beta[0];
const coefs = Object.fromEntries(Xcols.map((c,i)=>[c, beta[i+1]]));

// metrics (R2, MAE)
const yhat = X.map(row => row.reduce((s,v,i)=> s + v*beta[i], 0));
const meanY = y.reduce((a,b)=>a+b,0)/y.length;
const ssRes = y.reduce((s,yi,i)=> s + Math.pow(yi - yhat[i],2), 0);
const ssTot = y.reduce((s,yi)=> s + Math.pow(yi - meanY,2), 0);
const r2 = 1 - ssRes/(ssTot || 1);
const mae = y.reduce((s,yi,i)=> s + Math.abs(yi - yhat[i]), 0) / y.length;
fs.writeFileSync(path.join(outDir, 'model.json'), JSON.stringify({ coefficients: coefs, intercept, metrics: { r2, mae } }, null, 2));

// KMeans (k=3) simple implementation
const k = 3;
const feats = Xcols;
// initialize centroids to random points
let centroids = Array.from({length:k},()=>students[Math.floor(Math.random()*students.length)]).map(s=>feats.map(f=>s[f]));
function dist2(a,b){return a.reduce((s,v,i)=>s+Math.pow(v-b[i],2),0)}
for(let iter=0; iter<20; iter++){
  const labels = students.map(s=>{
    const x = feats.map(f=>s[f]);
    let best=0,bd=Infinity; for(let i=0;i<k;i++){ const d=dist2(x,centroids[i]); if(d<bd){bd=d; best=i;} }
    return best;
  });
  // recompute centroids
  centroids = Array.from({length:k},(_,i)=>{
    const items = students.filter((_,idx)=>labels[idx]===i);
    if (!items.length) return feats.map(()=>0);
    return feats.map(f=> items.reduce((s,v)=>s+v[f],0)/items.length );
  });
  // assign back for next iteration
  if (iter===19){
    const exportPersonas = students.map((s,idx)=>({student_id:s.student_id, name:s.name, class:s.class, persona: labels[idx]}));
    const centroidsOut = centroids.map(c=> Object.fromEntries(c.map((v,i)=>[feats[i], v])) );
    fs.writeFileSync(path.join(outDir, 'personas.json'), JSON.stringify({ personas: exportPersonas, centroids: centroidsOut }, null, 2));
  }
}

console.log('Analysis artifacts written to public/analysis');

