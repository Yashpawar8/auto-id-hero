
-- Vehicles registered with fines
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  owner_name TEXT,
  fine_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX vehicles_user_plate_idx ON public.vehicles(user_id, UPPER(plate));
CREATE INDEX vehicles_plate_idx ON public.vehicles(UPPER(plate));

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own vehicles select" ON public.vehicles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own vehicles insert" ON public.vehicles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own vehicles update" ON public.vehicles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own vehicles delete" ON public.vehicles FOR DELETE USING (auth.uid() = user_id);

-- Detection history
CREATE TABLE public.detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  image_url TEXT,
  matched_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX detections_user_idx ON public.detections(user_id, created_at DESC);

ALTER TABLE public.detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own detections select" ON public.detections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own detections insert" ON public.detections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own detections delete" ON public.detections FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER vehicles_set_updated_at BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for plate photos
INSERT INTO storage.buckets (id, name, public) VALUES ('plates', 'plates', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "plates public read" ON storage.objects FOR SELECT
USING (bucket_id = 'plates');

CREATE POLICY "plates auth upload" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'plates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "plates auth delete" ON storage.objects FOR DELETE
USING (bucket_id = 'plates' AND auth.uid()::text = (storage.foldername(name))[1]);
