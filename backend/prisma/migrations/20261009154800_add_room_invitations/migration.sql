CREATE TYPE "RoomInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "RoomInvitations" (
    "invitation_id" BIGSERIAL NOT NULL,
    "room_id" BIGINT NOT NULL,
    "invitee_id" BIGINT NOT NULL,
    "status" "RoomInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomInvitations_pkey" PRIMARY KEY ("invitation_id")
);

CREATE UNIQUE INDEX "RoomInvitations_room_id_invitee_id_key"
ON "RoomInvitations"("room_id", "invitee_id");

ALTER TABLE "RoomInvitations"
ADD CONSTRAINT "RoomInvitations_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "Rooms"("room_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomInvitations"
ADD CONSTRAINT "RoomInvitations_invitee_id_fkey"
FOREIGN KEY ("invitee_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
