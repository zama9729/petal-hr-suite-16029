-- Drop existing manager policies that might be causing issues
DROP POLICY IF EXISTS "Managers can view their team timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Managers can update their team timesheets" ON public.timesheets;

-- Create improved policies for managers
CREATE POLICY "Managers can view their team timesheets"
  ON public.timesheets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = timesheets.employee_id
      AND e.reporting_manager_id = get_employee_id(auth.uid())
    )
  );

CREATE POLICY "Managers can update their team timesheets"
  ON public.timesheets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = timesheets.employee_id
      AND e.reporting_manager_id = get_employee_id(auth.uid())
    )
  );

-- Same fix for leave requests
DROP POLICY IF EXISTS "Managers can view their team leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Managers can update their team leave requests" ON public.leave_requests;

CREATE POLICY "Managers can view their team leave requests"
  ON public.leave_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = leave_requests.employee_id
      AND e.reporting_manager_id = get_employee_id(auth.uid())
    )
  );

CREATE POLICY "Managers can update their team leave requests"
  ON public.leave_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = leave_requests.employee_id
      AND e.reporting_manager_id = get_employee_id(auth.uid())
    )
  );