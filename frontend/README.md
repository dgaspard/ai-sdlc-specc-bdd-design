# Frontend

Plain HTML/JS (PROJECT-PLAN A-04). Port 3000. Calls services only through their
published APIs and uses accessible labels and roles so Playwright scenarios read
like a user's actions. Playwright scenarios live in `spec/` and do not change when a
backend service is rebuilt in another language.

The executable `setup`/`start` scripts and Node HTTP server satisfy the runtime
contract: `PORT` (default 3000), `GET /health`, and graceful shutdown. Other routes
return 404. The UI and its browser journey remain FE-01 work. TEST-02 currently
exercises the backend using Playwright HTTP requests without launching a browser.
