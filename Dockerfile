FROM node:25-alpine3.21

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all source files
COPY . .

# Build the frontend
RUN npm run build

# Expose port
EXPOSE 4000

# Set production environment
ENV NODE_ENV=production

# Start the server
CMD ["node", "server/index.js"]


