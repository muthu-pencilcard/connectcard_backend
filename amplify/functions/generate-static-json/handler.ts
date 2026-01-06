import type { Handler } from 'aws-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';

/*
 * GENERATE STATIC JSON (Offline Sync Engine)
 * Pattern: "S3 Dump & Sync"
 * Frequency: Hourly (Cron)
 * Purpose: Dumps all public BusinessCards to a static JSON file for mobile apps to download.
 */

const ddb = new DynamoDBClient({});
const s3 = new S3Client({});

const TABLE_NAME = process.env.BUSINESS_CARD_TABLE_NAME;
const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME;

export const handler: Handler = async (event) => {
    console.log('Starting Static JSON Generation...');

    try {
        // 1. Scan DynamoDB (Get all businesses)
        // Note: For production, use pagination (LastEvaluatedKey). For Phase 0 (<5000 records), Scan is fine.
        const scanResult = await ddb.send(new ScanCommand({
            TableName: TABLE_NAME,
            ProjectionExpression: 'slug, businessName, category, phone, city, location, logoUrl, tier, country, currency, hours'
        }));

        const businesses = scanResult.Items?.map(item => unmarshall(item)) || [];
        console.log(`Fetched ${businesses.length} businesses.`);

        // 2. Transform Data (Minimize payload)
        const payload = {
            meta: {
                generatedAt: new Date().toISOString(),
                count: businesses.length,
                version: "1.0"
            },
            data: businesses
        };

        // 3. Upload to S3 (Public Read)
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: 'public/businesses.json',
            Body: JSON.stringify(payload),
            ContentType: 'application/json',
            CacheControl: 'max-age=3600', // Cache for 1 hour
            ACL: 'public-read'
        }));

        console.log('Successfully uploaded public/businesses.json');
        return { statusCode: 200, body: 'Success' };

    } catch (error) {
        console.error('Error generating JSON:', error);
        return { statusCode: 500, body: JSON.stringify(error) };
    }
};
