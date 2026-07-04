# Shared dev image for the Next.js apps (web + admin).
# Build context is the repo root. Deps are installed into the image; at runtime
# the source is bind-mounted while node_modules are preserved via volumes.
FROM node:22-slim

RUN corepack enable
WORKDIR /workspace

# Copy the whole workspace and install once (no lockfile yet -> fresh resolve).
COPY . .
RUN pnpm install

EXPOSE 3000
# Overridden per service (web / admin) in compose.
CMD ["pnpm", "--filter", "@usafe/web", "dev"]
