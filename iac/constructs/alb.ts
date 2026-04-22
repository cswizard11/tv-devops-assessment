import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { AcmCertificate } from "@cdktf/provider-aws/lib/acm-certificate";
import { Alb } from "@cdktf/provider-aws/lib/alb";
import { AlbListener } from "@cdktf/provider-aws/lib/alb-listener";

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

    // 2. Create Application Load Balancer
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

    // 3. Create HTTPS Listener (Port 443)
    new AlbListener(this, "https-listener", {
      provider: config.provider,
      loadBalancerArn: alb.arn,
      port: 443,
      protocol: "HTTPS",
      sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
      certificateArn: certificate.arn,
      defaultAction: [
        {
          type: "forward",
          targetGroupArn: config.targetGroupArn,
        },
      ],
    });

    // 4. Create HTTP Listener (Port 80) -> Redirect to HTTPS
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
