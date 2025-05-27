import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as mwaa from 'aws-cdk-lib/aws-mwaa';

export interface MwaaConstructProps {
  vpc: ec2.IVpc;
  dagsBucket: s3.Bucket;
}

export class MwaaConstruct extends Construct {
  public readonly mwaaExecutionRole: iam.Role;
  public readonly mwaaSecurityGroup: ec2.SecurityGroup;
  public readonly mwaaEnvironment: mwaa.CfnEnvironment;

  constructor(scope: Construct, id: string, props: MwaaConstructProps) {
    super(scope, id);

    // Create a custom policy for MWAA web login token
    const mwaaWebLoginPolicy = new iam.Policy(this, 'MWAAWebLoginPolicy', {
      policyName: 'Lab2MWAAWebLoginPolicy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['airflow:CreateWebLoginToken'],
          resources: ['arn:aws:airflow:*:*:role/*/*'],
        }),
      ],
    });

    // Create an execution role for MWAA
    this.mwaaExecutionRole = new iam.Role(this, 'MWAAExecutionRole', {
      assumedBy: new iam.ServicePrincipal('airflow-env.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
      ],
      roleName: 'Lab2MWAAExecutionRole',
    });
    mwaaWebLoginPolicy.attachToRole(this.mwaaExecutionRole);

    // Create a security group specifically for MWAA
    this.mwaaSecurityGroup = new ec2.SecurityGroup(this, 'MWAASecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for MWAA environment',
      allowAllOutbound: true,
    });

    // Create a VPC endpoint for S3 (Gateway endpoint, required for MWAA private networking)
    new ec2.CfnVPCEndpoint(this, 'MWAAS3Endpoint', {
      vpcId: props.vpc.vpcId,
      serviceName: `com.amazonaws.${cdk.Stack.of(this).region}.s3`,
      routeTableIds: ['rtb-0dfed0011b5739620'],
      vpcEndpointType: 'Gateway',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:*',
            Resource: '*',
          },
        ],
      },
    });

    // Create required VPC endpoints for MWAA (Interface endpoints)
    const mwaaInterfaceEndpointServices = [
      'com.amazonaws.' + cdk.Stack.of(this).region + '.monitoring',
      'com.amazonaws.' + cdk.Stack.of(this).region + '.logs',
      'com.amazonaws.' + cdk.Stack.of(this).region + '.sqs',
      'com.amazonaws.' + cdk.Stack.of(this).region + '.kms',
    ];
    for (const service of mwaaInterfaceEndpointServices) {
      new ec2.CfnVPCEndpoint(this, `MWAAEndpoint${service.split('.').pop()}`, {
        vpcId: props.vpc.vpcId,
        serviceName: service,
        subnetIds: ['subnet-1398f35a', 'subnet-2dec5076'],
        securityGroupIds: [this.mwaaSecurityGroup.securityGroupId],
        vpcEndpointType: 'Interface',
        privateDnsEnabled: true,
      });
    }

    // Deploy requirements.txt to the bucket
    new s3deploy.BucketDeployment(this, 'DeployRequirements', {
      sources: [s3deploy.Source.asset('./assets')],
      destinationBucket: props.dagsBucket,
      destinationKeyPrefix: 'requirements',
    });

    // create a mwaa
    this.mwaaEnvironment = new mwaa.CfnEnvironment(this, 'MWAAEnvironment', {
      name: 'lab2-mwaa',
      environmentClass: 'mw1.small',
      sourceBucketArn: props.dagsBucket.bucketArn,
      requirementsS3Path: 'requirements/requirements.txt',
      dagS3Path: 'dags',
      networkConfiguration: {
        securityGroupIds: [this.mwaaSecurityGroup.securityGroupId],
        subnetIds: ['subnet-1398f35a', 'subnet-2dec5076'],
      },
      maxWorkers: 3,
      maxWebservers: 2,
      minWorkers: 1,
      webserverAccessMode: 'PUBLIC_ONLY',
      executionRoleArn: this.mwaaExecutionRole.roleArn,
      loggingConfiguration: {
        dagProcessingLogs: {
          enabled: true,
          logLevel: 'INFO',
        },
        schedulerLogs: {
          enabled: true,
          logLevel: 'INFO',
        },
        taskLogs: {
          enabled: true,
          logLevel: 'INFO',
        },
        webserverLogs: {
          enabled: true,
          logLevel: 'INFO',
        },
        workerLogs: {
          enabled: true,
          logLevel: 'INFO',
        },
      },
    });
  }
}

