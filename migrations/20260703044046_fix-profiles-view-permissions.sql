-- Drop existing view to allow redefinition
DROP VIEW IF EXISTS public.profiles_view CASCADE;

-- Create helper function with SECURITY DEFINER to bypass auth schema permissions limit
CREATE OR REPLACE FUNCTION public.get_profiles()
RETURNS TABLE (
  id UUID,
  company_id UUID,
  branch_id UUID,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT,
  department TEXT,
  job_title TEXT,
  employee_code TEXT,
  date_joined DATE,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  email TEXT
) SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, 
    p.company_id, 
    p.branch_id, 
    p.first_name, 
    p.last_name, 
    p.avatar_url, 
    p.phone, 
    p.role, 
    p.department, 
    p.job_title, 
    p.employee_code, 
    p.date_joined, 
    p.is_active, 
    p.created_at, 
    p.updated_at, 
    u.email::text
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id;
END;
$$ LANGUAGE plpgsql;

-- Recreate the view selecting from the secure function
CREATE OR REPLACE VIEW public.profiles_view AS
SELECT * FROM public.get_profiles();
