import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Lab2 from '../lib/lab2-stack';

describe('Lab2 Stack', () => {
  let app: cdk.App;
  let stack: Lab2.Lab2Stack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new Lab2.Lab2Stack(app, 'MyTestStack');
    template = Template.fromStack(stack);
  });

  test('Redshift Serverless Namespace Created', () => {
    template.hasResourceProperties('AWS::RedshiftServerless::Namespace', {
      NamespaceName: 'lab2-namespace',
      AdminUsername: 'admin',
      DbName: 'lab2db',
    });
  });

  test('Redshift Serverless Workgroup Created', () => {
    template.hasResourceProperties('AWS::RedshiftServerless::Workgroup', {
      WorkgroupName: 'lab2-workgroup',
      NamespaceName: 'lab2-namespace',
      BaseCapacity: 8,
      EnhancedVpcRouting: false,
      PubliclyAccessible: false,
    });
  });

  test('Secrets Manager Secret Created', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      SecretName: 'redshift-serverless-admin-user-secret',
      GenerateSecretString: {
        SecretStringTemplate: '{"username":"admin"}',
        GenerateStringKey: 'password',
        ExcludePunctuation: true,
        IncludeSpace: false,
        PasswordLength: 16,
      },
    });
  });
});
