-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for org-logos bucket
CREATE POLICY "Anyone can view org logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

CREATE POLICY "CEOs can upload their org logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-logos' AND
  (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid()) AND
  (has_role(auth.uid(), 'ceo'::app_role))
);

CREATE POLICY "CEOs can update their org logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'org-logos' AND
  (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid()) AND
  (has_role(auth.uid(), 'ceo'::app_role))
);

CREATE POLICY "CEOs can delete their org logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'org-logos' AND
  (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid()) AND
  (has_role(auth.uid(), 'ceo'::app_role))
);

-- Add logo_url to organizations table
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;