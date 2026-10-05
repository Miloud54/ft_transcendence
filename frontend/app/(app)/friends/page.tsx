import type { Metadata } from "next";
import { FriendsContent } from "@/components/friends-content";

export const metadata: Metadata = {
  title: "Friends",
};

export default function FriendsPage() {
  return <FriendsContent />;
}
