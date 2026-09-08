const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function listPostcards() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data, error } = await supabase
    .from('postcards')
    .select('id, title, processing_status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Postales disponibles:');
    data.forEach(p => {
      console.log('- ID: ' + p.id);
      console.log('  Título: ' + (p.title || 'Sin título'));
      console.log('  Estado: ' + p.processing_status);
      console.log('  Creada: ' + p.created_at);
      console.log('');
    });
  }
}

listPostcards();