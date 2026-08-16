# CommonPlace console for Fly. Build context is the CommonPlace repo root.
FROM node:22-bookworm

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/console ./apps/console
COPY packages ./packages
COPY .commonplace-canonical .commonplace-canonical

# NEXT_PUBLIC_* is inlined at `next build`. Runtime Fly secrets do not reach this step.
ARG NEXT_PUBLIC_CONSOLE_CHAT_URL=/api/chat/stream
ARG NEXT_PUBLIC_THEOREM_GATEWAY_URL=
ENV NEXT_PUBLIC_CONSOLE_CHAT_URL=$NEXT_PUBLIC_CONSOLE_CHAT_URL
ENV NEXT_PUBLIC_THEOREM_GATEWAY_URL=$NEXT_PUBLIC_THEOREM_GATEWAY_URL

RUN pnpm install --no-frozen-lockfile --filter @commonplace/console... \
  && pnpm --filter @commonplace/console run build:railway

EXPOSE 8080
CMD ["node", "apps/console/scripts/start-railway.mjs"]
