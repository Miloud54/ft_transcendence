/*
  Warnings:

  - The values [DUMMY1,DUMMY2] on the enum `RoomStatus` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `Game_players` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Game_players` table. All the data in the column will be lost.
  - You are about to drop the column `wikipage_id` on the `Games` table. All the data in the column will be lost.
  - The primary key for the `Room_players` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `player_id` on the `Room_players` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[game_id,user_id]` on the table `Game_players` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[room_id,user_id]` on the table `Room_players` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `Users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `Users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RoomStatus_new" AS ENUM ('OPEN', 'STARTING', 'IN_GAME', 'CLOSED');
ALTER TABLE "Rooms" ALTER COLUMN "status" TYPE "RoomStatus_new" USING ("status"::text::"RoomStatus_new");
ALTER TYPE "RoomStatus" RENAME TO "RoomStatus_old";
ALTER TYPE "RoomStatus_new" RENAME TO "RoomStatus";
DROP TYPE "public"."RoomStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "Game_players" DROP CONSTRAINT "Game_players_pkey",
DROP COLUMN "id",
ADD COLUMN     "game_player_id" BIGSERIAL NOT NULL,
ADD CONSTRAINT "Game_players_pkey" PRIMARY KEY ("game_player_id");

-- AlterTable
ALTER TABLE "Games" DROP COLUMN "wikipage_id";

-- AlterTable
ALTER TABLE "Room_players" DROP CONSTRAINT "Room_players_pkey",
DROP COLUMN "player_id",
ADD COLUMN     "room_player_id" BIGSERIAL NOT NULL,
ADD CONSTRAINT "Room_players_pkey" PRIMARY KEY ("room_player_id");

-- AlterTable
ALTER TABLE "Rooms" ALTER COLUMN "created_at" DROP NOT NULL,
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "closed_at" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Game_players_game_id_user_id_key" ON "Game_players"("game_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Room_players_room_id_user_id_key" ON "Room_players"("room_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Users_username_key" ON "Users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");
