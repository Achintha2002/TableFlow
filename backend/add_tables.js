require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addTables() {
  const newTables = [];
  for (let i = 6; i <= 20; i++) {
    newTables.push({
      table_number: i,
      capacity: i % 3 === 0 ? 6 : (i % 2 === 0 ? 4 : 2), // random capacities 2, 4, 6
      status: 'available'
    });
  }

  const { data, error } = await supabase.from('restaurant_tables').insert(newTables);
  if (error) {
    console.error('Error inserting tables:', error);
  } else {
    console.log('Successfully added 15 tables');
  }
}

addTables();
