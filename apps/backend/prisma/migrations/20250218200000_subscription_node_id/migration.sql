-- AlterTable: add nodeId (nullable first for backfill)
ALTER TABLE "Subscription" ADD COLUMN "nodeId" TEXT;

-- Backfill: assign existing subscriptions to first node (required for NOT NULL)
UPDATE "Subscription" SET "nodeId" = (SELECT id FROM "Node" LIMIT 1) WHERE "nodeId" IS NULL;

-- Make NOT NULL and add FK
ALTER TABLE "Subscription" ALTER COLUMN "nodeId" SET NOT NULL;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Subscription_nodeId_idx" ON "Subscription"("nodeId");
