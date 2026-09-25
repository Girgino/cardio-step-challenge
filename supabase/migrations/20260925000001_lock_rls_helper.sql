-- Supabase's auto-RLS event-trigger helper does not need to be callable over the API.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
