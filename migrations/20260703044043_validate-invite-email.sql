-- Backend validation: prevent inviting emails that already have registered user accounts in auth.users
CREATE OR REPLACE FUNCTION check_invite_email_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the email already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'An account with the email % already exists in the system.', NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_invite_email_uniqueness ON employee_invitations;
CREATE TRIGGER tr_check_invite_email_uniqueness
BEFORE INSERT OR UPDATE OF email ON employee_invitations
FOR EACH ROW
EXECUTE FUNCTION check_invite_email_uniqueness();
