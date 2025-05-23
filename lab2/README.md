# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

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

