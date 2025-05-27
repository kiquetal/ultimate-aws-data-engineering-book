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
  sqlBucket: s3.IBucket;
}

export class RedshiftSchemaConstruct extends Construct {
  constructor(scope: Construct, id: string, props: RedshiftSchemaProps) {
    super(scope, id);

    // Deploy the SQL file to the provided S3 bucket
    new s3deploy.BucketDeployment(this, 'DeployRedshiftSchemaSql', {
      sources: [s3deploy.Source.asset(path.dirname(props.sqlAssetPath))],
      destinationBucket: props.sqlBucket,
      destinationKeyPrefix: 'redshift-sql',
      prune: false,
    });

    // Create a Lambda Layer for Python dependencies (excluding boto3/botocore)
    const redshiftLayer = new lambda.LayerVersion(this, 'RedshiftSchemaLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../assets/layers'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash', '-c',
            [
              'pip install -r requirements.txt -t /asset-output/python',
              'cp -au /asset-input/* /asset-output/python/'
            ].join(' && ')
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'Layer with Redshift schema dependencies (no boto3/botocore)',
    });

    // Create a Lambda function to run the SQL on Redshift (code only, no requirements)
    const redshiftSchemaLambda = new lambda.Function(this, 'RedshiftSchemaLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'redshift_schema_lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../assets'), {
        exclude: ['layers/requirements.txt'],
      }),
      timeout: cdk.Duration.minutes(15),
      memorySize: 256,
      environment: {
        PYTHONPATH: '/opt',
        WORKGROUP_NAME: props.workgroupName,
        DATABASE_NAME: props.databaseName,
        ADMIN_SECRET_ARN: props.adminSecretArn,
        S3_BUCKET_NAME: props.sqlBucket.bucketName,
        S3_KEY_PREFIX: 'redshift-sql',
        SQL_FILE_NAME: 'redshift-tables.sql',
      },
      layers: [redshiftLayer],
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
    props.sqlBucket.grantRead(redshiftSchemaLambda);

    // Grant the Lambda function permissions to use the Redshift admin secret
    redshiftSchemaLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue'
      ],
      resources: [props.adminSecretArn]
    }));
  }
}
