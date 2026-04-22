import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";

export interface IamConstructConfig {
  provider: AwsProvider;
  appName: string;
}

export class IamConstruct extends Construct {
  public readonly taskExecutionRoleArn: string;
  public readonly taskRoleArn: string;

  constructor(scope: Construct, id: string, config: IamConstructConfig) {
    super(scope, id);

    // Trust policy for ECS tasks
    const assumeRolePolicy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            Service: "ecs-tasks.amazonaws.com",
          },
          Action: "sts:AssumeRole",
        },
      ],
    });

    // Create Task Execution Role
    const taskExecutionRole = new IamRole(this, "task-execution-role", {
      provider: config.provider,
      name: `${config.appName}-task-execution-role`,
      assumeRolePolicy: assumeRolePolicy,
      tags: {
        Name: `${config.appName}-task-execution-role`,
      },
    });

    // Attach AWS managed policy for task execution
    new IamRolePolicyAttachment(this, "task-execution-policy", {
      provider: config.provider,
      role: taskExecutionRole.name,
      policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    // Create Task Role (minimal permissions)
    const taskRole = new IamRole(this, "task-role", {
      provider: config.provider,
      name: `${config.appName}-task-role`,
      assumeRolePolicy: assumeRolePolicy,
      tags: {
        Name: `${config.appName}-task-role`,
      },
    });

    this.taskExecutionRoleArn = taskExecutionRole.arn;
    this.taskRoleArn = taskRole.arn;
  }
}
