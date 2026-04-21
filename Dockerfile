# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Cache bust label — increment this to force Railway to rebuild from scratch
LABEL cache-bust="v4"

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy patches FIRST — pnpm needs them before install
COPY patches/ ./patches/

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (dev + prod needed for build)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build: Vite (frontend → dist/public) + esbuild (server → dist/index.js)
RUN pnpm run build

# Prune dev dependencies after build — leaves only production node_modules
RUN pnpm prune --prod

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Copy pruned node_modules from builder (no reinstall needed)
COPY --from=builder /app/node_modules ./node_modules

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Copy drizzle migration files (needed for schema reference at runtime)
COPY --from=builder /app/drizzle ./drizzle

# Copy package.json (needed by Node.js ESM runtime)
COPY --from=builder /app/package.json ./package.json

# Expose the port Railway will assign via $PORT
EXPOSE 3000

# Start the production server
CMD ["node", "dist/index.js"]
