import { App, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { EcrConstruct } from "./constructs/ecr";
import { VpcConstruct } from "./constructs/vpc";
import { SecurityGroupsConstruct } from "./constructs/security-groups";
import { IamConstruct } from "./constructs/iam";
import { EcsConstruct } from "./constructs/ecs";
import { AlbConstruct } from "./constructs/alb";
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

    // 4. IAM Roles
    const iam = new IamConstruct(this, "iam", {
      provider: awsProvider,
      appName: config.appName,
    });

    // 5. ECS Cluster and Service
    const ecs = new EcsConstruct(this, "ecs", {
      provider: awsProvider,
      appName: config.appName,
      vpcId: vpc.vpcId,
      privateSubnetIds: vpc.privateSubnetIds,
      ecsSecurityGroupId: securityGroups.ecsSecurityGroupId,
      taskExecutionRoleArn: iam.taskExecutionRoleArn,
      taskRoleArn: iam.taskRoleArn,
      repositoryUrl: ecr.repositoryUrl,
      containerPort: 3000,
      cpu: "256",
      memory: "512",
    });

    // 6. Application Load Balancer
    const alb = new AlbConstruct(this, "alb", {
      provider: awsProvider,
      appName: config.appName,
      vpcId: vpc.vpcId,
      publicSubnetIds: vpc.publicSubnetIds,
      albSecurityGroupId: securityGroups.albSecurityGroupId,
      targetGroupArn: ecs.targetGroupArn,
      domainName: config.domainName,
    });
  }
}

const app = new App();
new ExpressAppStack(app, "express-app-stack");
app.synth();
