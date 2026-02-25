-- AddColumn
ALTER TABLE "BalanceTopUp" ADD COLUMN "relatedUserId" TEXT;

-- CreateIndex
CREATE INDEX "BalanceTopUp_relatedUserId_idx" ON "BalanceTopUp"("relatedUserId");

-- AddForeignKey
ALTER TABLE "BalanceTopUp" ADD CONSTRAINT "BalanceTopUp_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

