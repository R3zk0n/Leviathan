FROM node:24-alpine
WORKDIR /app
COPY ./ui/package.json ./ui/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY ./ui /app
EXPOSE 3000
CMD ["yarn", "dev", "--host", "--port", "3000"]
