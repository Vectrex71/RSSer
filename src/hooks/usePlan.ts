
import { usePlan as usePlanFromContext } from '../context/PlanContext';
import { UserPlan, PlanStatus } from '../context/PlanContext';

export type { UserPlan, PlanStatus };

export function usePlan(): PlanStatus {
  return usePlanFromContext();
}
