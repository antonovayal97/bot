-- CreateTable
CREATE TABLE "BalanceTopUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BalanceTopUp_userId_idx" ON "BalanceTopUp"("userId");

-- CreateIndex
CREATE INDEX "BalanceTopUp_createdAt_idx" ON "BalanceTopUp"("createdAt");

-- AddForeignKey
ALTER TABLE "BalanceTopUp" ADD CONSTRAINT "BalanceTopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
