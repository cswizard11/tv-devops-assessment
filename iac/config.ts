export interface AppConfig {
  region: string;
  repositoryName: string;
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
  };
}
