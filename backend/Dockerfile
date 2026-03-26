#
# Health Monitor Backend (NestJS)
# - Build bằng Node.js 18
# - Chạy production (chỉ copy dist + deps production)
#

# 1) Stage build: cài dev-deps và build TypeScript -> dist/
FROM node:18-alpine AS builder

WORKDIR /app

# Tận dụng cache Docker: chỉ copy package trước khi npm ci
COPY package.json package-lock.json ./
RUN npm ci

# Copy toàn bộ source để build
COPY . .
RUN npm run build

# 2) Stage runtime: image nhỏ hơn + chỉ cài deps production
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Cài deps production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy dist đã build từ stage trước
COPY --from=builder /app/dist ./dist

# Nest backend lắng nghe PORT (mặc định 3000)
EXPOSE 3000

# Chạy production
CMD ["npm", "run", "start:prod"]

