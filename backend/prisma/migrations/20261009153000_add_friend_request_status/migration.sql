CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');

ALTER TABLE "Friendships"
ADD COLUMN "status" "FriendshipStatus" NOT NULL DEFAULT 'ACCEPTED';
