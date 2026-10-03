const supabase = require('./src/config/supabase');

async function test() {
  console.log('Testing coupons table...');
  const { data, error } = await supabase.from('coupons').select('*').limit(5);
  console.log('Coupons result:', { data, error });

  console.log('Testing coupon_redemptions table...');
  const { data: redData, error: redError } = await supabase.from('coupon_redemptions').select('*').limit(5);
  console.log('Coupon redemptions result:', { redData, redError });
}

test().catch(console.error);
