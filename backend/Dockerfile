# Build stage
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Set executable permissions for node_modules binaries
RUN chmod -R +x node_modules/.bin

# Build with npm run
RUN npm run build

# Production stage
FROM node:22-bookworm-slim

WORKDIR /app

# Install dumb-init to handle signals properly
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init ca-certificates libgomp1 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Create uploads directory
RUN mkdir -p /app/uploads-propiedades

# Expose port
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
