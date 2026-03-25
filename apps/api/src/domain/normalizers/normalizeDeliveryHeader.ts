import { DeliveryHeader } from './types.ts';

/**
 * Normalize raw delivery header into domain object
 */
export function normalizeDeliveryHeader(raw: any): DeliveryHeader {
  return {
    id: String(raw.deliveryDocument || ''),
    createdAt: raw.creationDate ? new Date(raw.creationDate) : null,
  };
}
