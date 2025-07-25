import 'dotenv/config';
import { connectToMongoDB, saveToMongoDB, queryMongoDB, closeMongoDB } from './src/services/mongodb.js';

async function testMongoDB() {
  console.log('🧪 Testing MongoDB Connection\n');
  
  console.log('MongoDB URI:', process.env.MONGODB_URI?.replace(/:[^:]+@/, ':****@'));
  console.log('MongoDB Database:', process.env.MONGODB_DB_NAME);
  console.log('\n');

  try {
    // Test connection
    console.log('1. Testing connection...');
    const db = await connectToMongoDB();
    console.log('✅ Connected successfully!\n');

    // Test save
    console.log('2. Testing save to collection...');
    await saveToMongoDB('test', {
      type: 'connection_test',
      timestamp: new Date(),
      message: 'MCP server MongoDB test'
    });
    console.log('✅ Saved test document\n');

    // Test query
    console.log('3. Testing query...');
    const results = await queryMongoDB('test', { type: 'connection_test' });
    console.log(`✅ Found ${results.length} test documents\n`);

    // Show collections
    console.log('4. Listing collections with "social_" prefix:');
    const collections = await db.collections();
    const socialCollections = collections
      .map(c => c.collectionName)
      .filter(name => name.startsWith('social_'));
    
    if (socialCollections.length > 0) {
      socialCollections.forEach(name => console.log(`   - ${name}`));
    } else {
      console.log('   (No social_ collections found yet)');
    }
    console.log('\n');

    console.log('🎉 MongoDB connection test successful!');
    console.log('\nCollection naming:');
    console.log('- All collections will be prefixed with "social_"');
    console.log('- Example: posts → social_posts');
    console.log('- Example: analyses → social_analyses');

  } catch (error) {
    console.error('❌ MongoDB test failed:', error);
  } finally {
    await closeMongoDB();
    console.log('\n✅ Connection closed');
  }
}

testMongoDB().catch(console.error);