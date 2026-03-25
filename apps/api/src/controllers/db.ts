import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const testDb = async (_req: Request, res: Response) => {
  try {
    const orders = await prisma.salesOrder.findMany();
    res.json({ orders });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to query database' });
  }
};
