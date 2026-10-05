"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { connectToRoom, type RoomMessage } from "@/lib/room-socket";

export function RoomChat() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = pathname.startsWith("/lobby/")
    ? pathname.split("/")[2] ?? null
    : pathname.startsWith("/game/")
      ? searchParams.get("room")
      : null;

  const [isFooterVisible, setIsFooterVisible] = useState(false);

  useEffect(() => {
    const footer = document.getElementById("site-footer");
    if (!footer) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsFooterVisible(entry.isIntersecting);
    });

    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof connectToRoom>>(null);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMessages([]);
      setUnreadCount(0);
      setDraft("");
      setConnectionError(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    socketRef.current = connectToRoom(
      roomId,
      () => {},
      () => {},
      {
        onChatMessage: (message) => {
          if (message.roomId !== roomId) return;
          setMessages((current) => [...current, message]);
          setUnreadCount((count) => (isOpenRef.current ? count : count + 1));
        },
        onStatus: (status, message) => {
          if (status === "error") {
            setConnectionError(message ?? "Room chat connection failed");
          } else if (status === "connected") {
            setConnectionError(null);
          }
        },
        onAuthError: (message) => {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setConnectionError(message);
          router.push(`/login?error=${encodeURIComponent(message)}`);
        },
      },
    );

    return () => {
      socketRef.current?.emit("room:leave", { roomId });
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [roomId, router]);

  function handleOpen() {
    setIsOpen(true);
    setUnreadCount(0);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();

    if (!text || !roomId || !socketRef.current) return;

    socketRef.current.emit("chat:send", { roomId, text });
    setDraft("");
  }

  const isRoomContext = pathname.startsWith("/lobby/") || pathname.startsWith("/game/");
  const bottomOffset = isFooterVisible ? "bottom-20" : "bottom-4";

  if (!isRoomContext) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Open room chat"
        className={`fixed ${bottomOffset} right-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-700 text-white shadow-lg hover:bg-violet-800`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-400 px-1 text-[11px] font-bold text-violet-950">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={`fixed ${bottomOffset} right-4 flex h-96 w-80 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl`}>
      <div className="flex items-center justify-between bg-violet-700 px-4 py-3">
        <p className="text-sm font-semibold text-white">Room chat</p>
        <button type="button" onClick={() => setIsOpen(false)} aria-label="Close room chat" className="text-violet-200 hover:text-white">
          ✕
        </button>
      </div>
      {connectionError && (
        <p className="bg-red-50 px-3 py-2 text-xs text-red-700">
          {connectionError}
        </p>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto bg-zinc-50 p-3">
        {messages.length === 0 && <p className="text-xs text-zinc-400">No messages yet.</p>}
        {messages.map((message, index) => (
          <div key={index} className="flex items-start gap-2">
            <img src={message.avatar} alt={message.username} className="h-6 w-6 rounded-full bg-zinc-200" />
            <div className="text-sm">
              <span className="font-medium text-zinc-800">{message.username}</span>{" "}
              <span className="text-zinc-600">{message.text}</span>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-zinc-200 p-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Send a message..."
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        <button type="submit" className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800">
          Send
        </button>
      </form>
    </div>
  );
}
