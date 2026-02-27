-- CreateTable
CREATE TABLE "RioPayOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "riopayOrderId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RioPayOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RioPayOrder_externalId_key" ON "RioPayOrder"("externalId");

-- CreateIndex
CREATE INDEX "RioPayOrder_externalId_idx" ON "RioPayOrder"("externalId");

-- CreateIndex
CREATE INDEX "RioPayOrder_userId_idx" ON "RioPayOrder"("userId");

-- AddForeignKey
ALTER TABLE "RioPayOrder" ADD CONSTRAINT "RioPayOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
