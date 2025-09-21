const https = require('https');

// Test the database connection on Render
const testUrl = 'https://zipsea-backend.onrender.com/health/detailed';

https.get(testUrl, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('Health Check Response:');
      console.log('======================');
      console.log('Status:', result.status);
      console.log('Database:', result.database);
      console.log('Redis:', result.redis);

      if (result.database === 'disconnected' || !result.database) {
        console.log('\n❌ Database is not connected!');
        console.log('This explains why webhook events are not being created.');
        console.log('DATABASE_URL may not be set in Render environment variables.');
      } else {
        console.log('\n✅ Database is connected');
      }

      if (result.details) {
        console.log('\nDetails:');
        console.log(JSON.stringify(result.details, null, 2));
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
