"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

export default function Home() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadInfo, setUploadInfo] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [modelMetrics, setModelMetrics] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [personaById, setPersonaById] = useState({});
  const [personaCounts, setPersonaCounts] = useState([]);
  const [radarIndex, setRadarIndex] = useState(0);
  const [personaFilter, setPersonaFilter] = useState("all");
  const [syncWithSelected, setSyncWithSelected] = useState(true);
  const [uploadHistory, setUploadHistory] = useState([]);
  // Filters & pagination
  const [classFilter, setClassFilter] = useState("all");
  const [scoreRange, setScoreRange] = useState([0, 100]);
  const [skillRanges, setSkillRanges] = useState({
    attention: [0, 100],
    focus: [0, 100],
    comprehension: [0, 100],
    retention: [0, 100],
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    // Do not auto-load students on first visit; wait for CSV upload or sample load
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        document.querySelector('input[type="file"]')?.click();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCsvUpload = async (file) => {
    try {
      if (!file) return;
      setIsUploading(true);
      setError("");
      const maxSizeBytes = 5 * 1024 * 1024;
      const isCsv = file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
      if (!isCsv) throw new Error("Please upload a .csv file");
      if (file.size > maxSizeBytes) throw new Error("File too large (max 5 MB)");
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) throw new Error("Empty CSV");
      setFilePreview({ name: file.name, size: file.size, rows: rows.length - 1 });
      const header = rows[0].map((h) => h.trim());
      const expected = [
        "student_id",
        "name",
        "class",
        "attention",
        "focus",
        "comprehension",
        "retention",
        "engagement_time",
        "assessment_score",
      ];
      const ok = expected.every((k, i) => header[i] === k);
      if (!ok) throw new Error("Invalid CSV header");
      const data = rows.slice(1).filter(r => r.length && r.some(c => String(c).trim() !== "")).map((r) => ({
        student_id: Number(r[0]),
        name: String(r[1]),
        class: String(r[2]),
        attention: Number(r[3]),
        focus: Number(r[4]),
        comprehension: Number(r[5]),
        retention: Number(r[6]),
        engagement_time: Number(r[7]),
        assessment_score: Number(r[8]),
      }));
      setStudents(data);
      setRadarIndex(0);
      setPersonaFilter("all");
      const uniqueClasses = Array.from(new Set(data.map(d => d.class)));
      setUploadInfo({ count: data.length, classes: uniqueClasses.length, filename: file.name });
      setError("");
      setUploadHistory(prev => [{ name: file.name, rows: data.length, when: new Date().toLocaleTimeString() }, ...prev].slice(0,3));
    } catch (e) {
      setError(e.message || "Failed to parse CSV");
    }
    finally {
      setIsUploading(false);
    }
  };

  const downloadSampleCsv = () => {
    const csv = toCsv(students);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const kpis = useMemo(() => {
    if (!students.length) return null;
    const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    return {
      count: students.length,
      attention: avg(students.map((s) => s.attention)),
      focus: avg(students.map((s) => s.focus)),
      comprehension: avg(students.map((s) => s.comprehension)),
      retention: avg(students.map((s) => s.retention)),
      score: avg(students.map((s) => s.assessment_score)),
    };
  }, [students]);

  const selectedStudent = students[radarIndex];

  const classes = useMemo(() => Array.from(new Set(students.map(s => s.class))), [students]);

  const visibleStudents = useMemo(() => {
    if (!students.length) return [];
    const [sMin, sMax] = scoreRange;
    const inRange = (v, [min, max]) => v >= min && v <= max;
    return students.filter(s =>
      (classFilter === "all" || s.class === classFilter) &&
      inRange(s.assessment_score, [sMin, sMax]) &&
      inRange(s.attention, skillRanges.attention) &&
      inRange(s.focus, skillRanges.focus) &&
      inRange(s.comprehension, skillRanges.comprehension) &&
      inRange(s.retention, skillRanges.retention)
    );
  }, [students, classFilter, scoreRange, skillRanges]);

  const pagedStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleStudents.slice(start, start + pageSize);
  }, [visibleStudents, page, pageSize]);

  const cohortStudents = useMemo(() => {
    if (!visibleStudents.length) return [];
    if (!syncWithSelected || !selectedStudent) return visibleStudents;
    // Use the selected student's class as a cohort
    return visibleStudents.filter((s) => s.class === selectedStudent.class);
  }, [visibleStudents, syncWithSelected, selectedStudent]);

  const skillVsScore = useMemo(() => {
    if (!cohortStudents.length) return [];
    return [
      { skill: "attention", score: corr(cohortStudents, "attention") },
      { skill: "focus", score: corr(cohortStudents, "focus") },
      { skill: "comprehension", score: corr(cohortStudents, "comprehension") },
      { skill: "retention", score: corr(cohortStudents, "retention") },
    ];
  }, [cohortStudents]);

  if (loading) return <div className="p-8">Loading…</div>;

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold text-center">Cognitive Skills & Performance Dashboard</h1>
        <p className="text-sm text-gray-500 text-center">Upload a CSV to explore insights, correlations, and student profiles.</p>
        <div className="text-xs text-gray-400 text-center">💡 Tip: Press Ctrl+O to open file dialog</div>
        {students.length > 0 ? (
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">Persona:</div>
            <select className="border rounded px-2 py-1 text-sm" value={personaFilter} onChange={(e)=>setPersonaFilter(e.target.value)}>
              <option value="all">All</option>
              {personaCounts.map(p=> (
                <option key={p.persona} value={String(p.persona)}>Persona {p.persona}</option>
              ))}
            </select>
          </div>
        ) : null}
      </header>

      {uploadInfo && (
        <div className="border rounded-md p-3 bg-green-50 text-green-800 flex items-center justify-between">
          <div className="text-sm">Loaded <strong>{uploadInfo.count}</strong> rows across <strong>{uploadInfo.classes}
          </strong> classes from <strong>{uploadInfo.filename}</strong>.</div>
          <div className="flex items-center gap-3">
            <button className="text-xs underline" onClick={()=>setUploadInfo(null)}>Dismiss</button>
            <button
              className="text-xs underline"
              onClick={()=>{
                setStudents([]);
                setPersonaById({});
                setPersonaCounts([]);
                setModelInfo(null);
                setModelMetrics(null);
                setUploadInfo(null);
                setFilePreview(null);
              }}
            >Clear data</button>
          </div>
        </div>
      )}

      {filePreview && (
        <div className="border rounded-md p-3 bg-blue-50 text-blue-800">
          <div className="text-sm">
            📄 <strong>{filePreview.name}</strong> ({Math.round(filePreview.size / 1024)} KB) • {filePreview.rows} rows detected
          </div>
        </div>
      )}

      {uploadHistory.length > 0 ? (
        <div className="border rounded-md p-3 bg-white/5">
          <div className="text-xs text-gray-500 mb-1">Recent uploads</div>
          <ul className="text-sm grid sm:grid-cols-3 gap-2">
            {uploadHistory.map((u, i) => (
              <li key={`${u.name}-${i}`} className="border rounded px-2 py-1 flex items-center justify-between">
                <span className="truncate mr-2" title={u.name}>{u.name}</span>
                <span className="text-xs text-gray-500">{u.rows} rows • {u.when}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section
        className={`border rounded-lg p-5 bg-white/5 ${isDragOver ? "ring-2 ring-indigo-500 bg-indigo-50" : ""}`}
        onDragOver={(e)=>{e.preventDefault(); setIsDragOver(true);}}
        onDragLeave={()=>setIsDragOver(false)}
        onDrop={async (e)=>{e.preventDefault(); setIsDragOver(false); const f=e.dataTransfer?.files?.[0]; if (f) await handleCsvUpload(f);}}
      >
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="lg:col-span-2 space-y-2">
            <h2 className="font-medium text-lg">Upload CSV</h2>
            <p className="text-sm text-gray-500">Upload a CSV with any number of students. Drag and drop into this panel or use the file picker.</p>
            <div className="text-xs text-gray-500 flex flex-wrap gap-2">
              <span className="opacity-70">Required columns:</span>
              {["student_id","name","class","attention","focus","comprehension","retention","engagement_time","assessment_score"].map(k=> (
                <code key={k} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">{k}</code>
              ))}
            </div>
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            <ul className="text-xs text-gray-500 list-disc pl-5 space-y-1 mt-2">
              <li>The first row must be the exact header shown above.</li>
              <li>Skill and score values should be numeric in the range 0–100.</li>
              <li>Max file size 5 MB. Accepted type: .csv</li>
            </ul>
            <div className="pt-2">
              <button
                className="text-xs underline"
                onClick={()=> navigator.clipboard?.writeText("student_id,name,class,attention,focus,comprehension,retention,engagement_time,assessment_score")}
              >Copy header to clipboard</button>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3">
            <label className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:bg-gray-50 transition">
              <span className="block text-sm mb-2">
                {isUploading ? (
                  <span className="inline-flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : (
                  "Choose CSV file"
                )}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleCsvUpload(e.target.files?.[0])}
                className="hidden"
                disabled={isUploading}
              />
              <span className="text-xs text-gray-500">
                {isUploading ? "Please wait..." : "Or drag & drop here"}
              </span>
            </label>
          </div>
        </div>
      </section>

      {students.length === 0 ? (
        <div className="flex justify-end">
          <a href="/data/students.csv" download className="rounded-md px-3 py-2 text-sm border hover:bg-gray-50">Download sample CSV</a>
        </div>
      ) : null}

      {students.length === 0 ? (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-700 mb-1">Step 1</div>
            <div className="font-medium mb-1">Prepare your CSV</div>
            <p className="text-sm text-gray-500">Ensure the header matches and values are numeric. Include any number of rows.</p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-700 mb-1">Step 2</div>
            <div className="font-medium mb-1">Upload and explore</div>
            <p className="text-sm text-gray-500">Upload the file to unlock dashboards, correlations, and the searchable table.</p>
          </div>
        </section>
      ) : null}

      {students.length > 0 && kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Kpi title="Students" value={kpis.count} />
          <Kpi title="Avg Score" value={kpis.score} />
          <Kpi title="Attention" value={kpis.attention} />
          <Kpi title="Focus" value={kpis.focus} />
          <Kpi title="Comprehension" value={kpis.comprehension} />
          <Kpi title="Retention" value={kpis.retention} />
        </div>
      )}

      {students.length > 0 ? (
      <section className="border rounded-md p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Class</div>
            <select className="border rounded px-2 py-1 text-sm" value={classFilter} onChange={(e)=>{setClassFilter(e.target.value); setPage(1);}}>
              <option value="all">All</option>
              {classes.map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <RangeInputs label="Score" value={scoreRange} onChange={(v)=>{setScoreRange(v); setPage(1);}} />
          <RangeInputs label="Attention" value={skillRanges.attention} onChange={(v)=>{setSkillRanges(prev=>({...prev, attention:v})); setPage(1);}} />
          <RangeInputs label="Focus" value={skillRanges.focus} onChange={(v)=>{setSkillRanges(prev=>({...prev, focus:v})); setPage(1);}} />
          <RangeInputs label="Compr." value={skillRanges.comprehension} onChange={(v)=>{setSkillRanges(prev=>({...prev, comprehension:v})); setPage(1);}} />
          <RangeInputs label="Reten." value={skillRanges.retention} onChange={(v)=>{setSkillRanges(prev=>({...prev, retention:v})); setPage(1);}} />
          <div className="ml-auto flex items-center gap-2">
            <div className="text-xs text-gray-500">Rows per page</div>
            <select className="border rounded px-2 py-1 text-sm" value={pageSize} onChange={(e)=>{setPageSize(Number(e.target.value)); setPage(1);}}>
              {[10,25,50,100].map(n=> (<option key={n} value={n}>{n}</option>))}
            </select>
          </div>
        </div>
      </section>
      ) : null}

      {students.length > 0 ? (
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="h-96 border rounded-md p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Correlation with Assessment Score</h2>
            <label className="text-xs inline-flex items-center gap-2">
              <input type="checkbox" className="accent-indigo-600" checked={syncWithSelected} onChange={(e)=>setSyncWithSelected(e.target.checked)} />
              {"Sync with selected student\u2019s class"}
            </label>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={skillVsScore} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="skill" tick={{ fontSize: 12 }} tickMargin={12} interval={0} />
              <YAxis domain={[-1, 1]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="score" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-96 border rounded-md p-4 overflow-hidden">
          <h2 className="mb-2 font-medium">Attention vs Assessment Score</h2>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="attention" name="Attention" domain={[0, 100]} tick={{ fontSize: 12 }} tickMargin={12} />
              <YAxis type="number" dataKey="assessment_score" name="Score" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={cohortStudents} fill="#10b981" />
              {selectedStudent ? (
                <Scatter data={[selectedStudent]} fill="#ef4444" />
              ) : null}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="h-96 border rounded-md p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Student Profile (Radar)</h2>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={radarIndex}
              onChange={(e) => setRadarIndex(Number(e.target.value))}
            >
              {students.map((s, i) => (
                <option key={s.student_id} value={i}>
                  {s.name} (#{s.student_id})
                </option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={toRadarData(students[radarIndex])}
              outerRadius="70%"
            >
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
              <Radar name="Score" dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.5} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>
      ) : null}

      {students.length > 0 ? (
      <section className="border rounded-md p-4">
        <h2 className="mb-2 font-medium">Insights</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Correlation strongest with: <strong>{topCorrelation(skillVsScore)}</strong>.</li>
          <li>Average assessment score: <strong>{kpis?.score}</strong>.</li>
          <li>Average engagement time: <strong>{Math.round(students.reduce((a,s)=>a+s.engagement_time,0)/students.length)} min</strong>.</li>
          {modelMetrics ? (
            <li>Model performance — R2: <strong>{modelMetrics.r2.toFixed(3)}</strong>, MAE: <strong>{modelMetrics.mae.toFixed(2)}</strong>.</li>
          ) : (
            <li>Run the notebook to populate model metrics.</li>
          )}
          {personaCounts?.length ? (
            <li>Personas distribution: {personaCounts.map(p => `${p.persona}: ${p.count}`).join(', ')}.</li>
          ) : (
            <li>Run clustering in the notebook to see personas.</li>
          )}
          <li>Use radar to inspect individual strengths across skills.</li>
        </ul>
        {modelInfo?.coefficients && (
          <div className="mt-3 text-sm">
            <div className="font-medium mb-1">Model coefficients</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {Object.entries(modelInfo.coefficients).map(([k,v]) => (
                <div key={k} className="border rounded px-2 py-1">{k}: <span className="font-mono">{Number(v).toFixed(3)}</span></div>
              ))}
            </div>
          </div>
        )}
      </section>
      ) : null}

      {students.length > 0 ? (
      <section className="border rounded-md p-4">
        <h2 className="mb-2 font-medium">Students</h2>
        <StudentsTable data={pagedStudents} personaById={personaById} />
        <Pagination
          total={visibleStudents.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>
      ) : null}

      <footer className="text-xs text-gray-400 text-center py-4">Upload data remains in your browser; nothing is uploaded to a server.</footer>
    </div>
  );
}

function Kpi({ title, value }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function corr(rows, key) {
  const xs = rows.map((r) => r[key]);
  const ys = rows.map((r) => r.assessment_score);
  const n = xs.length;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy) || 1;
  return +(num / den).toFixed(2);
}

function toRadarData(s) {
  if (!s) return [];
  return [
    { metric: "Attention", value: s.attention },
    { metric: "Focus", value: s.focus },
    { metric: "Comprehension", value: s.comprehension },
    { metric: "Retention", value: s.retention },
  ];
}

function topCorrelation(rows) {
  if (!rows?.length) return "N/A";
  const sorted = [...rows].sort((a,b)=>Math.abs(b.score)-Math.abs(a.score));
  const best = sorted[0];
  return `${best.skill} (${best.score})`;
}

function StudentsTable({ data, personaById }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("student_id");
  const [sortDir, setSortDir] = useState("asc");
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return data.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.student_id).includes(q) ||
        s.class.toLowerCase().includes(q)
    );
  }, [data, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered].map((s)=> ({...s, persona: personaById[s.student_id]}));
    arr.sort((a,b)=>{
      const A = a[sortKey];
      const B = b[sortKey];
      if (A < B) return sortDir === "asc" ? -1 : 1;
      if (A > B) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, personaById]);

  const setSort = (key) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="border rounded-md p-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, id, class"
        className="mb-3 w-full border rounded px-3 py-2"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-700">
              <Th onClick={() => setSort("student_id")} active={sortKey==="student_id"} dir={sortDir}>ID</Th>
              <Th onClick={() => setSort("name")} active={sortKey==="name"} dir={sortDir}>Name</Th>
              <Th onClick={() => setSort("class")} active={sortKey==="class"} dir={sortDir}>Class</Th>
              <Th onClick={() => setSort("persona")} active={sortKey==="persona"} dir={sortDir}>Persona</Th>
              <Th onClick={() => setSort("attention")} active={sortKey==="attention"} dir={sortDir}>Attention</Th>
              <Th onClick={() => setSort("focus")} active={sortKey==="focus"} dir={sortDir}>Focus</Th>
              <Th onClick={() => setSort("comprehension")} active={sortKey==="comprehension"} dir={sortDir}>Compr.</Th>
              <Th onClick={() => setSort("retention")} active={sortKey==="retention"} dir={sortDir}>Reten.</Th>
              <Th onClick={() => setSort("engagement_time")} active={sortKey==="engagement_time"} dir={sortDir}>Engage (m)</Th>
              <Th onClick={() => setSort("assessment_score")} active={sortKey==="assessment_score"} dir={sortDir}>Score</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.student_id} className="border-b border-gray-700 hover:bg-gray-800">
                <Td>{s.student_id}</Td>
                <Td>{s.name}</Td>
                <Td>{s.class}</Td>
                <Td>{personaById[s.student_id] ?? "-"}</Td>
                <Td>{s.attention}</Td>
                <Td>{s.focus}</Td>
                <Td>{s.comprehension}</Td>
                <Td>{s.retention}</Td>
                <Td>{s.engagement_time}</Td>
                <Td>{s.assessment_score}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-500 mt-2">Showing {sorted.length} of {data.length}</div>
    </div>
  );
}

function Th({ children, onClick, active, dir }) {
  return (
    <th className="py-2 pr-3 font-medium cursor-pointer select-none" onClick={onClick}>
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? <span className="text-gray-400">{dir === "asc" ? "▲" : "▼"}</span> : null}
      </span>
    </th>
  );
}

function Td({ children }) {
  return <td className="py-2 pr-3">{children}</td>;
}

function RangeInputs({ label, value, onChange }) {
  const [min, max] = value;
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label} ({min}-{max})</div>
      <div className="flex items-center gap-2">
        <input type="number" className="w-16 border rounded px-2 py-1 text-sm" value={min} min={0} max={100} onChange={(e)=>onChange([Number(e.target.value), max])} />
        <span className="text-gray-400">–</span>
        <input type="number" className="w-16 border rounded px-2 py-1 text-sm" value={max} min={0} max={100} onChange={(e)=>onChange([min, Number(e.target.value)])} />
      </div>
    </div>
  );
}

function Pagination({ total, page, pageSize, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const prev = () => onPageChange(Math.max(1, page - 1));
  const next = () => onPageChange(Math.min(totalPages, page + 1));
  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <div className="text-gray-500">Showing page {page} of {totalPages} • {total} rows</div>
      <div className="flex items-center gap-2">
        <button className="border rounded px-2 py-1 disabled:opacity-50" onClick={prev} disabled={page<=1}>Prev</button>
        <button className="border rounded px-2 py-1 disabled:opacity-50" onClick={next} disabled={page>=totalPages}>Next</button>
      </div>
    </div>
  );
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    rows.push(cells);
  }
  return rows;
}

function toCsv(rows) {
  const header = [
    "student_id",
    "name",
    "class",
    "attention",
    "focus",
    "comprehension",
    "retention",
    "engagement_time",
    "assessment_score",
  ];
  const escapeCell = (v) => {
    const s = String(v ?? "");
    const mustQuote = /[",\n]/.test(s);
    const q = s.replace(/"/g, '""');
    return mustQuote ? `"${q}"` : q;
  };
  const body = rows.map((r) => [
    r.student_id,
    r.name,
    r.class,
    r.attention,
    r.focus,
    r.comprehension,
    r.retention,
    r.engagement_time,
    r.assessment_score,
  ].map(escapeCell).join(",")).join("\n");
  return [header.join(","), body].filter(Boolean).join("\n");
}
