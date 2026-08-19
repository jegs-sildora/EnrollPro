import { Router } from "express"
import { authenticate } from "../../middleware/authenticate.js"
import { authorize } from "../../middleware/authorize.js"
import { getTeacherAdvisory } from "./teacher-advisory.controller.js"

const router: Router = Router()

router.use(
  authenticate,
  authorize("CLASS_ADVISER", "TEACHER", "HEAD_REGISTRAR", "SYSTEM_ADMIN"),
)

router.get("/", getTeacherAdvisory)

export default router
