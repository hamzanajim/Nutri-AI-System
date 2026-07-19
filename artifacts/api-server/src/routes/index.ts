import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profilesRouter from "./profiles";
import foodsRouter from "./foods";
import mealsRouter from "./meals";
import inventoryRouter from "./inventory";
import groceryRouter from "./grocery";
import nutritionRouter from "./nutrition";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profilesRouter);
router.use(foodsRouter);
router.use(mealsRouter);
router.use(inventoryRouter);
router.use(groceryRouter);
router.use(nutritionRouter);
router.use(aiRouter);

export default router;
