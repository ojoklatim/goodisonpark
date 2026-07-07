#!/bin/bash

echo "=== Table Schemas ==="
for table in companies employee_invitations quotations invoices attendance daily_activity_logs documents events; do
  echo "Table: $table"
  npx @insforge/cli db query "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '$table' AND table_schema = 'public'"
  echo "-----------------"
done

echo "=== Companies Row Count ==="
npx @insforge/cli db query "SELECT count(*) FROM companies"

echo "=== Checking profiles_view ==="
npx @insforge/cli db query "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles_view' AND table_schema = 'public'"

echo "=== Checking functions ==="
npx @insforge/cli db query "SELECT routine_name, routine_type, security_type FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('get_profiles', 'check_invite_email_uniqueness')"

echo "=== Testing functions ==="
npx @insforge/cli db query "SELECT get_profiles() LIMIT 1" || echo "get_profiles failed"
