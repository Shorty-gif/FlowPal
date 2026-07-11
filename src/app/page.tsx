"use client";

import { FormEvent, useMemo, useState } from "react";

type TaskStatus = "upcoming" | "active" | "done";
type Task = { id: number; title: string; subject: string; time: string; duration: number; due: string; color: string; status: TaskStatus };
type Tab = "Overview" | "Calendar" | "Analytics" | "Shop" | "Settings";

const initialTasks: Task[] = [
  { id: 1, title: "Momentum worksheet", subject: "AP Physics", time: "16:00", duration: 45, due: "Due tomorrow", color: "yellow", status: "upcoming" },
  { id: 2, title: "SAT math practice", subject: "Personal goal", time: "20:00", duration: 30, due: "Goal session", color: "purple", status: "upcoming" },
  { id: 3, title: "Draft essay introduction", subject: "English", time: "20:45", duration: 60, due: "Due Friday", color: "blue", status: "upcoming" },
  { id: 4, title: "Chemistry questions", subject: "AP Chemistry", time: "Yesterday", duration: 25, due: "Completed", color: "green", status: "done" },
];

const week = [["MON", "8", ""], ["TUE", "9", ""], ["WED", "10", "today"], ["THU", "11", ""], ["FRI", "12", ""], ["SAT", "13", ""], ["SUN", "14", ""]];
const monthDays = Array.from({ length: 35 }, (_, index) => index < 31 ? index + 1 : null);
const themes = [
  { id: "classic", name: "Classic pop", color: "#ffe75d", cost: 0 },
  { id: "ocean", name: "Ocean mode", color: "#70c8ff", cost: 180 },
  { id: "berry", name: "Berry burst", color: "#f5a5d6", cost: 250 },
  { id: "mint", name: "Mint mission", color: "#a8e6bd", cost: 320 },
];

export default function Home() {
  const [tasks, setTasks] = useState(initialTasks);
  const [message, setMessage] = useState("Your plan is balanced. Keep the momentum.");
  const [tab, setTab] = useState<Tab>("Overview");
  const [points, setPoints] = useState(1320);
  const [streak, setStreak] = useState(12);
  const [freezes, setFreezes] = useState(0);
  const [theme, setTheme] = useState("classic");
  const [showAdd, setShowAdd] = useState(false);
  const [showChannel, setShowChannel] = useState(false);
  const completed = tasks.filter((task) => task.status === "done").length;
  const active = tasks.find((task) => task.status === "active");
  const totalMinutes = useMemo(() => tasks.filter((task) => task.status !== "done").reduce((sum, task) => sum + task.duration, 0), [tasks]);
  const activeTheme = themes.find((item) => item.id === theme) ?? themes[0];

  function startTask(id: number) {
    setTasks((all) => all.map((task) => ({ ...task, status: task.id === id ? "active" : task.status === "active" ? "upcoming" : task.status })));
    const task = tasks.find((item) => item.id === id);
    if (task) setMessage(`Timer started for ${task.title}. Send “Finish ${task.subject}” to FlowPal when you’re done.`);
  }
  function finishTask(id: number) {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status === "done") return;
    setTasks((all) => all.map((item) => item.id === id ? { ...item, status: "done" } : item));
    setPoints((value) => value + 60);
    setMessage(`Nice work — ${task.duration} minutes logged. +60 points earned and your future estimates got smarter.`);
  }
  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    setTasks((all) => [...all, { id: Date.now(), title, subject: String(data.get("subject") || "Personal"), time: String(data.get("time") || "18:00"), duration: Number(data.get("duration") || 30), due: "New task", color: "yellow", status: "upcoming" }]);
    setShowAdd(false);
    setMessage(`${title} is on your plan. FlowPal will keep it in view.`);
  }
  function buyTheme(item: typeof themes[number]) {
    if (theme === item.id) return;
    if (points < item.cost) return setMessage(`You need ${item.cost - points} more points for ${item.name}.`);
    setPoints((value) => value - item.cost);
    setTheme(item.id);
    setMessage(`${item.name} unlocked. Your dashboard has a fresh look.`);
  }
  function buyFreeze() {
    const cost = 150;
    if (points < cost) return setMessage(`You need ${cost - points} more points for a streak freeze.`);
    setPoints((value) => value - cost);
    setFreezes((value) => value + 1);
    setMessage("Streak freeze added. It will protect one missed day.");
  }

  const navItems: Tab[] = ["Overview", "Calendar", "Analytics", "Shop", "Settings"];
  return <main style={{ "--accent": activeTheme.color } as React.CSSProperties}>
    <aside className="sidebar">
      <button className="brand" onClick={() => setTab("Overview")}><span>✦</span> FLOWPAL</button>
      <p className="brand-sub">STAY IN FLOW.</p>
      <nav>{navItems.map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? "nav-item selected" : "nav-item"}><span>{item === "Overview" ? "▦" : item === "Calendar" ? "▣" : item === "Analytics" ? "↗" : item === "Shop" ? "✦" : "⚙"}</span>{item}</button>)}</nav>
      <div className="companion"><div className="spark">✦</div><b>YOUR COMPANION</b><p>Connected on LINE</p><button className="tiny-button" onClick={() => setShowChannel(true)}>Manage channel ↗</button></div>
      <button className="profile" onClick={() => setTab("Settings")}><div className="avatar">S</div><div><b>Souto</b><small>Level 8 · {points.toLocaleString()} points</small></div><span>⌄</span></button>
    </aside>
    <section className="content" id="top">
      <header><div><p className="eyebrow">WEDNESDAY, JULY 10</p><h1>{tab === "Overview" ? "Good afternoon, Souto" : tab} <span>✦</span></h1><p className="muted">{tab === "Overview" ? "Here’s your plan for today." : `Your ${tab.toLowerCase()} is ready.`}</p></div><button className="outline-btn" onClick={() => setShowAdd(true)}>＋ Add task</button></header>
      <div className="notice"><span>✦</span><p>{message}</p><button aria-label="Dismiss notice" onClick={() => setMessage("Your plan is balanced. Keep the momentum.")}>×</button></div>
      {tab === "Overview" && <Overview tasks={tasks} completed={completed} totalMinutes={totalMinutes} active={active} streak={streak} freezes={freezes} points={points} startTask={startTask} finishTask={finishTask} setTab={setTab} />}
      {tab === "Calendar" && <Calendar tasks={tasks} startTask={startTask} />}
      {tab === "Analytics" && <Analytics tasks={tasks} points={points} streak={streak} />}
      {tab === "Shop" && <Shop points={points} theme={theme} freezes={freezes} buyTheme={buyTheme} buyFreeze={buyFreeze} />}
      {tab === "Settings" && <Settings theme={activeTheme.name} freezes={freezes} streak={streak} setMessage={setMessage} setStreak={setStreak} />}
    </section>
    {showAdd && <div className="modal-backdrop"><form className="modal" onSubmit={addTask}><div className="modal-top"><h2>Add a task</h2><button type="button" onClick={() => setShowAdd(false)}>×</button></div><label>Task name<input name="title" placeholder="e.g. Review SAT vocabulary" autoFocus /></label><label>Category<input name="subject" placeholder="School, personal, SAT..." /></label><div className="form-row"><label>Time<input name="time" type="time" defaultValue="18:00" /></label><label>Minutes<input name="duration" type="number" min="5" defaultValue="30" /></label></div><button className="primary-btn" type="submit">Add to my plan →</button></form></div>}
    {showChannel && <div className="modal-backdrop"><div className="modal"><div className="modal-top"><h2>Your companion</h2><button onClick={() => setShowChannel(false)}>×</button></div><p>LINE is connected. Discord and WhatsApp are coming next.</p><button className="primary-btn" onClick={() => { setShowChannel(false); setMessage("LINE is your active FlowPal companion."); }}>Keep LINE connected</button></div></div>}
  </main>;
}

function Overview({ tasks, completed, totalMinutes, active, streak, freezes, points, startTask, finishTask, setTab }: { tasks: Task[]; completed: number; totalMinutes: number; active?: Task; streak: number; freezes: number; points: number; startTask: (id: number) => void; finishTask: (id: number) => void; setTab: (tab: Tab) => void }) {
  return <><section className="top-grid"><article className="card progress-card"><div className="card-label">WEEKLY PROGRESS <span>↗</span></div><div className="progress-number">{Math.min(completed + 6, 10)}<small>/10</small></div><div className="progress-track"><i style={{ width: `${Math.min(completed + 6, 10) * 10}%` }} /></div><p>{Math.max(10 - completed - 6, 0)} tasks left this week</p></article><article className="card streak-card"><div className="flame" aria-label="Animated streak flame"><i className="flame-outer" /><i className="flame-middle" /><i className="flame-core" /><b>✦</b></div><div><div className="card-label">CURRENT STREAK</div><strong>{streak} days</strong><p>{freezes ? `${freezes} streak freeze${freezes > 1 ? "s" : ""} ready` : "Keep it going!"}</p></div></article><article className="card workload-card"><div className="card-label">WORKLOAD LEFT</div><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong><p>across {tasks.filter((t) => t.status !== "done").length} sessions · {points.toLocaleString()} points</p><div className="mini-bars"><i /><i /><i /><i /></div></article></section>
    <section className="main-grid"><article className="tasks-panel"><div className="section-heading"><div><p className="eyebrow">TODAY’S PLAN</p><h2>{active ? "You’re in focus mode." : "Three small wins. One great day."}</h2></div><button className="link-btn" onClick={() => setTab("Calendar")}>View calendar →</button></div><TaskList tasks={tasks} startTask={startTask} finishTask={finishTask} /></article><aside className="right-stack"><article className="ai-card"><div className="ai-title"><span>✦</span><b>FLOW INSIGHT</b></div><h3>Finish Physics today, and tomorrow stays light.</h3><p>You’ll free up 45 minutes and keep Thursday under 2 hours.</p><button onClick={() => startTask(1)}>Start Physics →</button></article><button className="line-card" onClick={() => setTab("Shop")}><div className="line-dot">SHOP</div><div><b>Spend your points</b><p>Get themes and streak freezes</p></div><span>↗</span></button></aside></section>
    <Calendar tasks={tasks} startTask={startTask} compact /></>;
}

function TaskList({ tasks, startTask, finishTask }: { tasks: Task[]; startTask: (id: number) => void; finishTask: (id: number) => void }) { return <div className="task-list">{tasks.map((task) => <div key={task.id} className={`task ${task.status} ${task.color}`}><div className="task-time">{task.status === "done" ? "✓" : task.time}</div><div className="task-info"><b>{task.title}</b><span>{task.subject} · {task.duration} min · {task.due}</span></div>{task.status === "done" ? <span className="completed">DONE</span> : task.status === "active" ? <button className="finish" onClick={() => finishTask(task.id)}>Finish now ✓</button> : <button className="start" onClick={() => startTask(task.id)}>Start now →</button>}</div>)}</div>; }

function Calendar({ tasks, startTask, compact = false }: { tasks: Task[]; startTask: (id: number) => void; compact?: boolean }) {
  if (!compact) return <MonthCalendar tasks={tasks} startTask={startTask} />;
  return <section className="calendar-section"><div className="section-heading"><div><p className="eyebrow">YOUR FLOW</p><h2>This week at a glance</h2></div><div className="legend"><span><i className="school" /> School</span><span><i className="personal" /> Personal</span><span><i className="focus" /> Focus</span></div></div><div className="week">{week.map(([day, date, label]) => <div key={day} className={label ? "day today" : "day"}><b>{day}</b><span>{date}</span>{label && <em>TODAY</em>}</div>)}</div><div className="blocks"><div className="block school-block" style={{ gridColumn: "1 / span 2" }}>School <small>08:00–15:30</small></div>{tasks.filter((task) => task.status !== "done").slice(0, 4).map((task, index) => <button key={task.id} className="block focus-block" style={{ gridColumn: String(Math.min(index + 3, 7)) }} onClick={() => startTask(task.id)}>{task.title}<small>{task.time} · Start now</small></button>)}</div></section>;
}

function MonthCalendar({ tasks, startTask }: { tasks: Task[]; startTask: (id: number) => void }) {
  const scheduled: Record<number, Task[]> = { 9: tasks.filter((task) => task.status === "done").slice(0, 1), 10: tasks.filter((task) => task.status !== "done").slice(0, 1), 11: tasks.filter((task) => task.status !== "done").slice(1, 2), 12: tasks.filter((task) => task.status !== "done").slice(2, 3) };
  return <section className="calendar-section calendar-page month-page"><div className="section-heading"><div><p className="eyebrow">YOUR FLOW · MONTH VIEW</p><h2>July 2024</h2></div><div className="legend"><span><i className="school" /> School</span><span><i className="personal" /> Personal</span><span><i className="focus" /> Focus</span></div></div><div className="month-calendar"><div className="month-weekdays">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <b key={day}>{day}</b>)}</div><div className="month-grid">{monthDays.map((date, index) => <div className={`month-day ${date === 10 ? "today" : ""} ${date ? "" : "empty"}`} key={`${date}-${index}`}>{date && <><span className="month-date">{date}</span>{date === 8 && <small className="month-school">School</small>}{(scheduled[date] ?? []).map((task) => <button className={`month-task ${task.status === "done" ? "complete" : task.color}`} key={task.id} onClick={() => task.status !== "done" && startTask(task.id)}>{task.status === "done" ? "✓ " : ""}{task.title}</button>)}</>}</div>)}</div></div></section>;
}

function Analytics({ tasks, points, streak }: { tasks: Task[]; points: number; streak: number }) { const done = tasks.filter((task) => task.status === "done").length; return <section className="analytics-grid"><article className="metric-card"><small>COMPLETION RATE</small><b>{Math.round((done / tasks.length) * 100)}%</b><p>{done} tasks completed so far.</p></article><article className="metric-card"><small>POINTS EARNED</small><b>{points.toLocaleString()}</b><p>Keep completing tasks for more.</p></article><article className="metric-card"><small>BEST STREAK</small><b>{streak} days</b><p>Your momentum is growing.</p></article><article className="wide-card"><p className="eyebrow">FLOWPAL INSIGHT</p><h2>You usually finish the tasks you start.</h2><p>Use “Start now” when you begin—the app can learn how long your work really takes.</p></article></section>; }

function Shop({ points, theme, freezes, buyTheme, buyFreeze }: { points: number; theme: string; freezes: number; buyTheme: (item: typeof themes[number]) => void; buyFreeze: () => void }) { return <section><div className="shop-head"><div><p className="eyebrow">FLOWPAL SHOP</p><h2>Make your flow yours.</h2></div><div className="points-pill">✦ {points.toLocaleString()} points</div></div><div className="shop-grid">{themes.map((item) => <article className="shop-item" key={item.id}><div className="theme-swatch" style={{ background: item.color }} /><h3>{item.name}</h3><p>{item.id === theme ? "Currently active" : "Changes your dashboard accent."}</p><button className="start" disabled={item.id === theme} onClick={() => buyTheme(item)}>{item.id === theme ? "Active" : item.cost ? `${item.cost} points` : "Free"}</button></article>)}<article className="shop-item freeze-card"><div className="freeze-icon">❄</div><h3>Streak freeze</h3><p>Protect one missed day. You have {freezes}.</p><button className="start" onClick={buyFreeze}>150 points</button></article></div></section>; }

function Settings({ theme, freezes, streak, setMessage, setStreak }: { theme: string; freezes: number; streak: number; setMessage: (message: string) => void; setStreak: (value: number) => void }) { return <section className="settings-card"><p className="eyebrow">SETTINGS</p><h2>Your FlowPal setup</h2><div><b>Companion channel</b><span>LINE connected</span></div><div><b>Current theme</b><span>{theme}</span></div><div><b>Streak protection</b><span>{freezes} freeze{freezes === 1 ? "" : "s"} available</span></div><button className="outline-btn" onClick={() => { setStreak(streak + 1); setMessage("Demo check-in complete. Your streak moved up by one day."); }}>Demo daily check-in</button></section>; }
