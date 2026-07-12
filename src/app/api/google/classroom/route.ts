import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type ImportedAssignment = {
  id: string;
  title: string;
  courseName: string;
  dueLabel: string;
  dueDate: string;
  dueTime: string;
  submissionState: string;
};

export async function GET() {
  const cookieStore = await cookies();
  const encodedImport = cookieStore.get("flowpal-classroom-import")?.value;

  if (!encodedImport) return NextResponse.json({ connected: false, assignments: [] });

  try {
    const assignments = JSON.parse(Buffer.from(encodedImport, "base64url").toString("utf8")) as ImportedAssignment[];
    return NextResponse.json({ connected: true, assignments });
  } catch {
    return NextResponse.json({ connected: false, assignments: [] });
  }
}
