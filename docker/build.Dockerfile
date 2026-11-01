FROM node:22-bookworm-slim
RUN corepack enable && corepack prepare pnpm@11.23.0 --activate
ENV PNPM_STORE_DIR=/app/.pnpm-store
WORKDIR /app