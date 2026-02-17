// Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ssm from "aws-cdk-lib/aws-ssm";

import { loadSSMParams } from "../config/ssm-params-util";
const configParams = require("../config/config.params.json");

import { CredentialVendingStack } from "./infrastructure/credential-vending-stack";
import { FrontendConfigStack } from "./frontend/frontend-config-stack";

export class CdkBackendStack extends cdk.Stack {
  public readonly backendStackOutputs: { key: string; value: string }[];

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.backendStackOutputs = [];

    //store physical stack name to SSM
    const outputHierarchy = `${configParams.hierarchy}outputParameters`;
    const cdkBackendStackName = new ssm.StringParameter(this, "CdkBackendStackName", {
      parameterName: `${outputHierarchy}/CdkBackendStackName`,
      stringValue: this.stackName,
    });

    const ssmParams = loadSSMParams(this);

    const credentialVendingStack = new CredentialVendingStack(this, "CredentialVendingStack", {
      SSMParams: ssmParams,
      cdkAppName: configParams["CdkAppName"],
    });

    /**************************************************************************************************************
     * CDK Outputs *
     **************************************************************************************************************/
    this.backendStackOutputs.push({ key: "backendRegion", value: this.region });

    this.backendStackOutputs.push({ key: "credentialVendingApiUrl", value: credentialVendingStack.credentialApiUrl });

    // Connect and service region config
    this.backendStackOutputs.push({ key: "connectInstanceURL", value: ssmParams.connectInstanceURL });
    this.backendStackOutputs.push({ key: "connectInstanceRegion", value: ssmParams.connectInstanceRegion });
    this.backendStackOutputs.push({ key: "transcribeRegion", value: ssmParams.transcribeRegion });
    this.backendStackOutputs.push({ key: "translateRegion", value: ssmParams.translateRegion });
    this.backendStackOutputs.push({ key: "translateProxyEnabled", value: String(ssmParams.translateProxyEnabled) });
    this.backendStackOutputs.push({ key: "pollyRegion", value: ssmParams.pollyRegion });
    this.backendStackOutputs.push({ key: "pollyProxyEnabled", value: String(ssmParams.pollyProxyEnabled) });

    new cdk.CfnOutput(this, "credentialVendingApiUrl", {
      value: credentialVendingStack.credentialApiUrl,
    });
  }
}
