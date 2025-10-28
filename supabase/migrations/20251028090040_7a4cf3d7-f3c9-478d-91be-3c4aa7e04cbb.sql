-- Create security definer function to get employee's manager ID
CREATE OR REPLACE FUNCTION public.get_employee_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = _user_id LIMIT 1
$$;

-- Drop and recreate the manager policy to use the function
DROP POLICY IF EXISTS "Managers can view their team" ON public.employees;

CREATE POLICY "Managers can view their team" 
ON public.employees 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager') 
  AND reporting_manager_id = get_employee_id(auth.uid())
);