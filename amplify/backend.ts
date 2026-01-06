import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource'; // We need to create this!
import { generateStaticJson } from './functions/generate-static-json/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  generateStaticJson,
});

/*
 * PERMISSIONS & WIRING
 * 1. Lambda needs to Read DynamoDB (BusinessCard)
 * 2. Lambda needs to Write S3 (public/businesses.json)
 */

// 1. Grant Data Access
const businessTable = backend.data.resources.tables['BusinessCard'];
(backend.generateStaticJson.resources.lambda as any).addEnvironment(
  'BUSINESS_CARD_TABLE_NAME',
  businessTable.tableName
);
businessTable.grantReadData(backend.generateStaticJson.resources.lambda);

// 2. Grant Storage Access
const bucket = backend.storage.resources.bucket;
(backend.generateStaticJson.resources.lambda as any).addEnvironment(
  'STORAGE_BUCKET_NAME',
  bucket.bucketName
);
bucket.grantWrite(backend.generateStaticJson.resources.lambda);
