FROM node:22-alpine

RUN npm install -g openclaw@latest --quiet

WORKDIR /app

EXPOSE 18789

CMD ["openclaw", "start"]
