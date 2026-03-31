FROM node:20-slim

WORKDIR /app

# Dependencias del sistema para Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Instalar dependencias (incluyendo devDeps para poder buildear)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Prisma generate
COPY prisma ./prisma/
RUN ./node_modules/.bin/prisma generate

# Copiar fuente y buildear
COPY . .
RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --schema=schema.prisma && node dist/main"]
