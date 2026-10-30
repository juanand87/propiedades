# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build arguments
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json ./
RUN npm ci

COPY . .

# Set executable permissions for node_modules binaries
RUN chmod -R +x node_modules/.bin

# Set Node options and build
ENV NODE_OPTIONS=--max_old_space_size=2048
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Set executable permissions
RUN chmod -R +x node_modules/.bin

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]

CMD ["npm", "start"]
