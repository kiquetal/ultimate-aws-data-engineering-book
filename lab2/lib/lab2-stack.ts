import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as redshift from 'aws-cdk-lib/aws-redshift-serverless';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

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

    // Create a Redshift Serverless namespace
    const namespace = new redshift.CfnNamespace(this, 'RedshiftServerlessNamespace', {
      namespaceName: 'lab2-namespace',
      adminUsername: 'admin',
      adminUserPassword: adminUserSecret.secretValueFromJson('password').toString(),
      dbName: 'lab2db',
      defaultIamRoleArn: undefined, // Optional: specify an IAM role ARN if needed
      iamRoles: [], // Optional: specify additional IAM roles if needed
      logExports: ['userlog', 'connectionlog', 'useractivitylog'], // Optional: specify log exports if needed
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
      securityGroupIds: [], // Optional: specify security group IDs if needed
      subnetIds: [], // Optional: specify subnet IDs if needed
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
  }
}
