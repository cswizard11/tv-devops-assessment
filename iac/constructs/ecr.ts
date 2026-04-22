import { Construct } from "constructs";
import { EcrRepository } from "@cdktf/provider-aws/lib/ecr-repository";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";

export interface EcrConstructConfig {
  repositoryName: string;
  provider: AwsProvider;
}

export class EcrConstruct extends Construct {
  public readonly repositoryUrl: string;

  constructor(scope: Construct, id: string, config: EcrConstructConfig) {
    super(scope, id);

    const repository = new EcrRepository(this, "repository", {
      provider: config.provider,
      name: config.repositoryName,
      imageTagMutability: "MUTABLE",
    });

    this.repositoryUrl = repository.repositoryUrl;
  }
}
