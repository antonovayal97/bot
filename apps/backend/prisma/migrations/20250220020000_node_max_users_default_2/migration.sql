-- AlterTable
ALTER TABLE "Node" ALTER COLUMN "maxUsers" SET DEFAULT 2;

-- Update existing nodes to have maxUsers=2
UPDATE "Node" SET "maxUsers" = 2 WHERE "maxUsers" > 2;
