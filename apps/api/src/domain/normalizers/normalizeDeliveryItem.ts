import { DeliveryItem } from './types.ts';

/**
 * Normalize raw delivery item into domain object
 */
export function normalizeDeliveryItem(raw: any): DeliveryItem {
  return {
    id: `${String(raw.deliveryDocument || '')}_${String(
      raw.deliveryDocumentItem || ''
    )}`,
    deliveryId: String(raw.deliveryDocument || ''),
    orderId: String(raw.referenceSdDocument || '') || null,
    quantity: raw.actualDeliveryQuantity
      ? parseFloat(String(raw.actualDeliveryQuantity))
      : null,
  };
}
