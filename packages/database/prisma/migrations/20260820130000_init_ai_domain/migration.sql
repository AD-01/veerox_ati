-- CreateTable
CREATE TABLE "ai_models" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "model_version" VARCHAR(50) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "execution_mode" VARCHAR(30) NOT NULL,
    "minimum_confidence" DECIMAL(5,2) NOT NULL,
    "max_risk_per_trade" DECIMAL(5,2) NOT NULL,
    "max_daily_loss" DECIMAL(5,2) NOT NULL,
    "max_open_positions" INTEGER NOT NULL,
    "max_position_size" DECIMAL(24,8) NOT NULL,
    "require_policy_approval" BOOLEAN NOT NULL DEFAULT true,
    "allowed_symbols" TEXT,
    "allowed_sessions" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ai_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "correlation_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "model_id" UUID NOT NULL,
    "model_version" VARCHAR(50) NOT NULL,
    "strategy_id" UUID,
    "symbol_id" UUID NOT NULL,
    "execution_mode" VARCHAR(30) NOT NULL,
    "recommendation_type" VARCHAR(50) NOT NULL,
    "confidence" DECIMAL(5,2) NOT NULL,
    "market_regime" VARCHAR(50),
    "suggested_side" VARCHAR(10),
    "suggested_size" DECIMAL(24,8),
    "suggested_entry" DECIMAL(24,8),
    "suggested_stop_loss" DECIMAL(24,8),
    "suggested_take_profit" DECIMAL(24,8),
    "reasoning" TEXT,
    "supporting_signals" TEXT,
    "status" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_workspace_id_provider_model_name_model_version_key" ON "ai_models"("workspace_id", "provider", "model_name", "model_version");
CREATE INDEX "ai_models_organization_id_idx" ON "ai_models"("organization_id");
CREATE INDEX "ai_models_workspace_id_idx" ON "ai_models"("workspace_id");
CREATE INDEX "ai_models_status_idx" ON "ai_models"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_configurations_workspace_id_key" ON "ai_configurations"("workspace_id");
CREATE INDEX "ai_configurations_organization_id_idx" ON "ai_configurations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_recommendations_idempotency_key_key" ON "ai_recommendations"("idempotency_key");
CREATE INDEX "ai_recommendations_organization_id_idx" ON "ai_recommendations"("organization_id");
CREATE INDEX "ai_recommendations_workspace_id_idx" ON "ai_recommendations"("workspace_id");
CREATE INDEX "ai_recommendations_correlation_id_idx" ON "ai_recommendations"("correlation_id");
CREATE INDEX "ai_recommendations_status_idx" ON "ai_recommendations"("status");

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_configurations" ADD CONSTRAINT "ai_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_configurations" ADD CONSTRAINT "ai_configurations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "symbols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
