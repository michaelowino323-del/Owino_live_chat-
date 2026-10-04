-- Run this AFTER you have created your account.
-- Replace the email with your actual account email.
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
