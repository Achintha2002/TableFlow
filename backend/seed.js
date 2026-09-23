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
    // Starters
    {
      name: 'Seared Hokkaido Scallops',
      description: 'Pan-seared premium scallops, served atop a silky cauliflower purée with crispy pancetta dust.',
      price: 28.00,
      category: 'Starters',
      image_url: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Artisanal Burrata',
      description: 'Fresh Italian burrata with virgin heirloom tomatoes, basil oil, and aged balsamic glaze.',
      price: 22.00,
      category: 'Starters',
      image_url: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Wagyu Beef Carpaccio',
      description: 'Thinly sliced grade A5 wagyu, truffle aioli, shaved parmesan, caper berries, and micro arugula.',
      price: 34.00,
      category: 'Starters',
      image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Lobster Bisque Velouté',
      description: 'Velvety Maine lobster bisque infused with aged cognac and tarragon crème fraîche.',
      price: 24.00,
      category: 'Starters',
      image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Truffle & Taleggio Arancini',
      description: 'Crispy carnaroli saffron rice croquettes filled with melted taleggio cheese and roasted garlic aioli.',
      price: 18.00,
      category: 'Starters',
      image_url: 'https://images.unsplash.com/photo-1541529086526-db283c563270?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },

    // Mains
    {
      name: 'Braised Short Rib',
      description: 'Slow-cooked beef short rib with truffle mashed potatoes and rich Cabernet Sauvignon reduction.',
      price: 42.00,
      category: 'Mains',
      image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Truffle Mushroom Risotto',
      description: 'Creamy carnaroli rice with wild forest mushrooms, 24-month Parmigiano crisp, and white truffle essence.',
      price: 26.00,
      category: 'Mains',
      image_url: 'https://images.unsplash.com/photo-1633337474564-1d94faee6266?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Chilean Sea Bass',
      description: 'Pan-roasted Chilean sea bass with sweet miso glaze, tender baby bok choy, and lemongrass dashi.',
      price: 48.00,
      category: 'Mains',
      image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Prime Dry-Aged Ribeye',
      description: '28-day aged USDA Prime ribeye steak, roasted bone marrow, charred rosemary herb butter, and sea salt.',
      price: 56.00,
      category: 'Mains',
      image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Handmade Tagliolini al Tartufo',
      description: 'Fresh artisanal egg pasta twirled in French cultured butter, Parmigiano Reggiano, and freshly shaved black truffle.',
      price: 32.00,
      category: 'Mains',
      image_url: 'https://images.unsplash.com/photo-1621996346565-e3d5d62816f1?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Pan-Roasted Spiced Duck Breast',
      description: 'Magret duck breast with blood orange Grand Marnier reduction, parsnip purée, and honey-glazed baby carrots.',
      price: 38.00,
      category: 'Mains',
      image_url: 'https://images.unsplash.com/photo-1514944298352-7b0032c25345?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },

    // Desserts
    {
      name: 'Valrhona Grand Cru Soufflé',
      description: 'Warm single-origin Valrhona dark chocolate soufflé accompanied by Tahitian vanilla bean gelato.',
      price: 18.00,
      category: 'Desserts',
      image_url: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Artisanal Pistachio Tiramisu',
      description: 'Bronte pistachio mascarpone cream layered with espresso-soaked savoiardi and crushed roasted pistachios.',
      price: 16.00,
      category: 'Desserts',
      image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Madagascar Vanilla Crème Brûlée',
      description: 'Velvety custard base topped with a brittle caramelized turbinado shell and fresh wild raspberries.',
      price: 15.00,
      category: 'Desserts',
      image_url: 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Mango & Passion Fruit Panna Cotta',
      description: 'Silky coconut cream panna cotta with Alphonso mango coulis, passion fruit pulp, and candied mint.',
      price: 14.00,
      category: 'Desserts',
      image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },

    // Drinks
    {
      name: 'Smoked Rosemary Old Fashioned',
      description: 'Small-batch Kentucky bourbon, Angostura bitters, pure maple syrup, infused with torch-smoked organic rosemary.',
      price: 20.00,
      category: 'Drinks',
      image_url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Botanical Hibiscus Spritz',
      description: 'Artisanal London dry gin, wild hibiscus flower reduction, elderflower liqueur, topped with crisp chilled Prosecco.',
      price: 16.00,
      category: 'Drinks',
      image_url: 'https://images.unsplash.com/photo-1556881286-fc6915169721?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Imperial Matcha Ceremony Latte',
      description: 'First-harvest ceremonial grade Uji matcha whisked with silky steamed oat milk and raw wildflower honey.',
      price: 12.00,
      category: 'Drinks',
      image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Yuzu Lychee Sparkler',
      description: 'Refreshing non-alcoholic elixir of Japanese yuzu juice, white lychee nectar, fresh mint, and sparkling mineral water.',
      price: 14.00,
      category: 'Drinks',
      image_url: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?q=80&w=600&auto=format&fit=crop',
      is_available: true
    },
    {
      name: 'Single-Origin Ethiopian Pour-Over',
      description: 'Specialty washed Yirgacheffe coffee beans presenting floral jasmine and citrus notes, freshly brewed.',
      price: 10.00,
      category: 'Drinks',
      image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600&auto=format&fit=crop',
      is_available: true
    }
  ];

  await supabase.from('menu_items').delete().neq('id', 0);
  const { error: menuErr } = await supabase.from('menu_items').insert(menuItems);
  if (menuErr) console.error('Error seeding menu:', menuErr.message);
  else console.log('✅ 20 Menu items seeded.');

  console.log('🎉 Seeding complete!');
  process.exit(0);
}

seed();
