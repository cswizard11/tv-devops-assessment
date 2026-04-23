# Express TypeScript Application

A containerized Express.js + TypeScript application with local development and production deployment support.

**Live URL:** https://tv-devops.inapeartree.net/

## Prerequisites

- Docker (v24.0+ recommended)
- Docker Compose (v2.22+ for Docker Watch support)
- Node.js (v24) - only needed for local development without Docker

## Local Development

### Quick Start

Start the development server with hot reload:

```bash
docker compose watch
```

The application will be available at http://localhost:3000.

### Development Features

- Hot Module Replacement: Changes to source files are automatically reflected
- Dependency Watching: Changes to package.json or package-lock.json trigger container rebuilds
- TypeScript Compilation: Automatic compilation with ts-node-dev

### Verify Installation

Health check endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{ "status": "healthy" }
```

Main endpoint:

```bash
curl http://localhost:3000/
```

Expected response:

```
Hello from Express + TypeScript!
```

## Production Build

### Build Production Image

Build production-optimized image:

```bash
docker build --target production -t express-app:prod .
```

Run production container:

```bash
docker run -d -p 3000:3000 --name express-prod express-app:prod
```

### Production Image Details

The production image is optimized for minimal size and security:

- Multi-stage build: TypeScript compiled in builder stage, only runtime artifacts in final image
- Production dependencies only: ~68 packages vs ~140 in development
- No source code: Only compiled JavaScript in dist/
- No package files: No package.json or package-lock.json in runtime image
- No dev tools: No TypeScript compiler, build tools, or dev dependencies

### Production Verification

Test health endpoint:

```bash
curl http://localhost:3000/health
```

Check container contents:

```bash
docker exec express-prod ls -la /app/
```

Should show: `dist/` and `node_modules/` only

## Docker Architecture

### Stages

1. base: Alpine Linux + Node.js LTS, shared package files
2. development: Full development environment with hot reload
3. prod-deps: Production dependencies only (cached layer)
4. builder: Extends prod-deps, compiles TypeScript
5. production: Minimal runtime image with compiled code and prod deps

### Development vs Production

| Feature          | Development | Production          |
| ---------------- | ----------- | ------------------- |
| Port             | 3000        | 3000                |
| Hot Reload       | Yes         | No                  |
| Source Maps      | Yes         | No                  |
| Dev Dependencies | All         | None                |
| Image Size       | ~200MB      | ~100MB              |
| Entry Point      | ts-node-dev | node dist/server.js |

## Dockerfile Explained

The Dockerfile uses a multi-stage build strategy to optimize image size and security.

### Stage 1: Base

```dockerfile
FROM node:lts-alpine as base
```

- Alpine Linux with Node.js LTS
- Sets working directory to `/app`
- Copies `package.json` and `package-lock.json` for dependency caching

### Stage 2: Development

```dockerfile
FROM base as development
```

- Installs all dependencies (including dev dependencies)
- Copies TypeScript configuration
- Runs with `ts-node-dev` for hot reload during development
- Used by `docker-compose.yml` for local development

### Stage 3: Production Dependencies

```dockerfile
FROM base as prod-deps
```

- Installs **only** production dependencies (`npm ci --only=production`)
- Creates a cacheable layer with just the runtime dependencies
- ~68 packages instead of ~140

### Stage 4: Builder

```dockerfile
FROM prod-deps as builder
```

- Extends `prod-deps` stage to reuse its cached `node_modules`
- Installs dev dependencies needed for compilation
- Compiles TypeScript to JavaScript in `dist/` directory

### Stage 5: Production

```dockerfile
FROM node:lts-alpine as production
```

- **Minimal runtime image** (~100MB)
- Copies only production `node_modules` from `prod-deps` stage
- Copies compiled JavaScript from `builder` stage
- No source code, no package files, no dev tools
- Runs with `node dist/server.js`

### Key Optimizations

| Technique           | Benefit                                                 |
| ------------------- | ------------------------------------------------------- |
| Multi-stage         | Separation of build and runtime environments            |
| Layer caching       | `package.json` changes trigger rebuild only when needed |
| Minimal base        | Alpine Linux is ~5MB vs ~100MB for full Debian          |
| No dev tools        | Production image has zero build dependencies            |
| Copy only artifacts | No source code or config files in final image           |

## Deployment

This application is deployed via GitHub Actions to AWS ECS. See the `iac/README.md` for full CI/CD documentation and required secrets configuration.

[![Build and Push](https://github.com/cswizard11/tv-devops-assessment/workflows/Build%20and%20Push%20Docker%20Image/badge.svg)](https://github.com/cswizard11/tv-devops-assessment/actions/workflows/build-and-push.yml)
