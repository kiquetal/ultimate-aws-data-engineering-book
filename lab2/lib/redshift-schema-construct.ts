import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as redshift from 'aws-cdk-lib/aws-redshiftserverless';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export interface RedshiftSchemaProps {
  workgroupName: string;
  databaseName: string;
  adminSecretArn: string;
  sqlAssetPath: string;
}

export class RedshiftSchemaConstruct extends Construct {
  constructor(scope: Construct, id: string, props: RedshiftSchemaProps) {
    super(scope, id);

    // Upload the SQL file to an S3 bucket
    const sqlBucket = new s3.Bucket(this, 'RedshiftSchemaSqlBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new s3deploy.BucketDeployment(this, 'DeployRedshiftSchemaSql', {
      sources: [s3deploy.Source.asset(path.dirname(props.sqlAssetPath))],
      destinationBucket: sqlBucket,
      destinationKeyPrefix: 'redshift-sql',
      prune: false,
    });

    // Create a Lambda function to run the SQL on Redshift
    const redshiftSchemaLambda = new lambda.Function(this, 'RedshiftSchemaLambda', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'redshift_schema_lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../assets')),
      timeout: cdk.Duration.minutes(15),
      memorySize: 256,
      environment: {
        PYTHONPATH: '/var/task'
      }
    });

    // Grant the Lambda function permissions to use Redshift Data API
    redshiftSchemaLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'redshift-data:ExecuteStatement',
        'redshift-data:DescribeStatement',
        'redshift-data:GetStatementResult'
      ],
      resources: ['*']
    }));

    // Grant the Lambda function permissions to read from the S3 bucket
    sqlBucket.grantRead(redshiftSchemaLambda);

    // Grant the Lambda function permissions to use the Redshift admin secret
    redshiftSchemaLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue'
      ],
      resources: [props.adminSecretArn]
    }));

    // Create a custom resource provider that uses the Lambda function
    const provider = new cr.Provider(this, 'RedshiftSchemaProvider', {
      onEventHandler: redshiftSchemaLambda,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK
    });

    // Create a custom resource that uses the provider
    new cdk.CustomResource(this, 'RunRedshiftSchemaSql', {
      serviceToken: provider.serviceToken,
      properties: {
        workgroupName: props.workgroupName,
        databaseName: props.databaseName,
        adminSecretArn: props.adminSecretArn,
        s3BucketName: sqlBucket.bucketName,
        s3KeyPrefix: 'redshift-sql',
        sqlFileName: 'redshift-tables.sql'
      }
    });
  }
}
