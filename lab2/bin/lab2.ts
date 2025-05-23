#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Lab2Stack } from '../lib/lab2-stack';

const app = new cdk.App();

// Add project tag to all resources
cdk.Tags.of(app).add('Project', 'ultimate-bootcamp-data-engineering');

// Determine environment from context or environment variable
const deployEnv = app.node.tryGetContext('env') || process.env.DEPLOY_ENV || 'default';

if (deployEnv === 'prod') {
  console.log('Deploying to production environment');
  new Lab2Stack(app, 'Lab2ProdStack', {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
    /* Add any prod-specific props here */
  });
} else {
  new Lab2Stack(app, 'Lab2Stack', {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
    /* Add any default-specific props here */
  });
}
