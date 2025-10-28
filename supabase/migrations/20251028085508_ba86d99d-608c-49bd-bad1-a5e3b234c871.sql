-- Add foreign key constraint from employees.user_id to profiles.id
ALTER TABLE public.employees 
DROP CONSTRAINT IF EXISTS employees_user_id_fkey;

ALTER TABLE public.employees 
ADD CONSTRAINT employees_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;