# ── Single stage build + run ─────────────────────────────────────────────────
# We keep all node_modules (including devDependencies) because the server
# bundle references vite at runtime for the static-file path resolution.
FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy patches FIRST — pnpm needs them before install
COPY patches/ ./patches/

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including devDeps needed at runtime)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build: Vite (frontend → dist/public) + esbuild (server → dist/index.js)
RUN pnpm run build

# Expose the port Railway will assign via $PORT
EXPOSE 3000

# Start the production server
CMD ["node", "dist/index.js"]
