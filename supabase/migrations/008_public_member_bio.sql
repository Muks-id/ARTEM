CREATE OR REPLACE VIEW public.member_directory
  WITH (security_invoker = false)
AS
  SELECT id, full_name, username, avatar_url, bio
  FROM public.profiles;

GRANT SELECT ON public.member_directory TO authenticated;
REVOKE ALL ON public.member_directory FROM PUBLIC, anon;
