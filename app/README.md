# Express TypeScript Application

A containerized Express.js + TypeScript application with local development and production deployment support.

## Prerequisites

- Docker (v24.0+ recommended)
- Docker Compose (v2.22+ for Docker Watch support)
- Node.js (v20 LTS) - only needed for local development without Docker

## Local Development

### Quick Start

Start the development server with hot reload:

    docker compose watch

The application will be available at http://localhost:3000.

### Development Features

- Hot Module Replacement: Changes to source files are automatically reflected
- Dependency Watching: Changes to package.json or package-lock.json trigger container rebuilds
- TypeScript Compilation: Automatic compilation with ts-node-dev

### Verify Installation

Health check endpoint:

    curl http://localhost:3000/health

Expected response: {"status":"healthy"}

Main endpoint:

    curl http://localhost:3000/

Expected response: Hello from Express + TypeScript!

## Production Build

### Build Production Image

Build production-optimized image:

    docker build --target production -t express-app:prod .

Run production container:

    docker run -d -p 3000:3000 --name express-prod express-app:prod

### Production Image Details

The production image is optimized for minimal size and security:

- Multi-stage build: TypeScript compiled in builder stage, only runtime artifacts in final image
- Production dependencies only: ~68 packages vs ~140 in development
- No source code: Only compiled JavaScript in dist/
- No package files: No package.json or package-lock.json in runtime image
- No dev tools: No TypeScript compiler, build tools, or dev dependencies

### Production Verification

Test health endpoint:

    curl http://localhost:3000/health

Check container contents:

    docker exec express-prod ls -la /app/

Should show: dist/ and node_modules/ only

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
