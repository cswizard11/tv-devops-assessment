import { TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketVersioningA } from "@cdktf/provider-aws/lib/s3-bucket-versioning";
import { DynamodbTable } from "@cdktf/provider-aws/lib/dynamodb-table";

export interface BootstrapStackConfig {
  region: string;
  appName: string;
}

export class BootstrapStack extends TerraformStack {
  public readonly bucketName: string;
  public readonly tableName: string;

  constructor(scope: Construct, id: string, config: BootstrapStackConfig) {
    super(scope, id);

    // Create AWS provider inside this stack
    const provider = new AwsProvider(this, "aws", {
      region: config.region,
    });

    this.bucketName = `${config.appName}-terraform-state`;
    this.tableName = `${config.appName}-terraform-lock`;

    // Create S3 bucket for Terraform state
    const bucket = new S3Bucket(this, "state-bucket", {
      provider: provider,
      bucket: this.bucketName,
      tags: {
        Name: this.bucketName,
      },
    });

    new S3BucketVersioningA(this, "bucket-versioning", {
      provider: provider,
      bucket: bucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });

    // Create DynamoDB table for state locking
    new DynamodbTable(this, "lock-table", {
      provider: provider,
      name: this.tableName,
      billingMode: "PAY_PER_REQUEST",
      attribute: [{ name: "LockID", type: "S" }],
      hashKey: "LockID",
      tags: {
        Name: this.tableName,
      },
    });
  }
}
