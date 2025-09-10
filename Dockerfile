# Use official Node image
FROM node:18-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Build the Next.js application
COPY . .
RUN npm run build

# Production image
FROM node:18-alpine
WORKDIR /app
COPY --from=base /app .
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
