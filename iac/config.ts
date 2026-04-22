export interface AppConfig {
  region: string;
  repositoryName: string;
  appName: string;
  domainName: string;
  vpcCidr: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

export function getConfig(): AppConfig {
  return {
    region: requireEnv("AWS_REGION"),
    repositoryName: requireEnv("ECR_REPOSITORY_NAME"),
    appName: requireEnv("APP_NAME"),
    domainName: requireEnv("DOMAIN_NAME"),
    vpcCidr: process.env["VPC_CIDR"] || "10.0.0.0/16",
  };
}
