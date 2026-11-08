
create policy "uploads own read" on storage.objects for select to authenticated using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "uploads own insert" on storage.objects for insert to authenticated with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "uploads own delete" on storage.objects for delete to authenticated using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
