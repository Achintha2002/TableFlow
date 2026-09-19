-- ==============================================================================
-- TableFlow: Phase 8 Menu Item Add-ons, Portions & Customizations Migration
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/azjjndqecpemltvdbkvy/sql
-- ==============================================================================

-- 1. ADD CUSTOMIZATIONS COLUMN TO MENU_ITEMS
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS customizations JSONB DEFAULT NULL;

-- 2. ADD SELECTED_CUSTOMIZATIONS COLUMN TO ORDER_ITEMS
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS selected_customizations JSONB DEFAULT NULL;

-- 3. ALLOW DIRECT TABLE DINE-IN ORDERS (IN ADDITION TO RESERVATION / QUEUE)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_check;
ALTER TABLE orders ADD CONSTRAINT orders_check 
CHECK (reservation_id IS NOT NULL OR queue_entry_id IS NOT NULL OR table_id IS NOT NULL);

-- 3. SEED RICH CUSTOMIZATION DATA ON POPULAR MENU ITEMS

-- Braised Short Rib (ID: 4)
UPDATE menu_items 
SET customizations = '{
  "sizes": [
    { "id": "reg", "name": "Regular Portion (250g)", "price_delta": 0, "is_available": true },
    { "id": "large", "name": "King Cut (400g)", "price_delta": 1200, "is_available": true }
  ],
  "addon_groups": [
    {
      "id": "sauce",
      "name": "Signature Sauce",
      "min_select": 1,
      "max_select": 1,
      "options": [
        { "id": "red_wine", "name": "Red Wine Glaze", "price": 0, "max_qty": 1, "is_available": true },
        { "id": "truffle_pepper", "name": "Truffle Peppercorn", "price": 250, "max_qty": 1, "is_available": true },
        { "id": "chimichurri", "name": "Herb Chimichurri", "price": 0, "max_qty": 1, "is_available": true }
      ]
    },
    {
      "id": "gourmet_extras",
      "name": "Gourmet Add-ons",
      "min_select": 0,
      "max_select": 3,
      "options": [
        { "id": "bone_marrow", "name": "Roasted Bone Marrow", "price": 800, "max_qty": 1, "is_available": true },
        { "id": "extra_mash", "name": "Extra Truffle Mash", "price": 450, "max_qty": 2, "is_available": true },
        { "id": "asparagus", "name": "Charred Asparagus", "price": 350, "max_qty": 1, "is_available": true },
        { "id": "foie_gras", "name": "Seared Foie Gras", "price": 1200, "max_qty": 1, "is_available": false }
      ]
    }
  ],
  "preferences": ["Medium Rare", "Medium", "Medium Well", "Well Done"]
}'::jsonb
WHERE id = 4;

-- Truffle Mushroom Risotto (ID: 5)
UPDATE menu_items 
SET customizations = '{
  "sizes": [
    { "id": "reg", "name": "Standard Bowl", "price_delta": 0, "is_available": true },
    { "id": "sharing", "name": "Sharing Platter", "price_delta": 900, "is_available": true }
  ],
  "addon_groups": [
    {
      "id": "cheese_extras",
      "name": "Cheeses & Toppings",
      "min_select": 0,
      "max_select": 2,
      "options": [
        { "id": "black_truffle", "name": "Shaved Fresh Truffle", "price": 650, "max_qty": 1, "is_available": true },
        { "id": "parmesan_crisp", "name": "Aged Parmesan Crisp", "price": 200, "max_qty": 2, "is_available": true },
        { "id": "wild_porcini", "name": "Wild Porcini Mushrooms", "price": 400, "max_qty": 1, "is_available": true }
      ]
    }
  ],
  "preferences": ["Classic Al Dente", "Extra Creamy", "Less Cream"]
}'::jsonb
WHERE id = 5;

-- Wagyu Beef Carpaccio (ID: 3)
UPDATE menu_items 
SET customizations = '{
  "sizes": [
    { "id": "reg", "name": "Single Starter", "price_delta": 0, "is_available": true },
    { "id": "large", "name": "Double Portion", "price_delta": 1500, "is_available": true }
  ],
  "addon_groups": [
    {
      "id": "dressing",
      "name": "Artisanal Dressing",
      "min_select": 1,
      "max_select": 1,
      "options": [
        { "id": "truffle_aioli", "name": "Truffle Aioli", "price": 0, "max_qty": 1, "is_available": true },
        { "id": "lemon_caper", "name": "Lemon Caper Vinaigrette", "price": 0, "max_qty": 1, "is_available": true }
      ]
    },
    {
      "id": "garnishes",
      "name": "Premium Garnishes",
      "min_select": 0,
      "max_select": 2,
      "options": [
        { "id": "capers", "name": "Fried Baby Capers", "price": 150, "max_qty": 1, "is_available": true },
        { "id": "microgreens", "name": "Organic Microgreens", "price": 180, "max_qty": 1, "is_available": true }
      ]
    }
  ],
  "preferences": ["Light Dressing", "Dressing on Side"]
}'::jsonb
WHERE id = 3;

-- Watermelon juice (ID: 8)
UPDATE menu_items 
SET customizations = '{
  "sizes": [
    { "id": "reg", "name": "Regular (350ml)", "price_delta": 0, "is_available": true },
    { "id": "large", "name": "Pitcher (750ml)", "price_delta": 450, "is_available": true }
  ],
  "addon_groups": [
    {
      "id": "sweetness",
      "name": "Sweetness Level",
      "min_select": 1,
      "max_select": 1,
      "options": [
        { "id": "no_sugar", "name": "No Added Sugar", "price": 0, "max_qty": 1, "is_available": true },
        { "id": "honey", "name": "Wild Honey", "price": 60, "max_qty": 1, "is_available": true },
        { "id": "classic", "name": "Classic Cane Sugar", "price": 0, "max_qty": 1, "is_available": true }
      ]
    },
    {
      "id": "refreshers",
      "name": "Fresh Infusions",
      "min_select": 0,
      "max_select": 2,
      "options": [
        { "id": "mint", "name": "Crushed Mint Leaves", "price": 50, "max_qty": 1, "is_available": true },
        { "id": "chia", "name": "Chia Seeds", "price": 80, "max_qty": 1, "is_available": true },
        { "id": "lime", "name": "Fresh Lime Squeeze", "price": 50, "max_qty": 1, "is_available": true }
      ]
    }
  ],
  "preferences": ["Extra Ice", "No Ice", "Less Ice"]
}'::jsonb
WHERE id = 8;
