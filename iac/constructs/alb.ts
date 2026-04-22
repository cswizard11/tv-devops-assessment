import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { AcmCertificate } from "@cdktf/provider-aws/lib/acm-certificate";
import { AcmCertificateValidation } from "@cdktf/provider-aws/lib/acm-certificate-validation";
import { Alb } from "@cdktf/provider-aws/lib/alb";
import { AlbListener } from "@cdktf/provider-aws/lib/alb-listener";
import { TerraformOutput } from "cdktf";

export interface AlbConstructConfig {
  provider: AwsProvider;
  appName: string;
  vpcId: string;
  publicSubnetIds: string[];
  albSecurityGroupId: string;
  targetGroupArn: string;
  domainName: string;
}

export class AlbConstruct extends Construct {
  public readonly albDnsName: string;

  constructor(scope: Construct, id: string, config: AlbConstructConfig) {
    super(scope, id);

    // 1. Request ACM Certificate
    const certificate = new AcmCertificate(this, "certificate", {
      provider: config.provider,
      domainName: config.domainName,
      validationMethod: "DNS",
      tags: {
        Name: `${config.appName}-certificate`,
      },
    });

    // 2. Wait for certificate validation
    // Note: After running cdktf deploy, check the Terraform output for CNAME records
    // Add those to your Cloudflare DNS, then re-run deploy
    const certificateValidation = new AcmCertificateValidation(this, "certificate-validation", {
      provider: config.provider,
      certificateArn: certificate.arn,
    });

    // Output validation records for DNS setup
    new TerraformOutput(this, "certificate-validation-info", {
      value: `Certificate created for ${config.domainName}. Check AWS Console → Certificate Manager for DNS validation records.`,
      description: "Certificate validation instructions",
    });

    // 3. Create Application Load Balancer
    const alb = new Alb(this, "alb", {
      provider: config.provider,
      name: `${config.appName}-alb`,
      internal: false,
      loadBalancerType: "application",
      securityGroups: [config.albSecurityGroupId],
      subnets: config.publicSubnetIds,
      idleTimeout: 60,
      tags: {
        Name: `${config.appName}-alb`,
      },
    });

    // 4. Create HTTPS Listener (Port 443)
    // This waits for certificate validation to complete
    const httpsListener = new AlbListener(this, "https-listener", {
      provider: config.provider,
      loadBalancerArn: alb.arn,
      port: 443,
      protocol: "HTTPS",
      sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
      certificateArn: certificateValidation.certificateArn,
      defaultAction: [
        {
          type: "forward",
          targetGroupArn: config.targetGroupArn,
        },
      ],
    });
    
    // Ensure HTTPS listener waits for certificate validation
    httpsListener.node.addDependency(certificateValidation);

    // 5. Create HTTP Listener (Port 80) -> Redirect to HTTPS
    new AlbListener(this, "http-listener", {
      provider: config.provider,
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: "HTTP",
      defaultAction: [
        {
          type: "redirect",
          redirect: {
            port: "443",
            protocol: "HTTPS",
            statusCode: "HTTP_301",
          },
        },
      ],
    });

    // Set output
    this.albDnsName = alb.dnsName;
  }
}
