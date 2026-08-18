require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Seed Table Categories
  const { data: categories, error: catErr } = await supabase
    .from('table_categories')
    .upsert([
      { id: 1, name: 'Main Dining', description: 'Central seating area' },
      { id: 2, name: 'Window Seating', description: 'Great views', extra_charge: 10.00 },
      { id: 3, name: 'VIP Lounge', description: 'Exclusive private area', extra_charge: 50.00 }
    ])
    .select();
  
  if (catErr) console.error('Error seeding categories:', catErr.message);
  else console.log('✅ Categories seeded.');

  // 2. Seed Restaurant Tables (for Floor Plan)
  const tables = [
    { table_number: 1, category_id: 1, capacity: 2, x_coordinate: 50, y_coordinate: 50 },
    { table_number: 2, category_id: 1, capacity: 4, x_coordinate: 180, y_coordinate: 50 },
    { table_number: 3, category_id: 2, capacity: 2, x_coordinate: 50, y_coordinate: 180 },
    { table_number: 4, category_id: 3, capacity: 6, x_coordinate: 180, y_coordinate: 180 }, // VIP
    { table_number: 5, category_id: 1, capacity: 8, x_coordinate: 50, y_coordinate: 310 },
  ];
  
  // Clean old tables first to avoid unique constraint issues if running multiple times
  await supabase.from('restaurant_tables').delete().neq('id', 0);
  
  const { error: tblErr } = await supabase.from('restaurant_tables').insert(tables);
  if (tblErr) console.error('Error seeding tables:', tblErr.message);
  else console.log('✅ Tables seeded.');

  // 3. Seed Menu Items
  const menuItems = [
    {
      name: 'Seared Hokkaido Scallops',
      description: 'Pan-seared premium scallops, served atop a silky cauliflower purée with crispy pancetta dust.',
      price: 28.00,
      category: 'Starters',
      image_url: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?q=80&w=500&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Artisanal Burrata',
      description: 'Fresh Italian burrata with virgin heirloom tomatoes, basil oil, and aged balsamic.',
      price: 22.00,
      category: 'Starters',
      image_url: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?q=80&w=500&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Wagyu Beef Carpaccio',
      description: 'Thinly sliced grade A5 wagyu, truffle aioli, shaved parmesan, and micro arugula.',
      price: 34.00,
      category: 'Starters',
      image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=500&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Braised Short Rib',
      description: 'Slow-cooked beef short rib with truffle mashed potatoes and red wine reduction.',
      price: 42.00,
      category: 'Mains',
      image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=500&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Truffle Mushroom Risotto',
      description: 'Creamy arborio rice with wild mushrooms, parmesan crisp, and white truffle oil.',
      price: 26.00,
      category: 'Mains',
      image_url: 'https://images.unsplash.com/photo-1633337474564-1d94faee6266?q=80&w=500&auto=format&fit=crop',
      is_available: true
    }
  ];

  await supabase.from('menu_items').delete().neq('id', 0);
  const { error: menuErr } = await supabase.from('menu_items').insert(menuItems);
  if (menuErr) console.error('Error seeding menu:', menuErr.message);
  else console.log('✅ Menu items seeded.');

  console.log('🎉 Seeding complete!');
  process.exit(0);
}

seed();
