# One Step

A responsive task manager demo with a Node.js backend and persistent SQLite database. Add tasks, mark them complete, filter the list, and delete tasks. No external packages, API keys, or build step are required.

This is a public, shared demo: visitors can view and change all tasks. Do not enter private information. Authentication and private workspaces are future product work.

## Development

Requires Node.js 24. Run from the repository directory:

```sh
npm ci
npm test
npm start
```

The server uses port 3000 by default. `npm run dev` enables restart on server changes. The frontend is served by the same server.

- `PORT`: HTTP port, default `3000`.
- `DATABASE_PATH`: SQLite file, default `data/tasks.sqlite`. The directory is created automatically. Database files are ignored by Git.
- `GET /health`: verifies the server and database respond.

## Deploy on Render

The included `render.yaml` describes a Node web service and persistent disk. The Starter plan and persistent storage incur hosting charges; review Render's current pricing before creating resources.

1. Sign in to Render and choose **New → Blueprint**.
2. Connect this GitHub repository and select the branch containing this app.
3. Review the service and disk charges, then create the resources.
4. Wait for deployment and a successful `/health` check. Open the HTTPS address Render provides.
5. Add a task, reload the page, mark it complete, and delete it to verify the live workflow.

Set `DATABASE_PATH=/var/data/tasks.sqlite` with the disk mounted at `/var/data`, as specified in the blueprint. Free services without persistent storage lose local database data when their filesystem is replaced. Production use also needs authentication, backups, access controls, and abuse protection.

## API

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/api/tasks` | List tasks, newest first |
| POST | `/api/tasks` | `{ "title": "My next step" }` |
| PATCH | `/api/tasks/:id` | `{ "completed": true }` |
| DELETE | `/api/tasks/:id` | Delete one task |

The integration test exercises real HTTP requests, validation, updates, deletion, frontend serving, and persistence across a server restart using an isolated temporary database.
