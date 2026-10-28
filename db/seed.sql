INSERT INTO office (id, name, address, headcount, budget_per_person, dietary_notes) VALUES
  (1, 'Fieldnote HQ', '500 Howard St, San Francisco, CA', 30, 20, '6 vegetarian, 2 vegan, 1 gluten-free. 3 people don''t eat pork.');

INSERT INTO restaurants (id, name, cuisine, distance_miles, rating, review_count, catering_max, prep_minutes) VALUES
  ('olive-thyme', 'Olive & Thyme', 'mediterranean', 0.4, 4.7, 812, 40, 45),
  ('falafel-house', 'Falafel House', 'mediterranean', 0.8, 4.3, 390, 15, 30),
  ('cedar-grill', 'Cedar Grill', 'mediterranean', 1.1, 4.8, 1204, 60, 50),
  ('aegean-kitchen', 'Aegean Kitchen', 'mediterranean', 1.9, 4.1, 221, 30, 60),
  ('casa-verde', 'Casa Verde', 'mexican', 0.6, 4.5, 640, 50, 40),
  ('taqueria-sol', 'Taqueria Sol', 'mexican', 1.4, 4.6, 980, 20, 25),
  ('bangkok-bowl', 'Bangkok Bowl', 'thai', 0.7, 4.4, 512, 35, 40),
  ('saffron-table', 'Saffron Table', 'indian', 1.2, 4.6, 733, 45, 55),
  ('deli-co', 'Deli & Co', 'sandwiches', 0.3, 4.2, 455, 80, 30),
  ('umi-sushi', 'Umi Sushi', 'japanese', 0.9, 4.5, 601, 25, 50);

INSERT INTO menu_items (id, restaurant_id, name, price, serves, tags) VALUES
  ('ot-mezze', 'olive-thyme', 'Mezze platter (hummus, baba ghanoush, pita)', 48, 6, 'vegetarian,vegan'),
  ('ot-shawarma', 'olive-thyme', 'Chicken shawarma bowl', 15, 1, 'gluten-free'),
  ('ot-falafel-bowl', 'olive-thyme', 'Falafel bowl', 13, 1, 'vegetarian,vegan'),
  ('ot-lamb', 'olive-thyme', 'Lamb kofta plate', 19, 1, ''),
  ('ot-baklava', 'olive-thyme', 'Baklava tray', 24, 10, 'vegetarian'),

  ('fh-wrap', 'falafel-house', 'Falafel wrap', 10, 1, 'vegetarian,vegan'),
  ('fh-chicken-wrap', 'falafel-house', 'Chicken wrap', 12, 1, ''),
  ('fh-fries', 'falafel-house', 'Za''atar fries', 6, 2, 'vegetarian,vegan,gluten-free'),

  ('cg-platter', 'cedar-grill', 'Family grill platter', 85, 6, 'gluten-free'),
  ('cg-veg', 'cedar-grill', 'Grilled vegetable platter', 60, 6, 'vegetarian,vegan,gluten-free'),
  ('cg-salad', 'cedar-grill', 'Fattoush salad', 9, 1, 'vegetarian,vegan'),

  ('ak-gyro', 'aegean-kitchen', 'Pork gyro plate', 16, 1, ''),
  ('ak-spanakopita', 'aegean-kitchen', 'Spanakopita', 11, 1, 'vegetarian'),
  ('ak-greek-salad', 'aegean-kitchen', 'Greek salad', 10, 1, 'vegetarian,gluten-free'),

  ('cv-taco-bar', 'casa-verde', 'Taco bar (chicken, carnitas, veggie)', 150, 10, 'gluten-free'),
  ('cv-burrito', 'casa-verde', 'Veggie burrito', 12, 1, 'vegetarian'),
  ('cv-chips', 'casa-verde', 'Chips and guacamole', 18, 6, 'vegetarian,vegan,gluten-free'),

  ('ts-tacos', 'taqueria-sol', 'Al pastor tacos (3)', 11, 1, 'gluten-free'),
  ('ts-bowl', 'taqueria-sol', 'Black bean bowl', 11, 1, 'vegetarian,vegan,gluten-free'),

  ('bb-pad-thai', 'bangkok-bowl', 'Pad thai', 14, 1, ''),
  ('bb-green-curry', 'bangkok-bowl', 'Green curry with tofu', 14, 1, 'vegetarian,vegan,gluten-free'),
  ('bb-spring-rolls', 'bangkok-bowl', 'Spring rolls (12)', 20, 4, 'vegetarian,vegan'),

  ('st-tikka', 'saffron-table', 'Chicken tikka masala tray', 90, 8, 'gluten-free'),
  ('st-chana', 'saffron-table', 'Chana masala tray', 70, 8, 'vegetarian,vegan,gluten-free'),
  ('st-naan', 'saffron-table', 'Naan basket', 15, 6, 'vegetarian'),

  ('dc-box', 'deli-co', 'Sandwich box lunch', 16, 1, ''),
  ('dc-veg-box', 'deli-co', 'Veggie sandwich box lunch', 15, 1, 'vegetarian'),
  ('dc-salad', 'deli-co', 'Garden salad bowl', 11, 1, 'vegetarian,vegan,gluten-free'),

  ('us-platter', 'umi-sushi', 'Sushi party platter', 120, 6, 'gluten-free'),
  ('us-veg-rolls', 'umi-sushi', 'Vegetable roll platter', 70, 6, 'vegetarian,vegan');

INSERT INTO runs (id, request, status, final_message, model, started_at, finished_at) VALUES
  (1, 'tacos for the team on friday', 'done',
   'I recommend Casa Verde (0.6 mi): 3 taco bars and 3 chips and guacamole. $504 total, delivered by 12:40 PM. Want me to place the order?',
   'anthropic/claude-sonnet-5.5', '2026-10-23 18:02:11', '2026-10-23 18:02:39');

INSERT INTO run_steps (run_id, kind, name, input, output, error, duration_ms) VALUES
  (1, 'tool', 'get_user_context', '{}', '{"office":"Fieldnote HQ","headcount":30,"dietary_notes":"6 vegetarian, 2 vegan, 1 gluten-free. 3 people don''t eat pork."}', NULL, 4),
  (1, 'tool', 'search_nearby_restaurants', '{"cuisine":"mexican"}', '[{"id":"casa-verde","name":"Casa Verde","distance_miles":0.6},{"id":"taqueria-sol","name":"Taqueria Sol","distance_miles":1.4}]', NULL, 6),
  (1, 'tool', 'check_catering_capacity', '{"restaurant_id":"casa-verde","headcount":30}', '{"can_cater":true,"max":50}', NULL, 3),
  (1, 'tool', 'estimate_order', '{"restaurant_id":"casa-verde","items":[{"item_id":"cv-taco-bar","quantity":3},{"item_id":"cv-chips","quantity":3}]}', '{"total":504}', NULL, 5),
  (1, 'tool', 'propose_order', '{"restaurant_id":"casa-verde"}', '{"order_id":1}', NULL, 4);

INSERT INTO orders (id, run_id, restaurant_id, items, total, eta, status, created_at) VALUES
  (1, 1, 'casa-verde', '[{"item_id":"cv-taco-bar","name":"Taco bar (chicken, carnitas, veggie)","quantity":3,"price":150},{"item_id":"cv-chips","name":"Chips and guacamole","quantity":3,"price":18}]', 504, '12:40 PM', 'placed', '2026-10-23 18:02:39');
