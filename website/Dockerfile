# Local development image. Runs the Astro dev server (which also serves the
# proxy endpoint in-process). Production deploys to Cloudflare Pages, not this image.
FROM node:22-alpine

WORKDIR /app

# Install deps first for layer caching.
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 4321
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
