# Ultimate AWS Data Engineering Book - Lab 2 Index

## Project Structure

- **bin/**
  - `lab2.ts`: CDK app entry point.
- **lib/**
  - `lab2-stack.ts`: Main CDK stack definition, including Redshift Serverless resources.
- **test/**
  - `lab2.test.ts`: Jest unit tests for the stack.
- **cdk.json**: CDK configuration file.
- **package.json**: Project dependencies and scripts.
- **tsconfig.json**: TypeScript configuration.
- **README.md**: Project documentation (this file).

## Lab 2 Content Index

1. **Redshift Serverless Implementation**
   - Namespace: 'lab2-namespace' (admin user, 'lab2db' database)
   - Workgroup: 'lab2-workgroup' (8 RPUs)
   - Admin password managed in AWS Secrets Manager
2. **Deployment Instructions**
   - Build, test, and deploy commands
   - Environment context usage
3. **Accessing Redshift Serverless**
   - How to retrieve admin credentials
   - Connection details

---

# Welcome to your CDK TypeScript project

This is a project for CDK development with TypeScript that includes a Redshift Serverless implementation.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Redshift Serverless Implementation

This project includes an AWS Redshift Serverless implementation with the following components:

1. **Redshift Serverless Namespace**: A namespace named 'lab2-namespace' with an admin user and a database named 'lab2db'.
2. **Redshift Serverless Workgroup**: A workgroup named 'lab2-workgroup' with 8 RPUs (Redshift Processing Units) of base capacity.
3. **Admin Password Management**: The admin user password is securely stored in AWS Secrets Manager.

### Accessing Redshift Serverless

After deployment, you can access your Redshift Serverless resources using the following information:

- **Namespace**: The namespace name is 'lab2-namespace'
- **Workgroup**: The workgroup name is 'lab2-workgroup'
- **Admin Username**: 'admin'
- **Admin Password**: Stored in AWS Secrets Manager with the name 'redshift-serverless-admin-user-secret'

To retrieve the admin password from AWS Secrets Manager:

```sh
aws secretsmanager get-secret-value --secret-id redshift-serverless-admin-user-secret --query SecretString --output text | jq -r '.password'
```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Deploying with environment context

You can specify which stack to deploy using the CDK context flag:

- Deploy the default stack:
  ```sh
  npx cdk deploy
  ```
- Deploy the prod stack:
  ```sh
  npx cdk deploy -c env=prod
  ```

Alternatively, you can use the environment variable:

  ```sh
  DEPLOY_ENV=prod npx cdk deploy
  ```
