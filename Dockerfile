# Multi-stage build for optimal image size
# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist ./dist

# Copy server code
COPY server ./server

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose the port
EXPOSE 4000

# Set production environment
ENV NODE_ENV=production

# Start the server
CMD ["node", "server/index.js"]

