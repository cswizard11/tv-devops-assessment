import { App, TerraformStack } from "cdktf";
import { Construct } from "constructs";

class ExpressAppStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // define resources here
  }
}

const app = new App();
new ExpressAppStack(app, "express-app-stack");
app.synth();
