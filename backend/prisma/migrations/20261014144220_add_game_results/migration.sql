-- CreateEnum
CREATE TYPE "GameResult" AS ENUM ('WIN', 'LOSS');

-- DropIndex
DROP INDEX "Friendships_friend_id_idx";

-- AlterTable
ALTER TABLE "Friendships" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Game_players" ADD COLUMN     "rank" INTEGER,
ADD COLUMN     "result" "GameResult",
ADD COLUMN     "score" INTEGER;

-- AlterTable
ALTER TABLE "Games" ADD COLUMN     "article_title" TEXT;
