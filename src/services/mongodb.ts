import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

// Helper to prefix collection names with "social_"
function getCollectionName(collection: string): string {
  // If already prefixed, return as is
  if (collection.startsWith('social_')) {
    return collection;
  }
  // Otherwise add prefix
  return `social_${collection}`;
}

export async function connectToMongoDB(): Promise<Db> {
  if (db) return db;
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/startup_sentiment';
  const dbName = process.env.MONGODB_DB_NAME || 'startup_sentiment';
  
  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    console.error(`Connected to MongoDB database: ${dbName}`);
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function saveToMongoDB(collection: string, data: any | any[]): Promise<void> {
  try {
    const database = await connectToMongoDB();
    const collectionName = getCollectionName(collection);
    const col = database.collection(collectionName);
    
    if (Array.isArray(data)) {
      if (data.length > 0) {
        await col.insertMany(data);
      }
    } else {
      await col.insertOne(data);
    }
  } catch (error) {
    console.error(`Error saving to MongoDB collection ${collection}:`, error);
    // Don't throw - allow tools to continue even if DB save fails
  }
}

export async function queryMongoDB(collection: string, query: any, options?: any): Promise<any[]> {
  try {
    const database = await connectToMongoDB();
    const collectionName = getCollectionName(collection);
    const col = database.collection(collectionName);
    return await col.find(query, options).toArray();
  } catch (error) {
    console.error(`Error querying MongoDB collection ${collection}:`, error);
    return [];
  }
}

export async function aggregateMongoDB(collection: string, pipeline: any[]): Promise<any[]> {
  try {
    const database = await connectToMongoDB();
    const collectionName = getCollectionName(collection);
    const col = database.collection(collectionName);
    return await col.aggregate(pipeline).toArray();
  } catch (error) {
    console.error(`Error aggregating MongoDB collection ${collection}:`, error);
    return [];
  }
}

// Cleanup function
export async function closeMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}