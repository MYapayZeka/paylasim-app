import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================`);
  console.log(`🚀 PaylaşIM Sunucusu Aktif!`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🩺 Sağlık Kontrolü: /health`);
  console.log(`=================================`);
});