-- Seed the single company record (Goodison Park Properties)
INSERT INTO companies (
  id,
  name,
  slug,
  industry,
  country,
  city,
  address,
  phone,
  email,
  website,
  subscription_plan,
  is_active
) VALUES (
  'c06f2d3e-4db5-4849-88bd-f4fa72970002',
  'Goodison Park Properties',
  'goodison-park-properties',
  'Real Estate',
  'Uganda',
  'Kampala',
  'Goodison Park, Kampala',
  '+256 414 123456',
  'info@goodisonpark.com',
  'https://goodisonparkproperties.com',
  'enterprise',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  industry = EXCLUDED.industry,
  country = EXCLUDED.country,
  city = EXCLUDED.city,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  website = EXCLUDED.website,
  subscription_plan = EXCLUDED.subscription_plan,
  is_active = EXCLUDED.is_active;
