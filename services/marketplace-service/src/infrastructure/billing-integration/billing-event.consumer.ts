/**
 * S-23 Phase 05: DEPRECATED
 *
 * This consumer was a duplicate of the licensing-service's BillingEventConsumer.
 * It did NOT call activateLicense() after issuance, making it incomplete and dangerous.
 *
 * The authoritative subscription→license choreography is handled exclusively by:
 *   licensing-service/src/infrastructure/billing-integration/billing-event.consumer.ts
 *
 * Marketplace-service listens ONLY to LicenseIssuedEvent (via MarketplaceEventConsumer)
 * to increment purchaseCount. It does NOT participate in license issuance.
 *
 * This file is retained as documentation of the architectural decision.
 * See: S-23 Phase 05 Implementation Plan, Component 4.
 */

export class BillingEventConsumer {}
