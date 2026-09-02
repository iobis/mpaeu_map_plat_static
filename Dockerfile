# Multi-stage build: compile the static SvelteKit site, then serve it with a
# minimal nginx image. The site itself stays a plain static bundle (no Node
# runtime needed at serve time) — only the raster tiles now come from a
# separate backend (titiler, see docker-compose.yml).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Baked into the client JS bundle at build time (Vite/SvelteKit PUBLIC_ env
# convention) — must be the URL the *browser* will use, not an internal
# Docker network hostname.
ARG PUBLIC_TITILER_URL=http://localhost:8000
ENV PUBLIC_TITILER_URL=$PUBLIC_TITILER_URL

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
