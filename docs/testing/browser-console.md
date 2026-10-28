# Browser console test

The browser smoke test checks the landing page in the latest stable Google
Chrome channel and fails for application console errors, console warnings, and
uncaught page errors.

## Prerequisites

- Node.js 18 or newer
- Google Chrome stable installed and available to Playwright as the `chrome`
  channel
- Frontend dependencies installed with `npm --prefix frontend ci`

Run the test from the repository root:

```sh
npm ci
npm --prefix frontend ci
npm run test:browser-console
```

The Playwright web server starts the frontend automatically. The test uses
`http://127.0.0.1:3000` and does not require the backend for the public landing
page.

If a CI image provides a different Chromium channel, override it explicitly:

```sh
BROWSER_CHANNEL=chromium npm run test:browser-console
```

Warnings from third-party libraries are not ignored by default. If one is
unavoidable, add a narrowly scoped pattern to
`tests/browser/console.spec.ts` and document its source and reason here before
accepting it.
