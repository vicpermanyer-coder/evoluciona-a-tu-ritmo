revoke all on public.outfit_analyses from anon;
revoke insert, update, truncate, references, trigger on public.outfit_analyses from authenticated;
grant select, delete on public.outfit_analyses to authenticated;