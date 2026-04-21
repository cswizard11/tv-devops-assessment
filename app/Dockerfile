# base layer to reduce duplication
FROM node:lts-alpine as base

WORKDIR /app

RUN apk update && apk upgrade

COPY package.json ./
COPY package-lock.json ./

FROM base as development

COPY tsconfig.json ./

RUN npm ci

EXPOSE 3000

CMD ["npm", "run", "dev"]

# production dependencies layer - shared between builder and production
FROM base as prod-deps

RUN npm ci --only=production

# build stage extends prod-deps to take advantage of its npm cache
FROM prod-deps as builder

COPY tsconfig.json ./
COPY src ./src

# this only downloads the additional dev packages (72 more)
RUN npm ci

RUN npm run build

FROM node:lts-alpine as production

WORKDIR /app

# copy just the production node_modules
COPY --from=prod-deps /app/node_modules ./node_modules

# copy the compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.js"]
