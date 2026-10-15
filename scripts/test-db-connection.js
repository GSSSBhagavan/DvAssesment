const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not defined.');
  process.exit(1);
}

async function testConnection() {
  try {
    console.log('Attempting to connect to the database...');
    const conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000 // 5 seconds timeout
    });
    console.log('✅ Connection successful!');
    console.log(`Database Name: ${conn.connection.name}`);
    await mongoose.disconnect();
    console.log('Connection closed safely.');
  } catch (error) {
    console.error('❌ Connection failed!');
    
    // Sanitize and categorize error messages
    if (error.name === 'MongoServerSelectionError') {
      console.error('Likely cause: Network connectivity issue or IP address is not whitelisted in MongoDB Atlas.');
    } else if (error.name === 'MongoServerError' && error.code === 8000) {
      console.error('Likely cause: Invalid credentials (username or password).');
    } else if (error.message.includes('bad auth')) {
      console.error('Likely cause: Authentication failed (Invalid credentials).');
    } else {
      console.error('Likely cause: Invalid connection string or DNS issue.');
    }
    
    // Output sanitized message
    console.error(`Sanitized Error Details: ${error.name} - ${error.message.replace(MONGODB_URI, '<REDACTED_URI>')}`);
    process.exit(1);
  }
}

testConnection();
