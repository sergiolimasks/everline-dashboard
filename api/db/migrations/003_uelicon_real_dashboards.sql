-- 003: replace the placeholder "uelicon" offer (inherited from the original
-- Supabase migration) with the 4 real dashboards that the Panel routes expect.

DELETE FROM auth_everline.client_offers
WHERE offer_slug = 'uelicon';

INSERT INTO auth_everline.client_offers (client_id, offer_slug, label)
SELECT c.id, v.offer_slug, v.label
FROM auth_everline.clients c
CROSS JOIN (VALUES
  ('checkup-performance', 'Check-up da Vida Financeira'),
  ('formacao-consultor',  'Formação Consultor 360'),
  ('sistema-leads',       'Sistema de Leads'),
  ('distribuicao',        'Distribuição')
) AS v(offer_slug, label)
WHERE c.slug = 'uelicon'
ON CONFLICT (client_id, offer_slug) DO NOTHING;
