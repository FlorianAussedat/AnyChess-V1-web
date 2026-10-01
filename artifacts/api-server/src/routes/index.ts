import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pgnCommentsRouter from "./pgnComments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pgnCommentsRouter);

export default router;
