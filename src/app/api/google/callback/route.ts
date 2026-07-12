import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type Course = { id: string; name?: string };
type Coursework = { id: string; title?: string; dueDate?: { year: number; month: number; day: number }; dueTime?: { hours?: number; minutes?: number }; state?: string };
type Submission = { courseWorkId: string; state?: string };
type ImportedAssignment = { id: string; title: string; courseName: string; dueLabel: string; dueDate: string; dueTime: string; submissionState: string };

const classroomApi = "https://classroom.googleapis.com/v1";

function appUrl(request: NextRequest, result: "connected" | "error") {
  return new URL(`/?classroom=${result}`, request.url);
}

function formatDueDate(dueDate?: Coursework["dueDate"]) {
  if (!dueDate) return "No due date";
  const date = new Date(dueDate.year, dueDate.month - 1, dueDate.day);
  return `Due ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)}`;
}

function dueDateKey(dueDate: NonNullable<Coursework["dueDate"]>) {
  return `${dueDate.year}-${String(dueDate.month).padStart(2, "0")}-${String(dueDate.day).padStart(2, "0")}`;
}

function formatDueTime(dueTime?: Coursework["dueTime"]) {
  if (dueTime?.hours === undefined) return "";
  return `${String(dueTime.hours).padStart(2, "0")}:${String(dueTime.minutes ?? 0).padStart(2, "0")}`;
}

function isOpenRecentAssignment(coursework: Coursework, submission?: Submission) {
  // FlowPal is for work that still needs action. Skip items already submitted
  // (including work returned by a teacher) and coursework without a usable due date.
  if (["TURNED_IN", "RETURNED"].includes(submission?.state ?? "")) return false;
  if (!coursework.dueDate) return false;

  const dueDate = new Date(coursework.dueDate.year, coursework.dueDate.month - 1, coursework.dueDate.day);
  dueDate.setHours(0, 0, 0, 0);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 14);
  return dueDate >= cutoff;
}

async function googleJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 260);
    throw new Error(`Google Classroom request failed (${response.status}): ${detail}`);
  }
  return response.json() as Promise<T>;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const returnedError = request.nextUrl.searchParams.get("error");
  const expectedState = cookieStore.get("flowpal-google-oauth-state")?.value;
  const clientId = process.env.GOOGLE_CLASSROOM_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLASSROOM_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CLASSROOM_REDIRECT_URI;

  if (returnedError || !code || !state || state !== expectedState || !clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(appUrl(request, "error"));
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed");
    const { access_token: accessToken } = await tokenResponse.json() as { access_token?: string };
    if (!accessToken) throw new Error("Google did not return an access token");

    // FlowPal is a student companion. Explicitly requesting the current student's courses
    // is required for student OAuth tokens; an unfiltered course list can be denied.
    const { courses = [] } = await googleJson<{ courses?: Course[] }>(`${classroomApi}/courses?studentId=me&courseStates=ACTIVE&pageSize=100`, accessToken);
    const courseResults = await Promise.all(courses.map(async (course) => {
      const [courseworkResponse, submissionResponse] = await Promise.all([
        googleJson<{ courseWork?: Coursework[] }>(`${classroomApi}/courses/${course.id}/courseWork?courseWorkStates=PUBLISHED&pageSize=100`, accessToken),
        googleJson<{ studentSubmissions?: Submission[] }>(`${classroomApi}/courses/${course.id}/courseWork/-/studentSubmissions?pageSize=100`, accessToken),
      ]);
      const submissionsByCoursework = new Map((submissionResponse.studentSubmissions ?? []).map((submission) => [submission.courseWorkId, submission]));
      return (courseworkResponse.courseWork ?? [])
        .filter((coursework) => isOpenRecentAssignment(coursework, submissionsByCoursework.get(coursework.id)))
        .map((coursework): ImportedAssignment => ({
          id: `classroom-${course.id}-${coursework.id}`,
          title: coursework.title || "Untitled assignment",
          courseName: course.name || "Google Classroom",
          dueLabel: formatDueDate(coursework.dueDate),
          dueDate: dueDateKey(coursework.dueDate!),
          dueTime: formatDueTime(coursework.dueTime),
          submissionState: submissionsByCoursework.get(coursework.id)?.state || "NEW",
        }));
    }));

    // Cookie storage is intentionally only a small temporary MVP store. Supabase will replace it before recurring sync ships.
    const assignments = courseResults.flat().slice(0, 15);
    const response = NextResponse.redirect(appUrl(request, "connected"));
    response.cookies.set("flowpal-classroom-import", Buffer.from(JSON.stringify(assignments)).toString("base64url"), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    response.cookies.delete("flowpal-google-oauth-state");
    return response;
  } catch (error) {
    // This is local-only diagnostic text; it never includes OAuth tokens or the client secret.
    const reason = error instanceof Error ? error.message.slice(0, 320) : "Unknown Google Classroom import error";
    console.error("FlowPal Classroom import failed:", reason);
    const destination = appUrl(request, "error");
    destination.searchParams.set("reason", reason);
    return NextResponse.redirect(destination);
  }
}
