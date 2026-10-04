-- Create the media bucket.
insert into storage.buckets (id, name, public)
values ('media','media',true)
on conflict (id) do nothing;

create policy "public media read"
on storage.objects for select
using (bucket_id='media');

create policy "authenticated media upload"
on storage.objects for insert
to authenticated
with check (bucket_id='media');

create policy "owner media update"
on storage.objects for update
to authenticated
using (bucket_id='media' and owner_id=auth.uid());

create policy "owner media delete"
on storage.objects for delete
to authenticated
using (bucket_id='media' and owner_id=auth.uid());
