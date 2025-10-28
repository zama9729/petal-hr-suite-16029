-- Delete all auth users (this will cascade delete everything)
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    PERFORM auth.uid();  -- Just to ensure we're in the right context
    DELETE FROM auth.users WHERE id = user_record.id;
  END LOOP;
END $$;