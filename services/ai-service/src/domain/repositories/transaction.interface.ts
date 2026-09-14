/**
 * Represents a generic Unit of Work / Transaction boundary within the Domain Layer.
 * This prevents the domain from being tightly coupled to infrastructure-specific
 * transaction objects (like PrismaClient or Prisma.TransactionClient).
 */
export interface DomainTransaction {
  getProvider<T>(): T;
}
