-- Create profiles_view view to pre-join with auth.users email
CREATE OR REPLACE VIEW public.profiles_view AS
SELECT p.*, u.email
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id;
