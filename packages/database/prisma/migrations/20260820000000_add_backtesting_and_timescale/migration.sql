-- Create Backtesting Tables
CREATE TABLE "backtest_jobs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "strategy_id" UUID NOT NULL,
    "ea_id" UUID,
    "symbols" TEXT NOT NULL,
    "date_from" TIMESTAMP(6) NOT NULL,
    "date_to" TIMESTAMP(6) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    "requested_by" UUID NOT NULL,
    "configuration" TEXT,
    "initial_capital" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),
    CONSTRAINT "backtest_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "backtest_results" (
    "id" UUID NOT NULL,
    "backtest_job_id" UUID NOT NULL,
    "total_trades" INTEGER NOT NULL,
    "winning_trades" INTEGER NOT NULL,
    "losing_trades" INTEGER NOT NULL,
    "win_rate" DECIMAL(5,2) NOT NULL,
    "net_profit" DECIMAL(18,2) NOT NULL,
    "gross_profit" DECIMAL(18,2) NOT NULL,
    "gross_loss" DECIMAL(18,2) NOT NULL,
    "max_drawdown" DECIMAL(18,2) NOT NULL,
    "recovery_factor" DECIMAL(10,4) NOT NULL,
    "sharpe_ratio" DECIMAL(10,4) NOT NULL,
    "profit_factor" DECIMAL(10,4) NOT NULL,
    CONSTRAINT "backtest_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "backtest_trade_history" (
    "id" UUID NOT NULL,
    "backtest_job_id" UUID NOT NULL,
    "symbol" VARCHAR(50) NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "entry_price" DECIMAL(18,8) NOT NULL,
    "exit_price" DECIMAL(18,8) NOT NULL,
    "stop_loss" DECIMAL(18,8),
    "take_profit" DECIMAL(18,8),
    "lot_size" DECIMAL(18,4) NOT NULL,
    "pnl" DECIMAL(18,2) NOT NULL,
    "opened_at" TIMESTAMP(6) NOT NULL,
    "closed_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "backtest_trade_history_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "backtest_results_backtest_job_id_key" ON "backtest_results"("backtest_job_id");
CREATE INDEX "backtest_jobs_workspace_id_idx" ON "backtest_jobs"("workspace_id");
CREATE INDEX "backtest_jobs_status_idx" ON "backtest_jobs"("status");
CREATE INDEX "backtest_trade_history_backtest_job_id_idx" ON "backtest_trade_history"("backtest_job_id");

-- Foreign Keys
ALTER TABLE "backtest_jobs" ADD CONSTRAINT "backtest_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "backtest_jobs" ADD CONSTRAINT "backtest_jobs_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "backtest_results" ADD CONSTRAINT "backtest_results_backtest_job_id_fkey" FOREIGN KEY ("backtest_job_id") REFERENCES "backtest_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "backtest_trade_history" ADD CONSTRAINT "backtest_trade_history_backtest_job_id_fkey" FOREIGN KEY ("backtest_job_id") REFERENCES "backtest_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TimescaleDB Extensions
-- (Assumes TimescaleDB is enabled on the database)
-- We will selectively convert ticks and candles into hypertables if they exist.
DO $$
BEGIN
    -- Check if TimescaleDB extension exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        -- Convert ticks table to hypertable (partition by timestamp)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticks') THEN
            -- Verify it's not already a hypertable
            IF NOT EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'ticks') THEN
                PERFORM create_hypertable('ticks', 'timestamp', chunk_time_interval => INTERVAL '1 day');
            END IF;
        END IF;

        -- Convert candles table to hypertable (partition by timestamp)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candles') THEN
            IF NOT EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'candles') THEN
                PERFORM create_hypertable('candles', 'timestamp', chunk_time_interval => INTERVAL '7 days');
            END IF;
        END IF;
    END IF;
END $$;
