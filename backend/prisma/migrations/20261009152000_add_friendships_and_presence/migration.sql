ALTER TABLE "Users" ADD COLUMN "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "Friendships" (
    "friendship_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "friend_id" BIGINT NOT NULL,

    CONSTRAINT "Friendships_pkey" PRIMARY KEY ("friendship_id")
);

CREATE UNIQUE INDEX "Friendships_user_id_friend_id_key" ON "Friendships"("user_id", "friend_id");
CREATE INDEX "Friendships_friend_id_idx" ON "Friendships"("friend_id");

ALTER TABLE "Friendships"
    ADD CONSTRAINT "Friendships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Friendships"
    ADD CONSTRAINT "Friendships_friend_id_fkey"
    FOREIGN KEY ("friend_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
