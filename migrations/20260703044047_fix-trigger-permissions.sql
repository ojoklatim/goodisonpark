-- Drop the trigger to allow safe function alteration
DROP TRIGGER IF EXISTS tr_check_invite_email_uniqueness ON employee_invitations;

-- Redefine check_invite_email_uniqueness as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.check_invite_email_uniqueness()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'An account with the email % already exists in the system.', NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER tr_check_invite_email_uniqueness
BEFORE INSERT OR UPDATE OF email ON employee_invitations
FOR EACH ROW
EXECUTE FUNCTION check_invite_email_uniqueness();
