-- Make plates bucket private
UPDATE storage.buckets SET public = false WHERE id = 'plates';

-- Defense-in-depth: explicit UPDATE policy on detections
CREATE POLICY "own detections update"
ON public.detections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);