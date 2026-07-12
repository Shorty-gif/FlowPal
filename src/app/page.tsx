"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";

type TaskStatus = "upcoming" | "active" | "done";
type Task = { id: string | number; title: string; subject: string; time: string; duration: number; due: string; dueDate?: string; color: string; status: TaskStatus };
type Tab = "Overview" | "Calendar" | "Analytics" | "Shop" | "Settings";
type ClassroomImport = { id: string; title: string; courseName: string; dueLabel: string; dueDate: string; dueTime: string; submissionState: string };
type UnavailableBlock = { id: string; title: string; days: number[]; day: number; start: string; end: string };
type CalendarEvent = { id: string; title: string; date: string; start: string; end: string };
type SchoolBreak = { id: string; title: string; startDate: string; endDate: string };
type CalendarDisplayEvent = CalendarEvent & { kind: "school" | "club" | "event" };
type PlannerSettings = { schoolName: string; schoolStart: string; schoolEnd: string; schoolDays: number[]; schoolBreaks: SchoolBreak[]; sleepTime: string; weekendSleepTime: string; weekdayLimit: number; weekendStart: string; unavailable: UnavailableBlock[]; events: CalendarEvent[]; categories: string[]; priorityTaskIds: string[] };
type ScheduledTask = { task: Task; date: Date; time: string; priority: "URGENT" | "HIGH" | "NORMAL" };

const initialTasks: Task[] = [];
const defaultPlanner: PlannerSettings = { schoolName: "My school", schoolStart: "08:00", schoolEnd: "15:30", schoolDays: [1, 2, 3, 4, 5], schoolBreaks: [], weekdayLimit: 180, sleepTime: "23:00", weekendSleepTime: "00:00", weekendStart: "10:00", unavailable: [], events: [], categories: ["Schoolwork", "Study", "Personal", "Health", "Project"], priorityTaskIds: [] };

const fallbackDate = new Date(2024, 6, 10);
const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const shortWeekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function calendarCells(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  return Array.from({ length: totalCells }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
}

function taskDueDate(task: Task) {
  if (!task.dueDate) return null;
  const [year, month, day] = task.dueDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function tasksByUrgency(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (a.status === "active") return -1;
    if (b.status === "active") return 1;
    return (taskDueDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (taskDueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER);
  });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function sleepCutoff(value: string) {
  const minutes = timeToMinutes(value);
  return minutes === 0 ? 24 * 60 : minutes;
}

function taskPriority(task: Task, today: Date): ScheduledTask["priority"] {
  const due = taskDueDate(task);
  if (!due) return "NORMAL";
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.ceil((due.getTime() - todayStart.getTime()) / 86_400_000);
  if (days <= 1) return "URGENT";
  if (days <= 3) return "HIGH";
  return "NORMAL";
}

function isSchoolDay(day: Date, settings: PlannerSettings) {
  const key = localDateKey(day);
  const onBreak = settings.schoolBreaks.some((breakPeriod) => key >= breakPeriod.startDate && key <= breakPeriod.endDate);
  return settings.schoolDays.includes(day.getDay()) && !onBreak;
}

function calendarEventsForDay(day: Date, settings: PlannerSettings): CalendarDisplayEvent[] {
  const events: CalendarDisplayEvent[] = [];
  if (isSchoolDay(day, settings)) {
    events.push({ id: `school-${localDateKey(day)}`, title: settings.schoolName || "School", date: localDateKey(day), start: settings.schoolStart, end: settings.schoolEnd, kind: "school" });
  }
  settings.unavailable.filter((block) => block.days.includes(day.getDay())).forEach((block) => {
    events.push({ id: `${block.id}-${localDateKey(day)}`, title: block.title, date: localDateKey(day), start: block.start, end: block.end, kind: "club" });
  });
  settings.events.filter((event) => event.date === localDateKey(day)).forEach((event) => {
    events.push({ ...event, kind: "event" });
  });
  return events.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

function movePastUnavailable(candidate: number, duration: number, day: Date, settings: PlannerSettings) {
  const matchingBlocks = calendarEventsForDay(day, settings);
  let start = candidate;
  for (const block of matchingBlocks) {
    const blockStart = timeToMinutes(block.start);
    const blockEnd = timeToMinutes(block.end);
    if (start < blockEnd && start + duration > blockStart) start = blockEnd;
  }
  return start;
}

function buildSchedule(tasks: Task[], today: Date, settings: PlannerSettings): ScheduledTask[] {
  const startDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const now = new Date();
  const usedMinutes = new Map<string, number>();
  const nextAvailableMinute = new Map<string, number>();
  const sessionCounts = new Map<string, number>();
  const result: ScheduledTask[] = [];
  const ordered = [...tasks].filter((task) => task.status !== "done").sort((a, b) => {
    const preferredA = settings.priorityTaskIds.indexOf(String(a.id));
    const preferredB = settings.priorityTaskIds.indexOf(String(b.id));
    if (preferredA !== -1 || preferredB !== -1) return (preferredA === -1 ? Number.MAX_SAFE_INTEGER : preferredA) - (preferredB === -1 ? Number.MAX_SAFE_INTEGER : preferredB);
    const rank = { URGENT: 0, HIGH: 1, NORMAL: 2 };
    const priorityDifference = rank[taskPriority(a, startDay)] - rank[taskPriority(b, startDay)];
    return priorityDifference || ((taskDueDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (taskDueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER));
  });

  for (const task of ordered) {
    const dueDate = taskDueDate(task);
    const latestDay = dueDate ? new Date(Math.max(startDay.getTime(), addDays(dueDate, -1).getTime())) : addDays(startDay, 7);
    let selected: Date | null = null;
    let startTime = 0;
    const tryScheduleDay = (cursor: Date) => {
      const normalStart = isSchoolDay(cursor, settings) ? Math.max(timeToMinutes(settings.schoolEnd) + 30, 16 * 60) : timeToMinutes(settings.weekendStart);
      const currentMinute = now.getHours() * 60 + now.getMinutes() + 10;
      const dayStart = sameDay(cursor, now) ? Math.max(normalStart, currentMinute) : normalStart;
      const dayEnd = sleepCutoff(isSchoolDay(cursor, settings) ? settings.sleepTime : settings.weekendSleepTime) - 30;
      const key = cursor.toISOString().slice(0, 10);
      const used = usedMinutes.get(key) ?? 0;
      const candidateStart = movePastUnavailable(nextAvailableMinute.get(key) ?? dayStart, task.duration, cursor, settings);
      if (used + task.duration <= settings.weekdayLimit && candidateStart + task.duration <= dayEnd) {
        selected = new Date(cursor);
        startTime = candidateStart;
        usedMinutes.set(key, used + task.duration);
        const count = (sessionCounts.get(key) ?? 0) + 1;
        sessionCounts.set(key, count);
        nextAvailableMinute.set(key, candidateStart + task.duration + (count % 2 === 0 ? 15 : 10));
        return true;
      }
      return false;
    };
    for (let cursor = new Date(startDay); cursor <= latestDay && !selected; cursor = addDays(cursor, 1)) {
      tryScheduleDay(cursor);
    }
    if (!selected) {
      // There was no safe slot before the deadline. Put it in the first feasible
      // future slot instead of pretending a past-time session is still possible.
      for (let cursor = addDays(latestDay, 1); !selected && cursor <= addDays(latestDay, 14); cursor = addDays(cursor, 1)) {
        tryScheduleDay(cursor);
      }
    }
    if (selected) result.push({ task, date: selected, time: minutesToTime(startTime), priority: taskPriority(task, startDay) });
  }
  return result;
}

function timeGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
const themes = [
  { id: "classic", name: "Classic pop", color: "#ffe75d", cost: 0, description: "The original FlowPal look." },
  { id: "ocean", name: "Ice pack", color: "#aee9ff", cost: 180, description: "Frosted, icy action buttons." },
  { id: "rainbow", name: "Rainbow rush", color: "#f6a8d7", cost: 280, description: "A rainbow arc behind your flow." },
  { id: "mint", name: "Mint mission", color: "#9decc2", cost: 420, description: "Emerald glow and glassy mint buttons." },
  { id: "galaxy", name: "Galaxy drift", color: "#bba8ff", cost: 520, description: "Cosmic buttons and a starry workspace." },
  { id: "tide", name: "Ocean tide", color: "#72d3ea", cost: 560, description: "Deep-sea buttons with rolling wave light." },
  { id: "beach", name: "Beach day", color: "#ffd07a", cost: 600, description: "Sunlit sand, surf, and coral buttons." },
  { id: "forest", name: "Forest club", color: "#7acb80", cost: 650, description: "Mossy buttons with a leafy-pattern background." },
  { id: "cafe", name: "Late café", color: "#d4a676", cost: 700, description: "Warm espresso buttons and paper texture." },
  { id: "mono-black", name: "Midnight mono", color: "#393939", cost: 60, description: "A sharp, affordable dark mode." },
  { id: "mono-white", name: "Studio white", color: "#f5f5f2", cost: 80, description: "A clean, affordable monochrome mode." },
  { id: "graffiti", name: "Graffiti lab", color: "#dcff42", cost: 900, description: "Neon spray-paint buttons and street-art energy." },
];

export default function Home() {
  // Start with a stable placeholder for the initial render, then use the visitor's local clock.
  const [today, setToday] = useState<Date | null>(null);
  const [tasks, setTasks] = useState(initialTasks);
  const [message, setMessage] = useState("Your plan is balanced. Keep the momentum.");
  const [tab, setTab] = useState<Tab>("Overview");
  const [points, setPoints] = useState(1320);
  const [streak, setStreak] = useState(12);
  const [freezes, setFreezes] = useState(0);
  const [theme, setTheme] = useState("classic");
  const [unlockedThemes, setUnlockedThemes] = useState<string[]>(["classic"]);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showChannel, setShowChannel] = useState(false);
  const [showPal, setShowPal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [classroomConnected, setClassroomConnected] = useState(false);
  const [planner, setPlanner] = useState<PlannerSettings>(defaultPlanner);
  const [databaseReady, setDatabaseReady] = useState(false);
  const [lineLinkCode, setLineLinkCode] = useState<string | null>(null);
  const completed = tasks.filter((task) => task.status === "done").length;
  const active = tasks.find((task) => task.status === "active");
  const totalMinutes = useMemo(() => tasks.filter((task) => task.status !== "done").reduce((sum, task) => sum + task.duration, 0), [tasks]);
  const activeTheme = themes.find((item) => item.id === theme) ?? themes[0];
  const currentDate = today ?? fallbackDate;
  const greeting = timeGreeting(currentDate);

  useEffect(() => {
    const syncDate = () => setToday(new Date());
    syncDate();
    const interval = window.setInterval(syncDate, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setShowOnboarding(!window.localStorage.getItem("flowpal-onboarding-complete"));
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("flowpal-planner-settings");
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<PlannerSettings> & { unavailable?: Array<Omit<UnavailableBlock, "days" | "day"> & { days?: number[]; day?: number }> };
      setPlanner({ ...defaultPlanner, ...parsed, unavailable: (parsed.unavailable ?? []).map((block) => ({ ...block, day: block.day ?? block.days?.[0] ?? 0, days: block.days ?? (block.day === undefined ? [] : [block.day]) })), events: parsed.events ?? [] });
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("flowpal-planner-settings", JSON.stringify(planner));
  }, [planner]);

  useEffect(() => {
    fetch("/api/flowpal/profile")
      .then((response) => response.json())
      .then((profile: { linkCode?: string }) => {
        if (profile.linkCode) setLineLinkCode(profile.linkCode);
        return fetch("/api/flowpal/tasks");
      })
      .then((response) => response.json())
      .then((data: { tasks?: Task[] }) => {
        if (data.tasks?.length) setTasks(data.tasks);
        setDatabaseReady(true);
      })
      .catch(() => setDatabaseReady(true));
  }, []);

  useEffect(() => {
    if (!databaseReady) return;
    fetch("/api/flowpal/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tasks }) }).catch(() => undefined);
  }, [tasks, databaseReady]);

  useEffect(() => {
    if (!databaseReady || !today) return;
    const sessions = buildSchedule(tasks, today, planner).map((session) => {
      const [hours, minutes] = session.time.split(":").map(Number);
      const starts = new Date(session.date.getFullYear(), session.date.getMonth(), session.date.getDate(), hours, minutes);
      const ends = new Date(starts.getTime() + session.task.duration * 60_000);
      return { title: session.task.title, startsAt: starts.toISOString(), endsAt: ends.toISOString() };
    });
    fetch("/api/flowpal/sessions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessions }) }).catch(() => undefined);
  }, [tasks, planner, today, databaseReady]);

  useEffect(() => {
    if (!databaseReady) return;
    const query = new URLSearchParams(window.location.search);
    const connectionResult = query.get("classroom");
    const connectionReason = query.get("reason");
    if (connectionResult === "error") setMessage(connectionReason ? `Google Classroom couldn’t connect: ${connectionReason}` : "Google Classroom couldn’t connect. Check the setup details and try again.");
    if (connectionResult === "setup") setMessage("Google Classroom needs its Google Cloud keys first. Follow the setup steps in README.md, then try again.");
    if (connectionResult) window.history.replaceState({}, "", window.location.pathname);

    fetch("/api/google/classroom")
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (!ok || !data.connected) return;
        const colors = ["yellow", "purple", "blue", "green"];
        const imported = (data.assignments as ClassroomImport[]).map((assignment, index) => ({
          id: assignment.id,
          title: assignment.title,
          subject: "Schoolwork",
          // A Classroom due time is a deadline, not a study-session start time.
          time: "16:00",
          duration: 45,
          due: `${assignment.dueLabel}${assignment.dueTime ? ` · due ${assignment.dueTime}` : ""}`,
          dueDate: assignment.dueDate,
          color: colors[index % colors.length],
          status: assignment.submissionState === "TURNED_IN" ? "done" as const : "upcoming" as const,
        }));
        setTasks((existing) => [...existing, ...imported.filter((task) => !existing.some((current) => current.id === task.id))]);
        setClassroomConnected(true);
        if (connectionResult === "connected") setMessage(`${imported.length} Google Classroom assignment${imported.length === 1 ? "" : "s"} added to your FlowPal plan.`);
      })
      .catch(() => undefined);
  }, [databaseReady]);

  function startTask(id: Task["id"]) {
    setTasks((all) => all.map((task) => ({ ...task, status: task.id === id ? "active" : task.status === "active" ? "upcoming" : task.status })));
    const task = tasks.find((item) => item.id === id);
    if (task) setMessage(`Timer started for ${task.title}. Send “Finish ${task.subject}” to FlowPal when you’re done.`);
  }
  function finishTask(id: Task["id"]) {
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
    if (unlockedThemes.includes(item.id)) {
      setTheme(item.id);
      setPreviewTheme(null);
      return setMessage(`${item.name} equipped. Your collection stays yours forever.`);
    }
    if (points < item.cost) return setMessage(`You need ${item.cost - points} more points for ${item.name}.`);
    setPoints((value) => value - item.cost);
    setUnlockedThemes((all) => [...all, item.id]);
    setTheme(item.id);
    setPreviewTheme(null);
    setMessage(`${item.name} unlocked and equipped. You can switch back to it anytime for free.`);
  }
  function buyFreeze() {
    const cost = 150;
    if (points < cost) return setMessage(`You need ${cost - points} more points for a streak freeze.`);
    setPoints((value) => value - cost);
    setFreezes((value) => value + 1);
    setMessage("Streak freeze added. It will protect one missed day.");
  }
  function logOut() {
    fetch("/api/google/logout", { method: "POST" }).catch(() => undefined);
    window.localStorage.removeItem("flowpal-planner-settings");
    setTasks([]);
    setPlanner(defaultPlanner);
    setClassroomConnected(false);
    setTab("Overview");
    setMessage("Signed out locally.");
  }

  const navItems: Tab[] = ["Overview", "Calendar", "Analytics", "Shop", "Settings"];
  return <main className={`theme-${previewTheme ?? theme} ${previewTheme ? "is-previewing" : ""}`} style={{ "--accent": activeTheme.color } as React.CSSProperties}>
    <aside className="sidebar">
      <button className="brand" onClick={() => setTab("Overview")}><span>✦</span> FLOWPAL</button>
      <p className="brand-sub">STAY IN FLOW.</p>
      <nav>{navItems.map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? "nav-item selected" : "nav-item"}><span>{item === "Overview" ? "▦" : item === "Calendar" ? "▣" : item === "Analytics" ? "↗" : item === "Shop" ? "✦" : "⚙"}</span>{item}</button>)}</nav>
      <div className="companion"><div className="spark">✦</div><b>PAL · YOUR COMPANION</b><p>Ask about your plan or reschedule.</p><button className="tiny-button" onClick={() => setShowPal(true)}>Talk to Pal ↗</button></div>
      <button className="profile" onClick={() => setTab("Settings")}><div className="avatar">S</div><div><b>Souto</b><small>Level 8 · {points.toLocaleString()} points</small></div><span>⌄</span></button><button className="logout-btn" onClick={logOut}>Log out</button>
    </aside>
    <section className="content" id="top">
      <header><div><p className="eyebrow">{weekdayFormatter.format(currentDate).toUpperCase()}</p><h1>{tab === "Overview" ? `${greeting}, Souto` : tab} <span>✦</span></h1><p className="muted">{tab === "Overview" ? "Here’s your plan for today." : `Your ${tab.toLowerCase()} is ready.`}</p></div><button className="outline-btn" onClick={() => setShowAdd(true)}>＋ Add task</button></header>
      <div className="notice"><span>✦</span><p>{message}</p><button aria-label="Dismiss notice" onClick={() => setMessage("Your plan is balanced. Keep the momentum.")}>×</button></div>
      {tab === "Overview" && <Overview tasks={tasks} completed={completed} totalMinutes={totalMinutes} active={active} streak={streak} freezes={freezes} points={points} startTask={startTask} finishTask={finishTask} setTab={setTab} date={currentDate} planner={planner} setPlanner={setPlanner} />}
      {tab === "Calendar" && <Calendar tasks={tasks} startTask={startTask} date={currentDate} planner={planner} setPlanner={setPlanner} />}
      {tab === "Analytics" && <Analytics tasks={tasks} points={points} streak={streak} />}
      {tab === "Shop" && <Shop points={points} theme={theme} previewTheme={previewTheme} unlockedThemes={unlockedThemes} freezes={freezes} buyTheme={buyTheme} buyFreeze={buyFreeze} setPreviewTheme={setPreviewTheme} />}
      {tab === "Settings" && <><button className="outline-btn" onClick={() => { window.localStorage.removeItem("flowpal-onboarding-complete"); setShowOnboarding(true); }}>Run setup again ↗</button><SchoolScheduleSettings planner={planner} setPlanner={setPlanner} /><RecurringAvailabilitySettings planner={planner} setPlanner={setPlanner} /><CategorySettings planner={planner} setPlanner={setPlanner} /><Settings theme={activeTheme.name} freezes={freezes} streak={streak} classroomConnected={classroomConnected} planner={planner} setPlanner={setPlanner} setMessage={setMessage} setStreak={setStreak} lineLinkCode={lineLinkCode} /></>}
    </section>
    {showAdd && <div className="modal-backdrop"><form className="modal" onSubmit={addTask}><div className="modal-top"><h2>Add a task</h2><button type="button" onClick={() => setShowAdd(false)}>×</button></div><label>Task name<input name="title" placeholder="e.g. Review SAT vocabulary" autoFocus /></label><label>Category<select name="subject" defaultValue={planner.categories[0]}>{planner.categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><div className="form-row"><label>Time<input name="time" type="time" defaultValue="18:00" /></label><label>Minutes<input name="duration" type="number" min="5" defaultValue="30" /></label></div><button className="primary-btn" type="submit">Add to my plan →</button></form></div>}
    {showChannel && <div className="modal-backdrop"><div className="modal"><div className="modal-top"><h2>Your companion</h2><button onClick={() => setShowChannel(false)}>×</button></div><p>LINE is connected. Discord and WhatsApp are coming next.</p><button className="primary-btn" onClick={() => { setShowChannel(false); setMessage("LINE is your active FlowPal companion."); }}>Keep LINE connected</button></div></div>}
    {showPal && <PalChat tasks={tasks} date={currentDate} planner={planner} setPlanner={setPlanner} onClose={() => setShowPal(false)} />}
    {showOnboarding && <Onboarding planner={planner} setPlanner={setPlanner} onComplete={() => { window.localStorage.setItem("flowpal-onboarding-complete", "true"); setShowOnboarding(false); setMessage("Your FlowPal schedule is ready."); }} />}
  </main>;
}

function Onboarding({ planner, setPlanner, onComplete }: { planner: PlannerSettings; setPlanner: (settings: PlannerSettings) => void; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [activity, setActivity] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("19:00");
  const toggleDay = (day: number) => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  const addActivity = () => {
    if (!activity.trim() || !days.length || end <= start) return;
    setPlanner({ ...planner, unavailable: [...planner.unavailable, { id: String(Date.now()), title: activity.trim(), days, day: days[0], start, end }] });
    setActivity(""); setDays([]);
  };
  const connectClassroom = () => { onComplete(); window.location.assign("/api/google/classroom/connect"); };
  return <div className="modal-backdrop"><section className="modal onboarding"><p className="eyebrow">WELCOME TO FLOWPAL · {step + 1}/3</p>{step === 0 && <><h2>Build your flow.</h2><p>Tell FlowPal when school and sleep happen.</p><label>School name<input value={planner.schoolName} onChange={(event) => setPlanner({ ...planner, schoolName: event.target.value })} /></label><div className="form-row"><label>School starts<input type="time" value={planner.schoolStart} onChange={(event) => setPlanner({ ...planner, schoolStart: event.target.value })} /></label><label>School ends<input type="time" value={planner.schoolEnd} onChange={(event) => setPlanner({ ...planner, schoolEnd: event.target.value })} /></label></div><div className="form-row"><label>School-night sleep<input type="time" value={planner.sleepTime} onChange={(event) => setPlanner({ ...planner, sleepTime: event.target.value })} /></label><label>Weekend sleep<input type="time" value={planner.weekendSleepTime} onChange={(event) => setPlanner({ ...planner, weekendSleepTime: event.target.value })} /></label></div><button className="primary-btn" onClick={() => setStep(1)}>Next →</button></>}{step === 1 && <><h2>Protect your time.</h2><p>Add anything FlowPal should schedule around.</p><label>Activity<input value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="Basketball practice" /></label><div className="form-row"><label>Starts<input type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Ends<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div><div className="day-checkboxes">{weekdayNames.map((day, index) => <label key={day}><input type="checkbox" checked={days.includes(index)} onChange={() => toggleDay(index)} />{day.slice(0, 3)}</label>)}</div><button className="outline-btn" onClick={addActivity}>Add activity</button><div className="onboarding-actions"><button className="outline-btn" onClick={() => setStep(0)}>← Back</button><button className="primary-btn" onClick={() => setStep(2)}>Next →</button></div></>}{step === 2 && <><h2>Connect your assignments.</h2><p>Google Classroom imports your open schoolwork into this plan. You can also do this later in Settings.</p><div className="onboarding-actions"><button className="outline-btn" onClick={() => setStep(1)}>← Back</button><button className="outline-btn" onClick={onComplete}>Skip for now</button><button className="primary-btn" onClick={connectClassroom}>Connect Classroom →</button></div></>}</section></div>;
}

function Overview({ tasks, completed, totalMinutes, active, streak, freezes, points, startTask, finishTask, setTab, date, planner, setPlanner }: { tasks: Task[]; completed: number; totalMinutes: number; active?: Task; streak: number; freezes: number; points: number; startTask: (id: Task["id"]) => void; finishTask: (id: Task["id"]) => void; setTab: (tab: Tab) => void; date: Date; planner: PlannerSettings; setPlanner: (settings: PlannerSettings) => void }) {
  const orderedTasks = tasksByUrgency(tasks);
  const nextTask = orderedTasks.find((task) => task.status !== "done");
  return <><section className="top-grid"><article className="card progress-card"><div className="card-label">WEEKLY PROGRESS <span>↗</span></div><div className="progress-number">{completed}<small>/{Math.max(tasks.length, 1)}</small></div><div className="progress-track"><i style={{ width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%` }} /></div><p>{tasks.length ? `${tasks.length - completed} tasks left this week` : "Connect Classroom or add your first task"}</p></article><article className="card streak-card"><div className="flame" aria-label="Animated streak flame"><svg viewBox="0 0 100 130" role="img" aria-hidden="true"><g className="flame-shape"><path className="flame-yellow" d="M50 5C44 31 26 38 17 58 3 89 23 120 51 125 81 130 96 106 91 82c-3-15-10-23-17-32-5 8-11 14-19 17 9-29-7-47-5-62Z" /><path className="flame-gold" d="M49 16c-2 28-24 38-26 64-1 22 13 38 30 44-17-14-19-35-10-54 8-16 17-24 21-40-5-6-10-10-15-14Z" /><path className="flame-red" d="M50 74c-7 10-18 21-18 35 0 13 9 22 21 22s20-9 20-21c0-15-14-29-23-36Z" /><path className="flame-orange" d="M50 84c-5 8-10 16-10 25 0 11 6 18 14 21-4-10-1-20 5-29-3-6-6-12-9-17Z" /></g></svg></div><div><div className="card-label">CURRENT STREAK</div><strong>{streak} days</strong><p>{freezes ? `${freezes} streak freeze${freezes > 1 ? "s" : ""} ready` : "Keep it going!"}</p></div></article><article className="card workload-card"><div className="card-label">WORKLOAD LEFT</div><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong><p>across {tasks.filter((t) => t.status !== "done").length} sessions · {points.toLocaleString()} points</p><div className="mini-bars"><i /><i /><i /><i /></div></article></section>
    <section className="main-grid"><article className="tasks-panel"><div className="section-heading"><div><p className="eyebrow">TODAY’S PLAN</p><h2>{active ? "You’re in focus mode." : tasks.length ? "Small wins. One great day." : "Your clean slate starts here."}</h2></div><button className="link-btn" onClick={() => setTab("Calendar")}>View calendar →</button></div><TaskList tasks={orderedTasks} startTask={startTask} finishTask={finishTask} /></article><aside className="right-stack"><article className="ai-card"><div className="ai-title"><span>✦</span><b>FLOW INSIGHT</b></div><h3>{nextTask ? `Start ${nextTask.title} and keep your flow moving.` : "Bring your real work into FlowPal."}</h3><p>{nextTask ? "This is your most urgent unfinished task, based on its due date." : "Connect Google Classroom in Settings or add a personal task to make your first plan."}</p><button onClick={() => nextTask ? startTask(nextTask.id) : setTab("Settings")}>{nextTask ? "Start next task →" : "Open Settings →"}</button></article><button className="line-card" onClick={() => setTab("Shop")}><div className="line-dot">SHOP</div><div><b>Spend your points</b><p>Get themes and streak freezes</p></div><span>↗</span></button></aside></section>
    <Calendar tasks={tasks} startTask={startTask} date={date} planner={planner} setPlanner={setPlanner} compact /></>;
}

function TaskList({ tasks, startTask, finishTask }: { tasks: Task[]; startTask: (id: Task["id"]) => void; finishTask: (id: Task["id"]) => void }) { return <div className="task-list">{tasks.length === 0 ? <div className="empty-tasks"><b>No tasks yet.</b><span>Your real assignments will appear here after a Google Classroom refresh.</span></div> : tasks.map((task) => <div key={task.id} className={`task ${task.status} ${task.color}`}><div className="task-time">{task.status === "done" ? "✓" : task.time}</div><div className="task-info"><b>{task.title}</b><span>{task.subject} · {task.duration} min · {task.due}</span></div>{task.status === "done" ? <span className="completed">DONE</span> : task.status === "active" ? <button className="finish" onClick={() => finishTask(task.id)}>Finish now ✓</button> : <button className="start" onClick={() => startTask(task.id)}>Start now →</button>}</div>)}</div>; }

function Calendar({ tasks, startTask, date, planner, setPlanner, compact = false }: { tasks: Task[]; startTask: (id: Task["id"]) => void; date: Date; planner: PlannerSettings; setPlanner: (settings: PlannerSettings) => void; compact?: boolean }) {
  const schedule = buildSchedule(tasks, date, planner);
  if (!compact) return <CalendarViews tasks={tasks} startTask={startTask} date={date} planner={planner} setPlanner={setPlanner} schedule={schedule} />;
  return <DayTimeline schedule={schedule} day={date} events={calendarEventsForDay(date, planner)} startTask={startTask} overview />;
}

function CalendarViews({ tasks, startTask, date, planner, setPlanner, schedule }: { tasks: Task[]; startTask: (id: Task["id"]) => void; date: Date; planner: PlannerSettings; setPlanner: (settings: PlannerSettings) => void; schedule: ScheduledTask[] }) {
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [focusDate, setFocusDate] = useState(date);
  const monday = addDays(focusDate, -((focusDate.getDay() + 6) % 7));
  const step = view === "week" ? 7 : 1;
  return <section className="calendar-views"><div className="calendar-view-bar"><div className="view-switcher" aria-label="Calendar view"><button className={view === "month" ? "selected" : ""} onClick={() => setView("month")}>Month</button><button className={view === "week" ? "selected" : ""} onClick={() => setView("week")}>Week</button><button className={view === "day" ? "selected" : ""} onClick={() => setView("day")}>Day</button></div>{view !== "month" && <div className="view-navigation"><button className="outline-btn" onClick={() => setFocusDate((current) => addDays(current, -step))}>←</button><button className="outline-btn" onClick={() => setFocusDate(date)}>Today</button><button className="outline-btn" onClick={() => setFocusDate((current) => addDays(current, step))}>→</button></div>}</div>{view === "month" && <MonthCalendar tasks={tasks} startTask={startTask} date={date} planner={planner} setPlanner={setPlanner} schedule={schedule} />}{view === "week" && <section className="week-view"><p className="eyebrow">WEEK PLAN</p><h2>Week of {monthFormatter.format(monday)}</h2><div className="week-view-grid">{Array.from({ length: 7 }, (_, index) => { const day = addDays(monday, index); const sessions = schedule.filter((item) => sameDay(item.date, day)); const events = calendarEventsForDay(day, planner); return <article key={day.toISOString()} className={sameDay(day, date) ? "week-day-card today" : "week-day-card"}><b>{shortWeekdayFormatter.format(day)} {day.getDate()}</b>{events.map((event) => <span className={`month-event ${event.kind}`} key={event.id}>{event.start} {event.title}</span>)}{sessions.length ? sessions.map((item) => <button className="month-task" key={item.task.id} onClick={() => startTask(item.task.id)}>{item.time} · {item.task.title}</button>) : <small>Open</small>}</article>; })}</div></section>}{view === "day" && <DayTimeline schedule={schedule} day={focusDate} events={calendarEventsForDay(focusDate, planner)} startTask={startTask} />}</section>;
}

function MonthCalendar({ tasks, startTask, date, planner, setPlanner, schedule }: { tasks: Task[]; startTask: (id: Task["id"]) => void; date: Date; planner: PlannerSettings; setPlanner: (settings: PlannerSettings) => void; schedule: ScheduledTask[] }) {
  const [viewMonth, setViewMonth] = useState(() => new Date(date.getFullYear(), date.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(date);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("16:00");
  const [eventEnd, setEventEnd] = useState("18:00");
  const cells = calendarCells(viewMonth);
  const eventsForSelectedDay = calendarEventsForDay(selectedDay, planner);
  const addEvent = () => {
    if (!eventTitle.trim() || eventEnd <= eventStart) return;
    setPlanner({ ...planner, events: [...planner.events, { id: String(Date.now()), title: eventTitle.trim(), date: localDateKey(selectedDay), start: eventStart, end: eventEnd }] });
    setEventTitle("");
  };
  return <section className="calendar-section calendar-page month-page"><div className="section-heading"><div><p className="eyebrow">YOUR FLOW · MONTH VIEW</p><h2>{monthFormatter.format(viewMonth)}</h2></div><div className="month-controls"><button className="outline-btn" onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>←</button><button className="outline-btn" onClick={() => { setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelectedDay(date); }}>Today</button><button className="outline-btn" onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>→</button></div></div><div className="month-calendar"><div className="month-weekdays">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <b key={day}>{day}</b>)}</div><div className="month-grid">{cells.map((dayNumber, index) => { const cellDate = dayNumber ? new Date(viewMonth.getFullYear(), viewMonth.getMonth(), dayNumber) : null; const planned = cellDate ? schedule.filter((item) => sameDay(item.date, cellDate)) : []; const events = cellDate ? calendarEventsForDay(cellDate, planner) : []; return <button className={`month-day ${cellDate && sameDay(cellDate, date) ? "today" : ""} ${cellDate && sameDay(cellDate, selectedDay) ? "selected-day" : ""} ${cellDate ? "" : "empty"}`} key={`${dayNumber}-${index}`} disabled={!cellDate} onClick={() => cellDate && setSelectedDay(cellDate)}>{cellDate && <><span className="month-date">{dayNumber}</span>{sameDay(cellDate, date) && <small className="month-school">Today</small>}{events.slice(0, 2).map((event) => <span className={`month-event ${event.kind}`} key={event.id}>{event.title}</span>)}{planned.slice(0, 1).map(({ task }) => <span className={`month-task ${task.color}`} key={task.id}>{task.title}</span>)}</>}</button>; })}</div></div><DayTimeline schedule={schedule} day={selectedDay} events={eventsForSelectedDay} startTask={startTask} /><section className="event-form"><p className="eyebrow">ADD TO CALENDAR</p><h3>Add a one-time event</h3><p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(selectedDay)}</p><div className="planner-row"><label>Event<input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Basketball game" /></label><label>Starts<input type="time" value={eventStart} onChange={(event) => setEventStart(event.target.value)} /></label><label>Ends<input type="time" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} /></label></div><button className="primary-btn" onClick={addEvent}>Add event →</button></section></section>;
}

function DayTimeline({ schedule, day, events = [], startTask, overview = false }: { schedule: ScheduledTask[]; day: Date; events?: CalendarDisplayEvent[]; startTask: (id: Task["id"]) => void; overview?: boolean }) {
  const planned = schedule.filter((item) => sameDay(item.date, day));
  const dayTitle = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(day);
  const items = [...events.map((event) => ({ type: "event" as const, id: event.id, at: timeToMinutes(event.start), event })), ...planned.map((session) => ({ type: "task" as const, id: String(session.task.id), at: timeToMinutes(session.time), session }))].sort((a, b) => a.at - b.at);
  const showNow = sameDay(day, new Date());
  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nextItemIndex = items.findIndex((item) => item.at >= currentMinutes);
  const markerIndex = showNow ? (nextItemIndex === -1 ? items.length : nextItemIndex) : -1;
  const nowMarker = <div className="now-marker"><span>NOW</span><i /><small>{minutesToTime(currentMinutes)}</small></div>;
  return <section className={`day-timeline ${overview ? "overview-timeline" : ""}`}><div className="section-heading"><div><p className="eyebrow">DAY PLAN</p><h2>{overview ? "Today’s schedule" : dayTitle}</h2></div><span className="timeline-note">{overview ? "Built from deadlines, school, clubs, and your availability" : "This timeline includes school, clubs, events, and planned work"}</span></div>{items.length ? <div className="timeline-list">{items.map((item, index) => <Fragment key={`${item.type}-${item.id}`}>{markerIndex === index && nowMarker}{item.type === "event" ? <article className={`timeline-task calendar-event ${item.event.kind}`}><time>{item.event.start}</time><div><b>{item.event.title}</b><span>{item.event.kind === "school" ? `School · until ${item.event.end}` : item.event.kind === "club" ? `Recurring activity · until ${item.event.end}` : `Unavailable until ${item.event.end}`}</span></div></article> : <article className="timeline-task"><time>{item.session.time}</time><div><b>{item.session.task.title}</b><span><i className={`priority ${item.session.priority.toLowerCase()}`}>{item.session.priority}</i>{item.session.task.subject} · {item.session.task.duration} min · {item.session.task.due}</span></div><button className="start" onClick={() => startTask(item.session.task.id)}>Start now →</button></article>}</Fragment>)}{markerIndex === items.length && nowMarker}</div> : <div className="empty-tasks">{showNow && nowMarker}<b>{events.length ? "No study sessions around these blocks." : "No study sessions planned."}</b><span>Choose another date or add a task.</span></div>}</section>;
}

function PalChat({ tasks, date, planner, setPlanner, onClose }: { tasks: Task[]; date: Date; planner: PlannerSettings; setPlanner: (settings: PlannerSettings) => void; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([{ role: "pal", text: "Hey, I’m Pal. Ask me anything about your schedule or deadlines—or tell me what you want to do first and I’ll make space for it." }]);
  const schedule = buildSchedule(tasks, date, planner);
  const localReply = (text: string) => {
    const lower = text.toLowerCase();
    let reply = "I’m not that smart yet—but I can help with your FlowPal plan. Try asking what to do next, when you’re free, asking for a break, or telling me which task you want first.";
    if (lower.includes("break") || lower.includes("don’t feel") || lower.includes("dont feel")) {
      const minutes = Number(lower.match(/\d+/)?.[0] ?? 30);
      const next = schedule.find((item) => sameDay(item.date, date));
      const start = next?.time ?? "16:00";
      const end = minutesToTime(timeToMinutes(start) + minutes);
      setPlanner({ ...planner, events: [...planner.events, { id: String(Date.now()), title: "Pal break", date: localDateKey(date), start, end }] });
      reply = `Okay — I blocked ${minutes} minutes for you before your next session and rebuilt today’s plan. When you’re ready, we’ll pick it back up.`;
    } else if (lower.includes("first") || lower.includes("prioritize")) {
      const match = tasks.filter((task) => task.status !== "done").find((task) => lower.includes(task.title.toLowerCase()) || task.title.toLowerCase().split(" ").some((word) => word.length > 3 && lower.includes(word)));
      if (match) {
        setPlanner({ ...planner, priorityTaskIds: [String(match.id), ...planner.priorityTaskIds.filter((id) => id !== String(match.id))] });
        reply = `Got it. I moved “${match.title}” to the front of your plan and will schedule the other work around it.`;
      } else reply = "Tell me the assignment name you want first, and I’ll move it ahead of the rest.";
    } else if (lower.includes("what should") || lower.includes("next") || lower.includes("deadline")) {
      const next = schedule[0];
      reply = next ? `Your best next move is “${next.task.title}” at ${next.time}. It is marked ${next.priority.toLowerCase()} because ${next.task.due.toLowerCase()}.` : "You’re clear right now. Add a task or refresh Google Classroom and I’ll make a plan.";
    } else if (lower.includes("free") || lower.includes("when")) {
      reply = `Your current rules leave study space after ${planner.schoolEnd} on weekdays and after ${planner.weekendStart} on weekends, ending before ${planner.sleepTime}.`;
    }
    return reply;
  };
  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const fallback = localReply(text);
    setMessages((all) => [...all, { role: "you", text }]);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/pal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: {
            today: weekdayFormatter.format(date),
            school: `${planner.schoolName}, ${planner.schoolStart}–${planner.schoolEnd}`,
            sleepTime: planner.sleepTime,
            events: calendarEventsForDay(date, planner).map((event) => `${event.start}–${event.end} ${event.title}`),
            plannedWork: schedule.map((item) => `${weekdayFormatter.format(item.date)} ${item.time}: ${item.task.title} (${item.priority}, ${item.task.due})`),
            tasks: tasks.filter((task) => task.status !== "done").map((task) => `${task.title} — ${task.subject}, ${task.duration} min, ${task.due}`),
          },
        }),
      });
      const data = await response.json() as { reply?: string };
      setMessages((all) => [...all, { role: "pal", text: data.reply || fallback }]);
    } catch {
      setMessages((all) => [...all, { role: "pal", text: fallback }]);
    } finally {
      setLoading(false);
    }
  };
  return <div className="modal-backdrop"><div className="modal pal-chat" style={{ width: "min(560px, calc(100vw - 32px))", maxHeight: "78vh", display: "flex", flexDirection: "column", gap: 14 }}><div className="modal-top"><div><p className="eyebrow">FLOWPAL COMPANION</p><h2>Talk to Pal</h2></div><button onClick={onClose}>×</button></div><div className="pal-messages" style={{ display: "grid", gap: 10, overflowY: "auto", padding: "4px 2px", minHeight: 220 }}>{messages.map((message, index) => <p className={message.role} key={index} style={{ margin: 0, maxWidth: "86%", justifySelf: message.role === "you" ? "end" : "start", padding: "10px 12px", border: "2px solid #181818", borderRadius: message.role === "you" ? "14px 14px 3px 14px" : "14px 14px 14px 3px", background: message.role === "you" ? "#ffe75d" : "#eef1ff", fontSize: 13, lineHeight: 1.4, boxShadow: "2px 2px 0 #181818" }}>{message.text}</p>)}{loading && <p className="pal" style={{ margin: 0, width: "fit-content", padding: "10px 12px", border: "2px solid #181818", borderRadius: "14px 14px 14px 3px", background: "#eef1ff" }}>Pal is thinking…</p>}</div><div className="pal-prompts" style={{ display: "flex", flexWrap: "wrap", gap: 7 }}><button className="outline-btn" onClick={() => setInput("What should I do next?")}>What should I do?</button><button className="outline-btn" onClick={() => setInput("I need a 30 min break")}>I need a break</button></div><form style={{ display: "flex", gap: 8 }} onSubmit={(event) => { event.preventDefault(); send(); }}><input style={{ flex: 1, minWidth: 0, border: "2px solid #181818", borderRadius: 6, padding: "10px", font: "inherit" }} value={input} onChange={(event) => setInput(event.target.value)} placeholder="e.g. I want to do homework 6.4 first" autoFocus /><button className="primary-btn" type="submit" disabled={loading}>{loading ? "Thinking…" : "Send →"}</button></form></div></div>;
}

function Analytics({ tasks, points, streak }: { tasks: Task[]; points: number; streak: number }) { const done = tasks.filter((task) => task.status === "done").length; return <section className="analytics-grid"><article className="metric-card"><small>COMPLETION RATE</small><b>{Math.round((done / tasks.length) * 100)}%</b><p>{done} tasks completed so far.</p></article><article className="metric-card"><small>POINTS EARNED</small><b>{points.toLocaleString()}</b><p>Keep completing tasks for more.</p></article><article className="metric-card"><small>BEST STREAK</small><b>{streak} days</b><p>Your momentum is growing.</p></article><article className="wide-card"><p className="eyebrow">FLOWPAL INSIGHT</p><h2>You usually finish the tasks you start.</h2><p>Use “Start now” when you begin—the app can learn how long your work really takes.</p></article></section>; }

function Shop({ points, theme, previewTheme, unlockedThemes, freezes, buyTheme, buyFreeze, setPreviewTheme }: { points: number; theme: string; previewTheme: string | null; unlockedThemes: string[]; freezes: number; buyTheme: (item: typeof themes[number]) => void; buyFreeze: () => void; setPreviewTheme: (theme: string | null) => void }) { const preview = themes.find((item) => item.id === (previewTheme ?? theme)) ?? themes[0]; return <section><div className="shop-head"><div><p className="eyebrow">FLOWPAL SHOP · {unlockedThemes.length}/{themes.length} UNLOCKED</p><h2>Make your flow yours.</h2></div><div className="points-pill">✦ {points.toLocaleString()} points</div></div><div className="theme-preview" style={{ "--preview": preview.color } as React.CSSProperties}><span>THEME PREVIEW</span><b>{preview.name}</b><i>Hover an unlock button to preview it here.</i></div><div className="shop-grid" onMouseLeave={() => setPreviewTheme(null)}>{themes.map((item) => { const unlocked = unlockedThemes.includes(item.id); return <article className={`shop-item ${item.id}-item`} key={item.id}><div className="theme-swatch" style={{ background: item.color }} /><h3>{item.name}</h3><p>{item.id === theme ? "Currently active" : item.description}</p><button className="start" disabled={item.id === theme} onMouseEnter={() => setPreviewTheme(item.id)} onFocus={() => setPreviewTheme(item.id)} onBlur={() => setPreviewTheme(null)} onClick={() => buyTheme(item)}>{item.id === theme ? "Equipped" : unlocked ? "Switch for free" : item.cost ? `Unlock · ${item.cost} ✦` : "Free"}</button></article>; })}<article className="shop-item freeze-card"><div className="freeze-icon">❄</div><h3>Streak freeze</h3><p>Protect one missed day. You have {freezes}.</p><button className="start" onClick={buyFreeze}>150 points</button></article></div></section>; }

function CategorySettings({ planner, setPlanner }: { planner: PlannerSettings; setPlanner: (settings: PlannerSettings) => void }) {
  const [category, setCategory] = useState("");
  const addCategory = () => {
    const clean = category.trim();
    if (!clean || planner.categories.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
    setPlanner({ ...planner, categories: [...planner.categories, clean] });
    setCategory("");
  };
  return <section className="category-settings"><p className="eyebrow">TASK CATEGORIES</p><h2>Make your own categories.</h2><div className="category-chips">{planner.categories.map((item) => <span key={item}>{item}{!defaultPlanner.categories.includes(item) && <button onClick={() => setPlanner({ ...planner, categories: planner.categories.filter((category) => category !== item) })}>×</button>}</span>)}</div><div className="category-add"><input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. SAT prep" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCategory(); } }} /><button className="outline-btn" onClick={addCategory}>Add category</button></div></section>;
}

function SchoolScheduleSettings({ planner, setPlanner }: { planner: PlannerSettings; setPlanner: (settings: PlannerSettings) => void }) {
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const toggleSchoolDay = (day: number) => setPlanner({ ...planner, schoolDays: planner.schoolDays.includes(day) ? planner.schoolDays.filter((item) => item !== day) : [...planner.schoolDays, day].sort() });
  const addBreak = () => {
    if (!breakStart || !breakEnd || breakEnd < breakStart) return;
    setPlanner({ ...planner, schoolBreaks: [...planner.schoolBreaks, { id: String(Date.now()), title: "School break", startDate: breakStart, endDate: breakEnd }] });
    setBreakStart("");
    setBreakEnd("");
  };
  return <section className="category-settings school-schedule"><p className="eyebrow">SCHOOL & SLEEP</p><h2>When are you available?</h2><label>School name<input value={planner.schoolName} onChange={(event) => setPlanner({ ...planner, schoolName: event.target.value })} placeholder="My school" /></label><div className="planner-row"><label>School starts<input type="time" value={planner.schoolStart} onChange={(event) => setPlanner({ ...planner, schoolStart: event.target.value })} /></label><label>School ends<input type="time" value={planner.schoolEnd} onChange={(event) => setPlanner({ ...planner, schoolEnd: event.target.value })} /></label></div><div className="day-checkboxes">{weekdayNames.map((day, index) => <label key={day}><input type="checkbox" checked={planner.schoolDays.includes(index)} onChange={() => toggleSchoolDay(index)} />{day}</label>)}</div><div className="planner-row"><label>Sleep on school nights<input type="time" value={planner.sleepTime} onChange={(event) => setPlanner({ ...planner, sleepTime: event.target.value })} /></label><label>Sleep on non-school nights<input type="time" value={planner.weekendSleepTime} onChange={(event) => setPlanner({ ...planner, weekendSleepTime: event.target.value })} /></label></div><div className="planner-row"><label>Break starts<input type="date" value={breakStart} onChange={(event) => setBreakStart(event.target.value)} /></label><label>Break ends<input type="date" value={breakEnd} onChange={(event) => setBreakEnd(event.target.value)} /></label></div><button className="outline-btn" onClick={addBreak}>Add break</button>{planner.schoolBreaks.length > 0 && <div className="block-list">{planner.schoolBreaks.map((breakPeriod) => <div key={breakPeriod.id}><span><b>{breakPeriod.title}</b> · {breakPeriod.startDate}–{breakPeriod.endDate}</span><button aria-label="Delete school break" onClick={() => setPlanner({ ...planner, schoolBreaks: planner.schoolBreaks.filter((item) => item.id !== breakPeriod.id) })}>×</button></div>)}</div>}</section>;
}

function RecurringAvailabilitySettings({ planner, setPlanner }: { planner: PlannerSettings; setPlanner: (settings: PlannerSettings) => void }) {
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("19:00");
  const toggleDay = (day: number) => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  const addBlock = () => {
    if (!title.trim() || days.length === 0 || end <= start) return;
    setPlanner({ ...planner, unavailable: [...planner.unavailable, { id: String(Date.now()), title: title.trim(), days, day: days[0], start, end }] });
    setTitle("");
    setDays([]);
  };
  return <section className="category-settings"><p className="eyebrow">RECURRING BLOCKS</p><h2>Clubs & activities</h2><div className="planner-row"><label>Activity<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Basketball practice" /></label><label>Starts<input type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Ends<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div><div className="day-checkboxes">{weekdayNames.map((day, index) => <label key={day}><input type="checkbox" checked={days.includes(index)} onChange={() => toggleDay(index)} />{day}</label>)}</div><button className="primary-btn" onClick={addBlock}>Add block →</button>{planner.unavailable.length > 0 && <div className="block-list">{planner.unavailable.map((block) => <div key={block.id}><span><b>{block.title}</b> · {block.days.map((day) => weekdayNames[day].slice(0, 3)).join(", ")} · {block.start}–{block.end}</span><button aria-label={`Delete ${block.title}`} onClick={() => setPlanner({ ...planner, unavailable: planner.unavailable.filter((item) => item.id !== block.id) })}>×</button></div>)}</div>}</section>;
}

function Settings({ theme, freezes, streak, classroomConnected, planner, setPlanner, setMessage, setStreak, lineLinkCode }: { theme: string; freezes: number; streak: number; classroomConnected: boolean; planner: PlannerSettings; setPlanner: (settings: PlannerSettings) => void; setMessage: (message: string) => void; setStreak: (value: number) => void; lineLinkCode: string | null }) {
  const [blockTitle, setBlockTitle] = useState("");
  const [blockDay, setBlockDay] = useState(1);
  const [blockStart, setBlockStart] = useState("17:00");
  const [blockEnd, setBlockEnd] = useState("19:00");
  const addUnavailableBlock = () => {
    if (!blockTitle.trim() || blockEnd <= blockStart) return;
    setPlanner({ ...planner, unavailable: [...planner.unavailable, { id: String(Date.now()), title: blockTitle.trim(), days: [blockDay], day: blockDay, start: blockStart, end: blockEnd }] });
    setBlockTitle("");
  };
  return <section className="settings-card"><p className="eyebrow">SETTINGS</p><h2>Your FlowPal setup</h2><div><b>Companion channel</b><span>{lineLinkCode ? <>Send <strong>link {lineLinkCode}</strong> to FlowPal on LINE to connect reminders.</> : "LINE connection loading…"}</span></div><div><b>Google Classroom</b><span>{classroomConnected ? "Connected · only open work from the last 14 days" : "Not connected"}</span></div><button className="primary-btn" onClick={() => { window.location.assign("/api/google/classroom/connect"); }}>{classroomConnected ? "Refresh Google Classroom ↻" : "Connect Google Classroom →"}</button><form className="planner-form" onSubmit={(event) => { event.preventDefault(); setMessage("Your availability was saved. FlowPal rebuilt your schedule around it."); }}><div className="planner-title"><p className="eyebrow">SCHEDULING RULES</p><h3>When can FlowPal schedule you?</h3></div><label>School name<input value={planner.schoolName} onChange={(event) => setPlanner({ ...planner, schoolName: event.target.value })} placeholder="e.g. Mita International" /></label><div className="planner-row"><label>School starts<input type="time" value={planner.schoolStart} onChange={(event) => setPlanner({ ...planner, schoolStart: event.target.value })} /></label><label>School ends<input type="time" value={planner.schoolEnd} onChange={(event) => setPlanner({ ...planner, schoolEnd: event.target.value })} /></label></div><div className="planner-row"><label>Usually asleep by<input type="time" value={planner.sleepTime} onChange={(event) => setPlanner({ ...planner, sleepTime: event.target.value })} /></label><label>Weekend study starts<input type="time" value={planner.weekendStart} onChange={(event) => setPlanner({ ...planner, weekendStart: event.target.value })} /></label></div><label>Maximum study time each day<input type="number" min="30" step="15" value={planner.weekdayLimit} onChange={(event) => setPlanner({ ...planner, weekdayLimit: Number(event.target.value) || 30 })} /><small>minutes · FlowPal will protect your sleep time</small></label><div className="unavailable"><div className="planner-title"><p className="eyebrow">UNAVAILABLE TIME</p><h3>Clubs, lessons, and friend time</h3></div><div className="planner-row"><label>Activity<input value={blockTitle} onChange={(event) => setBlockTitle(event.target.value)} placeholder="Basketball practice" /></label><label>Every<select value={blockDay} onChange={(event) => setBlockDay(Number(event.target.value))}>{weekdayNames.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label></div><div className="planner-row"><label>Starts<input type="time" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} /></label><label>Ends<input type="time" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} /></label></div><button className="outline-btn" type="button" onClick={addUnavailableBlock}>＋ Block this time</button>{planner.unavailable.length > 0 && <div className="block-list">{planner.unavailable.map((block) => <div key={block.id}><span><b>{block.title}</b> · {weekdayNames[block.day]} · {block.start}–{block.end}</span><button type="button" onClick={() => setPlanner({ ...planner, unavailable: planner.unavailable.filter((item) => item !== block) })}>×</button></div>)}</div>}</div><button className="primary-btn" type="submit">Save schedule rules →</button></form><div><b>Current theme</b><span>{theme}</span></div><div><b>Streak protection</b><span>{freezes} freeze{freezes === 1 ? "" : "s"} available</span></div><button className="outline-btn" onClick={() => { setStreak(streak + 1); setMessage("Demo check-in complete. Your streak moved up by one day."); }}>Demo daily check-in</button></section>;
}
