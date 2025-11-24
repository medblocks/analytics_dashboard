FROM node:25-alpine3.21

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all source files
COPY . .

# Build the frontend
# NODE_ENV is set explicitly here to override any .env file value
# Vite automatically sets NODE_ENV=production during build, but we set it explicitly to avoid warnings
RUN NODE_ENV=production npm run build

# Expose port
EXPOSE 4000

# Start the server
CMD ["node", "server/index.js"]


