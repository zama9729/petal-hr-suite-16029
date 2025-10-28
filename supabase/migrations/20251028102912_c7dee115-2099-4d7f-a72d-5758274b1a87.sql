-- Delete all data in correct order to avoid foreign key violations
DELETE FROM timesheet_entries;
DELETE FROM timesheets;
DELETE FROM leave_requests;
DELETE FROM onboarding_data;
DELETE FROM employees;
DELETE FROM user_roles;
DELETE FROM profiles;
DELETE FROM leave_policies;
DELETE FROM workflows;
DELETE FROM organizations;