import { App, TerraformStack, S3Backend } from "cdktf";
import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { EcrConstruct } from "./constructs/ecr";
import { VpcConstruct } from "./constructs/vpc";
import { SecurityGroupsConstruct } from "./constructs/security-groups";
import { IamConstruct } from "./constructs/iam";
import { EcsConstruct } from "./constructs/ecs";
import { AlbConstruct } from "./constructs/alb";
import { BootstrapStack } from "./bootstrap-stack";
import { getConfig } from "./config";

class ExpressAppStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const config = getConfig();

    const awsProvider = new AwsProvider(this, "aws", {
      region: config.region,
      alias: "main",
    });

    // Configure S3 backend for Terraform state
    new S3Backend(this, {
      bucket: `${config.appName}-terraform-state`,
      key: "express-app-stack/terraform.tfstate",
      region: config.region,
      dynamodbTable: `${config.appName}-terraform-lock`,
      encrypt: true,
    });

    // 1. ECR Repository (always created)
    const ecr = new EcrConstruct(this, "ecr", {
      provider: awsProvider,
      repositoryName: config.repositoryName,
    });

    // Full infrastructure only
    if (config.deployMode === "full") {
      // 2. VPC with subnets
      const vpc = new VpcConstruct(this, "vpc", {
        provider: awsProvider,
        appName: config.appName,
        vpcCidr: config.vpcCidr,
        availabilityZones: [`${config.region}a`, `${config.region}c`],
      });

      // 3. Security Groups
      const securityGroups = new SecurityGroupsConstruct(
        this,
        "security-groups",
        {
          provider: awsProvider,
          appName: config.appName,
          vpcId: vpc.vpcId,
        }
      );

      // 4. IAM Roles
      const iam = new IamConstruct(this, "iam", {
        provider: awsProvider,
        appName: config.appName,
      });

      // 5. ECS Cluster and Service
      const ecs = new EcsConstruct(this, "ecs", {
        provider: awsProvider,
        appName: config.appName,
        region: config.region,
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
}

const app = new App();

// Load config - all env vars are provided by workflow
const config = getConfig();

// Create bootstrap stack (for S3 backend infrastructure)
// This is run conditionally by the workflow only when needed
new BootstrapStack(app, "bootstrap", {
  region: config.region,
  appName: config.appName,
});

// Create main application stack (uses S3 backend)
new ExpressAppStack(app, "express-app-stack");

app.synth();
