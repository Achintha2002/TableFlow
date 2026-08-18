# Use Node.js optimized for ARM64 architecture (Apple Silicon)
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "src/server.js"]
