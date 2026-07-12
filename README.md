# FlowPal

> Stay in flow.

FlowPal is an AI-powered student productivity companion. It brings Google Classroom assignments, personal tasks, schedule planning, and messaging-based accountability into one experience.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Google Classroom (local MVP)

FlowPal can now import a student's own active Google Classroom assignments. This first version is **read-only**: it cannot submit work, change grades, or alter a class.

1. Create a Google Cloud project and enable the **Google Classroom API**.
2. Configure the OAuth consent screen. For now, choose **External** and add your Google account as a test user.
3. Create an OAuth client of type **Web application**.
4. Add this authorized redirect URI:

   ```text
   http://localhost:3000/api/google/callback
   ```

5. Copy `.env.example` to `.env.local`, then add the client ID and client secret from Google Cloud.
6. Restart `npm run dev`, open FlowPal, go to **Settings**, then choose **Connect Google Classroom**.

The app asks only for permission to view courses, the student's own coursework, and the student's own submission status. It temporarily keeps the latest small import in an HTTP-only cookie; a future Supabase step will replace that with secure persistent sync.

For Netlify later, add `GOOGLE_CLASSROOM_CLIENT_ID`, `GOOGLE_CLASSROOM_CLIENT_SECRET`, and `GOOGLE_CLASSROOM_REDIRECT_URI` as environment variables. The production redirect URI will be:

```text
https://flowpal.netlify.app/api/google/callback
```

## Deployment

This project is set up for Netlify. After pushing it to GitHub, import the repository in Netlify and use the detected Next.js configuration.
