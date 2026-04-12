FROM node:20-slim

WORKDIR /app

# Copy server files
COPY prosalonpos-server/ ./prosalonpos-server/

# Install dependencies and run build
WORKDIR /app/prosalonpos-server
RUN npm install
RUN node scripts/build-railway.js

# Start server
CMD ["node", "src/server.js"]
