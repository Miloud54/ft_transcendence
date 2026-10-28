-- AlterTable
ALTER TABLE "Game_players" ADD COLUMN     "xp_gained" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "leveled_up" BOOLEAN NOT NULL DEFAULT false;
