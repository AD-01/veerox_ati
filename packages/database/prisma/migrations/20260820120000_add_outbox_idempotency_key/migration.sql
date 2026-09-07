-- AlterTable
ALTER TABLE "outbox_messages" ADD COLUMN "idempotency_key" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_messages_idempotency_key_key" ON "outbox_messages"("idempotency_key");
