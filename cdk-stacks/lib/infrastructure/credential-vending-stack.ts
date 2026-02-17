// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
//
// Provides temporary AWS credentials to the webapp
// via a Lambda + API Gateway using STS AssumeRole.
//
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface CredentialVendingStackProps extends cdk.NestedStackProps {
  readonly SSMParams: any;
  readonly cdkAppName: string;
}

export class CredentialVendingStack extends cdk.NestedStack {
  public readonly credentialApiUrl: string;
  public readonly authenticatedRole: iam.IRole;

  constructor(scope: Construct, id: string, props: CredentialVendingStackProps) {
    super(scope, id, props);

    // =========================================================================
    // IAM Role for V2V Translation
    // =========================================================================
    const translationRole = new iam.Role(this, "V2VTranslationRole", {
      roleName: `${props.cdkAppName}-V2VTranslationRole`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Core V2V translation permissions
    translationRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "polly:SynthesizeSpeech",
          "polly:DescribeVoices",
          "transcribe:StartStreamTranscription",
          "transcribe:StartStreamTranscriptionWebSocket",
          "translate:ListLanguages",
          "translate:TranslateText",
        ],
        resources: ["*"],
      })
    );

    this.authenticatedRole = translationRole;

    // =========================================================================
    // Credential Vending Lambda
    // =========================================================================
    const credentialVendingLambda = new lambda.Function(this, "CredentialVendingFunction", {
      functionName: `${props.cdkAppName}-CredentialVending`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/credential-vending"),
      environment: {
        ROLE_ARN: translationRole.roleArn,
        SESSION_DURATION: "3600",
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Allow the Lambda to assume the translation role
    credentialVendingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["sts:AssumeRole"],
        resources: [translationRole.roleArn],
      })
    );

    // Update the translation role trust policy to allow the Lambda to assume it
    translationRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(credentialVendingLambda.role!.roleArn)],
        actions: ["sts:AssumeRole"],
      })
    );

    // =========================================================================
    // API Gateway
    // =========================================================================
    const api = new apigateway.RestApi(this, "CredentialVendingApi", {
      restApiName: `${props.cdkAppName}-CredentialVending`,
      description: "Vends temporary AWS credentials for V2V translation services",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Restrict in production to your CloudFront domain
        allowMethods: ["POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization", "X-Api-Key"],
      },
      deployOptions: {
        stageName: "prod",
        throttlingRateLimit: 20,
        throttlingBurstLimit: 40,
      },
    });

    const credentialsResource = api.root.addResource("credentials");
    credentialsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(credentialVendingLambda, {
        proxy: true,
      })
      // NOTE: For production/federal environments, add authorization here:
      // { authorizationType: apigateway.AuthorizationType.IAM }
      // or use a Lambda authorizer / API key
    );

    this.credentialApiUrl = api.url + "credentials";

    /**************************************************************************************************************
     * Stack Outputs *
     **************************************************************************************************************/
    new cdk.CfnOutput(this, "CredentialVendingApiUrl", {
      value: this.credentialApiUrl,
      description: "URL for the credential vending API",
    });

    new cdk.CfnOutput(this, "TranslationRoleArn", {
      value: translationRole.roleArn,
      description: "IAM Role ARN used for V2V translation services",
    });
  }
}
