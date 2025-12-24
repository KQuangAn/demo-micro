<!--
title: 'AWS Node Scheduled Cron example in NodeJS'
description: 'This is an example of creating a function that runs as a cron job using the serverless ''schedule'' event.'
layout: Doc
framework: v4
platform: AWS
language: nodeJS
priority: 1
authorLink: 'https://github.com/0dj0bz'
authorName: 'Rob Abbott'
authorAvatar: 'https://avatars3.githubusercontent.com/u/5679763?v=4&s=140'
-->

# Serverless Framework Node Scheduled Cron on AWS

This template demonstrates how to develop and deploy a simple cron-like service running on AWS Lambda using the Serverless Framework.

This examples defines a single function, `rateHandler` which is triggered by an event of `schedule` type at a rate of 1 per minute. For detailed information about `schedule` event, please refer to corresponding section of Serverless [docs](https://serverless.com/framework/docs/providers/aws/events/schedule/).

## Usage

### Deployment

In order to deploy the example, you need to run the following command:

```
serverless deploy
```

After running deploy, you should see output similar to:

```
Deploying "aws-node-scheduled-cron" to stage "dev" (us-east-1)

✔ Service deployed to stack aws-node-scheduled-cron-dev (151s)

functions:
  rateHandler: aws-node-scheduled-cron-dev-rateHandler (2.3 kB)

```

There is no additional step required. Your defined schedules becomes active right away after deployment.

### Local development

The easiest way to develop and test your function is to use the `dev` command:

```
serverless dev
```

This will start a local emulator of AWS Lambda and tunnel your requests to and from AWS Lambda, allowing you to interact with your function as if it were running in the cloud.

Now you can invoke the function as before, but this time the function will be executed locally. Now you can develop your function locally, invoke it, and see the results immediately without having to re-deploy.

When you are done developing, don't forget to run `serverless deploy` to deploy the function to the cloud.
# Serverless Framework Compose: Multiframework Deployment

Deploying multiple services in a monorepository is a common pattern in larger teams. Serverless Framework Compose simplifies the deployment and orchestration of these services by offering:

1. Parallel deployment of multiple services
2. Ordered deployment of services
3. Support for deploying different types of services (e.g., Traditional, SAM, CloudFormation) together
4. Sharing outputs between services
5. Running commands across multiple services

In this example, we demonstrate how to use Serverless Compose to deploy three types of services together:

1. AWS CloudFormation Service: Deploys shared resources with outputs that are referenced by the other services.
2. Serverless Framework Traditional Service
3. AWS SAM Template Service

The AWS CloudFormation service is deployed first to create shared resources, followed by the parallel deployment of the Traditional and AWS SAM services.

This example also illustrates how to use Serverless Variables with Serverless Compose for organizing and structuring your application, as well as managing different stages.

For more information about Serverless Compose, please see the [Serverless Compose docs](https://www.serverless.com/framework/docs/guides/compose)

For more information about using AWS SAM and or AWS CloudFormation templates with the Serverless Framework, please see the [AWS SAM/CFN docs](https://www.serverless.com/framework/docs/guides/sam)

For more information about Serverless Variables, please see the [Serverless Variables docs](https://www.serverless.com/framework/docs/guides/variables)
