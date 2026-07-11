"use client";

import { useMemo, useState } from "react";

type TaskStatus = "upcoming" | "active" | "done";
type Task = { id: number; title: string; subject: string; time: string; duration: number; due: string; color: string; status: TaskStatus };

const initialTasks: Task[] = [
  { id: 1, title: "Momentum worksheet", subject: "AP Physics", time: "16:00", duration: 45, due: "Due tomorrow", color: "yellow", status: "upcoming" },
  { id: 2, title: "SAT math practice", subject: "Personal goal", time: "20:00", duration: 30, due: "Goal session", color: "purple", status: "upcoming" },
  { id: 3, title: "Draft essay introduction", subject: "English", time: "20:45", duration: 60, due: "Due Friday", color: "blue", status: "upcoming" },
  { id: 4, title: "Chemistry questions", subject: "AP Chemistry", time: "Yesterday", duration: 25, due: "Completed", color: "green", status: "done" },
];

const week = [
  ["MON", "8", ""], ["TUE", "9", ""], ["WED", "10", "today"], ["THU", "11", ""], ["FRI", "12", ""], ["SAT", "13", ""], ["SUN", "14", ""],
];

export default function Home() {
  const [tasks, setTasks] = useState(initialTasks);
  const [message, setMessage] = useState("Your plan is balanced. Keep the momentum.");
  const [tab, setTab] = useState("Overview");
  const completed = tasks.filter((task) => task.status === "done").length;
  const active = tasks.find((task) => task.status === "active");
  const totalMinutes = useMemo(() => tasks.filter((task) => task.status !== "done").reduce((sum, task) => sum + task.duration, 0), [tasks]);

  function startTask(id: number) {
    setTasks((all) => all.map((task) => ({ ...task, status: task.id === id ? "active" : task.status === "active" ? "upcoming" : task.status })));
    const task = tasks.find((item) => item.id === id);
    if (task) setMessage(`Timer started for ${task.title}. Send “Finish ${task.subject}” in LINE when you’re done.`);
  }
  function finishTask(id: number) {
    const task = tasks.find((item) => item.id === id);
    setTasks((all) => all.map((item) => item.id === id ? { ...item, status: "done" } : item));
    if (task) setMessage(`Nice work — ${task.duration} minutes logged. Your future estimates just got smarter.`);
  }

  return (
    <main>
      <aside className="sidebar">
        <a className="brand" href="#top"><span>✦</span> STUDYFLOW</a>
        <p className="brand-sub">STAY IN FLOW.</p>
        <nav>{["Overview", "Calendar", "Analytics", "Settings"].map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? "nav-item selected" : "nav-item"}><span>{item === "Overview" ? "▦" : item === "Calendar" ? "▣" : item === "Analytics" ? "↗" : "⚙"}</span>{item}</button>)}</nav>
        <div className="companion"><div className="spark">✦</div><b>YOUR COMPANION</b><p>Connected on LINE</p><button className="tiny-button">Manage channel ↗</button></div>
        <div className="profile"><div className="avatar">S</div><div><b>Souto</b><small>Level 8 · 1,320 XP</small></div><span>⌄</span></div>
      </aside>

      <section className="content" id="top">
        <header><div><p className="eyebrow">WEDNESDAY, JULY 10</p><h1>Good afternoon, Souto <span>✦</span></h1><p className="muted">{tab === "Overview" ? "Here’s your plan for today." : `${tab} is coming into focus.`}</p></div><button className="outline-btn">＋ Add task</button></header>
        <div className="notice"><span>✦</span><p>{message}</p><button onClick={() => setMessage("Your plan is balanced. Keep the momentum.")}>×</button></div>

        <section className="top-grid">
          <article className="card progress-card"><div className="card-label">WEEKLY PROGRESS <span>↗</span></div><div className="progress-number">{completed + 6}<small>/10</small></div><div className="progress-track"><i style={{ width: `${(completed + 6) * 10}%` }} /></div><p>{10 - completed - 6} tasks left this week</p></article>
          <article className="card streak-card"><div className="fire">🔥</div><div><div className="card-label">CURRENT STREAK</div><strong>12 days</strong><p>Keep it going!</p></div></article>
          <article className="card workload-card"><div className="card-label">WORKLOAD LEFT</div><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong><p>across {tasks.filter((t) => t.status !== "done").length} sessions</p><div className="mini-bars"><i /><i /><i /><i /></div></article>
        </section>

        <section className="main-grid">
          <article className="tasks-panel"><div className="section-heading"><div><p className="eyebrow">TODAY’S PLAN</p><h2>{active ? "You’re in focus mode." : "Three small wins. One great day."}</h2></div><button className="link-btn">View calendar →</button></div>
            <div className="task-list">{tasks.map((task) => <div key={task.id} className={`task ${task.status} ${task.color}`}><div className="task-time">{task.status === "done" ? "✓" : task.time}</div><div className="task-info"><b>{task.title}</b><span>{task.subject} · {task.duration} min · {task.due}</span></div>{task.status === "done" ? <span className="completed">DONE</span> : task.status === "active" ? <button className="finish" onClick={() => finishTask(task.id)}>Finish now ✓</button> : <button className="start" onClick={() => startTask(task.id)}>Start now →</button>}</div>)}</div>
          </article>
          <aside className="right-stack"><article className="ai-card"><div className="ai-title"><span>✦</span><b>FLOW INSIGHT</b></div><h3>Finish Physics today, and tomorrow stays light.</h3><p>You’ll free up 45 minutes and keep Thursday under 2 hours.</p><button onClick={() => startTask(1)}>Start Physics →</button></article><article className="line-card"><div className="line-dot">LINE</div><div><b>Message StudyFlow</b><p>Try: “Start Physics” or “Finish Physics”</p></div><span>↗</span></article></aside>
        </section>

        <section className="calendar-section"><div className="section-heading"><div><p className="eyebrow">YOUR FLOW</p><h2>This week at a glance</h2></div><div className="legend"><span><i className="school" /> School</span><span><i className="personal" /> Personal</span><span><i className="focus" /> Focus</span></div></div><div className="week">{week.map(([day, date, label]) => <div key={day} className={label ? "day today" : "day"}><b>{day}</b><span>{date}</span>{label && <em>TODAY</em>}</div>)}</div><div className="blocks"><div className="block school-block" style={{ gridColumn: "1 / span 2" }}>School <small>08:00–15:30</small></div><div className="block focus-block" style={{ gridColumn: "3" }}>Physics <small>16:00</small></div><div className="block personal-block" style={{ gridColumn: "4 / span 2" }}>Basketball practice <small>17:00</small></div><div className="block yellow-block" style={{ gridColumn: "6" }}>SAT practice <small>10:00</small></div></div></section>
      </section>
    </main>
  );
}
