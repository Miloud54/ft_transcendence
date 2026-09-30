# Modals

## Why a modal instead of a page

Transcendix is a real-time multiplayer game: a player can be waiting in a lobby or mid-game when they want to tweak an account setting. Sending them to a full page (`/settings`) and back is more disruptive here than in a typical app, since it means leaving the lobby/game context entirely. A modal that can be opened from any page inside `(app)` avoids that.

This does not conflict with the subject's requirement that "users have a profile page displaying their information" — that requirement is about **viewing** a profile, which stays a real route (`/profile`). Modals are only used for **editing** actions.

## Architecture

Two layers, kept deliberately separate:

- **`frontend/components/modal.tsx`** — a generic, reusable modal shell. Knows nothing about accounts, forms, or any specific content. Takes `isOpen`, `onClose`, `title`, and `children`.
- **Specific content components** (e.g. `frontend/components/account-menu.tsx`) — own the trigger button, the open/close state, and the actual form/content rendered inside the shell.

Any future modal (a confirmation dialog, a "create room" popup, etc.) should reuse `Modal` rather than rolling its own overlay — the accessibility/behavior details below only need to be gotten right once.

## Implementation details worth knowing

- **`createPortal(..., document.body)`** — the modal is rendered directly under `<body>`, not inside the component tree where it's declared. This avoids being visually clipped by an ancestor with `overflow-hidden` (most of our cards use that).
- **`mounted` state** — `document` does not exist during server rendering. `Modal` only calls `createPortal` after a `useEffect` has confirmed it's running in the browser, otherwise SSR would throw.
- **Escape key** — a `keydown` listener added only while `isOpen`, removed on cleanup.
- **Click outside to close** — the dark backdrop `<div>` has `onClick={onClose}`; the inner white dialog stops that same click from bubbling with `event.stopPropagation()`, so clicking inside the dialog never closes it.
- **`role="dialog"` / `aria-modal="true"` / `aria-label`** — minimum semantics so assistive tech announces it as a dialog rather than generic content.
- `dialogRef.current?.focus()` on open moves keyboard focus into the dialog. Note: there is currently **no focus trap** (Tab can still cycle to elements behind the modal) — acceptable for now given how small the current content is, but worth revisiting if a modal ever holds a long form.

## Current usage

`AccountMenu` (`frontend/components/account-menu.tsx`) renders a gear-icon button in the `(app)` header (`frontend/app/(app)/layout.tsx`) that opens the modal. Its content is a placeholder today — it will be replaced with the account form (username, avatar picker, password change) in a follow-up pass. The old `/settings` page still exists in parallel until that content lands, to avoid having a half-working page with no way to reach the equivalent modal content.

## How to add a new modal

```tsx
"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";

export function SomeTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Some title">
        {/* your content */}
      </Modal>
    </>
  );
}
```

Keep the open/close state local to the smallest component that needs it — don't lift modal state into a shared layout unless multiple, unrelated parts of the UI genuinely need to open the same modal.
