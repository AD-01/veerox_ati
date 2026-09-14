/* eslint-disable @typescript-eslint/no-explicit-any */
import { Invoice } from '../aggregates/invoice.aggregate';

export interface IInvoiceRepository {
  findById(id: string, tx?: any): Promise<Invoice | null>;
  save(invoice: Invoice, tx?: any): Promise<void>;
}
