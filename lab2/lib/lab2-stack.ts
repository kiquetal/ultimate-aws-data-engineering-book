import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as redshift from 'aws-cdk-lib/aws-redshiftserverless';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as mwaa from 'aws-cdk-lib/aws-mwaa'
export class Lab2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a secret for the Redshift Serverless admin user password
    const adminUserSecret = new secretsmanager.Secret(this, 'RedshiftServerlessAdminUserSecret', {
      secretName: 'redshift-serverless-admin-user-secret',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 16,
      },
    });

    // Create an IAM role for Redshift Serverless with S3 full access
    const redshiftS3Role = new iam.Role(this, 'RedshiftServerlessS3Role', {
      assumedBy: new iam.ServicePrincipal('redshift-serverless.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
      ],
      roleName: 'Lab2RedshiftServerlessS3Role',
    });

    // Create a security group for Redshift Serverless
    const redshiftSecurityGroup = new ec2.SecurityGroup(this, 'RedshiftServerlessSecurityGroup', {
      vpc: ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true }),
      description: 'Security group for Redshift Serverless allowing port 5432',
      allowAllOutbound: true,
    });
    redshiftSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(5432), 'Allow Redshift access on port 5432');

    // Create a Redshift Serverless namespace
    const namespace = new redshift.CfnNamespace(this, 'RedshiftServerlessNamespace', {
      namespaceName: 'lab2-namespace',
      adminUsername: 'admin',
      adminUserPassword: adminUserSecret.secretValueFromJson('password').unsafeUnwrap(),
      dbName: 'lab2db',
      defaultIamRoleArn: redshiftS3Role.roleArn,
      iamRoles: [redshiftS3Role.roleArn],
      logExports: ['userlog', 'connectionlog', 'useractivitylog'],
      tags: [
        {
          key: 'Environment',
          value: 'Development',
        },
      ],
    });

    // Create a Redshift Serverless workgroup
    const workgroup = new redshift.CfnWorkgroup(this, 'RedshiftServerlessWorkgroup', {
      workgroupName: 'lab2-workgroup',
      namespaceName: namespace.namespaceName,
      baseCapacity: 8, // RPUs (Redshift Processing Units)
      enhancedVpcRouting: false,
      publiclyAccessible: true,
      securityGroupIds: [redshiftSecurityGroup.securityGroupId],
      tags: [
        {
          key: 'Environment',
          value: 'Development',
        },
      ],
    });

    // Add dependency to ensure namespace is created before workgroup
    workgroup.addDependency(namespace);

    // Output the Redshift Serverless namespace and workgroup names
    new cdk.CfnOutput(this, 'RedshiftServerlessNamespaceName', {
      value: namespace.namespaceName,
      description: 'The name of the Redshift Serverless namespace',
    });

    new cdk.CfnOutput(this, 'RedshiftServerlessWorkgroupName', {
      value: workgroup.workgroupName,
      description: 'The name of the Redshift Serverless workgroup',
    });

    new cdk.CfnOutput(this, 'RedshiftServerlessSecretArn', {
      value: adminUserSecret.secretArn,
      description: 'The ARN of the secret containing the Redshift Serverless admin user credentials',
    });

    // Output the IAM role ARN
    new cdk.CfnOutput(this, 'RedshiftServerlessS3RoleArn', {
      value: redshiftS3Role.roleArn,
      description: 'The ARN of the IAM role with S3 full access for Redshift Serverless',
    });

    // Create the S3 bucket for Airflow DAGs
    const dagsBucket = new s3.Bucket(this, 'NLAirflowDagsKiquetal', {
      bucketName: 'nl-airflow-dags-kiquetal',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Deploy requirements.txt to the bucket
    new s3deploy.BucketDeployment(this, 'DeployRequirements', {
      sources: [s3deploy.Source.asset('./assets')], // Use the directory containing requirements.txt
      destinationBucket: dagsBucket,
      destinationKeyPrefix: 'requirements', // root of the bucket
    });

    // Create a custom policy for MWAA web login token
    const mwaaWebLoginPolicy = new iam.Policy(this, 'MWAAWebLoginPolicy', {
      policyName: 'Lab2MWAAWebLoginPolicy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['airflow:CreateWebLoginToken'],
          resources: ['arn:aws:airflow:*:*:role/*/*'], // Allow for every airflow role in every environment
        }),
      ],
    });

    // Create an execution role for MWAA
    const mwaaExecutionRole = new iam.Role(this, 'MWAAExecutionRole', {
      assumedBy: new iam.ServicePrincipal('airflow-env.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
      ],
      roleName: 'Lab2MWAAExecutionRole',
    });
    mwaaWebLoginPolicy.attachToRole(mwaaExecutionRole);

    // Create a security group specifically for MWAA
    const mwaaSecurityGroup = new ec2.SecurityGroup(this, 'MWAASecurityGroup', {
      vpc: ec2.Vpc.fromLookup(this, 'DefaultVpcForMWAA', { isDefault: true }),
      description: 'Security group for MWAA environment',
      allowAllOutbound: true,
    });

    // create a mwaa
    const mwaaC = new mwaa.CfnEnvironment(this, 'MWAAEnvironment', {
      name: 'lab2-mwaa',
      environmentClass: 'mw1.small',
      sourceBucketArn: dagsBucket.bucketArn,
      requirementsS3Path : 'requirements/requirements.txt',
      dagS3Path: 'dags',
      networkConfiguration: {
        securityGroupIds: [mwaaSecurityGroup.securityGroupId],
        subnetIds: ec2.Vpc.fromLookup(this, 'DefaultNVpc2', { isDefault: true })
          .selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }).subnetIds.slice(0, 2),
      },
      maxWorkers: 3,
      maxWebservers: 2,
      minWorkers:1,
      webserverAccessMode: 'PUBLIC_ONLY',
      executionRoleArn: mwaaExecutionRole.roleArn,
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
