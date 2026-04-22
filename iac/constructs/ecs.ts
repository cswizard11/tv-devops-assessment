import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { EcsCluster } from "@cdktf/provider-aws/lib/ecs-cluster";
import { CloudwatchLogGroup } from "@cdktf/provider-aws/lib/cloudwatch-log-group";
import { EcsTaskDefinition } from "@cdktf/provider-aws/lib/ecs-task-definition";
import { AlbTargetGroup } from "@cdktf/provider-aws/lib/alb-target-group";
import { EcsService } from "@cdktf/provider-aws/lib/ecs-service";

export interface EcsConstructConfig {
  provider: AwsProvider;
  appName: string;
  vpcId: string;
  privateSubnetIds: string[];
  ecsSecurityGroupId: string;
  taskExecutionRoleArn: string;
  taskRoleArn: string;
  repositoryUrl: string;
  containerPort: number;
  cpu: string;
  memory: string;
}

export class EcsConstruct extends Construct {
  public readonly clusterName: string;
  public readonly serviceName: string;
  public readonly targetGroupArn: string;

  constructor(scope: Construct, id: string, config: EcsConstructConfig) {
    super(scope, id);

    // 1. Create ECS Cluster
    const cluster = new EcsCluster(this, "cluster", {
      provider: config.provider,
      name: `${config.appName}-cluster`,
      tags: {
        Name: `${config.appName}-cluster`,
      },
    });

    // 2. Create CloudWatch Log Group
    const logGroup = new CloudwatchLogGroup(this, "log-group", {
      provider: config.provider,
      name: `/ecs/${config.appName}`,
      retentionInDays: 7,
      tags: {
        Name: `/ecs/${config.appName}`,
      },
    });

    // 3. Create Task Definition
    const taskDefinition = new EcsTaskDefinition(this, "task-definition", {
      provider: config.provider,
      family: `${config.appName}-task`,
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      cpu: config.cpu,
      memory: config.memory,
      executionRoleArn: config.taskExecutionRoleArn,
      taskRoleArn: config.taskRoleArn,
      containerDefinitions: JSON.stringify([
        {
          name: "app",
          image: config.repositoryUrl,
          essential: true,
          portMappings: [
            {
              containerPort: config.containerPort,
              protocol: "tcp",
            },
          ],
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": logGroup.name,
              "awslogs-region": "${AWS::Region}",
              "awslogs-stream-prefix": "ecs",
            },
          },
        },
      ]),
      tags: {
        Name: `${config.appName}-task`,
      },
    });

    // 4. Create Target Group
    const targetGroup = new AlbTargetGroup(this, "target-group", {
      provider: config.provider,
      name: `${config.appName}-tg`,
      port: config.containerPort,
      protocol: "HTTP",
      vpcId: config.vpcId,
      targetType: "ip",
      healthCheck: {
        enabled: true,
        healthyThreshold: 2,
        interval: 30,
        matcher: "200",
        path: "/health",
        port: "traffic-port",
        protocol: "HTTP",
        timeout: 5,
        unhealthyThreshold: 3,
      },
      tags: {
        Name: `${config.appName}-tg`,
      },
    });

    // 5. Create ECS Service
    const service = new EcsService(this, "service", {
      provider: config.provider,
      name: `${config.appName}-service`,
      cluster: cluster.id,
      taskDefinition: taskDefinition.arn,
      launchType: "FARGATE",
      desiredCount: 2,
      networkConfiguration: {
        subnets: config.privateSubnetIds,
        securityGroups: [config.ecsSecurityGroupId],
        assignPublicIp: false,
      },
      loadBalancer: [
        {
          targetGroupArn: targetGroup.arn,
          containerName: "app",
          containerPort: config.containerPort,
        },
      ],
      tags: {
        Name: `${config.appName}-service`,
      },
    });

    // Set outputs
    this.clusterName = cluster.name;
    this.serviceName = service.name;
    this.targetGroupArn = targetGroup.arn;
  }
}
