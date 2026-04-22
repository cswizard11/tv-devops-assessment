import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { Vpc } from "@cdktf/provider-aws/lib/vpc";
import { InternetGateway } from "@cdktf/provider-aws/lib/internet-gateway";
import { Subnet } from "@cdktf/provider-aws/lib/subnet";
import { NatGateway } from "@cdktf/provider-aws/lib/nat-gateway";
import { Eip } from "@cdktf/provider-aws/lib/eip";
import { RouteTable } from "@cdktf/provider-aws/lib/route-table";
import { Route } from "@cdktf/provider-aws/lib/route";
import { RouteTableAssociation } from "@cdktf/provider-aws/lib/route-table-association";

export interface VpcConstructConfig {
  provider: AwsProvider;
  appName: string;
  vpcCidr: string;
  availabilityZones: string[]; // e.g., ["us-east-1a", "us-east-1b"]
}

export class VpcConstruct extends Construct {
  public readonly vpcId: string;
  public readonly publicSubnetIds: string[];
  public readonly privateSubnetIds: string[];

  constructor(scope: Construct, id: string, config: VpcConstructConfig) {
    super(scope, id);

    // Validate availability zones
    if (config.availabilityZones.length < 1) {
      throw new Error("At least 1 availability zone is required");
    }

    // Arrays to collect subnet IDs for outputs
    const publicSubnetIds: string[] = [];
    const privateSubnetIds: string[] = [];

    // 1. Create VPC
    const vpc = new Vpc(this, "vpc", {
      provider: config.provider,
      cidrBlock: config.vpcCidr,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: {
        Name: `${config.appName}-vpc`,
      },
    });

    // 2. Create Internet Gateway
    const igw = new InternetGateway(this, "igw", {
      provider: config.provider,
      vpcId: vpc.id,
      tags: {
        Name: `${config.appName}-igw`,
      },
    });

    // 3. Create Public Route Table (shared by all public subnets)
    const publicRouteTable = new RouteTable(this, "public-rt", {
      provider: config.provider,
      vpcId: vpc.id,
      tags: {
        Name: `${config.appName}-public-rt`,
      },
    });

    // 4. Create Public Route (to Internet Gateway)
    new Route(this, "public-route", {
      provider: config.provider,
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: igw.id,
    });

    // 5. Loop through each AZ to create subnets, NATs, and private routes
    config.availabilityZones.forEach((az, index) => {
      const azIndex = index + 1;

      // Calculate CIDR blocks
      // Public: 10.0.1.0/24, 10.0.2.0/24, etc.
      // Private: 10.0.101.0/24, 10.0.102.0/24, etc. (offset by 100 to avoid conflicts)
      const publicCidr = `10.0.${azIndex}.0/24`;
      const privateCidr = `10.0.${azIndex + 100}.0/24`;

      // Create Public Subnet
      const publicSubnet = new Subnet(this, `public-subnet-${azIndex}`, {
        provider: config.provider,
        vpcId: vpc.id,
        cidrBlock: publicCidr,
        availabilityZone: az,
        mapPublicIpOnLaunch: true,
        tags: {
          Name: `${config.appName}-public-subnet-${azIndex}`,
          Type: "public",
        },
      });
      publicSubnetIds.push(publicSubnet.id);

      // Associate public subnet to shared public route table
      new RouteTableAssociation(this, `public-rta-${azIndex}`, {
        provider: config.provider,
        subnetId: publicSubnet.id,
        routeTableId: publicRouteTable.id,
      });

      // Create Elastic IP for NAT Gateway
      const eip = new Eip(this, `eip-${azIndex}`, {
        provider: config.provider,
        domain: "vpc",
        tags: {
          Name: `${config.appName}-eip-${azIndex}`,
        },
      });

      // Create NAT Gateway in public subnet
      const natGateway = new NatGateway(this, `nat-${azIndex}`, {
        provider: config.provider,
        subnetId: publicSubnet.id,
        allocationId: eip.id,
        tags: {
          Name: `${config.appName}-nat-${azIndex}`,
        },
      });

      // Create Private Subnet
      const privateSubnet = new Subnet(this, `private-subnet-${azIndex}`, {
        provider: config.provider,
        vpcId: vpc.id,
        cidrBlock: privateCidr,
        availabilityZone: az,
        mapPublicIpOnLaunch: false,
        tags: {
          Name: `${config.appName}-private-subnet-${azIndex}`,
          Type: "private",
        },
      });
      privateSubnetIds.push(privateSubnet.id);

      // Create Private Route Table for this AZ
      const privateRouteTable = new RouteTable(this, `private-rt-${azIndex}`, {
        provider: config.provider,
        vpcId: vpc.id,
        tags: {
          Name: `${config.appName}-private-rt-${azIndex}`,
        },
      });

      // Create Private Route (to this AZ's NAT Gateway)
      new Route(this, `private-route-${azIndex}`, {
        provider: config.provider,
        routeTableId: privateRouteTable.id,
        destinationCidrBlock: "0.0.0.0/0",
        natGatewayId: natGateway.id,
      });

      // Associate private subnet to its route table
      new RouteTableAssociation(this, `private-rta-${azIndex}`, {
        provider: config.provider,
        subnetId: privateSubnet.id,
        routeTableId: privateRouteTable.id,
      });
    });

    // Set outputs
    this.vpcId = vpc.id;
    this.publicSubnetIds = publicSubnetIds;
    this.privateSubnetIds = privateSubnetIds;
  }
}
