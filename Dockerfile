# ---------- 构建阶段 ----------
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g pnpm \
    && pnpm config set registry https://registry.npmmirror.com

COPY . .

RUN pnpm install

ARG NEXT_PUBLIC_HOST
ENV NEXT_PUBLIC_HOST=$NEXT_PUBLIC_HOST


RUN pnpm run build


# ---------- 运行阶段 ----------
FROM node:20-alpine

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g pnpm \
    && pnpm config set registry https://registry.npmmirror.com

COPY --from=builder /app ./

ENV NODE_ENV=production
EXPOSE 3000

# 启动命令
CMD ["pnpm", "run", "dev"]
