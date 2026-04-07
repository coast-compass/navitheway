# Build stage
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
# Nginx default config is usually fine for basic SPA, but might need a custom one if routing (BrowserRouter) is used.
# For now, we'll use the default and let the user know if they need fallback routing.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
