import { App, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { EcrConstruct } from "./constructs/ecr";
import { VpcConstruct } from "./constructs/vpc";
import { SecurityGroupsConstruct } from "./constructs/security-groups";
// import { IamConstruct } from "./constructs/iam";
// import { EcsConstruct } from "./constructs/ecs";
// import { AlbConstruct } from "./constructs/alb";
import { getConfig } from "./config";

class ExpressAppStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const config = getConfig();

    const awsProvider = new AwsProvider(this, "aws", {
      region: config.region,
      alias: "main",
    });

    // 1. ECR Repository
    const ecr = new EcrConstruct(this, "ecr", {
      provider: awsProvider,
      repositoryName: config.repositoryName,
    });

    // 2. VPC with subnets
    const vpc = new VpcConstruct(this, "vpc", {
      provider: awsProvider,
      appName: config.appName,
      vpcCidr: config.vpcCidr,
      availabilityZones: [`${config.region}a`, `${config.region}b`],
    });

    // 3. Security Groups
    const securityGroups = new SecurityGroupsConstruct(this, "security-groups", {
      provider: awsProvider,
      appName: config.appName,
      vpcId: vpc.vpcId,
    });

    // TODO: Add remaining constructs
    // 4. IAM Roles
    // 5. ECS Cluster and Service
    // 6. Application Load Balancer
  }
}

const app = new App();
new ExpressAppStack(app, "express-app-stack");
app.synth();
