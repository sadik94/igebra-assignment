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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modelMetrics, setModelMetrics] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [personaById, setPersonaById] = useState({});
  const [personaCounts, setPersonaCounts] = useState([]);
  const [radarIndex, setRadarIndex] = useState(0);
  const [personaFilter, setPersonaFilter] = useState("all");
  const [syncWithSelected, setSyncWithSelected] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/data/students.json").then((r) => r.json()),
      fetch("/analysis/model.json").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/analysis/personas.json").then((r) => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([studentsData, modelData, personasData]) => {
        setStudents(studentsData);
        if (modelData) {
          setModelInfo(modelData);
          if (modelData.metrics) setModelMetrics(modelData.metrics);
        }
        if (personasData?.personas) {
          const map = {};
          for (const p of personasData.personas) map[p.student_id] = p.persona;
          setPersonaById(map);
          const counts = personasData.personas.reduce((acc, p) => {
            acc[p.persona] = (acc[p.persona] || 0) + 1;
            return acc;
          }, {});
          setPersonaCounts(Object.entries(counts).map(([k,v]) => ({ persona: Number(k), count: v })));
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load data");
        setLoading(false);
      });
  }, []);

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

  const cohortStudents = useMemo(() => {
    if (!students.length) return [];
    if (!syncWithSelected || !selectedStudent) return students;
    // Use the selected student's class as a cohort
    return students.filter((s) => s.class === selectedStudent.class);
  }, [students, syncWithSelected, selectedStudent]);

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
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cognitive Skills & Performance Dashboard</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">Persona:</div>
          <select className="border rounded px-2 py-1 text-sm" value={personaFilter} onChange={(e)=>setPersonaFilter(e.target.value)}>
            <option value="all">All</option>
            {personaCounts.map(p=> (
              <option key={p.persona} value={String(p.persona)}>Persona {p.persona}</option>
            ))}
          </select>
        </div>
      </header>

      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Kpi title="Students" value={kpis.count} />
          <Kpi title="Avg Score" value={kpis.score} />
          <Kpi title="Attention" value={kpis.attention} />
          <Kpi title="Focus" value={kpis.focus} />
          <Kpi title="Comprehension" value={kpis.comprehension} />
          <Kpi title="Retention" value={kpis.retention} />
        </div>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="h-96 border rounded-md p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Correlation with Assessment Score</h2>
            <label className="text-xs inline-flex items-center gap-2">
              <input type="checkbox" className="accent-indigo-600" checked={syncWithSelected} onChange={(e)=>setSyncWithSelected(e.target.checked)} />
              Sync with selected student's class
            </label>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={skillVsScore} margin={{ top: 10, right: 10, left: 10, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="skill" tick={{ fontSize: 12 }} />
              <YAxis domain={[-1, 1]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="score" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-96 border rounded-md p-4 overflow-hidden">
          <h2 className="mb-2 font-medium">Attention vs Assessment Score</h2>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="attention" name="Attention" domain={[0, 100]} tick={{ fontSize: 12 }} />
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

      <section>
        <h2 className="mb-2 font-medium">Students</h2>
        <StudentsTable data={students.filter(s => personaFilter==='all' ? true : String(personaById[s.student_id])===personaFilter)} personaById={personaById} />
      </section>

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
  }, [filtered, sortKey, sortDir]);

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
            <tr className="text-left border-b">
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
              <tr key={s.student_id} className="border-b hover:bg-gray-50">
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
