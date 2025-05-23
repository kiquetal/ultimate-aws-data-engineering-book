import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as redshift from 'aws-cdk-lib/aws-redshiftserverless';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';

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
      publiclyAccessible: false,

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
  }
}
