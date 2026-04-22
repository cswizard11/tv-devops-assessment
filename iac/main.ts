import { App, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { EcrConstruct } from "./constructs/ecr";
import { getConfig } from "./config";

class ExpressAppStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const config = getConfig();

    const awsProvider = new AwsProvider(this, "aws", {
      region: config.region,
      alias: "main",
    });

    new EcrConstruct(this, "ecr", {
      provider: awsProvider,
      repositoryName: config.repositoryName,
    });
  }
}

const app = new App();
new ExpressAppStack(app, "express-app-stack");
app.synth();
