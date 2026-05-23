
ALTER FUNCTION public.set_updated_at() SET search_path = public;

DROP POLICY "plates public read" ON storage.objects;

-- Only owners can list/select; public-link reads still work via signed/public-bucket URL fetches at the CDN edge for the 'plates' bucket
CREATE POLICY "plates owner read" ON storage.objects FOR SELECT
USING (bucket_id = 'plates' AND auth.uid()::text = (storage.foldername(name))[1]);
