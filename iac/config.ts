import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export interface AppConfig {
  region: string;
  repositoryName: string;
  appName: string;
  domainName: string;
  vpcCidr: string;
  deployMode: "ecr-only" | "full";
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

export function getConfig(): AppConfig {
  const deployMode = process.env["DEPLOY_MODE"] || "full";
  if (deployMode !== "ecr-only" && deployMode !== "full") {
    throw new Error("DEPLOY_MODE must be either 'ecr-only' or 'full'");
  }

  return {
    region: requireEnv("AWS_REGION"),
    repositoryName: requireEnv("ECR_REPOSITORY_NAME"),
    appName: requireEnv("APP_NAME"),
    domainName: requireEnv("DOMAIN_NAME"),
    vpcCidr: process.env["VPC_CIDR"] || "10.0.0.0/16",
    deployMode: deployMode as "ecr-only" | "full",
  };
}
