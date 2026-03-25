import { Router, type Router as ExpressRouter } from 'express';
import { healthCheck } from '../controllers/health';
import { testDb } from '../controllers/db';
import { verify } from '../controllers/verify';
import { getGraph } from '../controllers/graph';
import { postQuery } from '../controllers/query';
import { postNlQuery } from '../controllers/nlQuery';

const router: ExpressRouter = Router();

router.get('/health', healthCheck);
router.get('/test-db', testDb);
router.get('/verify', verify);
router.get('/graph', getGraph);
router.post('/query', postQuery);
router.post('/query/nl', postNlQuery);

export default router;
