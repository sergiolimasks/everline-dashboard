
-- Fix: Restrict admin ALL policies to authenticated role on client_offers, clients, user_campaign_access

-- client_offers
DROP POLICY IF EXISTS "Admins can manage client_offers" ON public.client_offers;
CREATE POLICY "Admins can manage client_offers"
ON public.client_offers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view client_offers" ON public.client_offers;
CREATE POLICY "Authenticated users can view client_offers"
ON public.client_offers
FOR SELECT
TO authenticated
USING (true);

-- clients
DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;
CREATE POLICY "Admins can manage clients"
ON public.clients
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
CREATE POLICY "Authenticated users can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (true);

-- user_campaign_access
DROP POLICY IF EXISTS "Admins can manage access" ON public.user_campaign_access;
CREATE POLICY "Admins can manage access"
ON public.user_campaign_access
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own access" ON public.user_campaign_access;
CREATE POLICY "Users can view own access"
ON public.user_campaign_access
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
