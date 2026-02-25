-- CreateTable
CREATE TABLE "SubscriptionDevice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "configContent" TEXT NOT NULL,

    CONSTRAINT "SubscriptionDevice_pkey" PRIMARY KEY ("id")
);

-- DropColumn
ALTER TABLE "Subscription" DROP COLUMN "configContent";

-- CreateIndex
CREATE INDEX "SubscriptionDevice_subscriptionId_idx" ON "SubscriptionDevice"("subscriptionId");

-- AddForeignKey
ALTER TABLE "SubscriptionDevice" ADD CONSTRAINT "SubscriptionDevice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
