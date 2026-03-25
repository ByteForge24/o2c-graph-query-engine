/**
 * Entity Relationship Definitions
 * Defines all O2C flow relationships as reusable, extensible metadata
 */

/**
 * Relationship metadata between entities
 */
export type Relationship = {
  fromEntity: string;
  toEntity: string;
  fromField: string;
  toField: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one';
  description: string;
};

/**
 * All documented relationships in the SAP O2C flow
 */
export const RELATIONSHIPS: Relationship[] = [
  {
    fromEntity: 'billing_document_items',
    toEntity: 'outbound_delivery_items',
    fromField: 'referenceSdDocument',
    toField: 'deliveryDocument',
    type: 'many-to-one',
    description: 'Billing item references delivery document',
  },
  {
    fromEntity: 'outbound_delivery_items',
    toEntity: 'sales_order_items',
    fromField: 'referenceSdDocument',
    toField: 'salesOrder',
    type: 'many-to-one',
    description: 'Delivery item references sales order',
  },
  {
    fromEntity: 'billing_document_headers',
    toEntity: 'journal_entry_items_accounts_receivable',
    fromField: 'accountingDocument',
    toField: 'accountingDocument',
    type: 'one-to-many',
    description: 'Billing linked to journal entries via accounting document',
  },
  {
    fromEntity: 'billing_document_headers',
    toEntity: 'payments_accounts_receivable',
    fromField: 'accountingDocument',
    toField: 'accountingDocument',
    type: 'one-to-many',
    description: 'Billing linked to payments via accounting document',
  },
  {
    fromEntity: 'outbound_delivery_headers',
    toEntity: 'outbound_delivery_items',
    fromField: 'deliveryDocument',
    toField: 'deliveryDocument',
    type: 'one-to-many',
    description: 'Delivery header has many delivery items',
  },
  {
    fromEntity: 'sales_order_headers',
    toEntity: 'sales_order_items',
    fromField: 'salesOrder',
    toField: 'salesOrder',
    type: 'one-to-many',
    description: 'Sales order header has many order items',
  },
  {
    fromEntity: 'billing_document_headers',
    toEntity: 'billing_document_items',
    fromField: 'billingDocument',
    toField: 'billingDocument',
    type: 'one-to-many',
    description: 'Billing document header has many billing items',
  },
];

/**
 * Get all relationships originating from an entity
 */
export function getRelationshipsFrom(entity: string): Relationship[] {
  return RELATIONSHIPS.filter(
    (rel) => rel.fromEntity.toLowerCase() === entity.toLowerCase()
  );
}

/**
 * Get all relationships ending at an entity
 */
export function getRelationshipsTo(entity: string): Relationship[] {
  return RELATIONSHIPS.filter(
    (rel) => rel.toEntity.toLowerCase() === entity.toLowerCase()
  );
}

/**
 * Find a specific relationship between two entities
 */
export function findRelationship(
  fromEntity: string,
  toEntity: string
): Relationship | undefined {
  return RELATIONSHIPS.find(
    (rel) =>
      rel.fromEntity.toLowerCase() === fromEntity.toLowerCase() &&
      rel.toEntity.toLowerCase() === toEntity.toLowerCase()
  );
}

/**
 * Get field name for matching records using a relationship
 */
export function getRelationshipFields(
  fromEntity: string,
  toEntity: string
): { fromField: string; toField: string } | null {
  const rel = findRelationship(fromEntity, toEntity);
  if (!rel) return null;
  return { fromField: rel.fromField, toField: rel.toField };
}
