FROM node:20-alpine3.19 as base

# Generate a partial monorepo for a target package. The output will be placed into a directory named "out"
FROM base AS prune
RUN apk update
RUN apk add --no-cache libc6-compat

WORKDIR /app
RUN npm install turbo --global
COPY . .
RUN turbo prune product --docker

# Responsible for creating an authentication between our dockerfile and the private gituhb repositories
FROM base AS authentication
WORKDIR /app
# This Step only installs Production & Dev dependencies
FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
# the /out/json contain the package.json file that is used to install packages related to the "product" 
COPY --from=prune /app/out/json/ .

RUN npm install

# This Step only installs Production dependencies only
FROM base AS installer-production
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
# the /out/json contain the package.json file that is used to install packages related to the "product" 
COPY --from=prune /app/out/json/ .

RUN npm install --only=production

# Uses the dev & production dependencies to make a production build
FROM base AS builder
WORKDIR /app
COPY --from=installer /app/node_modules /app/node_modules

# the /out/full contain the code files that is used to run the package "product" 
COPY --from=prune /app/out/full/ .

RUN npx turbo build --filter=product

# runner will use the builder output, and use only the node_modules for production to reduce the size of the final image
FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 product-group
RUN adduser --system --uid 1001 product-user
USER product-user

# Copy Production dependencies, build and public dirctories
COPY --from=installer-production --chown=product-user:product-group /app/node_modules /app/node_modules
COPY --from=prune   --chown=product-user:product-group /app/out/json/ .
COPY --from=builder --chown=product-user:product-group /app/apps/product/build /app/apps/product/build
COPY --from=builder --chown=product-user:product-group /app/apps/product/public /app/apps/product/public

WORKDIR /app/apps/product

CMD ["npm", "run", "start"]