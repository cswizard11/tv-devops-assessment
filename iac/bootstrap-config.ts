// Simple config for bootstrap stack - only needs region and app name
export interface BootstrapConfig {
  region: string;
  appName: string;
}

export function getBootstrapConfig(): BootstrapConfig {
  const region = process.env.AWS_REGION;
  const appName = process.env.APP_NAME;

  if (!region) {
    throw new Error("AWS_REGION environment variable is required");
  }
  if (!appName) {
    throw new Error("APP_NAME environment variable is required");
  }

  return {
    region,
    appName,
  };
}
