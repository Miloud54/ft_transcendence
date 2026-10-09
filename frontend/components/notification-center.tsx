"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  acceptFriendRequest,
  acceptRoomInvitation,
  declineFriendRequest,
  declineRoomInvitation,
  getFriendRequests,
  getRoomInvitations,
  type FriendRequest,
  type RoomInvitation,
} from "@/lib/room-api";

type NotificationItem = {
  id: string;
  kind: "friend" | "room";
  label: string;
  detail: FriendRequest | RoomInvitation;
};

export function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [roomInvitations, setRoomInvitations] = useState<RoomInvitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([getFriendRequests(), getRoomInvitations()]).then(
      ([requests, invitations]) => {
        setFriendRequests(requests);
        setRoomInvitations(invitations);
      },
    ).catch(() => undefined);

    const onFriendRequest = (event: Event) => {
      const request = (event as CustomEvent<FriendRequest>).detail;
      setFriendRequests((current) =>
        current.some((item) => item.id === request.id) ? current : [request, ...current],
      );
    };
    const onRoomInvitation = (event: Event) => {
      const invitation = (event as CustomEvent<RoomInvitation>).detail;
      setRoomInvitations((current) =>
        current.some((item) => item.roomId === invitation.roomId)
          ? current
          : [invitation, ...current],
      );
    };

    window.addEventListener("friend-request:received", onFriendRequest);
    window.addEventListener("room-invitation:received", onRoomInvitation);
    return () => {
      window.removeEventListener("friend-request:received", onFriendRequest);
      window.removeEventListener("room-invitation:received", onRoomInvitation);
    };
  }, []);

  const count = friendRequests.length + roomInvitations.length;

  async function respondToFriend(request: FriendRequest, action: "accept" | "decline") {
    setBusyId(request.id);
    try {
      if (action === "accept") {
        const friend = await acceptFriendRequest(request.id);
        window.dispatchEvent(new CustomEvent("friend-request:accepted", { detail: friend }));
      } else {
        await declineFriendRequest(request.id);
      }
      setFriendRequests((current) => current.filter((item) => item.id !== request.id));
    } finally {
      setBusyId(null);
    }
  }

  async function respondToRoom(invitation: RoomInvitation, action: "accept" | "decline") {
    setBusyId(invitation.roomId);
    try {
      if (action === "accept") {
        await acceptRoomInvitation(invitation.roomId);
        setRoomInvitations((current) => current.filter((item) => item.roomId !== invitation.roomId));
        router.push(`/lobby/${invitation.roomId}`);
      } else {
        await declineRoomInvitation(invitation.roomId);
        setRoomInvitations((current) => current.filter((item) => item.roomId !== invitation.roomId));
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${count ? ` (${count})` : ""}`}
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
      >
        <span aria-hidden="true">🔔</span>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-400 px-1 text-[10px] font-bold text-violet-950">
            {count}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-violet-100 bg-white p-3 text-zinc-950 shadow-xl">
          <h2 className="px-2 text-sm font-semibold text-violet-950">Notifications</h2>
          {count === 0 ? (
            <p className="px-2 py-5 text-sm text-zinc-500">No new notifications.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {friendRequests.map((request) => (
                <div key={`friend-${request.id}`} className="rounded-lg bg-violet-50 p-3">
                  <p className="text-sm">{request.username} wants to be your friend.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busyId === request.id} onClick={() => void respondToFriend(request, "accept")} className="rounded-md bg-violet-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60">Accept</button>
                    <button type="button" disabled={busyId === request.id} onClick={() => void respondToFriend(request, "decline")} className="rounded-md border border-violet-200 px-2 py-1 text-xs font-semibold text-violet-700 disabled:opacity-60">Decline</button>
                  </div>
                </div>
              ))}
              {roomInvitations.map((invitation) => (
                <div key={`room-${invitation.roomId}`} className="rounded-lg bg-violet-50 p-3">
                  <p className="text-sm">{invitation.inviter.username} invited you to room #{invitation.roomId}.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busyId === invitation.roomId} onClick={() => void respondToRoom(invitation, "accept")} className="rounded-md bg-lime-400 px-2 py-1 text-xs font-semibold text-violet-950 disabled:opacity-60">Join lobby</button>
                    <button type="button" disabled={busyId === invitation.roomId} onClick={() => void respondToRoom(invitation, "decline")} className="rounded-md border border-violet-200 px-2 py-1 text-xs font-semibold text-violet-700 disabled:opacity-60">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
