-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ONLINE', 'OFFLINE', 'IN_GAME');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('DUMMY1', 'DUMMY2');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('COUNTDOWN', 'RUNNING', 'FINISHED');

-- CreateTable
CREATE TABLE "Users" (
    "user_id" BIGSERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "xp" BIGINT NOT NULL,
    "lvl" BIGINT NOT NULL,
    "status" "UserStatus" NOT NULL,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "Rooms" (
    "room_id" BIGSERIAL NOT NULL,
    "status" "RoomStatus" NOT NULL,
    "min_players" INTEGER NOT NULL,
    "max_players" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL,
    "creator_id" BIGINT NOT NULL,

    CONSTRAINT "Rooms_pkey" PRIMARY KEY ("room_id")
);

-- CreateTable
CREATE TABLE "Games" (
    "game_id" BIGSERIAL NOT NULL,
    "wikipage_id" BIGINT NOT NULL,
    "status" "GameStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "room_id" BIGINT NOT NULL,

    CONSTRAINT "Games_pkey" PRIMARY KEY ("game_id")
);

-- CreateTable
CREATE TABLE "Room_players" (
    "player_id" BIGSERIAL NOT NULL,
    "room_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,

    CONSTRAINT "Room_players_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "Game_players" (
    "id" BIGSERIAL NOT NULL,
    "game_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,

    CONSTRAINT "Game_players_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Rooms" ADD CONSTRAINT "Rooms_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Games" ADD CONSTRAINT "Games_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room_players" ADD CONSTRAINT "Room_players_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room_players" ADD CONSTRAINT "Room_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game_players" ADD CONSTRAINT "Game_players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Games"("game_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game_players" ADD CONSTRAINT "Game_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
