-- CreateTable
CREATE TABLE "MaxelPayOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sessionId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MaxelPayOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaxelPayOrder_orderId_key" ON "MaxelPayOrder"("orderId");

-- CreateIndex
CREATE INDEX "MaxelPayOrder_orderId_idx" ON "MaxelPayOrder"("orderId");

-- CreateIndex
CREATE INDEX "MaxelPayOrder_userId_idx" ON "MaxelPayOrder"("userId");

-- AddForeignKey
ALTER TABLE "MaxelPayOrder" ADD CONSTRAINT "MaxelPayOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
