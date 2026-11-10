
FROM node:22-bookworm-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Build React frontend
RUN npm run build

# Production environment
ENV NODE_ENV=production

# Remove development dependencies
RUN npm prune --omit=dev

# Start Employee Portal Express server
CMD ["npm", "start"]
