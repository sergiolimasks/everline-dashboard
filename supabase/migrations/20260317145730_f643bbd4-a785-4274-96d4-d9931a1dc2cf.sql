
-- Create clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage clients"
ON public.clients FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view clients"
ON public.clients FOR SELECT
TO authenticated
USING (true);

-- Create client_offers table to link offers/projects to clients
CREATE TABLE public.client_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  offer_slug text NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id, offer_slug)
);

ALTER TABLE public.client_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client_offers"
ON public.client_offers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view client_offers"
ON public.client_offers FOR SELECT
TO authenticated
USING (true);

-- Seed initial data: Uelicon Venâncio
INSERT INTO public.clients (name, slug) VALUES ('Uelicon Venâncio', 'uelicon');

INSERT INTO public.client_offers (client_id, offer_slug, label)
SELECT c.id, 'uelicon', 'Check-up da Vida Financeira'
FROM public.clients c WHERE c.slug = 'uelicon';
