import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";

export interface SecurityGroupsConstructConfig {
  provider: AwsProvider;
  appName: string;
  vpcId: string;
}

export class SecurityGroupsConstruct extends Construct {
  public readonly albSecurityGroupId: string;
  public readonly ecsSecurityGroupId: string;

  constructor(scope: Construct, id: string, config: SecurityGroupsConstructConfig) {
    super(scope, id);

    // Create ALB Security Group
    const albSecurityGroup = new SecurityGroup(this, "alb-sg", {
      provider: config.provider,
      name: `${config.appName}-alb-sg`,
      vpcId: config.vpcId,
      ingress: [
        {
          fromPort: 443,
          toPort: 443,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow HTTPS from internet",
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow all outbound traffic",
        },
      ],
      tags: {
        Name: `${config.appName}-alb-sg`,
      },
    });

    // Create ECS Security Group
    const ecsSecurityGroup = new SecurityGroup(this, "ecs-sg", {
      provider: config.provider,
      name: `${config.appName}-ecs-sg`,
      vpcId: config.vpcId,
      ingress: [
        {
          fromPort: 3000,
          toPort: 3000,
          protocol: "tcp",
          securityGroups: [albSecurityGroup.id],
          description: "Allow HTTP from ALB only",
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow all outbound traffic (ECR, CloudWatch)",
        },
      ],
      tags: {
        Name: `${config.appName}-ecs-sg`,
      },
    });

    this.albSecurityGroupId = albSecurityGroup.id;
    this.ecsSecurityGroupId = ecsSecurityGroup.id;
  }
}
