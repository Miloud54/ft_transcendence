/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Rooms` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Rooms` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: add the column as nullable first
ALTER TABLE "Rooms" ADD COLUMN "code" TEXT;

-- Backfill existing rooms with a unique placeholder code (derived from their id, so uniqueness is guaranteed)
UPDATE "Rooms" SET "code" = 'LEGACY' || "room_id"::text WHERE "code" IS NULL;

-- Now that every row has a value, make it mandatory
ALTER TABLE "Rooms" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Rooms_code_key" ON "Rooms"("code");

