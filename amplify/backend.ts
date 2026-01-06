import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource'; // We need to create this!
import { generateStaticJson } from './functions/generate-static-json/resource';
import { cardParser } from './functions/card-parser/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  generateStaticJson,
  cardParser,
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

// 3. Grant Bedrock Access to cardParser
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

backend.cardParser.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0',
    ],
  })
);
