# Infrastructure as Code (CDKTF)

[![Deploy Infrastructure](https://github.com/cswizard11/tv-devops-assessment/workflows/Deploy%20Infrastructure/badge.svg)](https://github.com/cswizard11/tv-devops-assessment/actions/workflows/deploy-infra.yml)

AWS infrastructure for the Express TypeScript application using CDK for Terraform (TypeScript).

## Architecture Overview

The infrastructure deploys a production-ready containerized application on AWS with the following topology:

### Network Topology

The VPC uses a multi-AZ design with public and private subnets:

- **VPC**: Custom CIDR block (default: `10.0.0.0/16`)
- **Public Subnets**: One per AZ (e.g., `10.0.1.0/24`, `10.0.2.0/24`)
  - ALB spans across all public subnets for high availability
  - Each public subnet hosts one NAT Gateway for its corresponding private subnet
  - One shared route table points to Internet Gateway
- **Private Subnets**: One per AZ (e.g., `10.0.101.0/24`, `10.0.102.0/24`)
  - ECS tasks are distributed across private subnets by the service scheduler
  - No direct inbound internet access (ingress only via ALB)
  - Each private subnet has its own route table pointing to its AZ's NAT Gateway
- **Internet Gateway**: Attached to VPC for public subnet internet access
- **NAT Gateways**: One per AZ in public subnets, allowing private subnet egress

### Security Model

Two security groups enforce least-privilege traffic flow:

- **ALB Security Group**: Allows HTTPS (443) from anywhere (`0.0.0.0/0`)
- **ECS Security Group**: Allows port 3000 **only** from the ALB security group

Both security groups allow all outbound traffic (required for ECR image pulls and CloudWatch logging).

### IAM Roles

- **Task Execution Role**: AWS-managed policy allowing ECS to pull images from ECR and write to CloudWatch Logs
- **Task Role**: Minimal role for the application container itself (currently no additional permissions attached)

### Container Orchestration

- **ECS Cluster**: Fargate launch type (serverless, no EC2 management)
- **Task Definition**: 256 CPU / 512 MiB memory per task
- **Service**: 2 desired tasks distributed across private subnets by the ECS scheduler
- **CloudWatch Logs**: 7-day retention for container stdout/stderr

### SSL/TLS

- **ACM Certificate**: DNS-validated certificate for the configured domain
- **ALB Listeners**: HTTPS (443) forwards to ECS, HTTP (80) redirects to HTTPS
- **DNS Validation**: Requires adding a CNAME record to your DNS provider (e.g., Cloudflare)

### Terraform State Backend

- **S3 Bucket**: Stores Terraform state files (versioning enabled)
- **DynamoDB Table**: Provides state locking to prevent concurrent modifications
- Created automatically by the bootstrap process

## Prerequisites

- AWS credentials with deployment permissions (see IAM Policy section)
- AWS CLI installed and configured
- Node.js 24+
- CDKTF CLI: `npm install -g cdktf-cli`

## Configuration

Required environment variables:

| Variable              | Description                       | Example            |
| --------------------- | --------------------------------- | ------------------ |
| `AWS_REGION`          | AWS region for all resources      | `us-west-1`        |
| `ECR_REPOSITORY_NAME` | Name for the ECR repository       | `express-app`      |
| `APP_NAME`            | Prefix for all AWS resource names | `express-app`      |
| `DOMAIN_NAME`         | Domain for ACM SSL certificate    | `api.mydomain.com` |

Optional environment variables:

| Variable      | Description          | Default       |
| ------------- | -------------------- | ------------- |
| `VPC_CIDR`    | VPC CIDR block       | `10.0.0.0/16` |
| `DEPLOY_MODE` | `ecr-only` or `full` | `full`        |

**Setup:**

```bash
cp template.env .env
# Edit .env with your values
```

Example `.env` file:

```bash
AWS_REGION=us-west-1
ECR_REPOSITORY_NAME=express-app
APP_NAME=express-app
DOMAIN_NAME=api.mydomain.com
VPC_CIDR=10.0.0.0/16
DEPLOY_MODE=full
```

**Note:** The `.env` file is gitignored. Use `template.env` as a starting point.

## Local Development

Preview the generated Terraform before deploying:

```bash
# Install dependencies
npm install

# Generate provider bindings
cdktf get

# Generate Terraform configuration
cdktf synth

# Preview changes without applying
cdktf diff
```

## Deployment

### Bootstrap (First Time Only)

Before deploying the main infrastructure, you must create the Terraform state backend. This is a one-time operation per AWS account/region.

The bootstrap stack creates:

- S3 bucket: `{APP_NAME}-terraform-state`
- DynamoDB table: `{APP_NAME}-terraform-lock`

**Manually:**

```bash
cdktf deploy bootstrap
```

**Via CI/CD:** The GitHub Actions workflow automatically detects if the backend exists and runs bootstrap if needed.

### Deploy Infrastructure

The deployment has two modes controlled by `DEPLOY_MODE`:

| Mode       | Description                     | Use Case                              |
| ---------- | ------------------------------- | ------------------------------------- |
| `ecr-only` | Creates only the ECR repository | Initial setup before pushing an image |
| `full`     | Deploys complete infrastructure | Normal deployment after image exists  |

**Step 1: Create ECR Repository**

```bash
DEPLOY_MODE=ecr-only cdktf deploy express-app-stack
```

Note the repository URL from the output.

**Step 2: Build and Push Docker Image**

```bash
cd ../app
docker build -t express-app .

# Authenticate with ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <aws-account-id>.dkr.ecr.<region>.amazonaws.com

# Tag and push
docker tag express-app:latest <aws-account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:latest
docker push <aws-account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:latest
```

**Step 3: Deploy Full Infrastructure**

```bash
DEPLOY_MODE=full cdktf deploy express-app-stack
```

This creates: VPC, subnets, NAT gateways, security groups, IAM roles, ECS cluster/service, ALB, and ACM certificate.

**Certificate Validation:**

The deployment will pause waiting for ACM certificate validation. Check the AWS Console (Certificate Manager) for the DNS validation CNAME record, then add it to your DNS provider:

```
Type: CNAME
Name: _<hash>.<your-domain>
Target: _<verification-hash>.acm-validations.aws
```

Re-run the deploy command after adding the CNAME.

**DNS Setup:**

After deployment, get the ALB DNS name:

```bash
aws elbv2 describe-load-balancers --names <app-name>-alb --query 'LoadBalancers[0].DNSName' --output text
```

Add a CNAME record pointing your domain to the ALB:

```
Type: CNAME
Name: <your-subdomain> (e.g., "api")
Target: <alb-dns-name>
```

### Verify Deployment

After DNS propagates:

```bash
curl https://<your-domain-name>/health
```

Expected response:

```json
{ "status": "healthy" }
```

View ECS service status:

```bash
aws ecs describe-services --cluster <app-name>-cluster --services <app-name>-service
```

View container logs:

```bash
aws logs tail /ecs/<app-name> --follow
```

### Destroy Infrastructure

Remove all resources:

```bash
cdktf destroy express-app-stack
```

**Important Notes:**

- **ECR repository**: Will fail to delete if images still exist. Either delete images first or keep the repository
- The S3 backend bucket and DynamoDB table (bootstrap resources) are NOT destroyed by this command
- ACM certificate will be recreated with a new validation CNAME on next deploy

## CI/CD Integration

Two GitHub Actions workflows automate the full pipeline:

1. **Build and Push** (`../.github/workflows/build-and-push.yml`): Builds Docker image and pushes to ECR
2. **Deploy Infrastructure** (`.github/workflows/deploy-infra.yml`): Deploys infrastructure via CDKTF

The deploy workflow:

1. Checks if the S3 backend exists
2. Runs bootstrap if the backend is missing
3. Deploys the main infrastructure stack

### Required GitHub Secrets

Configure these in your repository (Settings -> Secrets and variables -> Actions):

| Secret                  | Description                | Required |
| ----------------------- | -------------------------- | -------- |
| `AWS_ACCESS_KEY_ID`     | IAM user access key        | Yes      |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key        | Yes      |
| `AWS_REGION`            | AWS region                 | Yes      |
| `ECR_REPOSITORY_NAME`   | ECR repository name        | Yes      |
| `APP_NAME`              | Resource name prefix       | Yes      |
| `DOMAIN_NAME`           | Domain for SSL certificate | Yes      |
| `VPC_CIDR`              | VPC CIDR block             | No       |

### Workflow Triggers

- **Automatic**: Push to `main` that modifies `iac/**` files
- **Manual**: `workflow_dispatch` with optional parameter overrides

## IAM Policy for Deployment

The `iam-policy.json` file contains the least-privilege permissions needed to deploy this infrastructure. It includes:

| Service             | Permissions                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| **ECR**             | Create/manage repositories, push/pull images                           |
| **ECS**             | Create clusters, task definitions, services                            |
| **ELB**             | Create ALB, target groups, listeners                                   |
| **EC2**             | Create VPC, subnets, security groups, NAT gateways, route tables       |
| **IAM**             | Create roles, attach policies, pass roles to ECS                       |
| **CloudWatch Logs** | Create log groups, write logs                                          |
| **ACM**             | Request and validate SSL certificates                                  |
| **S3**              | Create buckets, read/write state files (scoped to `*-terraform-state`) |
| **DynamoDB**        | Create tables, read/write lock records (scoped to `*-terraform-lock`)  |

This policy intentionally excludes access to: billing, user management, RDS, Lambda, and other unused services.

## Project Structure

- `main.ts` - Entry point; defines the ExpressAppStack and BootstrapStack
- `bootstrap-stack.ts` - Creates S3 bucket and DynamoDB table for Terraform state
- `config.ts` - Environment variable loading with required validation
- `cdktf.json` - CDKTF project configuration
- `constructs/` - Reusable infrastructure components:
  - `ecr.ts` - Container registry
  - `vpc.ts` - VPC, subnets, IGW, NAT gateways, route tables
  - `security-groups.ts` - ALB and ECS security groups
  - `iam.ts` - Task execution and task roles
  - `ecs.ts` - ECS cluster, task definition, service, CloudWatch logs
  - `alb.ts` - ALB, ACM certificate, HTTPS/HTTP listeners

## Architecture Decisions

- **Multi-AZ VPC**: Public/private subnet split with NAT gateways for production security
- **ECS Fargate**: Serverless containers -- no EC2 instances to manage
- **Application Load Balancer**: Terminates SSL and distributes traffic across tasks
- **S3 + DynamoDB Backend**: Remote state with locking for team collaboration and CI/CD safety
- **Explicit AWS Provider**: Passed explicitly to every construct rather than relying on scope inheritance -- prevents provider resolution bugs
- **Fail-Fast Configuration**: `requireEnv()` throws immediately if required variables are missing rather than using defaults
