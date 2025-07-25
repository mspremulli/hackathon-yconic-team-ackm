# MongoDB Configuration Update

## Database Configuration
- **Database Name**: `hackathon-07-25-2025`
- **Collection Prefix**: `social_`

## Changes Made

1. **Updated MongoDB Service** (`src/services/mongodb.ts`):
   - Added support for `MONGODB_DB_NAME` environment variable
   - Implemented automatic collection name prefixing with `social_`
   - All collections will be prefixed automatically (e.g., `posts` → `social_posts`)

2. **Environment Variables**:
   - Added `MONGODB_DB_NAME=hackathon-07-25-2025` to `.env`
   - Updated `.env.example` with the new variable

## Collection Names

The following collections will be created with the `social_` prefix:
- `social_posts` - Social media posts from all platforms
- `social_analyses` - Sentiment analysis results
- `social_summaries` - Dashboard summaries
- `social_startups` - Startup analysis data
- `social_test` - Test documents

## Testing

Run the MongoDB connection test:
```bash
npx tsx test-mongodb.ts
```

This will verify:
- Connection to MongoDB Atlas
- Database selection
- Collection prefixing
- Basic CRUD operations