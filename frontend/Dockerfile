FROM node:23-alpine AS base

# Install necessary packages for Alpine
RUN apk update && apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Install dependencies for all apps
COPY ./apps/auth/package.json ./apps/auth/
COPY ./apps/dashboard/package.json ./apps/dashboard/
COPY ./apps/product/package.json ./apps/product/
RUN yarn install

# Copy all app files
COPY ./apps/ ./apps/

# Build each application
RUN cd apps/auth && yarn build
RUN cd apps/dashboard && yarn build
RUN cd apps/product && yarn build

# Create a final stage to run the applications
FROM base AS runner
WORKDIR /app

# Copy built applications
COPY --from=base /app/apps/auth/. ./apps/auth/
COPY --from=base /app/apps/dashboard/. ./apps/dashboard/
COPY --from=base /app/apps/product/. ./apps/product/

# Set the command to run the desired app
CMD ["node", "apps/auth/dist/index.js"] 